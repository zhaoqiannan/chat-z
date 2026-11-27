import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, users } from "@/db";
import { hashPassword } from "@/utils/auth";
import { parseJsonBody } from "@/utils/ownership";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const parsedBody = await parseJsonBody<{ username?: unknown; password?: unknown; name?: unknown }>(req);
    if (!parsedBody.ok) return parsedBody.response;
    const { username, password, name } = parsedBody.data;

    const cleanUsername = typeof username === "string" ? username.trim() : "";
    if (cleanUsername.length < 2 || cleanUsername.length > 64) {
      return NextResponse.json(
        { success: false, message: "用户名长度需在 2~64 个字符之间" },
        { status: 400 }
      );
    }

    if (typeof password !== "string" || password.length < 6 || password.length > 128) {
      return NextResponse.json(
        { success: false, message: "密码长度需在 6~128 位之间" },
        { status: 400 }
      );
    }

    const cleanName = typeof name === "string" && name.trim() ? name.trim().slice(0, 64) : cleanUsername;

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, cleanUsername))
      .get();

    if (existing) {
      return NextResponse.json(
        { success: false, message: "该用户名已被注册，请直接登录" },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(password);
    const userId = crypto.randomUUID();

    const newUser = {
      id: userId,
      username: cleanUsername,
      password: hashedPassword,
      name: cleanName,
      avatar: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(users).values(newUser);

    return NextResponse.json(
      {
        success: true,
        message: "注册成功，请前往登录",
        result: {
          userId: newUser.id,
          userName: newUser.name,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[API /api/register] Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "注册服务异常，请稍后重试",
      },
      { status: 500 }
    );
  }
}
