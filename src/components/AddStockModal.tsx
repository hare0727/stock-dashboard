"use client";

import { useState } from "react";
import { Stock } from "@/lib/useWatchlist";

// よく使われる日本株のサンプルリスト
const POPULAR_STOCKS: Stock[] = [
  { code: "7203", name: "トヨタ自動車" },
  { code: "6758", name: "ソニーグループ" },
  { code: "7974", name: "任天堂" },
  { code: "9984", name: "ソフトバンクグループ" },
  { code: "6861", name: "キーエンス" },
  { code: "4063", name: "信越化学工業" },
  { code: "8306", name: "三菱UFJフィナンシャル" },
  { code: "9432", name: "NTT" },
  { code: "6954", name: "ファナック" },
  { code: "4519", name: "中外製薬" },
  { code: "2914", name: "日本たばこ産業" },
  { code: "8035", name: "東京エレクトロン" },
];

type Props = {
  onAdd: (stock: Stock) => void;
  onClose: () => void;
};

export default function AddStockModal({ onAdd, onClose }: Props) {
  // 入力フォームの状態
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");

  // 検索フィルタ（銘柄コードまたは名前で絞り込み）
  const filtered = POPULAR_STOCKS.filter(
    (s) =>
      s.code.includes(search) ||
      s.name.includes(search)
  );

  // 手動入力で追加
  const handleManualAdd = () => {
    if (!code.trim() || !name.trim()) return;
    onAdd({ code: code.trim(), name: name.trim() });
  };

  return (
    // 背景オーバーレイ
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md shadow-2xl">
        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-base font-semibold text-white">銘柄を追加</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* 検索ボックス */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">銘柄を検索</label>
            <input
              type="text"
              placeholder="銘柄名または銘柄コードで検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* 人気銘柄リスト */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">
              {search ? "検索結果" : "人気銘柄"}
            </label>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {filtered.map((stock) => (
                <button
                  key={stock.code}
                  onClick={() => onAdd(stock)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors text-left"
                >
                  <span className="text-sm text-white">{stock.name}</span>
                  <span className="text-xs text-gray-400 font-mono">{stock.code}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-gray-500 px-3 py-2">見つかりませんでした</p>
              )}
            </div>
          </div>

          {/* 区切り線 */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-gray-700" />
            <span className="text-xs text-gray-500">または手動で入力</span>
            <div className="flex-1 border-t border-gray-700" />
          </div>

          {/* 手動入力フォーム */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="w-32">
                <label className="text-xs text-gray-400 mb-1 block">銘柄コード</label>
                <input
                  type="text"
                  placeholder="例：7203"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={4}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-400 mb-1 block">銘柄名</label>
                <input
                  type="text"
                  placeholder="例：トヨタ自動車"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <button
              onClick={handleManualAdd}
              disabled={!code.trim() || !name.trim()}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium py-2 rounded-lg transition-colors"
            >
              追加する
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
