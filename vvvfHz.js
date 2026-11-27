/**
 * vvvfHz.js
 * 電車のVVVF基本周波数 y (Hz) を計算する統合モジュール
 * どこからでも import して利用可能
 */

export const VVVF_PRESETS = Object.freeze([
  {
    id: "commuter_4p",
    category: "普通・通勤電車（標準4極）",
    polesP: 4,
    wheelDiameterM: 0.86,
    gearRatio: 6.5,
    slipPowerS: 0.02,
    slipBrakeS: -0.02,
    lockRatioLambda: 0.35,
    js_yFromXSync: "y = (4 * x) / 120",
    js_yFromXPower: "y = (4 * x) / (120 * (1 - 0.02))",
    js_yFromXBrake: "y = (4 * x) / (120 * (1 - (-0.02)))",
    js_yFromXLock: "y = (4 * x) / (120 * (1 - (-0.02)))",
    js_xFromV: "x = (1000 * v * 6.5) / (60 * Math.PI * 0.86)",
    js_yFromVPower: "y = (4 * ((1000 * v * 6.5) / (60 * Math.PI * 0.86))) / (120 * (1 - 0.02))",
    js_yFromVBrake: "y = (4 * ((1000 * v * 6.5) / (60 * Math.PI * 0.86))) / (120 * (1 - (-0.02)))",
    js_yFromVLock: "y = (4 * ((1000 * (v * (1 - 0.35)) * 6.5) / (60 * Math.PI * 0.86))) / (120 * (1 - (-0.02)))"
  },
  {
    id: "express_4p_highspeed",
    category: "特急・優等列車（4極・高速寄り）",
    polesP: 4,
    wheelDiameterM: 0.86,
    gearRatio: 5.3,
    slipPowerS: 0.015,
    slipBrakeS: -0.015,
    lockRatioLambda: 0.35,
    js_yFromXSync: "y = (4 * x) / 120",
    js_yFromXPower: "y = (4 * x) / (120 * (1 - 0.015))",
    js_yFromXBrake: "y = (4 * x) / (120 * (1 - (-0.015)))",
    js_yFromXLock: "y = (4 * x) / (120 * (1 - (-0.015)))",
    js_xFromV: "x = (1000 * v * 5.3) / (60 * Math.PI * 0.86)",
    js_yFromVPower: "y = (4 * ((1000 * v * 5.3) / (60 * Math.PI * 0.86))) / (120 * (1 - 0.015))",
    js_yFromVBrake: "y = (4 * ((1000 * v * 5.3) / (60 * Math.PI * 0.86))) / (120 * (1 - (-0.015)))",
    js_yFromVLock: "y = (4 * ((1000 * (v * (1 - 0.35)) * 5.3) / (60 * Math.PI * 0.86))) / (120 * (1 - (-0.015)))"
  },
  {
    id: "heavy_commuter_6p",
    category: "通勤・郊外電車（6極モーター想定）",
    polesP: 6,
    wheelDiameterM: 0.86,
    gearRatio: 6.2,
    slipPowerS: 0.02,
    slipBrakeS: -0.02,
    lockRatioLambda: 0.35,
    js_yFromXSync: "y = (6 * x) / 120",
    js_yFromXPower: "y = (6 * x) / (120 * (1 - 0.02))",
    js_yFromXBrake: "y = (6 * x) / (120 * (1 - (-0.02)))",
    js_yFromXLock: "y = (6 * x) / (120 * (1 - (-0.02)))",
    js_xFromV: "x = (1000 * v * 6.2) / (60 * Math.PI * 0.86)",
    js_yFromVPower: "y = (6 * ((1000 * v * 6.2) / (60 * Math.PI * 0.86))) / (120 * (1 - 0.02))",
    js_yFromVBrake: "y = (6 * ((1000 * v * 6.2) / (60 * Math.PI * 0.86))) / (120 * (1 - (-0.02)))",
    js_yFromVLock: "y = (6 * ((1000 * (v * (1 - 0.35)) * 6.2) / (60 * Math.PI * 0.86))) / (120 * (1 - (-0.02)))"
  },
  {
    id: "shinkansen_4p",
    category: "新幹線・高速車両（標準4極想定）",
    polesP: 4,
    wheelDiameterM: 0.91,
    gearRatio: 3.8,
    slipPowerS: 0.01,
    slipBrakeS: -0.01,
    lockRatioLambda: 0.35,
    js_yFromXSync: "y = (4 * x) / 120",
    js_yFromXPower: "y = (4 * x) / (120 * (1 - 0.01))",
    js_yFromXBrake: "y = (4 * x) / (120 * (1 - (-0.01)))",
    js_yFromXLock: "y = (4 * x) / (120 * (1 - (-0.01)))",
    js_xFromV: "x = (1000 * v * 3.8) / (60 * Math.PI * 0.91)",
    js_yFromVPower: "y = (4 * ((1000 * v * 3.8) / (60 * Math.PI * 0.91))) / (120 * (1 - 0.01))",
    js_yFromVBrake: "y = (4 * ((1000 * v * 3.8) / (60 * Math.PI * 0.91))) / (120 * (1 - (-0.01)))",
    js_yFromVLock: "y = (4 * ((1000 * (v * (1 - 0.35)) * 3.8) / (60 * Math.PI * 0.91))) / (120 * (1 - (-0.01)))"
  },
  {
    id: "shinkansen_6p",
    category: "新幹線・高速車両（6極モーター想定）",
    polesP: 6,
    wheelDiameterM: 0.91,
    gearRatio: 3.6,
    slipPowerS: 0.01,
    slipBrakeS: -0.01,
    lockRatioLambda: 0.35,
    js_yFromXSync: "y = (6 * x) / 120",
    js_yFromXPower: "y = (6 * x) / (120 * (1 - 0.01))",
    js_yFromXBrake: "y = (6 * x) / (120 * (1 - (-0.01)))",
    js_yFromXLock: "y = (6 * x) / (120 * (1 - (-0.01)))",
    js_xFromV: "x = (1000 * v * 3.6) / (60 * Math.PI * 0.91)",
    js_yFromVPower: "y = (6 * ((1000 * v * 3.6) / (60 * Math.PI * 0.91))) / (120 * (1 - 0.01))",
    js_yFromVBrake: "y = (6 * ((1000 * v * 3.6) / (60 * Math.PI * 0.91))) / (120 * (1 - (-0.01)))",
    js_yFromVLock: "y = (6 * ((1000 * (v * (1 - 0.35)) * 3.6) / (60 * Math.PI * 0.91))) / (120 * (1 - (-0.01)))"
  }
]);

