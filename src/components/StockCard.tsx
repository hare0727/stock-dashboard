"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createChart, IChartApi, CandlestickSeries, LineSeries, SeriesMarker, Time, createSeriesMarkers } from "lightweight-charts";
import { Stock } from "@/lib/useWatchlist";
import { calcSignals, Signal } from "@/lib/signals";
import { useNotification } from "@/lib/useNotification";

type Props = {
  stock: Stock;
  onRemove: () => void;
  // シグナル検出時に呼ばれるコールバック（履歴記録用）
  onSignalDetected?: (stock: Stock, signals: Signal[], price: number) => void;
  // シグナル一覧を親に通知するコールバック（ソート用）
  onSignalsUpdate?: (signals: Signal[]) => void;
  // 銘柄情報を更新するコールバック（メモ・アラートなど）
  onUpdateStock?: (patch: Partial<Stock>) => void;
};

// 株価データの型
type Candle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

// チャート表示期間の選択肢
type PeriodKey = "1m" | "3m" | "6m" | "1y";
const PERIODS: { key: PeriodKey; label: string; months: number }[] = [
  { key: "1m", label: "1ヶ月", months: 1 },
  { key: "3m", label: "3ヶ月", months: 3 },
  { key: "6m", label: "6ヶ月", months: 6 },
  { key: "1y", label: "1年", months: 12 },
];

// 自動更新の間隔（ミリ秒）
const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5分

