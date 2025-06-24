import { HeightLayer, MapWorld } from "./map-world";
import { GameSettings } from "./game-settings";
import { SystemTime } from "./system-time";
import { SystemSunMoon } from "./system-sun-moon";
import { Tile } from "./tile";

// Import for worker message types
export enum ShadowWorkerMessage {
  INIT,
  UPDATE,
  ON_ENTER,
  UPDATE_SHADOW_PROPERTIES,
}

// Height values used for shadow casting calculations
// the slope between layers is used to determine if a tile is shadowed or not
export const HeightLayerFalloff = {
  Hole: 0.25,
  Valley: 0.5,
  SeaLevel: 0.7,
  LowHill: 0.8,
  MidHill: 0.9,
  HighHill: 1,
};

export interface ShadowsSettings {
  shadowStrengthMultiplier: number;
  minShadowLength: number;
  maxShadowLength: number;
  minShadowStrength: number;
  shadowLengthMultiplier: number;
  nightShadowLengthFactor: number;
  nightShadowStrengthFactor: number;
  baseSlopeThreshold: number;
  slopeThresholdRange: number;
  slopeMaxThreshold: number;
  raytracingResolution: number;
}

/**
 * Implementation class for shadow calculations for the map.
 * Shadows are calculated in real-time based on the sun angle and height differences.
 */
export class SystemShadowsImplementation {
  // stores the current shadow values for visible tiles
  public shadowMap: Float32Array; // actual shadow map data
  // Shadow parameters: these get updated as time passes
  public shadowStrength: number; // current shadow strength based on time, etc
  public shadowLength: number; // current shadow length based on time, etc

  private shadowMapBuffer: SharedArrayBuffer; // the buffer used to share data with the worker
  private map: MapWorld;
  // Settings cached from GameSettings
  private settings: ShadowsSettings;
  // Web worker for shadow calculations
  private worker: Worker;

  /**
   * Initialize the shadow system with settings from GameSettings
   */
  public init(map: MapWorld): void {
    // Cache settings
    this.settings = GameSettings.options.shadows as ShadowsSettings;
    this.map = map;

    this.shadowMapBuffer = new SharedArrayBuffer(
      GameSettings.options.gameSize.width *
        GameSettings.options.gameSize.height *
        Tile.tileDensityRatio *
        Float32Array.BYTES_PER_ELEMENT // buffer is for a Float32Array
    );
    this.shadowMap = new Float32Array(this.shadowMapBuffer);

    // Initialize worker
    this.worker = new Worker(
      new URL("./system-shadows-worker.ts", import.meta.url)
    );

    // Set up message handling
    this.worker.onmessage = (e) => {
      if (e.data.type === ShadowWorkerMessage.UPDATE_SHADOW_PROPERTIES) {
        const { shadowLength, shadowStrength } = e.data.data;
        this.shadowLength = shadowLength;
        this.shadowStrength = shadowStrength;
      }
    };

    const heightLayerMapArray: HeightLayer[] = Array(
      this.map.heightLayerMap.size
    );
    this.map.heightLayerMap.forEach((value: HeightLayer, key: number) => {
      heightLayerMapArray[key] = value;
    });

    // Send initial data to worker
    this.worker.postMessage({
      type: ShadowWorkerMessage.INIT,
      data: {
        sharedBuffer: this.shadowMapBuffer,
        mapWidth: GameSettings.options.gameSize.width,
        mapHeight: GameSettings.options.gameSize.height,
        settings: this.settings,
        heightLayerMap: heightLayerMapArray,
      },
    });
  }
  /**
   * Update sun position and shadows based on time of day
   */
  public turnUpdate() {
    if (!GameSettings.options.toggles.enableSunShadows) return;

    // Send sun/moon data to worker
    this.worker.postMessage({
      type: ShadowWorkerMessage.UPDATE_SHADOW_PROPERTIES,
      data: {
        sunAngle: SystemSunMoon.angle,
        sunElevation: SystemSunMoon.elevation,
        isDayTime: SystemTime.isDayTime,
      },
    });

    // triggers the worker to update the shared shadow map
    this.worker.postMessage({
      type: ShadowWorkerMessage.UPDATE,
    });
  }

  /**
   * Clean up resources
   */
  public cleanup() {
    if (this.worker) {
      this.worker.terminate();
    }
  }
}

/**
 * Manages shadow calculations for the map.
 * Shadows are calculated in real-time based on the sun angle and height differences.
 * Provides a singleton interface for shadow management.
 */
export class SystemShadows {
  private static instance = new SystemShadowsImplementation();

  /**
   * Initialize the shadow system
   */
  static init(map: MapWorld): void {
    return this.instance.init(map);
  }

  /**
   * Update sun position and shadows based on time of day
   */
  static turnUpdate() {
    return this.instance.turnUpdate();
  }

  /**
   * Get the shadow map
   */
  static get all(): Float32Array {
    return this.instance.shadowMap;
  }

  static cleanup() {
    if (this.instance["worker"]) {
      this.instance.cleanup();
    }
  }

  /**
   * Get the current shadow strength
   */
  static get shadowStrength(): number {
    return this.instance.shadowStrength;
  }

  /**
   * Get the current shadow length
   */
  static get shadowLength(): number {
    return this.instance.shadowLength;
  }
}
