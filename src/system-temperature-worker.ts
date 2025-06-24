import {
  TemperatureGenerationModifiers,
  TemperatureGenerationSettings,
} from "./system-temperature";
import { Season } from "./system-time";

export enum TemperatureWorkerMessage {
  INIT,
  UPDATE_CURRENT_TEMPS,
  UPDATE_TIME_PROPERTIES,
}

let settings: TemperatureGenerationSettings;
let modifiers: TemperatureGenerationModifiers;
let baseTemperatureBuffer: Float32Array;
let currentTemperatureBuffer: Float32Array;
let shadowBuffer: Float32Array;
let occlusionBuffer: Float32Array;
let cloudBuffer: Float32Array;
let shadowStrength: number;
let occlusionStrength: number;
let cloudMinLevel: number;
let cloudStrength: number;
let enableSunShadows: boolean;
let enableOcclusionShadows: boolean;
let enableClouds: boolean;
let mapWidth: number;
let mapHeight: number;

// Time-based properties
let isDayTime: boolean;
let season: Season;
let remainingCyclePercent: number;

onmessage = (e) => {
  switch (e.data.type) {
    case TemperatureWorkerMessage.INIT:
      init(e.data.data);
      break;
    case TemperatureWorkerMessage.UPDATE_CURRENT_TEMPS:
      updateCurrentTemperatures();
      break;
    case TemperatureWorkerMessage.UPDATE_TIME_PROPERTIES:
      updateTimeProperties(e.data.data);
      break;
  }
};

const init = (data: {
  baseTemperatureBuffer: SharedArrayBuffer;
  currentTemperatureBuffer: SharedArrayBuffer;
  shadowBuffer: SharedArrayBuffer;
  occlusionBuffer: SharedArrayBuffer;
  cloudBuffer: SharedArrayBuffer;
  mapWidth: number;
  mapHeight: number;
  settings: TemperatureGenerationSettings;
  modifiers: TemperatureGenerationModifiers;
  enableSunShadows: boolean;
  enableOcclusionShadows: boolean;
}) => {
  settings = data.settings;
  modifiers = data.modifiers;
  mapWidth = data.mapWidth;
  mapHeight = data.mapHeight;
  enableSunShadows = data.enableSunShadows;
  enableOcclusionShadows = data.enableOcclusionShadows;
  baseTemperatureBuffer = new Float32Array(data.baseTemperatureBuffer);
  currentTemperatureBuffer = new Float32Array(data.currentTemperatureBuffer);
  shadowBuffer = new Float32Array(data.shadowBuffer);
  occlusionBuffer = new Float32Array(data.occlusionBuffer);
  cloudBuffer = new Float32Array(data.cloudBuffer);
};

const updateTimeProperties = (data: {
  isDayTime: boolean;
  season: Season;
  remainingCyclePercent: number;
}) => {
  isDayTime = data.isDayTime;
  season = data.season;
  remainingCyclePercent = data.remainingCyclePercent;
};

const updateCurrentTemperatures = () => {
  for (let i = 0; i < baseTemperatureBuffer.length; i++) {
    const baseTemp = baseTemperatureBuffer[i];
    if (baseTemp === 0) continue; // Skip uninitialized positions

    const adjustedTemp = calculateAdjustedTemp(baseTemp, i);
    currentTemperatureBuffer[i] = adjustedTemp;
  }

  postMessage({
    type: TemperatureWorkerMessage.UPDATE_CURRENT_TEMPS,
  });
};

const calculateAdjustedTemp = (baseTemp: number, index: number): number => {
  // Apply time-based modifiers
  const timeModifier = isDayTime
    ? applyDaytimeModifier()
    : applyNighttimeModifier();

  // Apply seasonal modifiers
  const seasonModifier = applySeasonModifier();

  let adjustedTemp = baseTemp + timeModifier + seasonModifier;

  // Apply environmental effects
  adjustedTemp = applyEnvironmentalEffects(adjustedTemp, index);

  return Math.max(0, Math.min(1, adjustedTemp));
};

/**
 * Apply environmental effects to temperature
 * including shadows, occlusion, and clouds
 */
const applyEnvironmentalEffects = (temp: number, index: number): number => {
  let adjustedTemp = temp;

  // Apply shadow effects - shadows cool areas
  if (enableSunShadows && shadowBuffer) {
    const shadowValue = shadowBuffer[index];
    if (shadowValue > 0) {
      adjustedTemp -=
        shadowValue * shadowStrength * modifiers.sunShadowModifier;
    }
  }

  // Apply occlusion effects - valleys and areas between hills are cooler
  if (enableOcclusionShadows) {
    let occlusionValue = occlusionBuffer[index];
    if (occlusionValue > 0) {
      adjustedTemp -=
        occlusionValue *
        // SystemOcclusion.strengthMultiplier *
        occlusionStrength *
        modifiers.occlusionShadowModifier;
    }
  }

  // Apply cloud effects - clouded areas are cooler
  if (enableClouds) {
    let cloudValue = cloudBuffer[index];
    cloudValue -= cloudMinLevel;
    if (cloudValue > 0) {
      adjustedTemp +=
        cloudValue * cloudStrength * modifiers.cloudShadowModifier;
    }
  }

  return adjustedTemp;
};

/**
 * Calculate temperature modifier based on time of day during daylight
 * Morning: cooler → Mid-day: warmest → Evening: cooling down
 */
const applyDaytimeModifier = (): number => {
  const dayProgress = 1 - remainingCyclePercent;

  // Warmest at mid-day (bell curve)
  // Creates a curve that peaks at mid-day and falls off at morning/evening
  const tempCurve = Math.sin(dayProgress * Math.PI);

  // Scale the modifier based on configured daytime strength
  return tempCurve * modifiers.dayModifier;
};

/**
 * Calculate temperature modifier for nighttime
 * Temperature decreases throughout the night, coldest before dawn
 */
const applyNighttimeModifier = (): number => {
  const nightProgress = 1 - remainingCyclePercent;

  // Get colder as night progresses, coldest at end of night (before dawn)
  // Creates a downward curve that bottoms out near dawn
  const tempFall = -modifiers.nightModifier * nightProgress;

  return tempFall;
};

/**
 * Calculate temperature modifier based on current season
 */
const applySeasonModifier = (): number => {
  switch (season) {
    case Season.Summer:
      return modifiers.summerModifier;
    case Season.Spring:
      return modifiers.springModifier;
    case Season.Fall:
      return modifiers.fallModifier;
    case Season.Winter:
      return modifiers.winterModifier;
    default:
      return 0;
  }
};
