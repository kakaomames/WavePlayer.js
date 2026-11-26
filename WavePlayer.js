/**
 * wavePlayer.js
 * 読み込むだけでユーザー操作（タップ・クリック・キー入力）を検知して音声制限を解除し、
 * playWaveFromNumber(数字, 秒数, 音量) で波を生成・再生するスタンドアロンJS。
 */
(function (global) {
  "use strict";

  let audioCtx = null;
  let unlocked = false;
  let unlockPromise = null;

  function ensureAudioContext() {
    if (!audioCtx) {
      const AudioContextCtor = global.AudioContext || global.webkitAudioContext;
      if (!AudioContextCtor) {
        console.warn("[WavePlayer] Web Audio API 非対応環境です");
        return null;
      }
      audioCtx = new AudioContextCtor();
      console.log("[WavePlayer] AudioContext 生成:", audioCtx.state);
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
      return true;
    } catch (err) {
      console.warn("[WavePlayer] 無音バッファ再生スキップ:", err);
      return false;
    }
  }

  async function unlockAudio() {
    if (unlockPromise) {
      return unlockPromise;
    }

    unlockPromise = (async () => {
      const ctx = ensureAudioContext();
      if (!ctx) {
        return null;
      }

      if (ctx.state === "suspended" || ctx.state === "interrupted") {
        try {
          await ctx.resume();
          console.log("[WavePlayer] AudioContext resume 完了:", ctx.state);
        } catch (err) {
          console.warn("[WavePlayer] AudioContext resume 保留:", err);
        }
      }

      if (!unlocked && ctx.state === "running") {
        playSilentUnlockBuffer(ctx);
        unlocked = true;
        console.log("[WavePlayer] 音声アンロック完了");
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
      console.warn("[WavePlayer] 自動アンロック待機中:", err);
    });
  }

  function attachUnlockListeners() {
    if (typeof global.addEventListener !== "function") {
      return;
    }
    unlockEvents.forEach((eventName) => {
      global.addEventListener(eventName, handleAutoUnlock, { passive: true });
    });
  }

  function cleanupUnlockListeners() {
    if (typeof global.removeEventListener !== "function") {
      return;
    }
    unlockEvents.forEach((eventName) => {
      global.removeEventListener(eventName, handleAutoUnlock);
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
  async function playWaveFromNumber(value, duration = 0.4, volume = 0.3, waveFn = null) {
    const ctx = await unlockAudio();
    if (!ctx) {
      return null;
    }

    if (ctx.state !== "running") {
      try {
        await ctx.resume();
      } catch (_) {
        // ユーザー操作前の呼び出しでは running にならない場合がある
      }
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

    console.log(
      `[WavePlayer] 再生: freq=${freq}Hz, duration=${safeDuration}s, volume=${safeVolume}, unlocked=${unlocked}, state=${ctx.state}`
    );

    return source;
  }

  // スクリプト読み込みと同時にタップ・キー操作の自動検知を開始
  attachUnlockListeners();

  global.playWaveFromNumber = playWaveFromNumber;
  global.WavePlayer = {
    play: playWaveFromNumber,
    unlock: unlockAudio,
    getContext: ensureAudioContext,
    isUnlocked: () => unlocked,
  };
})(typeof window !== "undefined" ? window : globalThis);
