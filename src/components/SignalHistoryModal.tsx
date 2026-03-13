"use client";

import { useEffect } from "react";
import { SignalRecord, SignalStat } from "@/lib/useSignalHistory";

type Props = {
  history: SignalRecord[];
  stats: SignalStat[];
  onClose: () => void;
  onMount: () => void; // 開いたときに価格を更新する
};

// 価格変化率を計算して表示用データを返す
function getPriceChange(
  priceAtSignal: number,
  priceAfter: number | null,
  signalType: SignalRecord["signalType"]
): { text: string; colorClass: string; isWin: boolean | null } {
  if (priceAfter === null) {
    return { text: "確認中", colorClass: "text-gray-500", isWin: null };
  }
  const change = ((priceAfter - priceAtSignal) / priceAtSignal) * 100;
  const sign = change >= 0 ? "+" : "";
  // 買いは上昇が勝ち、売りは下落が勝ち、混合は判定なし
  const isWin =
    signalType === "buy"
      ? change > 0
      : signalType === "sell"
      ? change < 0
      : null;
  const colorClass =
    isWin === true
      ? "text-green-400"
      : isWin === false
      ? "text-red-400"
      : "text-gray-400";
  return { text: `${sign}${change.toFixed(1)}%`, colorClass, isWin };
}

