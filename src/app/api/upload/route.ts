import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, uploadedFiles } from "@/db";
import { isSafeUrl, parseJsonBody } from "@/utils/ownership";

// Cloudflare D1 单行上限约 1MB，Base64 膨胀约 1.33 倍，因此二进制文件限制 700KB 以内
const MAX_D1_FILE_BYTES = 700 * 1024;

const ALLOWED_EXT_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".log": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".markdown": "text/markdown; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function getSafeMimeType(fileName: string): string | null {
  const lower = fileName.toLowerCase().trim();
  const dotIdx = lower.lastIndexOf(".");
  if (dotIdx === -1) return null;
  const ext = lower.slice(dotIdx);
  return ALLOWED_EXT_MIME[ext] || null;
}

function matchesBinaryMagicBytes(mimeType: string, bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  if (mimeType === "image/png") {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  if (mimeType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/gif") {
    return bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38;
  }
  if (mimeType === "image/webp") {
    return (
      bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    );
  }
  if (mimeType === "application/pdf") {
    return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  }
  return true;
}

/**
 * POST: 文件/图片持久化上传（严格白名单防同源 XSS + D1 尺寸安全校验）
 */
export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ success: false, message: "未检测到上传文件" }, { status: 400 });
      }

      if (file.size <= 0 || file.size > MAX_D1_FILE_BYTES) {
        return NextResponse.json(
          { success: false, message: "受数据库单行容量限制，单个文件大小不能超过 700 KB" },
          { status: 400 }
        );
      }

      const safeMimeType = getSafeMimeType(file.name);
      if (!safeMimeType) {
        return NextResponse.json(
          { success: false, message: "不支持的文件类型（仅允许常见位图、PDF、TXT、Markdown、JSON、CSV 及 Office 文档）" },
          { status: 400 }
        );
      }

      const buffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      if (!matchesBinaryMagicBytes(safeMimeType, uint8)) {
        return NextResponse.json(
          { success: false, message: "文件内容与扩展名不匹配，请上传有效文件" },
          { status: 400 }
        );
      }
      const base64 = Buffer.from(buffer).toString("base64");
      const sizeStr = `${(file.size / 1024).toFixed(1)} KB`;

      const inserted = await db
        .insert(uploadedFiles)
        .values({
          userId: user.userId,
          fileName: file.name,
          mimeType: safeMimeType,
          fileSize: sizeStr,
          dataBase64: base64,
          createdAt: new Date(),
        })
        .returning()
        .get();

      return NextResponse.json({
        success: true,
        url: `/api/files/${inserted.id}`,
        fileId: inserted.id,
        fileName: file.name,
        fileSize: sizeStr,
        mimeType: safeMimeType,
        message: "文件上传成功",
      });
    }

    const parsedBody = await parseJsonBody<{ url?: string }>(req);
    if (!parsedBody.ok) return parsedBody.response;
    if (parsedBody.data.url) {
      if (!isSafeUrl(parsedBody.data.url)) {
        return NextResponse.json(
          { success: false, message: "仅支持 http(s) 或站内安全文件链接" },
          { status: 400 }
        );
      }
      return NextResponse.json({
        success: true,
        url: parsedBody.data.url.trim(),
        message: "文件链接保存成功",
      });
    }

    return NextResponse.json({ success: false, message: "无效的上传请求格式" }, { status: 400 });
  } catch (error: any) {
    console.error("Upload file error:", error);
    return NextResponse.json({ success: false, message: "文件上传失败，请稍后重试" }, { status: 500 });
  }
});
