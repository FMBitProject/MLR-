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
  const page = (await db
    .select()
    .from(t.contentVersionPages)
    .where(eq(t.contentVersionPages.id, id))
    )[0];
  if (!page) return new Response("Not found", { status: 404 });

  return new Response(page.renderedSvg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "private, max-age=60",
    },
  });
}
