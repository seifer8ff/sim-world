import { Game } from "./game";
import { lerp, positionToIndex } from "./misc-utility";
import { MapWorld } from "./map-world";
import { GameSettings } from "./game-settings";
import { SystemTime } from "./system-time";
import { SystemTemperature } from "./system-temperature";
import { SystemMoisture } from "./system-moisture";
import { Tile } from "./tile";
import { Layer } from "./renderer";

export enum MessageType {
  INIT,
  UPDATE,
  ON_ENTER,
  INTERPOLATE_STRENGTH,
}

export class SystemClouds {
  public static cloudMap: Float32Array;
  public static targetCloudMap: Float32Array; // interpolate cloudMap to targetCloudMap to smooth transitions
  public static cloudStrength: number;
  public static sunbeamStrength: number;
  public static cloudMinLevel: number; // threshold for when a cloud begins
  public static sunbeamMaxLevel: number; // threshold for when a sunbeam ends
  private static cloudMapBuffer: SharedArrayBuffer; // the buffer used to share data with the worker
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
    const bufferSize =
      GameSettings.options.gameSize.width *
      GameSettings.options.gameSize.height *
      Tile.tileDensityRatio;
    this.cloudMapBuffer = new SharedArrayBuffer(
      bufferSize * Float32Array.BYTES_PER_ELEMENT
    );
    this.cloudMap = new Float32Array(bufferSize);
    this.targetCloudMap = new Float32Array(this.cloudMapBuffer);
    this.worker.postMessage({
      type: MessageType.INIT,
      data: {
        sharedBuffer: this.cloudMapBuffer,
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
        this.cloudStrength = e.data.data.cloudStrength;
        this.sunbeamStrength = e.data.data.sunbeamStrength;
      }
    };
  }

  public static turnUpdate(map: MapWorld) {
    if (!GameSettings.options.toggles.enableClouds) {
      return;
    }

    let heights = [];
    let moistures = [];
    for (let i = 0; i < GameSettings.options.gameSize.width; i++) {
      for (let j = 0; j < GameSettings.options.gameSize.height; j++) {
        const index = positionToIndex(i, j, Layer.TERRAIN);
        heights[index] = map.heightMap.get(index) ?? 0;
        moistures[index] = SystemMoisture.atIndex(index);
      }
    }
    this.worker?.postMessage({
      type: MessageType.UPDATE,
      data: {
        heights,
        temperatures: SystemTemperature.all,
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

    if (this.targetCloudMap) {
      let val: number;
      let posIndex: number;
      // only iterate through tiles in the viewport
      for (let i = 0; i < tileIndexes.length; i++) {
        posIndex = tileIndexes[i];
        val = lerp(
          SystemTime.turnAnimTimePercent,
          this.atIndex(posIndex),
          this.targetCloudMap[posIndex]
        );
        this.setIndex(posIndex, val);
      }
    }
  }

  public static setIndex(index: number, cloudLevel: number): void {
    this.cloudMap[index] = cloudLevel;
  }

  public static atIndex(index: number): number {
    return this.cloudMap ? this.cloudMap[index] : 0; // Default to 0 if not set
  }

  public static atTargetIndex(index: number): number {
    return this.targetCloudMap ? this.targetCloudMap[index] : 0;
  }
}
