"use client";

import { useState, useEffect } from "react";
import { useWatchlist } from "@/lib/useWatchlist";
import StockCard from "@/components/StockCard";
import AddStockModal from "@/components/AddStockModal";
import { useNotification } from "@/lib/useNotification";

export default function Home() {
  // 銘柄追加モーダルの表示状態
  const [showModal, setShowModal] = useState(false);
  const { watchlist, addStock, removeStock } = useWatchlist();
  const { requestPermission } = useNotification();

  // ページ読み込み時にブラウザ通知の許可をリクエスト
  useEffect(() => {
    requestPermission();
  }, []);

  return (
    <div className="min-h-screen bg-gray-950">
      {/* ヘッダー */}
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
          <div>
            <h1 className="text-xl font-bold text-white">株ダッシュボード</h1>
            <p className="text-xs text-gray-400 mt-0.5">ウォッチリスト · シグナル通知</p>
          </div>
          {/* 銘柄追加ボタン */}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <span className="text-lg leading-none">＋</span>
            銘柄を追加
          </button>
        </div>
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
            {watchlist.map((stock) => (
              <StockCard
                key={stock.code}
                stock={stock}
                onRemove={() => removeStock(stock.code)}
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
    </div>
  );
}
