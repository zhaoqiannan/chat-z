import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

  const token = req.cookies.get("auth_token")?.value;
  const isLogin = token === "true";

  let response: NextResponse;

  if (!isLogin && !isLoginPage) {
    response = NextResponse.redirect(new URL(`/login/`, req.url));
  } else if (isLogin && (pathname === "/" || pathname === "" || isLoginPage)) {
    response = NextResponse.redirect(new URL(`/home/`, req.url));
  } else {
    response = NextResponse.next();
    response.headers.set("x-current-path", pathname);
  }

  return response;
}
