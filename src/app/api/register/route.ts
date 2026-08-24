import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, users } from "@/db";
import { hashPassword } from "@/utils/auth";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const { username, password, name } = body;

    if (!username || !username.trim()) {
      return NextResponse.json(
        { success: false, message: "用户名不能为空" },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { success: false, message: "密码长度不能少于 6 位" },
        { status: 400 }
      );
    }

    // 检查用户名是否已被注册
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.username, username.trim()))
      .get();

    if (existing) {
      return NextResponse.json(
        { success: false, message: "该用户名已被注册，请直接登录" },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(password);
    const userId = crypto.randomUUID();

    const newUser = {
      id: userId,
      username: username.trim(),
      password: hashedPassword,
      name: name?.trim() || username.trim(),
      avatar: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(users).values(newUser);

    return NextResponse.json({
      success: true,
      message: "注册成功，请前往登录",
      result: {
        userId: newUser.id,
        userName: newUser.name,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "注册服务异常",
      },
      { status: 500 }
    );
  }
}
