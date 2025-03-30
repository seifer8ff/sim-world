import { Game } from "./game";
import { lerp } from "./misc-utility";
import { MapWorld } from "./map-world";
import { GameSettings } from "./game-settings";

export enum MessageType {
  INIT,
  UPDATE,
  ON_ENTER,
  INTERPOLATE_STRENGTH,
}

export class MapClouds {
  public cloudMap: number[];
  public targetCloudMap: number[];
  public cloudStrength: number;
  public sunbeamStrength: number;
  public cloudMinLevel: number; // threshold for when a cloud begins
  public sunbeamMaxLevel: number; // threshold for when a sunbeam ends
  private worker: Worker;

  constructor(private game: Game, private map: MapWorld) {
    this.cloudStrength = 1;
    this.sunbeamStrength = 0.7;
    this.cloudMinLevel = 0.75;
    this.sunbeamMaxLevel = 0.3;
    this.worker = new Worker(
      new URL("./map-clouds-worker.ts", import.meta.url)
    );
  }

  public init() {
    this.cloudMap = [];
    this.targetCloudMap = [];
    let type: MessageType;
    let cloudMap: Map<number, number>;
    this.worker.postMessage({
      type: MessageType.INIT,
      data: {
        gameWidth: GameSettings.options.gameSize.width,
        gameHeight: GameSettings.options.gameSize.height,
        cloudStrength: this.cloudStrength,
        sunbeamStrength: this.sunbeamStrength,
        sunbeamMaxLevel: this.sunbeamMaxLevel,
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
  public turnUpdate() {
    if (!GameSettings.options.toggles.enableClouds) {
      return;
    }
    const tiles = this.game.userInterface.camera.viewportTilesPadded;
    const biomeIds = tiles.map((tileIndex) => this.map.biomeMap.get(tileIndex));
    this.worker.postMessage({
      type: MessageType.UPDATE,
      data: {
        tileIndexes: tiles,
        biomeIds,
      },
    });
  }

  public renderUpdate(interPercent: number) {
    if (!GameSettings.options.toggles.enableClouds) {
      return;
    }
    this.worker.postMessage({
      type: MessageType.INTERPOLATE_STRENGTH,
      data: {
        lightTransitionPercent: this.game.timeManager.lightTransitionPercent,
        remainingCyclePercent: this.game.timeManager.remainingCyclePercent,
        lightPhase: this.game.timeManager.lightPhase,
      },
    });
    this.interpolateCloudState(
      this.game.userInterface.camera.viewportTilesUnpadded
    );
  }

  public interpolateCloudState(tileIndexes: number[]) {
    if (!GameSettings.options.toggles.enableClouds) {
      return;
    }
    let val: number;
    let posIndex: number;
    // only iterate through tiles in the viewport
    for (let i = 0; i < tileIndexes.length; i++) {
      posIndex = tileIndexes[i];
      val = lerp(
        this.game.timeManager.turnAnimTimePercent,
        this.get(posIndex),
        this.targetCloudMap[posIndex]
      );
      this.set(posIndex, val);
    }
  }

  set(index: number, cloudLevel: number): void {
    this.cloudMap[index] = cloudLevel;
  }

  get(index: number): number {
    return this.cloudMap[index];
  }

  onEnter(indexes: number[]): void {
    if (!GameSettings.options.toggles.enableClouds) {
      return;
    }
    if (indexes.length === 0) {
      return;
    }
    this.worker.postMessage({
      type: MessageType.ON_ENTER,
      data: {
        tileIndexes: indexes,
        biomeIds: indexes.map((index) => this.map.biomeMap.get(index)),
      },
    });
  }
}
