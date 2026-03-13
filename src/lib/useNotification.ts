"use client";

import { Signal } from "./signals";
import { Stock } from "./useWatchlist";

// ブラウザ通知の許可を取得して、シグナルが出た時に通知するフック
export function useNotification() {

  // 通知許可をリクエストする
  const requestPermission = async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
  };

  // シグナル検出時にブラウザ通知を送る
  const notify = (stock: Stock, signals: Signal[]) => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (signals.length === 0) return;

    // 買いシグナルと売りシグナルを分類
    const buyCount = signals.filter((s) => s.type === "buy").length;
    const sellCount = signals.filter((s) => s.type === "sell").length;

    let title = "";
    let body = "";

    if (buyCount > 0 && sellCount > 0) {
      // 買い・売り両方あるケース
      title = `📊 ${stock.name} にシグナル`;
      body = `買い${buyCount}個・売り${sellCount}個の指標が一致`;
    } else if (buyCount > 0) {
      title = `📈 ${stock.name} 買いシグナル`;
      body = `${buyCount}個の買い指標が一致: ${signals.map((s) => s.name).join("、")}`;
    } else {
      title = `📉 ${stock.name} 売りシグナル`;
      body = `${sellCount}個の売り指標が一致: ${signals.map((s) => s.name).join("、")}`;
    }

    new Notification(title, {
      body,
      icon: "/favicon.ico",
    });
  };

  // 価格アラート通知を送る（設定価格を上抜け・下抜けしたとき）
  const notifyPriceAlert = (
    stock: Stock,
    currentPrice: number,
    alertPrice: number,
    direction: "above" | "below"
  ) => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const arrow = direction === "above" ? "▲" : "▼";
    const label = direction === "above" ? "上抜け" : "下抜け";
    new Notification(`🔔 ${stock.name} 価格アラート`, {
      body: `${arrow} ¥${currentPrice.toLocaleString()} が設定価格 ¥${alertPrice.toLocaleString()} を${label}しました`,
      icon: "/favicon.ico",
    });
  };

  return { requestPermission, notify, notifyPriceAlert };
}
