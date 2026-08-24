import { NextRequest, NextResponse } from "next/server";
import { verifyToken, JWTPayload } from "@/utils/auth";

export interface CurrentUser {
  userId: string;
  username: string;
  name?: string;
  rawToken?: string;
}

/**
 * 服务端鉴权高阶函数
 */
export function withAuth(
  handler: (req: NextRequest, user: CurrentUser) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    try {
      const authHeader = req.headers.get("authorization");
      const token = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : authHeader?.trim();

      if (!token) {
        return NextResponse.json(
          {
            success: false,
            message: "未提供访问凭证或登录已过期，请重新登录",
          },
          { status: 401 }
        );
      }

      // 验证并解析 token
      const payload: JWTPayload | null = await verifyToken(token);
      if (!payload) {
        return NextResponse.json(
          {
            success: false,
            message: "登录凭证无效或已过期，请重新登录",
          },
          { status: 401 }
        );
      }

      const user: CurrentUser = {
        userId: payload.userId,
        username: payload.username,
        name: payload.name || payload.username,
        rawToken: token,
      };

      return await handler(req, user);
    } catch (error: any) {
      return NextResponse.json(
        {
          success: false,
          message: error?.message || "服务器鉴权内部异常",
        },
        { status: 500 }
      );
    }
  };
}

