import { Game } from "./game";
import Simplex from "rot-js/lib/noise/simplex";
import { LightManager } from "./light-manager";
import { lerp, normalizeNoise, positionToIndex } from "./misc-utility";
import { MapWorld } from "./map-world";
import { Biomes } from "./biomes";
import Noise from "rot-js/lib/noise/noise";
import { Layer } from "./renderer";

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

export class MapTemperature {
  public lightManager: LightManager;
  public tempMap: Map<number, number>;
  public temperatureScale: number;
  private tempNoise: Simplex;

  constructor(private game: Game, private map: MapWorld) {
    this.tempMap = new Map();
    this.temperatureScale = 1.5;
  }

  public init() {
    this.tempMap = new Map();
  }

  public generateInitialTemp(
    x: number,
    y: number,
    width: number,
    height: number,
    noise: Noise
  ): number {
    const index = positionToIndex(x, y, Layer.TERRAIN);
    const terrainHeight = this.map.heightMap.get(index);
    const terrainAboveSeaLevel = this.map.seaLevel - terrainHeight;
    const magnetism = this.map.polesMap.getMagnetism(x, y);
    let heightModifier = terrainHeight;
    // higher terrain is colder
    if (terrainHeight > Biomes.Biomes.hillsmid.generationOptions.height.min) {
      heightModifier =
        Biomes.Biomes.hillsmid.generationOptions.height.min / 1.1;
    }
    if (terrainHeight > Biomes.Biomes.hillshigh.generationOptions.height.min) {
      heightModifier =
        Biomes.Biomes.hillshigh.generationOptions.height.min / 1.3;
    }
    // add seasonality
    // add humidity
    // add wind

    let noiseX = x / width - 0.5;
    let noiseY = y / height - 0.5;
    noiseX = x / 60;
    noiseY = y / 60;
    let noiseValue = noise.get(noiseX, noiseY);
    // mix multiple levels of noise
    // then divide by the sum of the weights to get back to between 0 and 1
    noiseValue += noise.get(noiseX * 2, noiseY * 2) * 0.5;
    noiseValue += noise.get(noiseX * 5, noiseY * 5) * 0.25;
    noiseValue = noiseValue / (1 + 0.5 + 0.25);
    noiseValue = normalizeNoise(noiseValue);
    // increase temp for low height and decrease for high height
    noiseValue = noiseValue * heightModifier;
    // reduce temp at high magnetism
    noiseValue -= magnetism;
    noiseValue = normalizeNoise(noiseValue * this.temperatureScale);
    this.tempMap.set(index, noiseValue);
    return this.tempMap.get(index);
  }

  setTemp(x: number, y: number, temp: number): void {
    const index = positionToIndex(x, y, Layer.TERRAIN);
    this.tempMap.set(index, temp);
  }

  getTemp(x: number, y: number): number {
    const index = positionToIndex(x, y, Layer.TERRAIN);
    return this.tempMap.get(index);
  }

  getTempByIndex(index: number): number {
    return this.tempMap.get(index);
  }

  getCurrentClimate(x: number, y: number): Climates {
    const index = positionToIndex(x, y, Layer.TERRAIN);
    const temp = this.tempMap.get(index);
    for (let climate in TempMap) {
      const range = TempMap[climate];
      if (temp >= range.min && temp <= range.max) {
        return climate as Climates;
      }
    }
  }
}
