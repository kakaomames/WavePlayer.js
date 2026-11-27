/**
 * test_vvvfHz.js
 * 0.1s 間隔の速度JSONデータを順番に getHz() へ渡し、値の変化をログ出力するテスト
 */

import getHz from "./vvvfHz.js";

// 0.1s 間隔の走行テストデータ（JSON配列）
const SPEED_TIMELINE_JSON = [
  { "t": 0.0, "v": 0.0,  "mode": "power", "lambda": 0.0,  "note": "停車・発進準備" },
  { "t": 0.1, "v": 2.5,  "mode": "power", "lambda": 0.0,  "note": "低速発進" },
  { "t": 0.2, "v": 6.0,  "mode": "power", "lambda": 0.0,  "note": "加速中" },
  { "t": 0.3, "v": 10.5, "mode": "power", "lambda": 0.0,  "note": "加速中" },
  { "t": 0.4, "v": 15.0, "mode": "power", "lambda": 0.0,  "note": "加速中" },
  { "t": 0.5, "v": 20.0, "mode": "power", "lambda": 0.0,  "note": "加速中" },
  { "t": 0.6, "v": 25.0, "mode": "power", "lambda": 0.0,  "note": "加速中" },
  { "t": 0.7, "v": 30.0, "mode": "brake", "lambda": 0.0,  "note": "ブレーキ開始" },
  { "t": 0.8, "v": 28.0, "mode": "lock",  "lambda": 0.45, "note": "車輪ロック発生！" },
  { "t": 0.9, "v": 26.5, "mode": "lock",  "lambda": 0.70, "note": "滑走深度アップ" },
  { "t": 1.0, "v": 25.0, "mode": "brake", "lambda": 0.0,  "note": "再粘着・ブレーキ復帰" }
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runHzTest({
  presetId = "commuter_4p",
  stepMs = 100,
  realTime = false
} = {}) {
  let prevHz = null;
  let prevMode = null;

  console.log(`[TEST_START] presetId=${presetId}, steps=${SPEED_TIMELINE_JSON.length}, stepMs=${stepMs}`);

  for (const frame of SPEED_TIMELINE_JSON) {
    const hz = getHz({
      presetId,
      mode: frame.mode,
      v: frame.v,
      lambda: frame.lambda
    });

    const roundedHz = Number(hz.toFixed(4));
    const hzChanged = prevHz === null || Math.abs(roundedHz - prevHz) >= 0.0001;
    const modeChanged = prevMode !== frame.mode;

    // 値（Hz または mode）が変わったときだけログに出力
    if (hzChanged || modeChanged) {
      const diff = prevHz === null ? 0 : Number((roundedHz - prevHz).toFixed(4));
      console.log(
        `[HZ_CHANGE] t=${frame.t.toFixed(1)}s | v=${frame.v.toFixed(1)}km/h | mode=${frame.mode} | lambda=${frame.lambda} | y=${roundedHz}Hz (delta=${diff >= 0 ? "+" : ""}${diff}Hz) | ${frame.note}`
      );
      prevHz = roundedHz;
      prevMode = frame.mode;
    }

    if (realTime) {
      await sleep(stepMs);
    }
  }

  console.log("[TEST_END] テスト完了！");
}

// まずは一瞬で全ステップ確認（実時間 0.1s 間隔で流したい場合は realTime: true に変更）
runHzTest({ presetId: "commuter_4p", stepMs: 100, realTime: false });
