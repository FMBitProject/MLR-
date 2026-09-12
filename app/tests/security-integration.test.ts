import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";

// Explicit opt-in to a disposable local database. Never load .env.local here.
const testUrl = process.env.SECURITY_TEST_DATABASE_URL;
test("security: PostgreSQL session, token, authorization and quota regressions", { skip: !testUrl }, async (suite) => {
  const url = new URL(testUrl!);
  assert.ok(
    ["127.0.0.1", "localhost"].includes(url.hostname) && /^\/mlr_security(?:_fresh)?$/.test(url.pathname),
    "Use a disposable LOCAL database named mlr_security or mlr_security_fresh",
  );
  process.env.DATABASE_URL = testUrl;
  process.env.AUTH_SECRET = "integration-test-only-secret-of-sufficient-length";
  const req = createRequire(import.meta.url);
  const cookieContext = new AsyncLocalStorage<{ value?: string; options?: Record<string, unknown> }>();
  function mock(name: string, exports: unknown) {
    const id = req.resolve(name);
    req.cache[id] = { id, filename: id, loaded: true, exports } as NodeModule;
  }
  mock("next/headers", {
    cookies: async () => ({
      get: () => cookieContext.getStore()?.value ? { value: cookieContext.getStore()!.value } : undefined,
      set: (_name: string, value: string, options: Record<string, unknown>) => Object.assign(cookieContext.getStore()!, { value, options }),
      delete: () => { cookieContext.getStore()!.value = undefined; },
    }), headers: async () => new Headers(),
  });
  mock("next/cache", { revalidatePath: () => {} });
  const afterJobs: Array<() => Promise<void>> = [];
  mock("next/server", { after: (job: () => Promise<void>) => { afterJobs.push(job); } }); // capture only; no email/AI calls
  let claimsFailure = false;
  mock("../src/lib/claims-check", { runClaimsCheck: async () => {
    if (claimsFailure) throw new Error("SIMULATED_CHECK_FAILURE");
    return 0;
  } });
  mock("next/navigation", { redirect: () => { throw new Error("TEST_REDIRECT"); } });
  const { db, t } = req("../src/lib/db") as typeof import("../src/lib/db");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const { eq, and } = await import("drizzle-orm");
  const { hashPassword } = req("../src/lib/password") as typeof import("../src/lib/password");
  const auth = req("../src/lib/auth") as typeof import("../src/lib/auth");
  const sessions = req("../src/lib/session-store") as typeof import("../src/lib/session-store");
  const tokens = req("../src/lib/account-tokens") as typeof import("../src/lib/account-tokens");
  const actions = req("../src/lib/actions") as typeof import("../src/lib/actions");
  const { insertSubmissionWithinQuota } = req("../src/lib/usage") as typeof import("../src/lib/usage");
  const { planLimits } = req("../src/lib/plans") as typeof import("../src/lib/plans");
  await migrate(db, { migrationsFolder: "src/lib/db/migrations" });
  const password = "Private-test-password", passwordHash = hashPassword(password);
  async function workspace(role = "super_admin") {
    const tenantId = randomUUID(), userId = randomUUID(), productId = randomUUID();
    await db.insert(t.tenants).values({ id: tenantId, slug: tenantId, name: "Security test", plan: "starter", createdAt: new Date() });
    await db.insert(t.users).values({ id: userId, tenantId, email: `${userId}@example.invalid`, name: "=1+1", role, passwordHash, emailVerifiedAt: new Date(), createdAt: new Date() });
    await db.insert(t.products).values({ id: productId, tenantId, name: "Product", createdAt: new Date() });
    return { tenantId, userId, productId };
  }
  function submission(w: Awaited<ReturnType<typeof workspace>>) {
    return { id: randomUUID(), tenantId: w.tenantId, productId: w.productId, submittedBy: w.userId, title: "Test", status: "in_review", currentStage: "medical_reviewer", createdAt: new Date() };
  }
  async function content(w: Awaited<ReturnType<typeof workspace>>) {
    const sub = submission(w), versionId = randomUUID(), elementId = randomUUID();
    await db.insert(t.contentSubmissions).values(sub);
    await db.insert(t.contentVersions).values({ id: versionId, submissionId: sub.id, versionNumber: 1, textContent: "Test text", createdAt: new Date() });
    await db.insert(t.contentElements).values({ id: elementId, versionId, pageNumber: 1, elementType: "text_block", extractionMethod: "native_text", extractedText: "Private tenant text" });
    await db.insert(t.contentVersionPages).values({ id: randomUUID(), versionId, pageNumber: 1, renderedSvg: "<svg/>", width: 100, height: 100 });
    return { sub, versionId, elementId };
  }
  const form = (values: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(values)) f.set(k, v); return f; };
  async function asUser<T>(userId: string, run: () => Promise<T>) {
    const [user] = await db.select().from(t.users).where(eq(t.users.id, userId));
    return cookieContext.run({ value: await sessions.issueSession(userId, user.passwordHash) }, run);
  }
  try {
    await suite.test("sessions: expired, logged-out, reset and legacy cookies are rejected", async () => {
      const w = await workspace();
      await cookieContext.run({}, async () => {
        const oldEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = "production";
        try { await auth.createSession(w.userId, passwordHash); } finally { process.env.NODE_ENV = oldEnv; }
        assert.equal(cookieContext.getStore()!.options?.secure, true);
        const captured = cookieContext.getStore()!.value!;
        assert.equal((await sessions.sessionUser(captured))?.id, w.userId);
        const [stored] = await db.select().from(t.sessions).where(eq(t.sessions.userId, w.userId));
        assert.notEqual(stored.tokenHash, captured);
        await auth.destroySession();
        assert.equal(await sessions.sessionUser(captured), null);
      });
      const expired = await sessions.issueSession(w.userId, passwordHash);
      await db.update(t.sessions).set({ expiresAt: new Date(Date.now() - 1) }).where(eq(t.sessions.userId, w.userId));
      assert.equal(await sessions.sessionUser(expired), null);
      assert.equal(await sessions.sessionUser(`${w.userId}.legacy-signature`), null);
      const live = await sessions.issueSession(w.userId, passwordHash);
      const token = await tokens.createAccountToken(w.userId, "reset");
      const [storedToken] = await db.select().from(t.accountTokens).where(eq(t.accountTokens.userId, w.userId));
      assert.equal(storedToken.tokenHash, createHash("sha256").update(token).digest("hex"));
      assert.notEqual(storedToken.tokenHash, token);
      assert.equal(await tokens.redeemAccountToken(token, "invite", "new-password-one"), null);
      const redeemed = await Promise.all([tokens.redeemAccountToken(token, "reset", "new-password-one"), tokens.redeemAccountToken(token, "reset", "new-password-two")]);
      assert.equal(redeemed.filter(Boolean).length, 1);
      assert.equal(await sessions.sessionUser(live), null);
      await assert.rejects(sessions.issueSession(w.userId, passwordHash), /UNAUTHENTICATED/);
      assert.equal(await tokens.findAccountToken(token), null);
    });
    await suite.test("comments: cross-tenant and wrong-version pins fail at action AND database", async () => {
      const a = await workspace(), b = await workspace();
      const own = await content(a), foreign = await content(b), other = await content(a);
      for (const elementId of [foreign.elementId, other.elementId]) {
        await assert.rejects(asUser(a.userId, () => actions.addComment(form({ versionId: own.versionId, elementId, comment: "Test" }))), /NOT_FOUND/);
        await assert.rejects(db.insert(t.reviewComments).values({ id: randomUUID(), versionId: own.versionId, elementId, reviewerId: a.userId, comment: "Test", createdAt: new Date() }));
      }
      await asUser(a.userId, () => actions.addComment(form({ versionId: own.versionId, elementId: own.elementId, comment: "Allowed" })));
      assert.equal((await db.select().from(t.reviewComments).where(eq(t.reviewComments.versionId, own.versionId))).length, 1);
    });
    await suite.test("review: pending-stage bypass, concurrent approval and terminal states", async () => {
      const w = await workspace(), c = await content(w), medical = randomUUID(), legal = randomUUID();
      await db.insert(t.reviewStages).values([
        { id: medical, submissionId: c.sub.id, stageOrder: 1, reviewerRole: "medical_reviewer", status: "in_progress" },
        { id: legal, submissionId: c.sub.id, stageOrder: 2, reviewerRole: "legal_reviewer", status: "pending" },
      ]);
      const decide = (id: string) => asUser(w.userId, () => actions.decideStage(form({ stageId: id, decision: "approved", password })));
      await assert.rejects(decide(legal), /FORBIDDEN/);
      const outcomes = await Promise.allSettled([decide(medical), decide(medical)]);
      assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
      let [sub] = await db.select().from(t.contentSubmissions).where(eq(t.contentSubmissions.id, c.sub.id));
      assert.equal(sub.status, "in_review"); assert.equal(sub.currentStage, "legal_reviewer");
      await decide(legal);
      [sub] = await db.select().from(t.contentSubmissions).where(eq(t.contentSubmissions.id, c.sub.id));
      assert.equal(sub.status, "approved");
      const [version] = await db.select().from(t.contentVersions).where(eq(t.contentVersions.id, c.versionId));
      assert.equal(version.isLocked, true);
      await assert.rejects(decide(legal), /FORBIDDEN/);
      const logs = await db.select().from(t.auditLog).where(and(eq(t.auditLog.tenantId, w.tenantId), eq(t.auditLog.action, "version_locked")));
      assert.equal(logs.length, 1);
    });
    await suite.test("quota: concurrent reservations and direct reuse cannot exceed the plan", async () => {
      const w = await workspace(), c = await content(w);
      await db.update(t.contentSubmissions).set({ status: "approved" }).where(eq(t.contentSubmissions.id, c.sub.id));
      const limit = planLimits("starter").submissionsPerMonth;
      await db.insert(t.contentSubmissions).values(Array.from({ length: limit - 2 }, () => submission(w)));
      const results = await Promise.allSettled([insertSubmissionWithinQuota(submission(w)), insertSubmissionWithinQuota(submission(w))]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      await assert.rejects(asUser(w.userId, () => actions.reuseApprovedContent(form({ submissionId: c.sub.id }))), /PLAN_LIMIT/);
      await assert.rejects(asUser(w.userId, () => actions.createSubmission(form({ title: "extra", productId: w.productId, text: "Test" }))), /PLAN_LIMIT/);
      assert.equal((await db.select().from(t.contentSubmissions).where(eq(t.contentSubmissions.tenantId, w.tenantId))).length, limit);
    });
    await suite.test("failed Office create/reuse rolls back content AND quota; valid retry succeeds", async () => {
      const JSZip = req("jszip");
      const zip = new JSZip();
      zip.file("word/document.xml", "<w:p><w:t>" + "x".repeat(1024 * 1024) + "</w:t></w:p>");
      const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
      const w = await workspace();
      const data = form({ title: "Rejected document", productId: w.productId });
      data.set("file", new File([bytes], "large.docx"));
      const jobsBefore = afterJobs.length;
      await assert.rejects(asUser(w.userId, () => actions.createSubmission(data)), /OFFICE_LIMIT/);
      assert.equal((await db.select().from(t.contentSubmissions).where(eq(t.contentSubmissions.tenantId, w.tenantId))).length, 0);
      assert.equal(afterJobs.length, jobsBefore);
      const source = await content(w);
      await db.update(t.contentSubmissions).set({ status: "approved" }).where(eq(t.contentSubmissions.id, source.sub.id));
      await db.update(t.contentVersions).set({ fileName: "large.docx", fileData: bytes, isLocked: true }).where(eq(t.contentVersions.id, source.versionId));
      await assert.rejects(asUser(w.userId, () => actions.reuseApprovedContent(form({ submissionId: source.sub.id }))), /OFFICE_LIMIT/);
      assert.equal((await db.select().from(t.contentSubmissions).where(eq(t.contentSubmissions.tenantId, w.tenantId))).length, 1);
      assert.equal(afterJobs.length, jobsBefore);
      await assert.rejects(asUser(w.userId, () => actions.createSubmission(form({ title: "Valid retry", productId: w.productId, text: "Valid text" }))), /TEST_REDIRECT/);
      assert.equal((await db.select().from(t.contentSubmissions).where(eq(t.contentSubmissions.tenantId, w.tenantId))).length, 2);
      assert.equal(afterJobs.length, jobsBefore + 2);
    });
    await suite.test("approval rejects processing, failed, missing pages/elements and missing master bytes", async () => {
      const w = await workspace(), c = await content(w), stageId = randomUUID();
      await db.insert(t.reviewStages).values({ id: stageId, submissionId: c.sub.id, stageOrder: 1, reviewerRole: "medical_reviewer", status: "in_progress" });
      const approve = () => asUser(w.userId, () => actions.decideStage(form({ stageId, decision: "approved", password })));
      for (const processingStatus of ["processing", "failed"]) {
        await db.update(t.contentVersions).set({ processingStatus }).where(eq(t.contentVersions.id, c.versionId));
        await assert.rejects(approve(), /VERSION_NOT_READY/);
      }
      await db.update(t.contentVersions).set({ processingStatus: "ready", fileName: "master.pdf" }).where(eq(t.contentVersions.id, c.versionId));
      await assert.rejects(approve(), /VERSION_INCOMPLETE/);
      await db.update(t.contentVersions).set({ fileData: Buffer.from("test-master") }).where(eq(t.contentVersions.id, c.versionId));
      await db.delete(t.contentVersionPages).where(eq(t.contentVersionPages.versionId, c.versionId));
      await assert.rejects(approve(), /VERSION_INCOMPLETE/);
      await db.insert(t.contentVersionPages).values({ id: randomUUID(), versionId: c.versionId, pageNumber: 1, renderedSvg: "<svg/>", width: 100, height: 100 });
      await db.delete(t.contentElements).where(eq(t.contentElements.versionId, c.versionId));
      await assert.rejects(approve(), /VERSION_INCOMPLETE/);
      await db.insert(t.contentElements).values({ id: c.elementId, versionId: c.versionId, pageNumber: 1, elementType: "text_block", extractionMethod: "native_text", extractedText: "Complete content" });
      await approve();
      const [sub] = await db.select().from(t.contentSubmissions).where(eq(t.contentSubmissions.id, c.sub.id));
      assert.equal(sub.status, "approved");
    });
    await suite.test("resubmit audit failure rolls back version and workflow, with no scheduled jobs", async () => {
      const w = await workspace(), c = await content(w), stageId = randomUUID();
      await db.insert(t.reviewStages).values({ id: stageId, submissionId: c.sub.id, stageOrder: 1, reviewerRole: "medical_reviewer", status: "changes_requested" });
      await db.update(t.contentSubmissions).set({ status: "changes_requested" }).where(eq(t.contentSubmissions.id, c.sub.id));
      const data = form({ submissionId: c.sub.id, text: "Revised text", changeNote: "Addressed feedback" });
      const jobsBefore = afterJobs.length;
      await globalThis.__mlrPool!.query("ALTER TABLE audit_log ADD CONSTRAINT review_probe CHECK (action <> 'resubmitted') NOT VALID");
      try {
        await assert.rejects(asUser(w.userId, () => actions.resubmitVersion(data)), /Failed query/);
      } finally {
        await globalThis.__mlrPool!.query("ALTER TABLE audit_log DROP CONSTRAINT review_probe");
      }
      assert.equal(afterJobs.length, jobsBefore);
      assert.equal((await db.select().from(t.contentVersions).where(eq(t.contentVersions.submissionId, c.sub.id))).length, 1);
      const [stage] = await db.select().from(t.reviewStages).where(eq(t.reviewStages.id, stageId));
      assert.equal(stage.status, "changes_requested");
      const [sub] = await db.select().from(t.contentSubmissions).where(eq(t.contentSubmissions.id, c.sub.id));
      assert.equal(sub.status, "changes_requested");
      await asUser(w.userId, () => actions.resubmitVersion(data));
      assert.equal((await db.select().from(t.contentVersions).where(eq(t.contentVersions.submissionId, c.sub.id))).length, 2);
      assert.equal(afterJobs.length, jobsBefore + 2);
    });
    await suite.test("background check failure stays unapproved and can be retried", async () => {
      const w = await workspace(), c = await content(w);
      const jobsBefore = afterJobs.length;
      await asUser(w.userId, () => actions.rerunClaimsCheck(form({ submissionId: c.sub.id })));
      claimsFailure = true;
      try { await afterJobs[jobsBefore](); } finally { claimsFailure = false; }
      let [version] = await db.select().from(t.contentVersions).where(eq(t.contentVersions.id, c.versionId));
      assert.equal(version.processingStatus, "failed");
      assert.equal(version.isLocked, false);
      const retryJob = afterJobs.length;
      await asUser(w.userId, () => actions.rerunClaimsCheck(form({ submissionId: c.sub.id })));
      await afterJobs[retryJob]();
      [version] = await db.select().from(t.contentVersions).where(eq(t.contentVersions.id, c.versionId));
      assert.equal(version.processingStatus, "ready");
    });
    await suite.test("concurrent recheck and final approval cannot mutate a locked version", async () => {
      const w = await workspace(), c = await content(w), stageId = randomUUID();
      await db.insert(t.reviewStages).values({ id: stageId, submissionId: c.sub.id, stageOrder: 1, reviewerRole: "medical_reviewer", status: "in_progress" });
      const results = await Promise.allSettled([
        asUser(w.userId, () => actions.decideStage(form({ stageId, decision: "approved", password }))),
        asUser(w.userId, () => actions.rerunClaimsCheck(form({ submissionId: c.sub.id }))),
      ]);
      assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
      const [version] = await db.select().from(t.contentVersions).where(eq(t.contentVersions.id, c.versionId));
      assert.equal(version.processingStatus, version.isLocked ? "ready" : "processing");
    });
  } finally { await globalThis.__mlrPool?.end(); }
});
