import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, users } from "@/db";
import { verifyPassword, signToken, isLegacyPasswordHash, hashPassword } from "@/utils/auth";
import { parseJsonBody } from "@/utils/ownership";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const parsedBody = await parseJsonBody<{ username?: string; password?: string }>(req);
    if (!parsedBody.ok) return parsedBody.response;
    const { username, password } = parsedBody.data;

    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
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

    // 存量旧版无盐哈希在登录成功后无感升级为 PBKDF2
    if (isLegacyPasswordHash(user.password)) {
      try {
        const upgradedHash = await hashPassword(password);
        await db.update(users).set({ password: upgradedHash }).where(eq(users.id, user.id)).run();
      } catch (upgradeErr) {
        console.warn("[login] 密码哈希升级失败:", upgradeErr);
      }
    }

    const maxAge = 7 * 24 * 3600;
    const accessToken = await signToken({
      userId: user.id,
      username: user.username,
      name: user.name || user.username,
    }, maxAge);

    const response = NextResponse.json({
      success: true,
      message: "登录成功",
      accessToken,
      userId: user.id,
      userName: user.name || user.username,
      result: {
        accessToken,
        userId: user.id,
        userName: user.name || user.username,
      },
    });

    response.cookies.set("access_token", accessToken, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge,
      sameSite: "lax",
    });
    response.cookies.delete("auth_token");

    return response;
  } catch (error: any) {
    console.error("[API /api/login] Error:", error);
    return NextResponse.json(
      { success: false, message: "登录服务异常，请稍后重试" },
      { status: 500 }
    );
  }
}
