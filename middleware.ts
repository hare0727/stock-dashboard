import { NextRequest, NextResponse } from "next/server";

// クッキーでアクセスを制限するミドルウェア
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ログインページとAPIは認証不要
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // 環境変数が未設定の場合はそのまま通す（ローカル開発用）
  const validPassword = process.env.BASIC_AUTH_PASSWORD;
  if (!validPassword) {
    return NextResponse.next();
  }

  // クッキーを確認する
  const auth = request.cookies.get("auth");
  if (auth?.value === "1") {
    return NextResponse.next();
  }

  // 未認証の場合はログインページへリダイレクト
  return NextResponse.redirect(new URL("/login", request.url));
}

// 静的ファイルや画像は認証対象から除外する
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
