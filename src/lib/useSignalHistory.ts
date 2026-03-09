"use client";

import { useState, useEffect } from "react";
import { Signal } from "./signals";
import { Stock } from "./useWatchlist";

// シグナル履歴1件の型
export type SignalRecord = {
  id: string;
  date: string;
  stockCode: string;
  stockName: string;
  signalType: "buy" | "sell" | "mixed";
  signals: string[];
  signalCount: number;
  priceAtSignal: number;
  price1w: number | null;
  price2w: number | null;
  price3w: number | null;
  price1m: number | null;
};

// 勝率集計の型
export type SignalStat = {
  period: "price1w" | "price2w" | "price3w" | "price1m";
  label: string;
  buyWinRate: number | null;
  sellWinRate: number | null;
  totalWinRate: number | null;
  buyCount: number;
  sellCount: number;
};

// ローソク足データの型
type Candle = { time: string; close: number };

// 日付文字列にN日加算する
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

// ローソク足から指定日以降で最初の取引日の終値を返す
function findPrice(candles: Candle[], targetDate: string): number | null {
  const c = candles.find((c) => c.time >= targetDate);
  return c ? c.close : null;
}

// シグナル履歴の管理フック
export function useSignalHistory() {
  const [history, setHistory] = useState<SignalRecord[]>([]);

  // マウント時に履歴を読み込む
  useEffect(() => {
    loadHistory();
  }, []);

  // Redisから履歴を取得する
  const loadHistory = async () => {
    try {
      const res = await fetch("/api/signal-history");
      const data: SignalRecord[] = await res.json();
      setHistory(data);
      return data;
    } catch (e) {
      console.error("シグナル履歴読み込みエラー:", e);
      return [];
    }
  };

  // Redisに履歴を保存する
  const saveHistory = async (list: SignalRecord[]) => {
    try {
      await fetch("/api/signal-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(list),
      });
    } catch (e) {
      console.error("シグナル履歴保存エラー:", e);
    }
  };

  // シグナルを記録する（同日・同銘柄・同種は重複しない）
  const addRecord = async (stock: Stock, signals: Signal[], price: number) => {
    const today = new Date().toISOString().split("T")[0];
    const buyCount = signals.filter((s) => s.type === "buy").length;
    const sellCount = signals.filter((s) => s.type === "sell").length;
    const signalType: SignalRecord["signalType"] =
      buyCount > sellCount ? "buy" : sellCount > buyCount ? "sell" : "mixed";

    // 重複チェック用のID
    const id = `${today}-${stock.code}-${signalType}`;

    // 最新の履歴を取得して重複チェック
    const current = await loadHistory();
    if (current.some((r) => r.id === id)) return;

    const newRecord: SignalRecord = {
      id,
      date: today,
      stockCode: stock.code,
      stockName: stock.name,
      signalType,
      signals: signals.map((s) => s.name),
      signalCount: signals.length,
      priceAtSignal: price,
      price1w: null,
      price2w: null,
      price3w: null,
      price1m: null,
    };

    const updated = [...current, newRecord];
    setHistory(updated);
    await saveHistory(updated);
  };

  // 過去シグナルの価格を更新する（モーダルを開いたときに呼ぶ）
  const updatePrices = async () => {
    const today = new Date().toISOString().split("T")[0];
    const current = await loadHistory();

    // 未確定の価格がある記録を対象にする
    const needsUpdate = current.filter(
      (r) =>
        r.price1w === null ||
        r.price2w === null ||
        r.price3w === null ||
        r.price1m === null
    );
    if (needsUpdate.length === 0) {
      setHistory(current);
      return;
    }

    // 更新対象の銘柄データを一括取得（重複なし）
    const uniqueCodes = [...new Set(needsUpdate.map((r) => r.stockCode))];
    const stockDataMap: Record<string, Candle[]> = {};

    await Promise.all(
      uniqueCodes.map(async (code) => {
        try {
          const res = await fetch(`/api/stock?code=${code}`);
          stockDataMap[code] = await res.json();
        } catch {}
      })
    );

    // 各記録の価格を更新する
    const updated = current.map((record) => {
      const candles = stockDataMap[record.stockCode];
      // データ未取得 or 全価格確定済みはスキップ
      if (
        !candles ||
        (record.price1w !== null &&
          record.price2w !== null &&
          record.price3w !== null &&
          record.price1m !== null)
      ) {
        return record;
      }

      // 各期間の目標日を計算
      const d1w = addDays(record.date, 7);
      const d2w = addDays(record.date, 14);
      const d3w = addDays(record.date, 21);
      const d1m = addDays(record.date, 30);

      return {
        ...record,
        // 目標日を過ぎていれば価格を取得、まだなら null のまま
        price1w: record.price1w ?? (d1w <= today ? findPrice(candles, d1w) : null),
        price2w: record.price2w ?? (d2w <= today ? findPrice(candles, d2w) : null),
        price3w: record.price3w ?? (d3w <= today ? findPrice(candles, d3w) : null),
        price1m: record.price1m ?? (d1m <= today ? findPrice(candles, d1m) : null),
      };
    });

    setHistory(updated);
    await saveHistory(updated);
  };

  // 期間別の勝率を集計する
  const calcStats = (data: SignalRecord[] = history): SignalStat[] => {
    const periods: SignalStat["period"][] = ["price1w", "price2w", "price3w", "price1m"];
    const labels: Record<SignalStat["period"], string> = {
      price1w: "1週後",
      price2w: "2週後",
      price3w: "3週後",
      price1m: "1ヶ月後",
    };

    return periods.map((period) => {
      // 価格が確定している買い・売り記録のみ対象
      const buyRecords = data.filter(
        (r) => r.signalType === "buy" && r[period] !== null
      );
      const sellRecords = data.filter(
        (r) => r.signalType === "sell" && r[period] !== null
      );

      // 勝ち = 買いで上昇 / 売りで下落
      const buyWins = buyRecords.filter(
        (r) => (r[period] as number) > r.priceAtSignal
      ).length;
      const sellWins = sellRecords.filter(
        (r) => (r[period] as number) < r.priceAtSignal
      ).length;

      const totalConfirmed = buyRecords.length + sellRecords.length;
      const totalWins = buyWins + sellWins;

      return {
        period,
        label: labels[period],
        buyWinRate: buyRecords.length > 0 ? Math.round((buyWins / buyRecords.length) * 100) : null,
        sellWinRate: sellRecords.length > 0 ? Math.round((sellWins / sellRecords.length) * 100) : null,
        totalWinRate: totalConfirmed > 0 ? Math.round((totalWins / totalConfirmed) * 100) : null,
        buyCount: buyRecords.length,
        sellCount: sellRecords.length,
      };
    });
  };

  return { history, addRecord, updatePrices, calcStats };
}
