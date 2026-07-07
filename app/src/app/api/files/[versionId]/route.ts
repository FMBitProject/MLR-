import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/files/[versionId]">,
) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { versionId } = await ctx.params;
  const version = db
    .select({ version: t.contentVersions, sub: t.contentSubmissions })
    .from(t.contentVersions)
    .innerJoin(
      t.contentSubmissions,
      eq(t.contentVersions.submissionId, t.contentSubmissions.id),
    )
    .where(eq(t.contentVersions.id, versionId))
    .get();
  if (!version || version.sub.tenantId !== user.tenantId || !version.version.fileName) {
    return new Response("Not found", { status: 404 });
  }

  const filePath = path.join(process.cwd(), ".data", "uploads", versionId);
  if (!fs.existsSync(filePath)) return new Response("Not found", { status: 404 });

  const ext = path.extname(version.version.fileName).toLowerCase();
  return new Response(new Uint8Array(fs.readFileSync(filePath)), {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${version.version.fileName.replaceAll('"', "")}"`,
    },
  });
}
