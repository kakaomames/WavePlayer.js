/**
 * WavePlayer.js
 * iPadOS Safari / Web Audio API 向けに、ユーザー操作イベント内で
 * AudioContext の生成と ctx.resume() を優先実行する本体モジュール。
 */
let audioCtx = null;
let unlocked = false;
let unlockPromise = null;
let lastObservedState = null;

function logChange(level, message) {
  const line = `[WavePlayer:${level}] ${message}`;
  console.log(line);
  if (typeof window !== "undefined" && typeof window.onWpLog === "function") {
    window.onWpLog(level, message);
  }
}

function syncContextStateLog(ctx, reason = "check") {
  if (!ctx) return;
  if (ctx.state !== lastObservedState) {
    const prev = lastObservedState;
    lastObservedState = ctx.state;
    logChange("STATE", `AudioContext state 変化 (${reason}): ${prev ?? "none"} -> ${ctx.state}`);
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
    lastObservedState = audioCtx.state;
    logChange("STATE", `AudioContext 生成 -> state=${audioCtx.state}`);

    if (typeof audioCtx.addEventListener === "function") {
      audioCtx.addEventListener("statechange", () => {
        syncContextStateLog(audioCtx, "statechange");
      });
    }
  } else {
    syncContextStateLog(audioCtx, "ensureAudioContext");
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
    logChange("UNLOCK", `無音バッファ再生完了 -> state=${ctx.state}`);
    return true;
  } catch (err) {
    logChange("WARN", `無音バッファ再生スキップ -> ${err}`);
    return false;
  }
}

/**
 * ユーザー操作のイベントハンドラ内から同期的に呼ぶ優先解除処理。
 * iPadOS Safari ではジェスチャー直後に resume() を呼び出すことが重要。
 */
function kickResumeImmediately(sourceEventName = "gesture") {
  const ctx = ensureAudioContext();
  if (!ctx) return null;

  syncContextStateLog(ctx, `before:${sourceEventName}`);

  let resumePromise = null;
  if (ctx.state !== "running" && typeof ctx.resume === "function") {
    try {
      resumePromise = ctx.resume();
      logChange("GESTURE", `[${sourceEventName}] 内で ctx.resume() 優先キック -> state=${ctx.state}`);
    } catch (err) {
      logChange("WARN", `[${sourceEventName}] 内で ctx.resume() 呼び出しエラー -> ${err}`);
    }
  }

  if (ctx.state === "running") {
    playSilentUnlockBuffer(ctx);
    if (!unlocked) {
      unlocked = true;
      logChange("UNLOCK", `[${sourceEventName}] 音声アンロック完了 -> unlocked=true`);
    }
  } else if (resumePromise && typeof resumePromise.then === "function") {
    resumePromise
      .then(() => {
        syncContextStateLog(ctx, `after:${sourceEventName}`);
        if (ctx.state === "running") {
          playSilentUnlockBuffer(ctx);
          if (!unlocked) {
            unlocked = true;
            logChange("UNLOCK", `[${sourceEventName}] resume 後にアンロック完了 -> unlocked=true`);
          }
        }
      })
      .catch((err) => {
        logChange("WARN", `[${sourceEventName}] resume 失敗 -> ${err}`);
      });
  }

  return ctx;
}

async function unlockAudio(sourceEventName = "unlockAudio") {
  const preCtx = kickResumeImmediately(sourceEventName);
  if (!preCtx) {
    return null;
  }

  if (unlocked && preCtx.state === "running") {
    return preCtx;
  }

  if (unlockPromise) {
    logChange("STATE", "既存の unlockPromise を待機中...");
    return unlockPromise;
  }

  unlockPromise = (async () => {
    logChange("STEP", `unlockAudio 開始 -> state=${preCtx.state}`);
    const ctx = ensureAudioContext();
    if (!ctx) {
      return null;
    }

    if (ctx.state !== "running") {
      logChange("STEP", `ctx.resume() 実行前 -> state=${ctx.state}`);
      await withTimeout(ctx.resume(), 350, "ctx.resume()");
      syncContextStateLog(ctx, "unlockAudio:resumed");
    }

    if (ctx.state === "running") {
      playSilentUnlockBuffer(ctx);
      if (!unlocked) {
        unlocked = true;
        logChange("UNLOCK", "音声アンロック完了 -> unlocked=true");
      }
      cleanupUnlockListeners();
    } else {
      logChange("WARN", `unlockAudio 終了時も state=${ctx.state}`);
    }

    return ctx;
  })().finally(() => {
    unlockPromise = null;
  });

  return unlockPromise;
}

const unlockEvents = ["pointerdown", "touchstart", "touchend", "click", "keydown"];

function createGestureHandler(eventName) {
  return function handleAutoUnlock() {
    kickResumeImmediately(eventName);
    unlockAudio(eventName).catch((err) => {
      logChange("WARN", `自動アンロック待機中 (${eventName}) -> ${err}`);
    });
  };
}

const boundListeners = unlockEvents.map((eventName) => ({
  eventName,
  handler: createGestureHandler(eventName),
}));

function attachUnlockListeners() {
  const g = typeof window !== "undefined" ? window : globalThis;
  if (typeof g.addEventListener !== "function") {
    return;
  }
  boundListeners.forEach(({ eventName, handler }) => {
    g.addEventListener(eventName, handler, { passive: true, capture: true });
  });
  logChange("INIT", "iPadOS 優先アンロックリスナー登録完了");
}

function cleanupUnlockListeners() {
  const g = typeof window !== "undefined" ? window : globalThis;
  if (typeof g.removeEventListener !== "function") {
    return;
  }
  boundListeners.forEach(({ eventName, handler }) => {
    g.removeEventListener(eventName, handler, { capture: true });
  });
}

function normalizeNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * 数字を受け取って波を生成し、再生する関数
 * @param {number} value - 周波数(Hz)として扱う数字（20〜20000に制限、不正値は440）
 * @param {number} [duration=0.4] - 再生時間（秒、0.005秒以上）
 * @param {number} [volume=0.3] - 音量倍率（0.0〜1.0に制限）
 * @param {function|null} [waveFn=null] - カスタム波形関数 (t, freq, sampleRate) => -1.0〜1.0
 * @returns {Promise<AudioBufferSourceNode|null>}
 */
export async function playWaveFromNumber(value, duration = 0.4, volume = 0.3, waveFn = null) {
  logChange("STEP", `playWaveFromNumber 開始 -> value=${value}, duration=${duration}, volume=${volume}`);

  // 再生呼び出しの瞬間にもまず同期 resume を試みる
  let ctx = kickResumeImmediately("playWaveFromNumber");
  if (!ctx) {
    return null;
  }

  if (!unlocked || ctx.state !== "running") {
    ctx = await withTimeout(unlockAudio("playWaveFromNumber"), 500, "unlockAudio()");
  }

  if (!ctx || typeof ctx !== "object") {
    logChange("WARN", `有効な AudioContext が取得できませんでした -> ctx=${String(ctx)}`);
    return null;
  }

  syncContextStateLog(ctx, "beforePlay");
  if (ctx.state !== "running") {
    logChange("STEP", `再生前 resume 試行 -> state=${ctx.state}`);
    await withTimeout(ctx.resume(), 350, "再生前 ctx.resume()");
    syncContextStateLog(ctx, "afterPlayResume");
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
  getState: () => (audioCtx ? audioCtx.state : "none"),
};

export default playWaveFromNumber;
