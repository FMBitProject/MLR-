import { eq } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// Lightweight poll target for the review workspace while the background AI
// claims check runs — much cheaper than re-rendering the whole page via
// router.refresh() on an interval.
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/versions/[versionId]/status">,
) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { versionId } = await ctx.params;
  const row = (
    await db
      .select({
        processingStatus: t.contentVersions.processingStatus,
        tenantId: t.contentSubmissions.tenantId,
      })
      .from(t.contentVersions)
      .innerJoin(
        t.contentSubmissions,
        eq(t.contentVersions.submissionId, t.contentSubmissions.id),
      )
      .where(eq(t.contentVersions.id, versionId))
  )[0];
  if (!row || row.tenantId !== user.tenantId) {
    return new Response("Not found", { status: 404 });
  }

  return Response.json(
    { processingStatus: row.processingStatus },
    { headers: { "Cache-Control": "no-store" } },
  );
}
