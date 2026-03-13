"use client";

import { useState, useEffect } from "react";
import { useWatchlist } from "@/lib/useWatchlist";
import StockCard from "@/components/StockCard";
import AddStockModal from "@/components/AddStockModal";
import SignalHistoryModal from "@/components/SignalHistoryModal";
import { useNotification } from "@/lib/useNotification";
import { useSignalHistory } from "@/lib/useSignalHistory";
import { Signal } from "@/lib/signals";

// ソート種別
type SortType = "default" | "signals" | "buy" | "sell";

export default function Home() {
  // 銘柄追加モーダルの表示状態
  const [showModal, setShowModal] = useState(false);
  // シグナル履歴モーダルの表示状態
  const [showHistory, setShowHistory] = useState(false);
  // ソート種別（デフォルト＝登録順）
  const [sortBy, setSortBy] = useState<SortType>("default");
  // 各銘柄のシグナル数を記録するマップ（ソートに使用）
  const [signalMap, setSignalMap] = useState<Record<string, Signal[]>>({});

  const { watchlist, addStock, removeStock, updateStock } = useWatchlist();
  const { requestPermission } = useNotification();
  const { history, addRecord, updatePrices, calcStats } = useSignalHistory();

  // ページ読み込み時にブラウザ通知の許可をリクエスト
  useEffect(() => {
    requestPermission();
  }, []);

  // 各カードからシグナル情報を受け取って記録する
  const handleSignalsUpdate = (code: string, signals: Signal[]) => {
    setSignalMap((prev) => ({ ...prev, [code]: signals }));
  };

  // ソートされたウォッチリストを返す
  const sortedWatchlist = [...watchlist].sort((a, b) => {
    if (sortBy === "default") return 0;
    const aSignals = signalMap[a.code] ?? [];
    const bSignals = signalMap[b.code] ?? [];
    if (sortBy === "signals") {
      // 総シグナル数が多い順
      return bSignals.length - aSignals.length;
    }
    if (sortBy === "buy") {
      // 買いシグナル数が多い順
      const aBuy = aSignals.filter((s) => s.type === "buy").length;
      const bBuy = bSignals.filter((s) => s.type === "buy").length;
      return bBuy - aBuy;
    }
    if (sortBy === "sell") {
      // 売りシグナル数が多い順
      const aSell = aSignals.filter((s) => s.type === "sell").length;
      const bSell = bSignals.filter((s) => s.type === "sell").length;
      return bSell - aSell;
    }
    return 0;
  });

  // ソートボタンのスタイルを返すヘルパー
  const sortBtnClass = (type: SortType) =>
    `text-xs px-2.5 py-1 rounded-full transition-colors ${
      sortBy === type
        ? "bg-blue-600 text-white"
        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
    }`;

  return (
    <div className="min-h-screen bg-gray-950">
      {/* ヘッダー */}
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
          <div>
            <h1 className="text-xl font-bold text-white">株ダッシュボード</h1>
            <p className="text-xs text-gray-400 mt-0.5">ウォッチリスト · シグナル通知</p>
          </div>

          {/* 通知条件の説明 */}
          <div className="hidden md:flex flex-col items-center text-center gap-1">
            <p className="text-xs text-gray-400 font-medium">🔔 通知条件</p>
            <p className="text-xs text-gray-500">以下の指標が <span className="text-yellow-400 font-bold">3つ以上</span> 同時に揃ったときブラウザ通知</p>
            <div className="flex gap-2 mt-0.5">
              <div className="flex flex-wrap gap-1 justify-center">
                {["ゴールデンクロス","RSI売られすぎ","MACDクロス(買)","BB下限タッチ","短期上昇トレンド"].map((s) => (
                  <span key={s} className="text-xs bg-green-900/30 text-green-400 border border-green-700/40 px-1.5 py-0.5 rounded-full">{s}</span>
                ))}
                {["デッドクロス","RSI買われすぎ","MACDクロス(売)","BB上限タッチ","短期下降トレンド"].map((s) => (
                  <span key={s} className="text-xs bg-red-900/30 text-red-400 border border-red-700/40 px-1.5 py-0.5 rounded-full">{s}</span>
                ))}
              </div>
            </div>
          </div>

          {/* 右側のボタン群 */}
          <div className="flex items-center gap-2">
            {/* シグナル履歴ボタン */}
            <button
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
            >
              <span>📋</span>
              <span className="hidden sm:inline">シグナル履歴</span>
              {history.length > 0 && (
                <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full leading-none">
                  {history.length}
                </span>
              )}
            </button>

            {/* 銘柄追加ボタン */}
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <span className="text-lg leading-none">＋</span>
              銘柄を追加
            </button>
          </div>
        </div>

        {/* ソートバー（銘柄がある場合のみ表示） */}
        {watchlist.length > 0 && (
          <div className="flex items-center gap-2 mt-3 max-w-screen-2xl mx-auto">
            <span className="text-xs text-gray-500">並び順：</span>
            <button onClick={() => setSortBy("default")} className={sortBtnClass("default")}>登録順</button>
            <button onClick={() => setSortBy("signals")} className={sortBtnClass("signals")}>シグナル多い順</button>
            <button onClick={() => setSortBy("buy")} className={sortBtnClass("buy")}>買いシグナル優先</button>
            <button onClick={() => setSortBy("sell")} className={sortBtnClass("sell")}>売りシグナル優先</button>
          </div>
        )}
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-screen-2xl mx-auto px-6 py-6">
        {watchlist.length === 0 ? (
          // 銘柄が未登録の場合の案内
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="text-5xl mb-4">📈</div>
            <h2 className="text-lg font-semibold text-gray-300 mb-2">
              ウォッチリストが空です
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              「銘柄を追加」ボタンから見たい株を追加してください
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              銘柄を追加する
            </button>
          </div>
        ) : (
          // チャート一覧グリッド（横4列）
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
            {sortedWatchlist.map((stock) => (
              <StockCard
                key={stock.code}
                stock={stock}
                onRemove={() => removeStock(stock.code)}
                onSignalDetected={addRecord}
                onSignalsUpdate={(signals) => handleSignalsUpdate(stock.code, signals)}
                onUpdateStock={(patch) => updateStock(stock.code, patch)}
              />
            ))}
          </div>
        )}
      </main>

      {/* 銘柄追加モーダル */}
      {showModal && (
        <AddStockModal
          onAdd={(stock) => {
            addStock(stock);
            setShowModal(false);
          }}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* シグナル履歴モーダル */}
      {showHistory && (
        <SignalHistoryModal
          history={history}
          stats={calcStats()}
          onClose={() => setShowHistory(false)}
          onMount={updatePrices}
        />
      )}
    </div>
  );
}
