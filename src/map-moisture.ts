import { Color, Map as RotJsMap } from "rot-js/lib/index";
import { RNG } from "rot-js";
import { Game } from "./game";
import { Biome, BiomeType, Season, Tile, TileType } from "./tile";
import { Point } from "./point";
import { Actor } from "./entities/actor";
import { Layer } from "./renderer";
import { Autotile } from "./autotile";
import Simplex from "rot-js/lib/noise/simplex";
import PreciseShadowcasting from "rot-js/lib/fov/precise-shadowcasting";
import { LightManager } from "./light-manager";
import { lerp } from "./misc-utility";
import { MapWorld } from "./map-world";
import { clamp } from "rot-js/lib/util";

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

export class MapMoisture {
  public moistureMap: { [key: string]: number };
  public scale: number;

  constructor(private game: Game, private map: MapWorld) {
    this.moistureMap = {};
    this.scale = 1;
  }

  public generateMoistureFor(
    x: number,
    y: number,
    width: number,
    height: number,
    noise: Simplex
  ): number {
    const key = MapWorld.coordsToKey(x, y);
    const terrainHeight = this.map.heightMap[key];
    const terrainType = this.map.terrainTileMap[key];
    const nearWater = this.map.isAdjacentToTerrain(x, y, [
      Tile.Biomes.ocean,
      Tile.Biomes.oceandeep,
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
    this.moistureMap[key] = lerp(noiseValue * this.scale, 0, 1);
    // console.log("scaled temp", this.tempMap[key]);
    return this.moistureMap[key];
  }

  setMoisture(x: number, y: number, temp: number): void {
    this.moistureMap[MapWorld.coordsToKey(x, y)] = temp;
  }

  getMoisture(x: number, y: number): number {
    return this.moistureMap[MapWorld.coordsToKey(x, y)];
  }

  getMoistureByKey(key: string): number {
    return this.moistureMap[key];
  }

  getMoistureDescription(x: number, y: number): MoistureZones {
    const key = MapWorld.coordsToKey(x, y);
    const moistureLevel = this.moistureMap[key];
    for (let climate in MoistureZoneMap) {
      const range = MoistureZoneMap[climate];
      if (moistureLevel >= range.min && moistureLevel <= range.max) {
        return climate as MoistureZones;
      }
    }
  }
}