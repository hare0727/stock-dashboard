import { NextRequest, NextResponse } from 'next/server'

// Basic認証でサイト全体をパスワード保護する
export function middleware(request: NextRequest) {
  // 環境変数からパスワードを取得
  const validPassword = process.env.BASIC_AUTH_PASSWORD
  if (!validPassword) {
    // 環境変数が未設定の場合はそのまま通す（ローカル開発用）
    return NextResponse.next()
  }

  // リクエストのAuthorizationヘッダーを確認する
  const authHeader = request.headers.get('authorization')
  if (authHeader) {
    // "Basic xxxxx" の形式をデコードする
    const base64 = authHeader.split(' ')[1]
    const decoded = Buffer.from(base64, 'base64').toString('utf-8')
    const [, password] = decoded.split(':')

    // パスワードが正しければ通す
    if (password === validPassword) {
      return NextResponse.next()
    }
  }

  // 未認証の場合はパスワード入力を求める
  return new NextResponse('認証が必要です', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="株ダッシュボード"',
    },
  })
}

// 静的ファイルや画像は認証対象から除外する
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
