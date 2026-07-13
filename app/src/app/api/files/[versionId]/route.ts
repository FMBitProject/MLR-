import { eq } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { mimeForFileName } from "@/lib/mime";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/files/[versionId]">,
) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { versionId } = await ctx.params;
  const version = (await db
    .select({ version: t.contentVersions, sub: t.contentSubmissions })
    .from(t.contentVersions)
    .innerJoin(
      t.contentSubmissions,
      eq(t.contentVersions.submissionId, t.contentSubmissions.id),
    )
    .where(eq(t.contentVersions.id, versionId))
    )[0];
  if (!version || version.sub.tenantId !== user.tenantId || !version.version.fileName) {
    return new Response("Not found", { status: 404 });
  }

  const data = await storage.get(versionId);
  if (!data) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": mimeForFileName(version.version.fileName),
      "Content-Disposition": `attachment; filename="${version.version.fileName.replaceAll('"', "")}"`,
    },
  });
}
