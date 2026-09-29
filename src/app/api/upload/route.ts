import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, uploadedFiles } from "@/db";

async function ensureUploadedFilesTable(db: any) {
  try {
    await db.run(`CREATE TABLE IF NOT EXISTS uploaded_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size TEXT,
      data_base64 TEXT NOT NULL,
      created_at INTEGER
    )`);
  } catch (_) {}
}

/**
 * POST: 文件/图片统一持久化上传处理
 * 将文件存储到数据库 uploaded_files 表，并生成永久且可在新标签页直接打开的 URL: `/api/files/[id]`
 */
export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureUploadedFilesTable(db);

    const contentType = req.headers.get("content-type") || "";

    // 1. 处理 FormData 上传
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json(
          { success: false, message: "未检测到上传文件" },
          { status: 400 }
        );
      }

      // 限制 10MB
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, message: "文件大小不能超过 10MB" },
          { status: 400 }
        );
      }

      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      let mimeType = file.type || "application/octet-stream";
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith(".txt") || lowerName.endsWith(".log")) {
        mimeType = "text/plain; charset=utf-8";
      } else if (lowerName.endsWith(".md") || lowerName.endsWith(".markdown")) {
        mimeType = "text/markdown; charset=utf-8";
      } else if (lowerName.endsWith(".json")) {
        mimeType = "application/json; charset=utf-8";
      } else if (lowerName.endsWith(".csv")) {
        mimeType = "text/csv; charset=utf-8";
      }
      const sizeStr =
        file.size < 1024 * 1024
          ? `${(file.size / 1024).toFixed(1)} KB`
          : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

      const inserted = await db
        .insert(uploadedFiles)
        .values({
          userId: user.userId,
          fileName: file.name,
          mimeType,
          fileSize: sizeStr,
          dataBase64: base64,
          createdAt: new Date(),
        })
        .returning()
        .get();

      const fileUrl = `/api/files/${inserted.id}`;

      return NextResponse.json({
        success: true,
        url: fileUrl,
        fileId: inserted.id,
        fileName: file.name,
        fileSize: sizeStr,
        mimeType,
        message: "文件上传成功",
      });
    }

    // 2. 处理 JSON 传参 (如外链)
    const body = await req.json();
    if (body?.url) {
      return NextResponse.json({
        success: true,
        url: body.url,
        message: "文件链接保存成功",
      });
    }

    return NextResponse.json(
      { success: false, message: "无效的上传请求格式" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Upload file error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "文件上传失败" },
      { status: 500 }
    );
  }
});
