import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";

// シグナル履歴の1件のデータ型
export type SignalRecord = {
  id: string;             // 重複防止ID（日付-銘柄コード-種類）
  date: string;           // シグナル発生日 YYYY-MM-DD
  stockCode: string;      // 銘柄コード
  stockName: string;      // 銘柄名
  signalType: "buy" | "sell" | "mixed"; // 買い・売り・混合
  signals: string[];      // 発生したシグナル名リスト
  signalCount: number;    // シグナル数
  priceAtSignal: number;  // シグナル発生時の価格
  price1w: number | null; // 1週間後の価格
  price2w: number | null; // 2週間後の価格
  price3w: number | null; // 3週間後の価格
  price1m: number | null; // 1ヶ月後の価格
};

// Redisのキー名
const HISTORY_KEY = "signal_history";

// 履歴を取得する
export async function GET() {
  try {
    const data = await redis.get<SignalRecord[]>(HISTORY_KEY);
    return NextResponse.json(data ?? []);
  } catch (e) {
    console.error("シグナル履歴取得エラー:", e);
    return NextResponse.json([], { status: 500 });
  }
}

// 履歴を保存する（全件上書き）
export async function POST(req: NextRequest) {
  try {
    const body: SignalRecord[] = await req.json();
    await redis.set(HISTORY_KEY, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("シグナル履歴保存エラー:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
