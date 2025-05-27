import { Game } from "./game";
import { lerp } from "./misc-utility";
import { MapWorld } from "./map-world";
import { GameSettings } from "./game-settings";
import { SystemTime } from "./system-time";
import { SystemTemperature } from "./system-temperature";
import { SystemMoisture } from "./system-moisture";

export enum MessageType {
  INIT,
  UPDATE,
  ON_ENTER,
  INTERPOLATE_STRENGTH,
}

export class SystemClouds {
  public static cloudMap: number[];
  public static targetCloudMap: number[];
  public static cloudStrength: number;
  public static sunbeamStrength: number;
  public static cloudMinLevel: number; // threshold for when a cloud begins
  public static sunbeamMaxLevel: number; // threshold for when a sunbeam ends
  private static worker: Worker;

  public static init() {
    this.cloudStrength = 1;
    this.sunbeamStrength = 0.7;
    // Use values from GameSettings
    this.cloudMinLevel = GameSettings.options.clouds.cloudMinLevel;
    this.sunbeamMaxLevel = GameSettings.options.clouds.sunbeamMaxLevel;
    this.worker = new Worker(
      new URL("./system-clouds-worker.ts", import.meta.url)
    );
    this.cloudMap = [];
    this.targetCloudMap = [];
    let cloudMap: Map<number, number>;
    this.worker.postMessage({
      type: MessageType.INIT,
      data: {
        gameWidth: GameSettings.options.gameSize.width,
        gameHeight: GameSettings.options.gameSize.height,
        cloudStrength: this.cloudStrength,
        sunbeamStrength: this.sunbeamStrength,
        sunbeamMaxLevel: this.sunbeamMaxLevel,
        cloudMinLevel: this.cloudMinLevel,
        windSpeed: GameSettings.options.clouds.windSpeed,
        baseWindSpeed: GameSettings.options.clouds.baseWindSpeed,
        windSpeedMax: GameSettings.options.clouds.windSpeedMax,
        windSpeedMin: GameSettings.options.clouds.windSpeedMin,
        windSpeedChangeChance:
          GameSettings.options.clouds.windSpeedChangeChance,
        windSpeedChangeAmount:
          GameSettings.options.clouds.windSpeedChangeAmount,
        windSpeedChangeDirection:
          GameSettings.options.clouds.windSpeedChangeDirection,
        windSpeedChangeDirectionChance:
          GameSettings.options.clouds.windSpeedChangeDirectionChance,
        // Cloud generation parameters
        cloudGeneration: GameSettings.options.clouds.generation,
        biomeClouds: GameSettings.options.clouds.biomeClouds,
      },
    });
    this.worker.onmessage = (e) => {
      if (e.data.type === MessageType.UPDATE) {
        cloudMap = e.data.data.cloudMap;
        this.cloudStrength = e.data.data.cloudStrength;
        this.sunbeamStrength = e.data.data.sunbeamStrength;
        for (let [tileIndex, cloudValue] of cloudMap.entries()) {
          if (cloudValue === undefined) {
            continue;
          }
          this.set(tileIndex, this.targetCloudMap[tileIndex]);
        }
        this.targetCloudMap.length = 0;
        for (let [tileIndex, cloudValue] of cloudMap.entries()) {
          if (cloudValue === undefined) {
            continue;
          }
          this.targetCloudMap[tileIndex] = cloudValue;
        }
      }
      if (e.data.type === MessageType.ON_ENTER) {
        cloudMap = e.data.data;
        for (let [tileIndex, cloudValue] of cloudMap.entries()) {
          if (cloudValue === undefined) {
            continue;
          }
          this.set(tileIndex, cloudValue);
          this.targetCloudMap[tileIndex] = cloudValue;
        }
      }
    };
  }

  // called each game turn
  public static turnUpdate(map: MapWorld, tileIndexes: number[]) {
    if (!GameSettings.options.toggles.enableClouds) {
      return;
    }
    // const biomeIds = tileIndexes.map((tileIndex) =>
    //   map.biomeMap.get(tileIndex)
    // );
    const heights = tileIndexes.map((tileIndex) =>
      map.heightMap.get(tileIndex)
    );
    const temperatures = tileIndexes.map((tileIndex) =>
      SystemTemperature.getByIndex(tileIndex)
    );
    const moistures = tileIndexes.map((tileIndex) =>
      SystemMoisture.getByIndex(tileIndex)
    );
    this.worker?.postMessage({
      type: MessageType.UPDATE,
      data: {
        tileIndexes: tileIndexes,
        heights,
        temperatures,
        moistures,
      },
    });
  }

  public static renderUpdate(interPercent: number, tileIndexes: number[]) {
    if (!GameSettings.options.toggles.enableClouds) {
      return;
    }
    this.worker?.postMessage({
      type: MessageType.INTERPOLATE_STRENGTH,
      data: {
        lightTransitionPercent: SystemTime.lightTransitionPercent,
        remainingCyclePercent: SystemTime.remainingCyclePercent,
        lightPhase: SystemTime.lightPhase,
      },
    });
    this.interpolateCloudState(tileIndexes);
  }

  public static interpolateCloudState(tileIndexes: number[]) {
    if (!GameSettings.options.toggles.enableClouds) {
      return;
    }
    let val: number;
    let posIndex: number;
    // only iterate through tiles in the viewport
    for (let i = 0; i < tileIndexes.length; i++) {
      posIndex = tileIndexes[i];
      val = lerp(
        SystemTime.turnAnimTimePercent,
        this.get(posIndex),
        this.targetCloudMap[posIndex]
      );
      this.set(posIndex, val);
    }
  }

  public static set(index: number, cloudLevel: number): void {
    this.cloudMap[index] = cloudLevel;
  }

  public static get(index: number): number {
    return this.cloudMap[index];
  }

  public static getTarget(index: number): number {
    return this.targetCloudMap[index];
  }

  public static onEnter(updateTileIndexes: number[], map: MapWorld): void {
    if (!GameSettings.options.toggles.enableClouds) {
      return;
    }
    if (updateTileIndexes.length === 0) {
      return;
    }
    const heights = updateTileIndexes.map((tileIndex) =>
      map.heightMap.get(tileIndex)
    );
    const temperatures = updateTileIndexes.map((tileIndex) =>
      SystemTemperature.getByIndex(tileIndex)
    );
    const moistures = updateTileIndexes.map((tileIndex) =>
      SystemMoisture.getByIndex(tileIndex)
    );
    this.worker?.postMessage({
      type: MessageType.ON_ENTER,
      data: {
        tileIndexes: updateTileIndexes,
        heights,
        temperatures,
        moistures,
        // biomeIds: updateTileIndexes.map((index) => map.biomeMap.get(index)),
      },
    });
  }
}
