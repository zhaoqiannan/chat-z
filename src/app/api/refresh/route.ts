import { NextRequest, NextResponse } from "next/server";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { signToken } from "@/utils/auth";

export const POST = withAuth(async (_req: NextRequest, currentUser: CurrentUser) => {
  try {
    const maxAge = 7 * 24 * 3600;
    const newAccessToken = await signToken({
      userId: currentUser.userId,
      username: currentUser.username,
      name: currentUser.name,
    }, maxAge);

    const response = NextResponse.json({
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

    response.cookies.set("access_token", newAccessToken, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge,
      sameSite: "lax",
    });

    return response;
  } catch (error: any) {
    console.error("[API /api/refresh] Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "刷新凭证失败，请重新登录",
      },
      { status: 500 }
    );
  }
});
