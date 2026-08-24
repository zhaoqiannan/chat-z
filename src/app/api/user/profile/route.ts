import { NextRequest, NextResponse } from "next/server";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, users } from "@/db";
import { eq } from "drizzle-orm";

export const GET = withAuth(async (req: NextRequest, currentUser: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const user = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        avatar: users.avatar,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, currentUser.userId))
      .get();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "用户不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      result: user,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "获取用户信息失败",
      },
      { status: 500 }
    );
  }
});
