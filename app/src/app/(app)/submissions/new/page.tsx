import { eq } from "drizzle-orm";
import { Lock } from "lucide-react";
import { db, t } from "@/lib/db";
import { requireUser, SUBMITTER_ROLES } from "@/lib/auth";
import { submissionQuota } from "@/lib/usage";
import { getDict } from "@/lib/i18n-server";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { SubmissionForm } from "@/components/submission-form";

export default async function NewSubmissionPage() {
  const user = await requireUser();
  const { dict } = await getDict();

  if (!SUBMITTER_ROLES.includes(user.role as (typeof SUBMITTER_ROLES)[number])) {
    return (
      <div className="animate-fade-up">
        <PageHeader title={dict.newSubmission.title} subtitle={dict.newSubmission.subtitle} />
        <Card>
          <EmptyState
            icon={<Lock className="size-6 text-slate-300" />}
            text={dict.newSubmission.submitterOnly}
          />
        </Card>
      </div>
    );
  }

  const products = await db
    .select({ id: t.products.id, name: t.products.name })
    .from(t.products)
    .where(eq(t.products.tenantId, user.tenantId));

  const templates = await db
    .select()
    .from(t.workflowTemplates)
    .where(eq(t.workflowTemplates.tenantId, user.tenantId));
  const workflows = Object.fromEntries(templates.map((w) => [w.channel, w.stages]));

  const tenant = (await db.select().from(t.tenants).where(eq(t.tenants.id, user.tenantId)))[0];
  const { used, limit } = await submissionQuota(user.tenantId, tenant?.plan);
  // Infinity doesn't survive server→client serialization — null = unlimited.
  const quota = { used, limit: Number.isFinite(limit) ? limit : null };

  return (
    <div className="animate-fade-up">
      <PageHeader title={dict.newSubmission.title} subtitle={dict.newSubmission.subtitle} />
      <SubmissionForm dict={dict} products={products} workflows={workflows} quota={quota} />
    </div>
  );
}
