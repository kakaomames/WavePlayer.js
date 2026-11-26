/**
 * main.js
 * WavePlayer.js から playWaveFromNumber をインポートし、WP(...args) でラッピングする
 */
import { playWaveFromNumber } from "./WavePlayer.js";

export function WP(...args) {
  console.log("[main.js] WP 呼び出し -> args:", args);
  return playWaveFromNumber(...args);
}

const globalTarget = typeof window !== "undefined" ? window : globalThis;
globalTarget.WP = WP;

export default WP;
