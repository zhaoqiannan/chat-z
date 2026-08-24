import { NextRequest, NextResponse } from "next/server";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { signToken } from "@/utils/auth";

export const POST = withAuth(async (req: NextRequest, currentUser: CurrentUser) => {
  try {
    const newAccessToken = await signToken({
      userId: currentUser.userId,
      username: currentUser.username,
      name: currentUser.name,
    }, 7 * 24 * 3600);

    return NextResponse.json({
      success: true,
      message: "刷新凭证成功",
      accessToken: newAccessToken,
      userId: currentUser.userId,
      userName: currentUser.name,
      result: {
        accessToken: newAccessToken,
        userId: currentUser.userId,
        userName: currentUser.name,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "刷新 Token 失败",
      },
      { status: 500 }
    );
  }
});