export default function StockCard({
  stock,
  onRemove,
  onSignalDetected,
  onSignalsUpdate,
  onUpdateStock,
}: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<IChartApi | null>(null);

  const [candles, setCandles] = useState<Candle[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number | null>(null);
  // 最終更新時刻
  const [lastUpdated, setLastUpdated] = useState<string>("");
  // チャート表示期間（デフォルト3ヶ月）
  const [period, setPeriod] = useState<PeriodKey>("3m");
  // アラート設定UIの表示フラグ
  const [showAlertForm, setShowAlertForm] = useState(false);
  // アラート価格入力バッファ
  const [alertPriceInput, setAlertPriceInput] = useState(
    stock.alertPrice ? String(stock.alertPrice) : ""
  );
  const [alertDirection, setAlertDirection] = useState<"above" | "below">(
    stock.alertDirection ?? "above"
  );
  // アラート発火済みフラグ（1回だけ通知するため）
  const alertFiredRef = useRef(false);
  // メモ入力バッファ
  const [memoInput, setMemoInput] = useState(stock.memo ?? "");

  const { notify, notifyPriceAlert } = useNotification();

  // 株価データを取得する
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/stock?code=${stock.code}`);
      if (!res.ok) throw new Error("データ取得に失敗しました");
      const data: Candle[] = await res.json();
      setCandles(data);

      // 最新価格と変動率を計算
      if (data.length >= 2) {
        const latest = data[data.length - 1];
        const prev = data[data.length - 2];
        const latestClose = latest.close;
        setCurrentPrice(latestClose);
        setPriceChange(((latestClose - prev.close) / prev.close) * 100);

        // 価格アラートチェック（まだ発火していない場合のみ）
        if (stock.alertPrice && stock.alertDirection && !alertFiredRef.current) {
          const triggered =
            stock.alertDirection === "above"
              ? latestClose >= stock.alertPrice
              : latestClose <= stock.alertPrice;
          if (triggered) {
            alertFiredRef.current = true;
            notifyPriceAlert(stock, latestClose, stock.alertPrice, stock.alertDirection);
          }
        }
      }

      // シグナルを計算
      const detected = calcSignals(data);
      setSignals(detected);
      // 親にシグナル一覧を通知（ソート用）
      onSignalsUpdate?.(detected);

      // 3指標以上揃った場合のみ通知・履歴記録する
      if (detected.length >= 3) {
        notify(stock, detected);
        if (onSignalDetected) {
          const latestPrice = data[data.length - 1].close;
          onSignalDetected(stock, detected, latestPrice);
        }
      }

      // 最終更新時刻を記録
      const now = new Date();
      setLastUpdated(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
    } catch (e) {
      setError("データを取得できませんでした");
    } finally {
      setLoading(false);
    }
  }, [stock.code, stock.alertPrice, stock.alertDirection]);

  // 初回取得 + 5分ごとの自動更新
  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [fetchData]);

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

    // シグナルマーカーをローソク足に表示する
    const buySignals = signals.filter((s) => s.type === "buy");
    const sellSignals = signals.filter((s) => s.type === "sell");
    if (buySignals.length > 0 || sellSignals.length > 0) {
      const lastCandle = candles[candles.length - 1];
      const markers: SeriesMarker<Time>[] = [];
      if (buySignals.length >= 3) {
        markers.push({
          time: lastCandle.time as Time,
          position: "belowBar",
          color: "#22c55e",
          shape: "arrowUp",
          text: `買${buySignals.length}`,
          size: 1,
        });
      }
      if (sellSignals.length >= 3) {
        markers.push({
          time: lastCandle.time as Time,
          position: "aboveBar",
          color: "#ef4444",
          shape: "arrowDown",
          text: `売${sellSignals.length}`,
          size: 1,
        });
      }
      if (markers.length > 0) {
        createSeriesMarkers(candleSeries, markers);
      }
    }

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

    // 選択期間に応じて表示範囲を設定する
    const to = candles[candles.length - 1].time;
    const fromDate = new Date(to);
    const selectedPeriod = PERIODS.find((p) => p.key === period) ?? PERIODS[1];
    fromDate.setMonth(fromDate.getMonth() - selectedPeriod.months);
    const from = fromDate.toISOString().split("T")[0];
    chart.timeScale().setVisibleRange({
      from: from as unknown as import("lightweight-charts").Time,
      to: to as unknown as import("lightweight-charts").Time,
    });

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
  }, [candles, period, signals]);

  // 買い・売りシグナルを分類
  const buySignals = signals.filter((s) => s.type === "buy");
  const sellSignals = signals.filter((s) => s.type === "sell");

  // 含み損益を計算する
  const calcPnl = () => {
    if (!stock.purchasePrice || !stock.shares || !currentPrice) return null;
    const pnl = (currentPrice - stock.purchasePrice) * stock.shares;
    const rate = ((currentPrice - stock.purchasePrice) / stock.purchasePrice) * 100;
    return { pnl, rate };
  };
  const pnl = calcPnl();

  // アラート設定を保存する
  const saveAlert = () => {
    const price = parseFloat(alertPriceInput);
    if (isNaN(price) || price <= 0) return;
    alertFiredRef.current = false; // 新しい設定なので発火フラグをリセット
    onUpdateStock?.({ alertPrice: price, alertDirection });
    setShowAlertForm(false);
  };

  // アラートを削除する
  const clearAlert = () => {
    alertFiredRef.current = false;
    setAlertPriceInput("");
    onUpdateStock?.({ alertPrice: undefined, alertDirection: undefined });
    setShowAlertForm(false);
  };

  // メモを保存する（フォーカスが外れたとき）
  const saveMemo = () => {
    onUpdateStock?.({ memo: memoInput });
  };

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
        <div className="flex items-center gap-1">
          {/* アラートボタン */}
          <button
            onClick={() => setShowAlertForm((v) => !v)}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              stock.alertPrice
                ? "text-yellow-400 bg-yellow-900/30 hover:bg-yellow-900/50"
                : "text-gray-500 hover:text-yellow-400"
            }`}
            title="価格アラートを設定"
          >
            🔔
          </button>
          {/* 削除ボタン */}
          <button
            onClick={onRemove}
            className="text-gray-500 hover:text-red-400 text-sm transition-colors px-2 py-1"
            title="ウォッチリストから削除"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 価格アラート設定フォーム */}
      {showAlertForm && (
        <div className="px-4 py-3 bg-gray-800/60 border-b border-gray-700 space-y-2">
          <p className="text-xs text-gray-400 font-medium">価格アラート設定</p>
          <div className="flex gap-2 items-center">
            <select
              value={alertDirection}
              onChange={(e) => setAlertDirection(e.target.value as "above" | "below")}
              className="text-xs bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 focus:outline-none"
            >
              <option value="above">以上になったら</option>
              <option value="below">以下になったら</option>
            </select>
            <input
              type="number"
              value={alertPriceInput}
              onChange={(e) => setAlertPriceInput(e.target.value)}
              placeholder="目標価格"
              className="w-28 text-xs bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 focus:outline-none focus:border-yellow-500"
            />
            <span className="text-xs text-gray-400">円</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveAlert}
              className="text-xs bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-1 rounded transition-colors"
            >
              設定
            </button>
            {stock.alertPrice && (
              <button
                onClick={clearAlert}
                className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded transition-colors"
              >
                削除
              </button>
            )}
            <button
              onClick={() => setShowAlertForm(false)}
              className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 transition-colors"
            >
              キャンセル
            </button>
          </div>
          {/* 現在のアラート設定を表示 */}
          {stock.alertPrice && (
            <p className="text-xs text-yellow-400">
              現在の設定：¥{stock.alertPrice.toLocaleString()} {stock.alertDirection === "above" ? "以上" : "以下"}
            </p>
          )}
        </div>
      )}

      {/* 含み損益表示（購入価格・株数が設定されている場合） */}
      {pnl !== null && (
        <div className={`px-4 py-2 flex items-center justify-between border-b border-gray-700 ${
          pnl.pnl >= 0 ? "bg-green-900/10" : "bg-red-900/10"
        }`}>
          <span className="text-xs text-gray-400">
            {stock.shares?.toLocaleString()}株 × ¥{stock.purchasePrice?.toLocaleString()}
          </span>
          <div className="text-right">
            <span className={`text-sm font-bold ${pnl.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
              {pnl.pnl >= 0 ? "+" : ""}¥{Math.round(pnl.pnl).toLocaleString()}
            </span>
            <span className={`text-xs ml-1.5 ${pnl.rate >= 0 ? "text-green-400" : "text-red-400"}`}>
              ({pnl.rate >= 0 ? "+" : ""}{pnl.rate.toFixed(2)}%)
            </span>
          </div>
        </div>
      )}

      {/* チャート期間切替ボタン */}
      <div className="flex gap-1 px-3 pt-2">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${
              period === p.key
                ? "bg-blue-600 text-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {p.label}
          </button>
        ))}
        {/* 最終更新時刻 */}
        {lastUpdated && (
          <span className="text-xs text-gray-600 ml-auto self-center">
            更新 {lastUpdated}
          </span>
        )}
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

      {/* メモ入力エリア */}
      <div className="px-4 pb-3 pt-2 border-t border-gray-800">
        <input
          type="text"
          value={memoInput}
          onChange={(e) => setMemoInput(e.target.value)}
          onBlur={saveMemo}
          placeholder="メモを入力..."
          className="w-full bg-transparent text-xs text-gray-400 placeholder-gray-600 focus:outline-none focus:text-gray-200 transition-colors"
        />
      </div>
    </div>
  );
}
