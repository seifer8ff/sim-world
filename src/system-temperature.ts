import {
  lerp,
  normalize,
  normalizeNoise,
  positionToIndex,
} from "./misc-utility";
import { MapWorld } from "./map-world";
import { Biomes } from "./biomes";
import Noise from "rot-js/lib/noise/noise";
import { Layer } from "./renderer";
import { SystemPoles } from "./system-poles";
import { Season, SystemTime } from "./system-time";
import { SystemShadows } from "./system-shadows";
import { SystemOcclusion } from "./system-occlusion";
import { GameSettings } from "./game-settings";
import { SystemClouds } from "./system-clouds";

export enum Climates {
  Scorching = "Scorching",
  Hot = "Hot",
  Warm = "Warm",
  Cool = "Cool",
  Cold = "Cold",
  Freezing = "Freezing",
}

export const TempMap = {
  [Climates.Scorching]: {
    min: 0.85,
    max: 1,
  },
  [Climates.Hot]: {
    min: 0.7,
    max: 0.85,
  },
  [Climates.Warm]: {
    min: 0.5,
    max: 0.7,
  },
  [Climates.Cool]: {
    min: 0.3,
    max: 0.5,
  },
  [Climates.Cold]: {
    min: 0.15,
    max: 0.3,
  },
  [Climates.Freezing]: {
    min: 0,
    max: 0.15,
  },
};

export interface TemperatureSettings {
  modifiers: TemperatureModifiers;
  noiseGeneration: TemperatureNoiseGenerationSettings;
  updateSettings: TemperatureUpdateSettings;
}

export interface TemperatureModifiers {
  baseTemperature: number;
  magnetismModifier: number;
  heightModifier: number;
  dayModifier: number;
  nightModifier: number;
  sunShadowModifier: number;
  occlusionShadowModifier: number;
  cloudShadowModifier: number;
  summerModifier: number;
  springModifier: number;
  fallModifier: number;
  winterModifier: number;
}

export interface TemperatureNoiseGenerationSettings {
  baseScale: number;
  secondaryScale: number;
  tertiaryScale: number;
  baseWeight: number;
  secondaryWeight: number;
  tertiaryWeight: number;
}

export interface TemperatureUpdateSettings {
  interval: number;
  historyLength: number;
}

export class SystemTemperature {
  private static baseTemperatureMap: Map<number, number>;
  private static temperatureMap: Map<number, number>; // Cache for adjusted temperatures
  private static temperatureHistory: Map<number, number[]>; // Store recent temperatures

  // Cache of settings for performance
  private static modifiers: TemperatureModifiers;
  private static generationSettings: TemperatureNoiseGenerationSettings;
  private static updateSettings: TemperatureUpdateSettings;

  public static init() {
    this.baseTemperatureMap = new Map();
    this.temperatureMap = new Map();
    this.temperatureHistory = new Map();
    this.cacheSettings();
  }

  /**
   * Cache settings from GameSettings for performance
   */
  private static cacheSettings() {
    this.modifiers = GameSettings.options.temperature.modifiers;
    this.generationSettings = GameSettings.options.temperature.noiseGeneration;
    this.updateSettings = GameSettings.options.temperature.updateSettings;
  }

