// 売買シグナルの型定義
export type Signal = {
  name: string;       // シグナル名（例：「ゴールデンクロス」）
  type: "buy" | "sell";  // 買いか売りか
  description: string; // 説明文
};

// ローソク足データの型
type Candle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

// --- 指標計算ユーティリティ ---

// 単純移動平均（SMA）を計算する
function sma(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

// RSI（相対力指数）を計算する
function rsi(closes: number[], period = 14): number[] {
  const result: number[] = new Array(period).fill(NaN);
  let gains = 0;
  let losses = 0;

  // 最初のperiod期間の平均を計算
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period; i < closes.length; i++) {
    if (i === period) {
      const rs = avgGain / (avgLoss === 0 ? 0.001 : avgLoss);
      result.push(100 - 100 / (1 + rs));
      continue;
    }
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
    const rs = avgGain / (avgLoss === 0 ? 0.001 : avgLoss);
    result.push(100 - 100 / (1 + rs));
  }
  return result;
}

// MACD を計算する（EMAの差）
function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      result.push(values[0]);
    } else {
      result.push(values[i] * k + result[i - 1] * (1 - k));
    }
  }
  return result;
}

function macd(closes: number[]): { macdLine: number[]; signalLine: number[] } {
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = ema(macdLine.slice(26), 9);
  // signal lineをmacdLineと長さを合わせる
  const paddedSignal = new Array(26).fill(NaN).concat(signalLine);
  return { macdLine, signalLine: paddedSignal };
}

// ボリンジャーバンドを計算する
function bollingerBands(closes: number[], period = 20): {
  upper: number[];
  lower: number[];
  mid: number[];
} {
  const mid = sma(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      const slice = closes.slice(i - period + 1, i + 1);
      const mean = mid[i];
      const variance = slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period;
      const std = Math.sqrt(variance);
      upper.push(mean + 2 * std);
      lower.push(mean - 2 * std);
    }
  }
  return { upper, lower, mid };
}

// --- シグナル判定 ---

export function calcSignals(candles: Candle[]): Signal[] {
  // データが少ない場合はスキップ
  if (candles.length < 30) return [];

  const closes = candles.map((c) => c.close);
  const signals: Signal[] = [];
  const last = closes.length - 1;

  // --- 買いシグナル ---

  // ① ゴールデンクロス（短期MAが長期MAを上抜け）
  const sma25 = sma(closes, 25);
  const sma75 = sma(closes, 75);
  if (
    sma25.length > 1 &&
    sma75.length > 1 &&
    !isNaN(sma25[last]) &&
    !isNaN(sma75[last]) &&
    sma25[last] > sma75[last] &&
    sma25[last - 1] <= sma75[last - 1]
  ) {
    signals.push({
      name: "ゴールデンクロス",
      type: "buy",
      description: "25日MAが75日MAを上抜けました",
    });
  }

  // ② RSI 売られすぎ（30以下）
  const rsiValues = rsi(closes, 14);
  const lastRsi = rsiValues[last];
  if (!isNaN(lastRsi) && lastRsi < 30) {
    signals.push({
      name: `RSI売られすぎ(${lastRsi.toFixed(0)})`,
      type: "buy",
      description: `RSIが${lastRsi.toFixed(0)}と売られすぎの水準です`,
    });
  }

  // ③ MACDゴールデンクロス（MACDがシグナルを上抜け）
  const { macdLine, signalLine } = macd(closes);
  if (
    !isNaN(macdLine[last]) &&
    !isNaN(signalLine[last]) &&
    !isNaN(macdLine[last - 1]) &&
    !isNaN(signalLine[last - 1]) &&
    macdLine[last] > signalLine[last] &&
    macdLine[last - 1] <= signalLine[last - 1]
  ) {
    signals.push({
      name: "MACDクロス(買)",
      type: "buy",
      description: "MACDがシグナルラインを上抜けました",
    });
  }

  // ④ ボリンジャーバンド下限タッチ
  const bb = bollingerBands(closes, 20);
  if (
    !isNaN(bb.lower[last]) &&
    closes[last] <= bb.lower[last]
  ) {
    signals.push({
      name: "BB下限タッチ",
      type: "buy",
      description: "価格がボリンジャーバンド下限に達しました",
    });
  }

  // ⑤ 短期上昇トレンド（5日MA > 25日MA かつ上向き）
  const sma5 = sma(closes, 5);
  if (
    !isNaN(sma5[last]) &&
    !isNaN(sma25[last]) &&
    sma5[last] > sma25[last] &&
    sma5[last] > sma5[last - 1]
  ) {
    signals.push({
      name: "短期上昇トレンド",
      type: "buy",
      description: "5日MAが25日MAを上回り上向きです",
    });
  }

  // --- 売りシグナル ---

  // ⑥ デッドクロス（短期MAが長期MAを下抜け）
  if (
    !isNaN(sma25[last]) &&
    !isNaN(sma75[last]) &&
    sma25[last] < sma75[last] &&
    sma25[last - 1] >= sma75[last - 1]
  ) {
    signals.push({
      name: "デッドクロス",
      type: "sell",
      description: "25日MAが75日MAを下抜けました",
    });
  }

  // ⑦ RSI 買われすぎ（70以上）
  if (!isNaN(lastRsi) && lastRsi > 70) {
    signals.push({
      name: `RSI買われすぎ(${lastRsi.toFixed(0)})`,
      type: "sell",
      description: `RSIが${lastRsi.toFixed(0)}と買われすぎの水準です`,
    });
  }

  // ⑧ MACDデッドクロス（MACDがシグナルを下抜け）
  if (
    !isNaN(macdLine[last]) &&
    !isNaN(signalLine[last]) &&
    !isNaN(macdLine[last - 1]) &&
    !isNaN(signalLine[last - 1]) &&
    macdLine[last] < signalLine[last] &&
    macdLine[last - 1] >= signalLine[last - 1]
  ) {
    signals.push({
      name: "MACDクロス(売)",
      type: "sell",
      description: "MACDがシグナルラインを下抜けました",
    });
  }

  // ⑨ ボリンジャーバンド上限タッチ
  if (
    !isNaN(bb.upper[last]) &&
    closes[last] >= bb.upper[last]
  ) {
    signals.push({
      name: "BB上限タッチ",
      type: "sell",
      description: "価格がボリンジャーバンド上限に達しました",
    });
  }

  // ⑩ 短期下降トレンド
  if (
    !isNaN(sma5[last]) &&
    !isNaN(sma25[last]) &&
    sma5[last] < sma25[last] &&
    sma5[last] < sma5[last - 1]
  ) {
    signals.push({
      name: "短期下降トレンド",
      type: "sell",
      description: "5日MAが25日MAを下回り下向きです",
    });
  }

  return signals;
}
