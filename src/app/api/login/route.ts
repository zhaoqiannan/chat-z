import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, users } from "@/db";
import { verifyPassword, signToken } from "@/utils/auth";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: "用户名和密码不能为空" },
        { status: 400 }
      );
    }

    const user = await db
      .select()
      .from(users)
      .where(eq(users.username, username.trim()))
      .get();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "用户名或密码错误" },
        { status: 401 }
      );
    }

    const isMatch = await verifyPassword(password, user.password);
    if (!isMatch) {
      return NextResponse.json(
        { success: false, message: "用户名或密码错误" },
        { status: 401 }
      );
    }

    // 签发 7 天长效 Token
    const accessToken = await signToken({
      userId: user.id,
      username: user.username,
      name: user.name || user.username,
    }, 7 * 24 * 3600);

    const response = NextResponse.json({
      success: true,
      message: "登录成功",
      accessToken, // 兼容前端 rest.ts 的 updateSession
      userId: user.id,
      userName: user.name || user.username,
      result: {
        accessToken,
        userId: user.id,
        userName: user.name || user.username,
      },
    });

    // 同时种下 auth_token cookie
    response.cookies.set("auth_token", "true", {
      path: "/",
      httpOnly: false,
      maxAge: 7 * 24 * 3600,
      sameSite: "lax",
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "登录服务异常",
      },
      { status: 500 }
    );
  }
}