// 勝率バーの色クラスを返す
function winRateColor(rate: number | null): string {
  if (rate === null) return "bg-gray-700";
  if (rate >= 60) return "bg-green-500";
  if (rate >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

// シグナル履歴をCSVとしてダウンロードする
function downloadCsv(history: SignalRecord[]) {
  // CSVヘッダー行
  const header = [
    "日付",
    "銘柄コード",
    "銘柄名",
    "種類",
    "シグナル数",
    "シグナル一覧",
    "発生時価格",
    "1週後価格",
    "2週後価格",
    "3週後価格",
    "1ヶ月後価格",
  ].join(",");

  // 各レコードをCSV行に変換する
  const rows = [...history].reverse().map((r) => {
    const signalTypeLabel =
      r.signalType === "buy" ? "買い" : r.signalType === "sell" ? "売り" : "混合";
    return [
      r.date,
      r.stockCode,
      `"${r.stockName}"`,
      signalTypeLabel,
      r.signalCount,
      `"${r.signals.join(" / ")}"`,
      r.priceAtSignal,
      r.price1w ?? "",
      r.price2w ?? "",
      r.price3w ?? "",
      r.price1m ?? "",
    ].join(",");
  });

  const csv = [header, ...rows].join("\n");
  // BOMを付けてExcelで文字化けしないようにする
  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `signal_history_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SignalHistoryModal({ history, stats, onClose, onMount }: Props) {
  // モーダルを開いたときに価格を更新する
  useEffect(() => {
    onMount();
  }, []);

  // シグナル種類の表示用
  const signalTypeLabel = (type: SignalRecord["signalType"]) => {
    if (type === "buy") return { label: "買い", className: "text-green-400 bg-green-900/30 border-green-700/40" };
    if (type === "sell") return { label: "売り", className: "text-red-400 bg-red-900/30 border-red-700/40" };
    return { label: "混合", className: "text-gray-400 bg-gray-700/30 border-gray-600/40" };
  };

  // 最も勝率が高い期間を見つける
  const bestPeriod = stats.reduce(
    (best, s) => {
      if (s.totalWinRate !== null && (best === null || s.totalWinRate > (best.totalWinRate ?? 0))) return s;
      return best;
    },
    null as SignalStat | null
  );

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h2 className="text-base font-semibold text-white">シグナル履歴・結果分析</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              シグナル発生後の株価変化を追跡 · 全{history.length}件
            </p>
          </div>
          <div className="flex items-center gap-3">
            {bestPeriod && bestPeriod.totalWinRate !== null && (
              <div className="text-xs text-gray-400 text-right">
                <span className="text-yellow-400 font-bold">
                  最高勝率：{bestPeriod.label} {bestPeriod.totalWinRate}%
                </span>
              </div>
            )}
            {/* CSVエクスポートボタン */}
            {history.length > 0 && (
              <button
                onClick={() => downloadCsv(history)}
                className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                <span>⬇️</span>
                CSVダウンロード
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-xl leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        {/* スクロール可能な本文 */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">

          {/* 期間別勝率サマリー */}
          <div>
            <h3 className="text-xs font-medium text-gray-400 mb-3">期間別勝率サマリー</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {stats.map((s) => (
                <div
                  key={s.period}
                  className={`bg-gray-800 rounded-lg p-3 border ${
                    bestPeriod?.period === s.period && s.totalWinRate !== null
                      ? "border-yellow-500/50"
                      : "border-gray-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">{s.label}</span>
                    {bestPeriod?.period === s.period && s.totalWinRate !== null && (
                      <span className="text-xs text-yellow-400">★ 最高</span>
                    )}
                  </div>
                  {s.totalWinRate !== null ? (
                    <>
                      {/* 勝率バー */}
                      <div className="w-full bg-gray-700 rounded-full h-1.5 mb-2">
                        <div
                          className={`h-1.5 rounded-full ${winRateColor(s.totalWinRate)}`}
                          style={{ width: `${s.totalWinRate}%` }}
                        />
                      </div>
                      <div className="text-lg font-bold text-white">{s.totalWinRate}%</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        <span className="text-green-400">買{s.buyWinRate ?? "-"}%</span>
                        {" / "}
                        <span className="text-red-400">売{s.sellWinRate ?? "-"}%</span>
                        <span className="ml-1">({s.buyCount + s.sellCount}件)</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-500 mt-2">データなし</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 履歴テーブル */}
          <div>
            <h3 className="text-xs font-medium text-gray-400 mb-3">シグナル一覧</h3>
            {history.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-sm">
                <p className="text-3xl mb-3">📭</p>
                <p>まだシグナル履歴がありません</p>
                <p className="text-xs mt-1">3指標以上揃うと自動で記録されます</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-700">
                      <th className="text-left py-2 pr-4">日付</th>
                      <th className="text-left py-2 pr-4">銘柄</th>
                      <th className="text-left py-2 pr-4">種類</th>
                      <th className="text-left py-2 pr-4">シグナル</th>
                      <th className="text-right py-2 pr-4">発生時価格</th>
                      <th className="text-right py-2 pr-4">1週後</th>
                      <th className="text-right py-2 pr-4">2週後</th>
                      <th className="text-right py-2 pr-4">3週後</th>
                      <th className="text-right py-2">1ヶ月後</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...history].reverse().map((record) => {
                      const typeInfo = signalTypeLabel(record.signalType);
                      const c1w = getPriceChange(record.priceAtSignal, record.price1w, record.signalType);
                      const c2w = getPriceChange(record.priceAtSignal, record.price2w, record.signalType);
                      const c3w = getPriceChange(record.priceAtSignal, record.price3w, record.signalType);
                      const c1m = getPriceChange(record.priceAtSignal, record.price1m, record.signalType);
                      return (
                        <tr key={record.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                          <td className="py-2.5 pr-4 text-gray-400 whitespace-nowrap">
                            {record.date}
                          </td>
                          <td className="py-2.5 pr-4 whitespace-nowrap">
                            <div className="text-white text-xs font-medium">{record.stockName}</div>
                            <div className="text-gray-500 text-xs">{record.stockCode}</div>
                          </td>
                          <td className="py-2.5 pr-4">
                            <span className={`text-xs border px-1.5 py-0.5 rounded-full ${typeInfo.className}`}>
                              {typeInfo.label}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {record.signals.map((s) => (
                                <span key={s} className="text-xs bg-gray-700/60 text-gray-300 px-1.5 py-0.5 rounded">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2.5 pr-4 text-right text-white font-mono whitespace-nowrap">
                            ¥{record.priceAtSignal.toLocaleString()}
                          </td>
                          <td className={`py-2.5 pr-4 text-right font-mono whitespace-nowrap ${c1w.colorClass}`}>
                            {c1w.text}
                          </td>
                          <td className={`py-2.5 pr-4 text-right font-mono whitespace-nowrap ${c2w.colorClass}`}>
                            {c2w.text}
                          </td>
                          <td className={`py-2.5 pr-4 text-right font-mono whitespace-nowrap ${c3w.colorClass}`}>
                            {c3w.text}
                          </td>
                          <td className={`py-2.5 text-right font-mono whitespace-nowrap ${c1m.colorClass}`}>
                            {c1m.text}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
