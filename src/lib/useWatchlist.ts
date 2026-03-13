"use client";

import { useState, useEffect } from "react";

// 銘柄の型定義
export type Stock = {
  code: string;           // 銘柄コード（例：7203）
  name: string;           // 銘柄名（例：トヨタ自動車）
  purchasePrice?: number; // 購入単価（任意）
  shares?: number;        // 保有株数（任意）
  memo?: string;          // メモ（任意）
  alertPrice?: number;    // 価格アラートの目標価格（任意）
  alertDirection?: "above" | "below"; // アラートの方向（上抜け/下抜け）
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

  // 既存銘柄の情報を更新する（メモ・損益・アラートなど）
  const updateStock = async (code: string, patch: Partial<Stock>) => {
    const newList = watchlist.map((s) =>
      s.code === code ? { ...s, ...patch } : s
    );
    setWatchlist(newList);
    await saveToRedis(newList);
  };

  return { watchlist, addStock, removeStock, updateStock };
}
