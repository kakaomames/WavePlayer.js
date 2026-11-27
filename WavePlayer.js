/**
 * WavePlayer.js（固まり防止・ステップログ強化版）
 */
let audioCtx = null;
let unlocked = false;
let unlockPromise = null;

function logChange(level, message) {
  const line = `[WavePlayer:${level}] ${message}`;
  console.log(line);
  if (typeof window !== "undefined" && typeof window.onWpLog === "function") {
    window.onWpLog(level, message);
  }
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => {
        logChange("WARN", `${label} が ${ms}ms でタイムアウト（固まり回避）`);
        resolve("timeout");
      }, ms);
    }),
  ]);
}

function ensureAudioContext() {
  if (!audioCtx) {
    const g = typeof window !== "undefined" ? window : globalThis;
    const AudioContextCtor = g.AudioContext || g.webkitAudioContext;
    if (!AudioContextCtor) {
      logChange("WARN", "Web Audio API 非対応環境です");
      return null;
    }
    audioCtx = new AudioContextCtor();
    logChange("STATE", `AudioContext 生成 -> state=${audioCtx.state}`);
  }
  return audioCtx;
}

function playSilentUnlockBuffer(ctx) {
  try {
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate || 44100);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    logChange("UNLOCK", "無音バッファ再生完了");
    return true;
  } catch (err) {
    logChange("WARN", `無音バッファ再生スキップ -> ${err}`);
    return false;
  }
}

async function unlockAudio() {
  if (unlockPromise) {
    logChange("STATE", "既存の unlockPromise を待機中...");
    return unlockPromise;
  }

  unlockPromise = (async () => {
    logChange("STEP", "unlockAudio 開始");
    const ctx = ensureAudioContext();
    if (!ctx) {
      return null;
    }

    if (ctx.state === "suspended" || ctx.state === "interrupted") {
      logChange("STEP", `ctx.resume() 実行前 -> state=${ctx.state}`);
      await withTimeout(ctx.resume(), 300, "ctx.resume()");
      logChange("STATE", `ctx.resume() 通過 -> state=${ctx.state}`);
    }

    if (!unlocked && ctx.state === "running") {
      playSilentUnlockBuffer(ctx);
      unlocked = true;
      logChange("UNLOCK", "音声アンロック完了 -> unlocked=true");
      cleanupUnlockListeners();
    }

    return ctx;
  })().finally(() => {
    unlockPromise = null;
  });

  return unlockPromise;
}

const unlockEvents = ["pointerdown", "touchstart", "touchend", "click", "keydown"];

function handleAutoUnlock() {
  unlockAudio().catch((err) => {
    logChange("WARN", `自動アンロック待機中 -> ${err}`);
  });
}

function attachUnlockListeners() {
  const g = typeof window !== "undefined" ? window : globalThis;
  if (typeof g.addEventListener !== "function") {
    return;
  }
  unlockEvents.forEach((eventName) => {
    g.addEventListener(eventName, handleAutoUnlock, { passive: true });
  });
  logChange("INIT", "自動アンロックリスナー登録完了");
}

function cleanupUnlockListeners() {
  const g = typeof window !== "undefined" ? window : globalThis;
  if (typeof g.removeEventListener !== "function") {
    return;
  }
  unlockEvents.forEach((eventName) => {
    g.removeEventListener(eventName, handleAutoUnlock);
  });
}

function normalizeNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export async function playWaveFromNumber(value, duration = 0.4, volume = 0.3, waveFn = null) {
  logChange("STEP", `playWaveFromNumber 開始 -> value=${value}, duration=${duration}, volume=${volume}`);
  const ctx = await withTimeout(unlockAudio(), 500, "unlockAudio()");
  if (!ctx || typeof ctx !== "object") {
    logChange("WARN", `有効な AudioContext が取得できませんでした -> ctx=${String(ctx)}`);
    return null;
  }

  if (ctx.state !== "running") {
    logChange("STEP", `再生前 resume 試行 -> state=${ctx.state}`);
    await withTimeout(ctx.resume(), 300, "再生前 ctx.resume()");
  }

  const baseValue = normalizeNumber(value, 440);
  const freq = clamp(baseValue, 20, 20000);
  const safeDuration = Math.max(0.005, normalizeNumber(duration, 0.4));
  const safeVolume = clamp(normalizeNumber(volume, 0.3), 0.0, 1.0);

  const sampleRate = ctx.sampleRate || 44100;
  const frameCount = Math.max(1, Math.floor(sampleRate * safeDuration));
  const buffer = ctx.createBuffer(1, frameCount, sampleRate);
  const channelData = buffer.getChannelData(0);

  const fadeSamples = Math.min(240, Math.floor(frameCount * 0.1));
  const twoPiFreq = 2 * Math.PI * freq;
  const twoPiHarmonic = 2 * Math.PI * (freq * 2);

  for (let i = 0; i < frameCount; i++) {
    const t = i / sampleRate;

    let rawSample;
    if (typeof waveFn === "function") {
      rawSample = waveFn(t, freq, sampleRate);
    } else {
      rawSample = 0.75 * Math.sin(twoPiFreq * t) + 0.25 * Math.sin(twoPiHarmonic * t);
    }

    let env = 1.0;
    if (fadeSamples > 0) {
      if (i < fadeSamples) {
        env = i / fadeSamples;
      } else if (i > frameCount - fadeSamples) {
        env = (frameCount - i) / fadeSamples;
      }
    }

    const numericSample = Number.isFinite(rawSample) ? rawSample : 0;
    const clampedSample = clamp(numericSample, -1.0, 1.0);
    channelData[i] = clampedSample * safeVolume * env;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);

  logChange(
    "PLAY",
    `再生スタート！freq=${freq}Hz, duration=${safeDuration}s, volume=${safeVolume}, unlocked=${unlocked}, state=${ctx.state}`
  );

  return source;
}

attachUnlockListeners();

const globalTarget = typeof window !== "undefined" ? window : globalThis;
globalTarget.playWaveFromNumber = playWaveFromNumber;
globalTarget.WavePlayer = {
  play: playWaveFromNumber,
  unlock: unlockAudio,
  getContext: ensureAudioContext,
  isUnlocked: () => unlocked,
};

export default playWaveFromNumber;
