import { NextRequest, NextResponse } from "next/server";
import { withAuth, CurrentUser } from "@/utils/serverAuth";

/**
 * POST: 图片上传处理
 * 支持 FormData 或 JSON 格式，转换为标准 URL / DataURL 供页面与数据库持久化使用
 */
export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
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

      // 限制 5MB
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, message: "图片大小不能超过 5MB" },
          { status: 400 }
        );
      }

      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      const mimeType = file.type || "image/jpeg";
      const dataUrl = `data:${mimeType};base64,${base64}`;

      return NextResponse.json({
        success: true,
        url: dataUrl,
        message: "图片上传成功",
      });
    }

    // 2. 处理 JSON 传参 (如外链或 Base64)
    const body = await req.json();
    if (body?.url) {
      return NextResponse.json({
        success: true,
        url: body.url,
        message: "图片链接保存成功",
      });
    }

    return NextResponse.json(
      { success: false, message: "无效的上传请求格式" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Upload image error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "图片上传失败" },
      { status: 500 }
    );
  }
});
