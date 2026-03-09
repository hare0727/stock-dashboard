import { NextRequest, NextResponse } from "next/server";
import { redis, WATCHLIST_KEY } from "@/lib/redis";
import { Stock } from "@/lib/useWatchlist";

// ウォッチリストを取得する
export async function GET() {
  try {
    const data = await redis.get<Stock[]>(WATCHLIST_KEY);
    return NextResponse.json(data ?? []);
  } catch (e) {
    console.error("ウォッチリスト取得エラー:", e);
    return NextResponse.json([], { status: 500 });
  }
}

// ウォッチリストを保存する
export async function POST(req: NextRequest) {
  try {
    const body: Stock[] = await req.json();
    await redis.set(WATCHLIST_KEY, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("ウォッチリスト保存エラー:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
