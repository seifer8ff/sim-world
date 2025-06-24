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
import { SystemTime } from "./system-time";
import { GameSettings } from "./game-settings";

export enum MoistureZones {
  SuperSaturated = "Super Saturated",
  Wet = "Humid",
  Balanced = "Balanced",
  Dry = "Dry",
  Arid = "Arid",
}

export const MoistureZoneMap = {
  [MoistureZones.SuperSaturated]: {
    min: 0.85,
    max: 1,
  },
  [MoistureZones.Wet]: {
    min: 0.7,
    max: 0.85,
  },
  [MoistureZones.Balanced]: {
    min: 0.3,
    max: 0.7,
  },
  [MoistureZones.Dry]: {
    min: 0.15,
    max: 0.3,
  },
  [MoistureZones.Arid]: {
    min: 0,
    max: 0.15,
  },
};

export interface MoistureSettings {
  modifiers: MoistureModifiers;
  noiseGeneration: MoistureNoiseGenerationSettings;
  updateSettings: MoistureUpdateSettings;
}

export interface MoistureModifiers {
  nearWaterMultiplier: number; // Multiplier for when near water
  multiplier: number; // Multiplier for the final noise value before normalizing it
  baseMoisture: number; // Base moisture level to start from
}

export interface MoistureNoiseGenerationSettings {
  baseWeight: number;
  baseScale: number;
}

export interface MoistureUpdateSettings {
  interval: number;
  historyLength: number;
}

export class SystemMoisture {
  public static baseMoistureMap: Map<number, number>;
  public static moistureMap: Map<number, number>;
  private static moistureHistory: Map<number, number[]>; // Store recent moisture values

  // Cache of settings for performance
  private static modifiers: MoistureModifiers;
  private static generationSettings: MoistureNoiseGenerationSettings;
  private static updateSettings: MoistureUpdateSettings;

  public static init() {
    this.baseMoistureMap = new Map();
    this.moistureMap = new Map();
    this.moistureHistory = new Map();
    this.modifiers = GameSettings.options.moisture.modifiers;
    this.generationSettings = GameSettings.options.moisture.noiseGeneration;
    this.updateSettings = GameSettings.options.moisture.updateSettings;
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
    const isWater = map.isWater(x, y);
    // const distanceToWater = this.distanceTo(x, y, [
    //   Biomes.Biomes.ocean.id,
    //   Biomes.Biomes.oceandeep.id,
    // ]);

    const noiseX = x / width;
    const noiseY = y / height;
    let noiseValue = this.modifiers.baseMoisture; // start with a base temperature modifier, positive or negative

    // Calculate base noise with multiple octaves
    noiseValue +=
      noise.get(
        noiseX * this.generationSettings.baseScale,
        noiseY * this.generationSettings.baseScale
      ) * this.generationSettings.baseWeight;

    noiseValue = normalizeNoise(noiseValue);
    // if (!isWater) {
    //   console.log(noiseValue);
    // }
    // multiply if near water
    // if (noiseValue > MoistureZoneMap[MoistureZones.Balanced].min && nearWater) {
    //   noiseValue = noiseValue * this.modifiers.nearWaterMultiplier;
    // }

    if (isWater) {
      const moisturePercent = map.seaLevel - terrainHeight / map.seaLevel;
      noiseValue = lerp(
        moisturePercent,
        MoistureZoneMap[MoistureZones.Wet].min,
        MoistureZoneMap[MoistureZones.Wet].max
      );
      // noiseValue is increased to wet level + how far below sea
      // const middleWetLevel =
      //   MoistureZoneMap[MoistureZones.Wet].min +
      //   (MoistureZoneMap[MoistureZones.Wet].max -
      //     MoistureZoneMap[MoistureZones.Wet].min) /
      //     2;
      // noiseValue = middleWetLevel;
    }

    noiseValue *= this.modifiers.multiplier;

    // console.log("temp", noiseValue, terrainHeight);
    this.baseMoistureMap.set(
      index,
      normalize(noiseValue)
      // lerp(noiseValue, 0, 1)
    );
    // if (!isWater) {
    //   console.log(this.baseMoistureMap.get(index));
    // }
    // console.log("scaled temp", this.tempMap[key]);
    return this.baseMoistureMap.get(index);
  }

