import { Redis } from "@upstash/redis";

// Upstash Redisクライアントの初期化
// 環境変数から接続情報を自動読み込み
export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// ウォッチリストを保存するキー名
export const WATCHLIST_KEY = "watchlist";
