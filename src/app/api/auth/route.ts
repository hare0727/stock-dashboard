import { NextRequest, NextResponse } from "next/server";

// パスワードを検証してクッキーをセットするAPI
export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const validPassword = process.env.BASIC_AUTH_PASSWORD;

  if (!validPassword || password !== validPassword) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // 認証成功：クッキーをセットする
  const res = NextResponse.json({ ok: true });
  res.cookies.set("auth", "1", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 30, // 30日間有効
  });
  return res;
}