  // public static generate(
  //   x: number,
  //   y: number,
  //   width: number,
  //   height: number,
  //   noise: Noise,
  //   map: MapWorld
  // ): number {
  //   const index = positionToIndex(x, y, Layer.TERRAIN);
  //   const terrainHeight = map.heightMap.get(index);
  //   const isWater = map.isWater(x, y);
  //   const nearWater = map.isAdjacentToBiome(x, y, map.terrainAdjacencyD2Map, [
  //     Biomes.Biomes.ocean.id,
  //   ]);

  //   let noiseX = x / width - 0.5;
  //   let noiseY = y / height - 0.5;
  //   noiseX = x * this.generationSettings.baseScale;
  //   noiseY = y * this.generationSettings.baseScale;
  //   let noiseValue = noise.get(noiseX, noiseY);
  //   noiseValue = normalizeNoise(noiseValue);
  //   // noiseValue = Math.min(1, Math.max(-1, noiseValue));
  //   // noiseValue = (noiseValue + 1) / 2;
  //   // multiply if near water
  //   if (noiseValue > MoistureZoneMap[MoistureZones.Balanced].min && nearWater) {
  //     noiseValue = noiseValue * this.modifiers.nearWaterMultiplier;
  //   }

  //   if (isWater) {
  //     const moisturePercent = map.seaLevel - terrainHeight / map.seaLevel;
  //     noiseValue = lerp(
  //       moisturePercent,
  //       MoistureZoneMap[MoistureZones.Wet].min,
  //       MoistureZoneMap[MoistureZones.Wet].max
  //     );
  //     // noiseValue is increased to wet level + how far below sea
  //     // const middleWetLevel =
  //     //   MoistureZoneMap[MoistureZones.Wet].min +
  //     //   (MoistureZoneMap[MoistureZones.Wet].max -
  //     //     MoistureZoneMap[MoistureZones.Wet].min) /
  //     //     2;
  //     // noiseValue = middleWetLevel;
  //   }

  //   noiseValue *= this.modifiers.multiplier;

  //   // console.log("temp", noiseValue, terrainHeight);
  //   this.baseMoistureMap.set(
  //     index,
  //     normalizeNoise(noiseValue)
  //     // lerp(noiseValue, 0, 1)
  //   );
  //   // console.log("scaled temp", this.tempMap[key]);
  //   return this.baseMoistureMap.get(index);
  // }

  public static turnUpdate(): void {
    if (SystemTime.currentTurn % this.updateSettings.interval === 0) {
      // Time to do a full temperature update
      this.updateMoistureLevels();
    }
  }

  private static updateMoistureLevels(): void {
    // how should we update moisture?
    //
    // this.baseMoistureMap.forEach((baseTemp, index) => {
    //   // Calculate current temperature
    //   const currentAdjusted = this.calculateAdjustedTemp(baseTemp, index);
    //   // Record to history
    //   this.recordTemperatureHistory(index, currentAdjusted);
    //   // Calculate averaged temperature
    //   const history = this.temperatureHistory.get(index) || [currentAdjusted];
    //   const avgTemp =
    //     history.reduce((sum, temp) => sum + temp, 0) / history.length;
    //   // Store the adjusted temperature directly
    //   this.temperatureMap.set(index, avgTemp);
    // });
  }

  public static setAt(x: number, y: number, temp: number): void {
    this.baseMoistureMap.set(positionToIndex(x, y, Layer.TERRAIN), temp);
  }

  public static at(x: number, y: number): number {
    return this.baseMoistureMap?.get(positionToIndex(x, y, Layer.TERRAIN));
  }

  public static atIndex(index: number): number {
    return this.baseMoistureMap?.get(index);
  }

  public static getDescriptionForMoisture(
    moistureLevel: number
  ): MoistureZones {
    for (let climate in MoistureZoneMap) {
      const range = MoistureZoneMap[climate];
      if (moistureLevel >= range.min && moistureLevel <= range.max) {
        return climate as MoistureZones;
      }
    }
  }
}
