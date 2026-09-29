import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, uploadedFiles } from "@/db";
import { eq } from "drizzle-orm";

/**
  * GET: 直接按 ID 获取并渲染/下载已上传文件
  * 支持在新标签页中独立打开（图片直接预览，文档直接展示/下载）
  */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
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

    const base64Data = fileRecord.dataBase64;
    const buffer = Buffer.from(base64Data, "base64");
    let mimeType = fileRecord.mimeType || "application/octet-stream";
    const fileName = fileRecord.fileName || "file";
    const lowerName = fileName.toLowerCase();

    // 针对文本文件（txt、md、json、csv、log、xml等），明确附加 charset=utf-8，防止浏览器打开时产生中文乱码
    if (
      mimeType.startsWith("text/") ||
      lowerName.endsWith(".txt") ||
      lowerName.endsWith(".md") ||
      lowerName.endsWith(".markdown") ||
      lowerName.endsWith(".json") ||
      lowerName.endsWith(".csv") ||
      lowerName.endsWith(".log") ||
      lowerName.endsWith(".xml") ||
      lowerName.endsWith(".html") ||
      lowerName.endsWith(".htm")
    ) {
      if (lowerName.endsWith(".txt") || lowerName.endsWith(".log")) {
        mimeType = "text/plain; charset=utf-8";
      } else if (lowerName.endsWith(".md") || lowerName.endsWith(".markdown")) {
        mimeType = "text/markdown; charset=utf-8";
      } else if (lowerName.endsWith(".json")) {
        mimeType = "application/json; charset=utf-8";
      } else if (lowerName.endsWith(".csv")) {
        mimeType = "text/csv; charset=utf-8";
      } else if (lowerName.endsWith(".html") || lowerName.endsWith(".htm")) {
        mimeType = "text/html; charset=utf-8";
      } else if (!mimeType.toLowerCase().includes("charset")) {
        mimeType = `${mimeType}; charset=utf-8`;
      }
    }

    const encodedFileName = encodeURIComponent(fileName);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": buffer.length.toString(),
        "Content-Disposition": `inline; filename*=UTF-8''${encodedFileName}`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error: any) {
    console.error("Fetch file error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