const PRESET_MAP = new Map(VVVF_PRESETS.map((preset) => [preset.id, preset]));

/**
 * プリセットIDを取得する（見つからなければ例外）
 * @param {string} presetId
 */
export function getVvvfPreset(presetId) {
  const preset = PRESET_MAP.get(presetId);
  if (!preset) {
    throw new Error(`[vvvfHz] Unknown presetId: ${presetId}`);
  }
  return preset;
}

/**
 * 速度 v (km/h) と滑走率 lambda (0..1) からモーター回転数 x (rpm) を計算
 * @param {object} params
 * @param {string} [params.presetId="commuter_4p"]
 * @param {number} params.v - 走行速度 [km/h]
 * @param {number} [params.lambda=0] - 車輪滑走率 [0..1]
 * @returns {number} モーター回転数 x [rpm]
 */
export function calcMotorRpm({ presetId = "commuter_4p", v, lambda = 0 } = {}) {
  if (typeof v !== "number" || Number.isNaN(v)) {
    throw new Error("[vvvfHz] v (km/h) must be a finite number.");
  }
  const preset = getVvvfPreset(presetId);
  const clampedLambda = Math.min(1, Math.max(0, Number(lambda) || 0));
  const effectiveV = v * (1 - clampedLambda);
  return (1000 * effectiveV * preset.gearRatio) / (60 * Math.PI * preset.wheelDiameterM);
}

/**
 * 回転数 x (rpm) または速度 v (km/h) から周波数 y (Hz) を計算して返す
 * @param {object} params
 * @param {string} [params.presetId="commuter_4p"] - プリセットID
 * @param {"sync"|"power"|"brake"|"lock"} [params.mode="power"] - 動作モード
 * @param {number|null} [params.x=null] - モーター回転数 [rpm]
 * @param {number|null} [params.v=null] - 走行速度 [km/h]
 * @param {number|null} [params.lambda=null] - 滑走率 [0..1]（lock時に指定可能）
 * @returns {number} 周波数 y [Hz]
 */
export function getHz({
  presetId = "commuter_4p",
  mode = "power",
  x = null,
  v = null,
  lambda = null
} = {}) {
  const preset = getVvvfPreset(presetId);

  const lockRatio =
    mode === "lock"
      ? (typeof lambda === "number" ? lambda : preset.lockRatioLambda)
      : 0;
  const clampedLambda = Math.min(1, Math.max(0, lockRatio));

  let effectiveX;
  if (typeof v === "number" && !Number.isNaN(v)) {
    effectiveX = calcMotorRpm({ presetId, v, lambda: clampedLambda });
  } else if (typeof x === "number" && !Number.isNaN(x)) {
    effectiveX = mode === "lock" ? x * (1 - clampedLambda) : x;
  } else {
    throw new Error("[vvvfHz] Either v (km/h) or x (rpm) must be provided.");
  }

  let slip = 0;
  if (mode === "power") {
    slip = preset.slipPowerS;
  } else if (mode === "brake" || mode === "lock") {
    slip = preset.slipBrakeS;
  } else if (mode !== "sync") {
    throw new Error(`[vvvfHz] Unknown mode: ${mode}`);
  }

  const y = (preset.polesP * effectiveX) / (120 * (1 - slip));
  return y;
}

export default getHz;
