import { indexToXY, lerp, positionToIndex } from "./misc-utility";
import { HeightLayer, MapWorld } from "./map-world";
import { GameSettings } from "./game-settings";
import { Layer } from "./renderer";
import { DayPhase, SystemTime } from "./system-time";
import { SystemSettings } from "./system";
import { Tile } from "./tile";

// Height values used for shadow casting calculations
export const HeightDropoff = {
  Hole: 0.25,
  Valley: 0.5,
  SeaLevel: 0.7,
  LowHill: 0.8,
  MidHill: 0.9,
  HighHill: 1,
};

export interface OcclusionSettings extends SystemSettings {
  dayStartStrength: number;
  dayMidStrength: number;
  dayEndStrength: number;
  nightMidStrength: number;
  maxOcclusionAmount: number;
}

export enum OcclusionWorkerMessage {
  INIT,
  UPDATE,
  ON_ENTER,
  INTERPOLATE_STRENGTH,
}

/**
 * Implementation class for occlusion shadow calculations.
 * Occlusion Shadows are calculated in real-time based on height difference between terrain layers.
 */
export class SystemOcclusionImplementation {
  public map: Float32Array; // Use typed array for performance
  // multiplier on the occlusion map itself. Changes based on time of day, etc
  public strengthMultiplier: number = 1;
  private mapBuffer: SharedArrayBuffer; // the buffer used to share data with the worker
  // Settings cached from GameSettings
  private settings: OcclusionSettings;

  // Web worker for occlusion calculations
  private worker: Worker;

  public init(
    settings: OcclusionSettings,
    mapWidth: number,
    mapHeight: number,
    map: MapWorld
  ): void {
    // Cache settings
    this.settings = settings;

    this.mapBuffer = new SharedArrayBuffer(
      GameSettings.options.gameSize.width *
        GameSettings.options.gameSize.height *
        Tile.tileDensityRatio *
        Float32Array.BYTES_PER_ELEMENT // buffer is for a Float32Array
    );
    this.map = new Float32Array(this.mapBuffer);
    // this.map = new Float32Array(mapWidth * mapHeight * Tile.tileDensityRatio);

    // Initialize worker
    this.worker = new Worker(
      new URL("./system-occlusion-worker.ts", import.meta.url)
    );
    // Set up message handling
    this.worker.onmessage = (e) => {
      if (e.data.type === OcclusionWorkerMessage.UPDATE) {
        const { strengthMultiplier } = e.data.data;
        this.strengthMultiplier = strengthMultiplier;
      }
    };

    const heightLayerMapArray: HeightLayer[] = Array(map.heightLayerMap.size);
    map.heightLayerMap.forEach((value: HeightLayer, key: number) => {
      heightLayerMapArray[key] = value;
    });
    // Send initial data to worker
    this.worker.postMessage({
      type: OcclusionWorkerMessage.INIT,
      data: {
        sharedBuffer: this.mapBuffer,
        mapWidth: mapWidth,
        mapHeight: mapHeight,
        settings: this.settings,
        heightLayerMap: heightLayerMapArray,
        heightLayerAdjacencyD1Map: map.heightLayerAdjacencyD1Map,
        heightLayerAdjacencyD2Map: map.heightLayerAdjacencyD2Map,
      },
    });
  }
  /**
   * Update sun position based on time of day
   */
  public turnUpdate() {
    if (!GameSettings.options.toggles.enableOcclusionShadows) return;

    this.worker.postMessage({
      type: OcclusionWorkerMessage.INTERPOLATE_STRENGTH,
      data: {
        remainingCyclePercent: SystemTime.remainingPhasePercent,
        lightPhase: SystemTime.lightPhase,
        isDaytime: SystemTime.isDayTime,
      },
    });

    // update occlusion map for all tiles
    this.worker.postMessage({
      type: OcclusionWorkerMessage.UPDATE,
    });
  }
}

/**
 * Manages occlusion shadow calculations for the map.
 * Occlusion Shadows are calculated in real-time based on height difference between terrain layers.
 * Provides a singleton interface for occlusion management.
 */
export class SystemOcclusion {
  private static instance = new SystemOcclusionImplementation();

  /**
   * Initialize the occlusion system
   */
  static init(map: MapWorld): void {
    return this.instance.init(
      GameSettings.options.occlusion,
      GameSettings.options.gameSize.width,
      GameSettings.options.gameSize.height,
      map
    );
  }

  /**
   * Update occlusion based on time of day
   */
  static turnUpdate() {
    return this.instance.turnUpdate();
  }

  /**
   * Get the occlusion value at a specific position
   */
  static at(x: number, y: number): number {
    const posIndex = positionToIndex(x, y, Layer.TERRAIN);
    return this.instance.map ? this.instance.map[posIndex] : 0; // Default to 0 if not set
  }

  /**
   * Get the occlusion value at a specific index
   */
  static atIndex(index: number): number {
    return this.instance.map ? this.instance.map[index] : 0; // Default to 0 if not set
  }

  /**
   * Get the occlusion map
   */
  static get all(): Float32Array {
    return this.instance.map;
  }

  /**
   * Get the current occlusion strength multiplier
   */
  static get strengthMultiplier(): number {
    return this.instance.strengthMultiplier;
  }

  /**
   * Clean up resources
   */
  static cleanup() {
    if (this.instance["worker"]) {
      this.instance["worker"].terminate();
    }
  }
}
