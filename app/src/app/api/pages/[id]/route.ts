import { eq } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/pages/[id]">,
) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const row = (await db
    .select({ page: t.contentVersionPages, tenantId: t.contentSubmissions.tenantId })
    .from(t.contentVersionPages)
    .innerJoin(t.contentVersions, eq(t.contentVersionPages.versionId, t.contentVersions.id))
    .innerJoin(t.contentSubmissions, eq(t.contentVersions.submissionId, t.contentSubmissions.id))
    .where(eq(t.contentVersionPages.id, id))
    )[0];
  if (!row || row.tenantId !== user.tenantId) return new Response("Not found", { status: 404 });
  const page = row.page;

  return new Response(page.renderedSvg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "private, max-age=60",
    },
  });
}