  public static generate(
    x: number,
    y: number,
    width: number,
    height: number,
    noise: Noise,
    map: MapWorld
  ): number {
    const index = positionToIndex(x, y, Layer.TERRAIN);
    const terrainHeight = map.heightMap.get(index);
    const terrainAboveSeaLevel = terrainHeight - map.seaLevel;
    const magnetism = SystemPoles.get(x, y);
    const noiseLayerOffset = 1000000; // offset to ensure noise layers are unique

    const noiseX = x / width;
    const noiseY = y / height;
    let noiseValue = this.modifiers.baseTemperature; // start with a base temperature modifier, positive or negative

    // Calculate base noise with multiple octaves
    noiseValue +=
      noise.get(
        noiseX * this.generationSettings.baseScale,
        noiseY * this.generationSettings.baseScale
      ) * this.generationSettings.baseWeight;

    // // Mix in secondary noise (medium frequency)
    noiseValue +=
      noise.get(
        // offset each noise layer to create more variation
        (noiseX + this.generationSettings.secondaryScale * noiseLayerOffset) *
          this.generationSettings.secondaryScale,
        (noiseY + this.generationSettings.secondaryScale * noiseLayerOffset) *
          this.generationSettings.secondaryScale
        // noiseX * this.generationSettings.secondaryScale,
        // noiseY * this.generationSettings.secondaryScale
      ) * this.generationSettings.secondaryWeight;

    // // Mix in detail noise (high frequency)
    noiseValue +=
      noise.get(
        (noiseX + this.generationSettings.tertiaryScale * noiseLayerOffset) *
          this.generationSettings.tertiaryScale,
        (noiseY + this.generationSettings.tertiaryScale * noiseLayerOffset) *
          this.generationSettings.tertiaryScale
      ) * this.generationSettings.tertiaryWeight;

    // // Normalize by dividing by the sum of weights
    const weightSum =
      this.generationSettings.baseWeight +
      this.generationSettings.secondaryWeight +
      this.generationSettings.tertiaryWeight;
    noiseValue = noiseValue / weightSum;

    let heightModifier = terrainAboveSeaLevel >= 0 ? terrainAboveSeaLevel : 0;
    heightModifier = heightModifier / (1 - map.seaLevel); // normalize to 0-1 range
    noiseValue -= heightModifier * this.modifiers.heightModifier; // apply height modifier to temperature

    // Apply magnetism effect (poles are colder)
    noiseValue -= magnetism * this.modifiers.magnetismModifier;

    // apply a final normalization to ensure the value is between 0 and 1
    noiseValue = normalizeNoise(noiseValue);
    this.baseTemperatureMap.set(index, noiseValue);

    //
    // Calculate and store the fully adjusted temperature
    const adjustedTemp = this.calculateAdjustedTemp(noiseValue, index);
    this.temperatureMap.set(index, adjustedTemp);

    // Record temperature history
    this.recordTemperatureHistory(index, adjustedTemp);
    //

    return noiseValue;
  }

  /**
   * Update temperatures on turn progression
   */
  public static turnUpdate(): void {
    if (SystemTime.currentTurn % this.updateSettings.interval === 0) {
      // Time to do a full temperature update
      this.updateTemperatures();
    }
  }

  // Update all temperatures at once
  private static updateTemperatures(): void {
    this.baseTemperatureMap.forEach((baseTemp, index) => {
      // Calculate current temperature
      const currentAdjusted = this.calculateAdjustedTemp(baseTemp, index);

      // Record to history
      this.recordTemperatureHistory(index, currentAdjusted);

      // Calculate averaged temperature
      const history = this.temperatureHistory.get(index) || [currentAdjusted];
      const avgTemp =
        history.reduce((sum, temp) => sum + temp, 0) / history.length;

      // Store the adjusted temperature directly
      this.temperatureMap.set(index, avgTemp);
    });
  }

  /**
   * Separately calculate temperature without updating state
   * This helps decouple from cloud and shadow systems
   */
  private static calculateAdjustedTemp(
    baseTemp: number,
    index: number
  ): number {
    // Apply time-based modifiers
    const timeModifier = SystemTime.isDayTime
      ? this.calculateDaytimeModifier()
      : this.calculateNighttimeModifier();

    // Apply seasonal modifiers
    const seasonModifier = this.calculateSeasonModifier();

    // Calculate the adjusted temperature
    let adjustedTemp = baseTemp + timeModifier + seasonModifier;

    // Apply environmental effects separately
    adjustedTemp = this.applyEnvironmentalEffects(adjustedTemp, index);

    // Ensure temperature stays within valid range
    return Math.max(0, Math.min(1, adjustedTemp));
  }

