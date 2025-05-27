import { lerp, positionToIndex } from "./misc-utility";
import { MapWorld } from "./map-world";
import { Biomes } from "./biomes";
import Noise from "rot-js/lib/noise/noise";
import { Layer } from "./renderer";

export enum MoistureZones {
  SuperSaturated = "Super Saturated",
  Wet = "Wet",
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

export class SystemMoisture {
  public static moistureMap: Map<number, number>;
  public static scale: number;

  public static init() {
    this.moistureMap = new Map();
    this.scale = 1;
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
    const nearWater = map.isAdjacentToBiome(x, y, map.terrainAdjacencyD2Map, [
      Biomes.Biomes.ocean.id,
    ]);

    let noiseX = x / width - 0.5;
    let noiseY = y / height - 0.5;
    noiseX = x / 55;
    noiseY = y / 55;
    let noiseValue = noise.get(noiseX, noiseY);
    noiseValue = Math.min(1, Math.max(-1, noiseValue));
    noiseValue = (noiseValue + 1) / 2;
    // multiply if near water
    if (noiseValue > MoistureZoneMap[MoistureZones.Balanced].min && nearWater) {
      noiseValue = noiseValue * 1.1;
    }

    // console.log("temp", noiseValue, terrainHeight);
    this.moistureMap.set(index, lerp(noiseValue * this.scale, 0, 1));
    // console.log("scaled temp", this.tempMap[key]);
    return this.moistureMap.get(index);
  }

  public static set(x: number, y: number, temp: number): void {
    this.moistureMap.set(positionToIndex(x, y, Layer.TERRAIN), temp);
  }

  public static get(x: number, y: number): number {
    return this.moistureMap?.get(positionToIndex(x, y, Layer.TERRAIN));
  }

  public static getByIndex(index: number): number {
    return this.moistureMap?.get(index);
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
