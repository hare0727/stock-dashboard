import { NextRequest, NextResponse } from "next/server";

// Yahoo Finance から日本株の株価データを取得するAPIルート
export async function GET(req: NextRequest) {
  // クエリパラメータから銘柄コードを取得
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "銘柄コードが必要です" }, { status: 400 });
  }

  // 日本株（数字コード）は ".T" を付加、米国株（英字コード）はそのまま使用
  const symbol = /^\d+$/.test(code) ? `${code}.T` : code;

  // 過去1年間の日足データを取得（中長期分析用）
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`;

  try {
    const res = await fetch(url, {
      headers: {
        // ブラウザからのリクエストに見せることでブロックを回避
        "User-Agent": "Mozilla/5.0",
      },
      next: { revalidate: 3600 }, // 1時間キャッシュ
    });

    if (!res.ok) {
      throw new Error(`Yahoo Finance APIエラー: ${res.status}`);
    }

    const json = await res.json();
    const result = json?.chart?.result?.[0];

    if (!result) {
      return NextResponse.json({ error: "データが見つかりませんでした" }, { status: 404 });
    }

    // タイムスタンプとOHLC価格を取り出す
    const timestamps: number[] = result.timestamp;
    const ohlcv = result.indicators.quote[0];

    // lightweight-charts 用のフォーマットに変換
    const candles = timestamps
      .map((ts, i) => {
        const open = ohlcv.open[i];
        const high = ohlcv.high[i];
        const low = ohlcv.low[i];
        const close = ohlcv.close[i];

        // nullやNaNのデータは除外
        if (open == null || high == null || low == null || close == null) return null;

        // Unix秒タイムスタンプを YYYY-MM-DD 形式の文字列に変換
        const date = new Date(ts * 1000);
        const timeStr = date.toISOString().split("T")[0];

        return { time: timeStr, open, high, low, close };
      })
      .filter(Boolean); // nullを除外

    return NextResponse.json(candles);
  } catch (e) {
    console.error("株価取得エラー:", e);
    return NextResponse.json({ error: "データ取得に失敗しました" }, { status: 500 });
  }
}
