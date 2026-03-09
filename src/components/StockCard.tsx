"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, IChartApi, CandlestickSeries, LineSeries } from "lightweight-charts";
import { Stock } from "@/lib/useWatchlist";
import { calcSignals, Signal } from "@/lib/signals";
import { useNotification } from "@/lib/useNotification";

type Props = {
  stock: Stock;
  onRemove: () => void;
  // シグナル検出時に呼ばれるコールバック（履歴記録用）
  onSignalDetected?: (stock: Stock, signals: Signal[], price: number) => void;
};

// 株価データの型
type Candle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export default function StockCard({ stock, onRemove, onSignalDetected }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<IChartApi | null>(null);

  const [candles, setCandles] = useState<Candle[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number | null>(null);
  const { notify } = useNotification();

  // 株価データを取得する
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        // Next.jsのAPIルート経由で取得（CORSを回避）
        const res = await fetch(`/api/stock?code=${stock.code}`);
        if (!res.ok) throw new Error("データ取得に失敗しました");
        const data: Candle[] = await res.json();
        setCandles(data);

        // 最新価格と変動率を計算
        if (data.length >= 2) {
          const latest = data[data.length - 1];
          const prev = data[data.length - 2];
          setCurrentPrice(latest.close);
          setPriceChange(((latest.close - prev.close) / prev.close) * 100);
        }

        // シグナルを計算
        const detected = calcSignals(data);
        setSignals(detected);

        // 3指標以上揃った場合のみ通知・履歴記録する
        if (detected.length >= 3) {
          notify(stock, detected);
          // 履歴記録コールバックを呼ぶ（発生時の最新終値を渡す）
          if (onSignalDetected) {
            const latestPrice = data[data.length - 1].close;
            onSignalDetected(stock, detected, latestPrice);
          }
        }
      } catch (e) {
        setError("データを取得できませんでした");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [stock.code]);

  // チャートを描画する
  useEffect(() => {
    if (!chartRef.current || candles.length === 0) return;

    // 既存チャートを破棄してから再生成
    if (chartInstance.current) {
      chartInstance.current.remove();
    }

    const chart = createChart(chartRef.current, {
      width: chartRef.current.clientWidth,
      height: 240,
      layout: {
        background: { color: "#111827" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { color: "#1f2937" },
        horzLines: { color: "#1f2937" },
      },
      timeScale: {
        borderColor: "#374151",
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: "#374151",
      },
    });

    // ローソク足を追加
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });
    candleSeries.setData(candles as Parameters<typeof candleSeries.setData>[0]);

    // --- 指標ラインの計算 ---
    const closes = candles.map((c) => c.close);

    // 単純移動平均（SMA）を計算するローカル関数
    const calcSma = (values: number[], period: number) => {
      return values.map((_, i) => {
        if (i < period - 1) return NaN;
        const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        return sum / period;
      });
    };

    // ボリンジャーバンドを計算するローカル関数
    const calcBB = (values: number[], period = 20) => {
      const mid = calcSma(values, period);
      return values.map((_, i) => {
        if (i < period - 1) return { upper: NaN, mid: mid[i], lower: NaN };
        const slice = values.slice(i - period + 1, i + 1);
        const mean = mid[i];
        const std = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period);
        return { upper: mean + 2 * std, mid: mean, lower: mean - 2 * std };
      });
    };

    const sma5 = calcSma(closes, 5);
    const sma25 = calcSma(closes, 25);
    const sma75 = calcSma(closes, 75);
    const bb = calcBB(closes, 20);

    // データを { time, value } 形式に変換するヘルパー
    const toLineData = (values: number[]) =>
      candles
        .map((c, i) => ({ time: c.time, value: values[i] }))
        .filter((d) => !isNaN(d.value)) as { time: string; value: number }[];

    // SMA5（白・細線）
    const sma5Series = chart.addSeries(LineSeries, {
      color: "#e2e8f0",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    sma5Series.setData(toLineData(sma5));

    // SMA25（黄色）
    const sma25Series = chart.addSeries(LineSeries, {
      color: "#facc15",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    sma25Series.setData(toLineData(sma25));

    // SMA75（オレンジ）
    const sma75Series = chart.addSeries(LineSeries, {
      color: "#f97316",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    sma75Series.setData(toLineData(sma75));

    // ボリンジャーバンド上限（紫・細線）
    const bbUpperSeries = chart.addSeries(LineSeries, {
      color: "#a78bfa",
      lineWidth: 1,
      lineStyle: 1, // 破線
      priceLineVisible: false,
      lastValueVisible: false,
    });
    bbUpperSeries.setData(toLineData(bb.map((b) => b.upper)));

    // ボリンジャーバンド中間（紫・薄め）
    const bbMidSeries = chart.addSeries(LineSeries, {
      color: "#7c3aed",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    bbMidSeries.setData(toLineData(bb.map((b) => b.mid)));

    // ボリンジャーバンド下限（紫・細線）
    const bbLowerSeries = chart.addSeries(LineSeries, {
      color: "#a78bfa",
      lineWidth: 1,
      lineStyle: 1, // 破線
      priceLineVisible: false,
      lastValueVisible: false,
    });
    bbLowerSeries.setData(toLineData(bb.map((b) => b.lower)));

    // 表示期間を直近3ヶ月に設定
    const to = candles[candles.length - 1].time;
    const fromDate = new Date(to);
    fromDate.setMonth(fromDate.getMonth() - 3);
    const from = fromDate.toISOString().split("T")[0];
    chart.timeScale().setVisibleRange({ from: from as unknown as import("lightweight-charts").Time, to: to as unknown as import("lightweight-charts").Time });

    chartInstance.current = chart;

    // ウィンドウリサイズ対応
    const handleResize = () => {
      if (chartRef.current) {
        chart.applyOptions({ width: chartRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [candles]);

  // 買い・売りシグナルを分類
  const buySignals = signals.filter((s) => s.type === "buy");
  const sellSignals = signals.filter((s) => s.type === "sell");

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
      {/* カードヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{stock.name}</span>
            <span className="text-xs text-gray-400 font-mono bg-gray-800 px-1.5 py-0.5 rounded">
              {stock.code}
            </span>
          </div>
          {/* 現在価格・変動率 */}
          {currentPrice && (
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-lg font-bold text-white">
                ¥{currentPrice.toLocaleString()}
              </span>
              {priceChange !== null && (
                <span
                  className={`text-xs font-medium ${
                    priceChange >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {priceChange >= 0 ? "▲" : "▼"}
                  {Math.abs(priceChange).toFixed(2)}%
                </span>
              )}
            </div>
          )}
        </div>
        {/* 削除ボタン */}
        <button
          onClick={onRemove}
          className="text-gray-500 hover:text-red-400 text-sm transition-colors px-2 py-1"
          title="ウォッチリストから削除"
        >
          ✕
        </button>
      </div>

      {/* チャート表示エリア */}
      <div className="relative">
        {loading && (
          <div className="flex items-center justify-center h-60 text-gray-500 text-sm">
            読み込み中...
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-60 text-red-400 text-sm">
            {error}
          </div>
        )}
        <div
          ref={chartRef}
          className={`w-full ${loading || error ? "hidden" : ""}`}
        />
      </div>

      {/* シグナル表示エリア */}
      {signals.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-700 space-y-2">
          {/* 買いシグナル */}
          {buySignals.length > 0 && (
            <div>
              <span className="text-xs font-medium text-green-400 mr-2">
                📈 買いシグナル（{buySignals.length}指標）
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {buySignals.map((s) => (
                  <span
                    key={s.name}
                    className="text-xs bg-green-900/40 text-green-300 border border-green-700/50 px-2 py-0.5 rounded-full"
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {/* 売りシグナル */}
          {sellSignals.length > 0 && (
            <div>
              <span className="text-xs font-medium text-red-400 mr-2">
                📉 売りシグナル（{sellSignals.length}指標）
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {sellSignals.map((s) => (
                  <span
                    key={s.name}
                    className="text-xs bg-red-900/40 text-red-300 border border-red-700/50 px-2 py-0.5 rounded-full"
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