  /**
   * Apply environmental effects to temperature
   * This separates the effects for better decoupling
   */
  private static applyEnvironmentalEffects(
    temp: number,
    index: number
  ): number {
    let adjustedTemp = temp;

    // Apply shadow effects - shadows cool areas
    if (GameSettings.options.toggles.enableSunShadows) {
      const shadowValue = SystemShadows.shadowMap[index];
      if (shadowValue > 0) {
        adjustedTemp -=
          shadowValue *
          SystemShadows.shadowStrength *
          this.modifiers.sunShadowModifier;
      }
    }

    // Apply occlusion effects - valleys and areas between hills are cooler
    if (GameSettings.options.toggles.enableOcclusionShadows) {
      const occlusionValue = SystemOcclusion.occlusionMap[index];
      if (occlusionValue > 0) {
        adjustedTemp -=
          occlusionValue *
          SystemOcclusion.strengthMultiplier *
          this.modifiers.occlusionShadowModifier;
      }
    }

    // Apply cloud effects - clouded areas are cooler
    if (GameSettings.options.toggles.enableClouds) {
      let cloudValue = SystemClouds.get(index);
      cloudValue -= SystemClouds.cloudMinLevel;
      if (cloudValue > 0) {
        adjustedTemp -=
          cloudValue *
          SystemClouds.cloudStrength *
          this.modifiers.cloudShadowModifier;
      }
    }

    return adjustedTemp;
  }

  /**
   * Record temperature in history for averaging
   */
  private static recordTemperatureHistory(
    index: number,
    temperature: number
  ): void {
    if (!this.temperatureHistory.has(index)) {
      this.temperatureHistory.set(index, []);
    }

    const history = this.temperatureHistory.get(index);
    history.push(temperature);

    // Maintain history length
    if (history.length > this.updateSettings.historyLength) {
      history.shift();
    }
  }

  /**
   * Calculate temperature modifier based on time of day during daylight
   * Morning: cooler → Mid-day: warmest → Evening: cooling down
   */
  private static calculateDaytimeModifier(): number {
    const dayProgress = 1 - SystemTime.remainingCyclePercent;

    // Warmest at mid-day (bell curve)
    // Creates a curve that peaks at mid-day and falls off at morning/evening
    const tempCurve = Math.sin(dayProgress * Math.PI);

    // Scale the modifier based on configured daytime strength
    return tempCurve * this.modifiers.dayModifier;
  }

  /**
   * Calculate temperature modifier for nighttime
   * Temperature decreases throughout the night, coldest before dawn
   */
  private static calculateNighttimeModifier(): number {
    const nightProgress = 1 - SystemTime.remainingCyclePercent;

    // Get colder as night progresses, coldest at end of night (before dawn)
    // Creates a downward curve that bottoms out near dawn
    const tempFall = -this.modifiers.nightModifier * nightProgress;

    return tempFall;
  }

  /**
   * Calculate temperature modifier based on current season
   */
  private static calculateSeasonModifier(): number {
    switch (SystemTime.season) {
      case Season.Summer:
        return this.modifiers.summerModifier;
      case Season.Spring:
        return this.modifiers.springModifier;
      case Season.Fall:
        return this.modifiers.fallModifier;
      case Season.Winter:
        return this.modifiers.winterModifier;
      default:
        return 0;
    }
  }

  public static getBaseMap(): Map<number, number> {
    return this.baseTemperatureMap; // Return the original map, for terrain gen
  }

  public static getMap(): Map<number, number> {
    return this.temperatureMap;
  }

  public static get(x: number, y: number): number {
    const index = positionToIndex(x, y, Layer.TERRAIN);
    return this.getByIndex(index);
  }

  public static getByIndex(index: number): number {
    return this.temperatureMap.get(index) || 0;
  }

  public static set(x: number, y: number, temp: number): void {
    const index = positionToIndex(x, y, Layer.TERRAIN);
    this.baseTemperatureMap.set(index, temp);
  }

  public static logDetails(): void {
    console.log(
      `SystemTemperature: ${this.baseTemperatureMap.size} temperatures generated.` +
        `Season: ${
          SystemTime.season
        } and modifier: ${this.calculateSeasonModifier()}` +
        `Time of day: ${SystemTime.isDayTime ? "Day" : "Night"}` +
        `Time of day modifier: ${this.calculateDaytimeModifier()}` +
        `Temperature Scale: ${this.modifiers.baseTemperature}`
    );
  }

  public static getDescription(temperature: number): Climates {
    for (let climate in TempMap) {
      const range = TempMap[climate];
      if (temperature >= range.min && temperature <= range.max) {
        return climate as Climates;
      }
    }
  }
}
