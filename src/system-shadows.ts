import { indexToXY, positionToIndex } from "./misc-utility";
import { MapWorld } from "./map-world";
import { GameSettings } from "./game-settings";
import { Layer } from "./renderer";
import { Viewport } from "./camera";
import { SystemTime } from "./system-time";
import { SystemSunMoon } from "./system-sun-moon";

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

/**
 * Manages shadow calculations for the map.
 * Shadows are calculated in real-time based on the sun angle and height differences.
 */
export class SystemShadows {
  // stores the current shadow values for visible tiles
  public static shadowMap: number[];

  // Shadow parameters
  // these get updated as time passes
  public static shadowStrength: number; // current shadow strength based on time, etc
  public static shadowLength: number; // current shadow length based on time, etc

  // Cached shadow settings for performance
  // - these reference the game settings
  // - these do not change during runtime
  private static minShadowLength: number; // minimum distance for ray tracing
  private static maxShadowLength: number; // maximum distance for ray tracing
  private static minShadowStrength: number; // minimum shadow strength. Used to calculate SystemShadows.shadowStrength
  private static shadowLengthMultiplier: number;
  private static nightShadowLengthFactor: number;
  private static nightShadowStrengthFactor: number;
  private static shadowStrengthMultiplier: number;
  private static raytracingResolution: number; // step size for ray tracing

  // Sun positioning
  // private static raytracingResolution: number; // step size for ray tracing
  public static init() {
    this.cacheSettings();

    // init shadow map with default values
    this.shadowMap = [];
    const mapWidth = GameSettings.options.gameSize.width;
    const mapHeight = GameSettings.options.gameSize.height;
    let posIndex: number;
    for (let x = 0; x < mapWidth; x++) {
      for (let y = 0; y < mapHeight; y++) {
        posIndex = positionToIndex(x, y, Layer.TERRAIN);
        this.shadowMap[posIndex] = 0; // 0 means no shadow
      }
    }
  }

  private static cacheSettings() {
    // cache options from GameSettings for performance

    // step size of 1 tile for ray tracing (move 1 tile at a time when casting rays)
    this.raytracingResolution =
      GameSettings.options.shadows.raytracingResolution;
    this.maxShadowLength = GameSettings.options.shadows.maxShadowLength;
    this.minShadowLength = GameSettings.options.shadows.minShadowLength;
    this.minShadowStrength = GameSettings.options.shadows.minShadowStrength;
    this.shadowLengthMultiplier =
      GameSettings.options.shadows.shadowLengthMultiplier;
    this.nightShadowLengthFactor =
      GameSettings.options.shadows.nightShadowLengthFactor;
    this.nightShadowStrengthFactor =
      GameSettings.options.shadows.nightShadowStrengthFactor;
    this.shadowStrengthMultiplier =
      GameSettings.options.shadows.shadowStrengthMultiplier;
  }

  /**
   * Update sun position and shadows based on time of day
   */
  public static turnUpdate(viewport: Viewport, map: MapWorld) {
    if (!GameSettings.options.toggles.enableSunShadows) return;

    this.calculateShadowLength();
    this.calculateShadowStrength();

    // Compute shadows for visible tiles
    this.updateShadowMap(viewport, map);
  }

