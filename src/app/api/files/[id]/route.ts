import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, uploadedFiles } from "@/db";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/utils/auth";

const SAFE_INLINE_IMAGES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/**
 * GET: 鉴权下载/预览已上传文件（校验归属用户 + 禁止同源内联 HTML/SVG + 强制 nosniff 与沙箱 CSP）
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get("authorization");
    let token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader?.trim();
    if (!token) {
      token = req.cookies.get("access_token")?.value || "";
    }
    const payload = token ? await verifyToken(token) : null;
    if (!payload) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    const resolvedParams = await context.params;
    const fileId = Number(resolvedParams?.id);

    if (!fileId || isNaN(fileId)) {
      return new NextResponse("Invalid file ID", { status: 400 });
    }

    const fileRecord = await db
      .select()
      .from(uploadedFiles)
      .where(eq(uploadedFiles.id, fileId))
      .get();

    if (!fileRecord || !fileRecord.dataBase64) {
      return new NextResponse("File not found", { status: 404 });
    }

    if (!fileRecord.userId || fileRecord.userId !== payload.userId) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const buffer = Buffer.from(fileRecord.dataBase64, "base64");
    const fileName = fileRecord.fileName || "file";
    const baseMime = (fileRecord.mimeType || "application/octet-stream").split(";")[0].trim().toLowerCase();

    // 永远不允许 HTML / SVG / XML / JS 作为同源活跃内容内联渲染
    const isUnsafeActiveType =
      baseMime.includes("html") ||
      baseMime.includes("svg") ||
      baseMime.includes("xml") ||
      baseMime.includes("javascript");

    const responseMime = isUnsafeActiveType
      ? "application/octet-stream"
      : fileRecord.mimeType || "application/octet-stream";

    const disposition = !isUnsafeActiveType && SAFE_INLINE_IMAGES.has(baseMime) ? "inline" : "attachment";
    const encodedFileName = encodeURIComponent(fileName);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": responseMime,
        "Content-Length": buffer.length.toString(),
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodedFileName}`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error: any) {
    console.error("Fetch file error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
