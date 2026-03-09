"use client";

import { useState, useEffect } from "react";

// 銘柄の型定義
export type Stock = {
  code: string;   // 銘柄コード（例：7203）
  name: string;   // 銘柄名（例：トヨタ自動車）
};

// ウォッチリストの管理フック（Redisに永続化）
export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<Stock[]>([]);

  // ページ読み込み時にRedisからウォッチリストを取得
  useEffect(() => {
    const fetchWatchlist = async () => {
      try {
        const res = await fetch("/api/watchlist");
        const data: Stock[] = await res.json();
        setWatchlist(data);
      } catch (e) {
        console.error("ウォッチリスト読み込みエラー:", e);
      }
    };
    fetchWatchlist();
  }, []);

  // Redisにウォッチリストを保存する
  const saveToRedis = async (list: Stock[]) => {
    try {
      await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(list),
      });
    } catch (e) {
      console.error("ウォッチリスト保存エラー:", e);
    }
  };

  // 銘柄を追加する
  const addStock = async (stock: Stock) => {
    // 同じ銘柄コードが既にある場合は追加しない
    if (watchlist.some((s) => s.code === stock.code)) return;
    const newList = [...watchlist, stock];
    setWatchlist(newList);
    await saveToRedis(newList);
  };

  // 銘柄を削除する
  const removeStock = async (code: string) => {
    const newList = watchlist.filter((s) => s.code !== code);
    setWatchlist(newList);
    await saveToRedis(newList);
  };

  return { watchlist, addStock, removeStock };
}