  /**
   * Updates the shadow map based on current sun position
   */
  private static updateShadowMap(viewport: Viewport, map: MapWorld) {
    if (!GameSettings.options.toggles.enableSunShadows) return;

    if (!this.shadowMap) return;

    // Direction vectors for shadow casting
    const shadowDx = -Math.cos(SystemSunMoon.angle);
    const shadowDy = -Math.sin(SystemSunMoon.angle);

    // Process each tile in the viewport
    for (let i = 0; i < viewport.tiles.length; i++) {
      const posIndex = viewport.tiles[i];
      const [tileX, tileY] = indexToXY(posIndex, Layer.TERRAIN);

      // Get falloff value for this position
      const h0 = this.getFalloffAt(map, posIndex);
      let shadowIntensity = 0;
      let distance = this.raytracingResolution;

      // Cast rays in the shadow direction
      while (distance < this.shadowLength) {
        // Calculate position along ray
        const rx = Math.floor(tileX + shadowDx * distance);
        const ry = Math.floor(tileY + shadowDy * distance);

        // Skip if out of bounds
        if (
          rx < 0 ||
          ry < 0 ||
          rx >= GameSettings.options.gameSize.width ||
          ry >= GameSettings.options.gameSize.height
        )
          break;

        const rayPosIndex = positionToIndex(rx, ry, Layer.TERRAIN);
        const h1 = this.getFalloffAt(map, rayPosIndex);

        // Check if there's higher terrain along the ray path
        // Check if there's higher terrain along the ray path
        if (h1 > h0) {
          // Calculate shadow intensity based on distance
          // Closer blockages create darker shadows (closer to 1.0)
          // Further blockages create lighter shadows (closer to 0.0)
          const normalizedDistance = Math.min(distance / this.shadowLength, 1);

          // Scale between 1.0 (closest) and 1.0 (furthest, change this to adjust shadow intensity)
          // Linear scaling from dark to light based on distance
          shadowIntensity = 1.0 - 1 * normalizedDistance;

          break; // Stop ray casting once we find any higher terrain
        }

        distance += this.raytracingResolution;
      }

      // Store shadow result as a value between 0 (no shadow) and 1 (full shadow)
      this.shadowMap[posIndex] = shadowIntensity;
    }
  }

  /**
   * Get light falloff value for a specific position.
   * y,x coordinates are used for access.
   */
  private static getFalloffAt(map: MapWorld, posIndex: number): number {
    let falloffValue = 0;
    const heightLayer = map.heightLayerMap.get(posIndex);
    if (heightLayer) {
      falloffValue = HeightLayerFalloff[heightLayer];
    } else {
      // Use medium light falloff if no height layer is found
      falloffValue = HeightLayerFalloff.MidHill;
    }
    return falloffValue;
  }

  /**
   * Calculate shadow length based on sun elevation
   * Longer shadows when sun is closer to horizon
   */ private static calculateShadowLength() {
    // Calculate elevation factor - determines shadow length
    let elevationFactor = 1 - SystemSunMoon.elevation;

    // Calculate shadow distance
    this.shadowLength = Math.ceil(
      this.minShadowLength +
        elevationFactor * this.shadowLengthMultiplier * this.minShadowLength
    );

    // Limit shadow length to reasonable bounds
    this.shadowLength = Math.max(
      this.minShadowLength,
      Math.min(this.shadowLength, this.maxShadowLength)
    );

    if (!SystemTime.isDayTime) {
      this.shadowLength = Math.max(
        this.minShadowLength,
        Math.floor(this.shadowLength * this.nightShadowLengthFactor)
      ); // Reduce length at night
    }
  }
  /**
   * Calculate shadow strength based on sun elevation
   * Stronger shadows when sun is closer to horizon
   */ private static calculateShadowStrength() {
    // Strength varies inversely with sun elevation
    let strength = 1 - SystemSunMoon.elevation;

    // Apply smooth easing to strength factor
    strength = strength * strength * (3 - 2 * strength);

    this.shadowStrength = Math.max(
      this.minShadowStrength,
      strength * this.shadowStrengthMultiplier
    );

    if (!SystemTime.isDayTime) {
      // Moon shadows are typically more subtle
      this.shadowStrength *= this.nightShadowStrengthFactor;
    }
  }

  /**
   * Handle when tiles enter the viewport.
   * Important when game is paused, as shadows are updated after turns.
   */
  public static onEnter(viewport: Viewport, map: MapWorld): void {
    if (!GameSettings.options.toggles.enableSunShadows) return;

    // kind of a hack:
    // re-calculate the entire viewport shadows whenever a tile enters the viewport
    this.updateShadowMap(viewport, map);
  }
}
