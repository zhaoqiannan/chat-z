import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/utils/auth";

export const config = {
  matcher: ["/((?!api/proxy|_next/static|_next/image|favicon.ico).*)"],
};

const PUBLIC_LIST = ["/images", "/json", "/api", "/maps"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_LIST.some((publicPath) => pathname.startsWith(publicPath))) {
    return NextResponse.next();
  }

  const isLoginPage = pathname === "/login" || pathname === "/login/";
  const rawToken = req.cookies.get("access_token")?.value || "";
  const isLogin = Boolean(rawToken && (await verifyToken(rawToken)));

  if (!isLogin && !isLoginPage) {
    return NextResponse.redirect(new URL("/login/", req.url));
  }
  if (isLogin && (pathname === "/" || pathname === "" || isLoginPage)) {
    return NextResponse.redirect(new URL("/workspace/", req.url));
  }

  const response = NextResponse.next();
  response.headers.set("x-current-path", pathname);
  return response;
}
