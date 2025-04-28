import { indexToXY, positionToIndex } from "./misc-utility";
import { MapWorld } from "./map-world";
import { GameSettings } from "./game-settings";
import { Layer } from "./renderer";
import { Viewport } from "./camera";
import { SystemTime } from "./system-time";
import { SystemSunMoon } from "./system-sun-moon";

// Height values used for shadow casting calculations
export const HeightDropoff = {
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
  public static shadowMap: number[] = [];

  // Shadow parameters
  // these get updated as time passes
  public static shadowStrength: number; // current shadow strength based on time, etc
  public static ambientLightStrength: number;
  public static shadowLength: number; // current shadow length based on time, etc

  // Shadow calculation constants
  private static readonly BASE_SHADOW_LENGTH = 3;
  private static readonly SHADOW_LENGTH_MULTIPLIER = 2;
  private static readonly NIGHT_SHADOW_LENGTH_FACTOR = 0.5;
  private static readonly NIGHT_SHADOW_STRENGTH_FACTOR = 0.8;

  // for raycasting- slope from the light source to the shadowed tile
  // these are used to determine if a tile is in shadow or not
  private static readonly BASE_SLOPE_THRESHOLD = 0.015;
  private static readonly SLOPE_THRESHOLD_RANGE = 0.05;
  private static readonly SLOPE_MAX_THRESHOLD = 0.06;

  // base shadow strength
  // these don't change
  private static maxShadowLength: number; // maximum distance for ray tracing
  private static minShadowStrength: number; // minimum shadow strength. Used to calculate SystemShadows.shadowStrength
  private static minShadowLength: number;

  // Sun positioning
  private static shadowResolution: number; // step size for ray tracing

  public static init() {
    SystemShadows.minShadowStrength = 0.22; // Minimum shadow strength
    SystemShadows.ambientLightStrength =
      GameSettings.options.ambientLightStrength;

    // Default values for shadow calculation
    SystemShadows.shadowResolution = 1; // step size of 1 tile for ray tracing
    SystemShadows.maxShadowLength = GameSettings.options.maxShadowLength;
    SystemShadows.minShadowLength = GameSettings.options.minShadowLength;
    SystemShadows.shadowMap = [];

    // init shadow map and occlusion map with default values
    const mapWidth = GameSettings.options.gameSize.width;
    const mapHeight = GameSettings.options.gameSize.height;
    let posIndex: number;
    for (let x = 0; x < mapWidth; x++) {
      for (let y = 0; y < mapHeight; y++) {
        posIndex = positionToIndex(x, y, Layer.TERRAIN);
        SystemShadows.shadowMap[posIndex] = SystemShadows.ambientLightStrength;
      }
    }
  }

  /**
   * Update sun position based on time of day
   */
  public static turnUpdate(viewport: Viewport, map: MapWorld) {
    if (!GameSettings.options.toggles.enableSunShadows) return;

    SystemShadows.calculateShadowProperties();

    // Compute shadows for visible tiles
    SystemShadows.updateShadowMap(viewport, map);
  }

  /**
   * Updates the shadow map based on current sun position
   */
  private static updateShadowMap(viewport: Viewport, map: MapWorld) {
    if (!GameSettings.options.toggles.enableSunShadows) return;

    // Convert 1D height map to 2D for the shadow computation algorithm
    const heightMap = SystemShadows.createHeightMapForViewport(viewport, map);
    if (!heightMap) return;

    // Compute shadows using the ray-tracing algorithm
    const shadowValues = SystemShadows.computeShadows(
      heightMap,
      SystemSunMoon.angle,
      SystemShadows.shadowLength,
      SystemShadows.shadowResolution
    );

    // Apply shadow values to the shadow map
    for (let i = 0; i < viewport.tiles.length; i++) {
      const posIndex = viewport.tiles[i];
      const [x, y] = indexToXY(posIndex, Layer.TERRAIN);

      // Convert to local viewport coordinates for accessing the shadowValues array
      const localX = x - heightMap.viewportOffsetX;
      const localY = y - heightMap.viewportOffsetY;

      if (
        localX >= 0 &&
        localX < heightMap.width &&
        localY >= 0 &&
        localY < heightMap.height
      ) {
        // Map shadow value (0 or 1) to actual light value
        const shadowValue = shadowValues[localY][localX];

        SystemShadows.shadowMap[posIndex] =
          shadowValue === 1
            ? SystemShadows.ambientLightStrength *
              (1 - SystemShadows.shadowStrength)
            : SystemShadows.ambientLightStrength;
      }
    }
  }

  /**
   * Get height value for a specific position
   */
  private static getHeightValueAt(map: MapWorld, posIndex: number): number {
    let heightValue = 0;
    const heightLayer = map.heightLayerMap.get(posIndex);
    if (heightLayer) {
      heightValue = HeightDropoff[heightLayer];
    } else {
      // Use raw height value as fallback
      heightValue = map.heightMap.get(posIndex) || 0;
    }
    return heightValue;
  }

  /**
   * Creates a generic height map for any map bounds
   */
  private static createHeightMap(
    map: MapWorld,
    bounds: { minX: number; minY: number; width: number; height: number }
  ): number[][] {
    const { minX, minY, width, height } = bounds;
    const heightMap = Array(height)
      .fill(0)
      .map(() => Array(width).fill(0));

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const worldX = minX + x;
        const worldY = minY + y;
        const posIndex = positionToIndex(worldX, worldY, Layer.TERRAIN);

        // Get height value for this position
        heightMap[y][x] = this.getHeightValueAt(map, posIndex);
      }
    }

    return heightMap;
  }

  /**
   * Creates a 2D height map for the current viewport for shadow computation
   */
  private static createHeightMapForViewport(viewport: Viewport, map: MapWorld) {
    if (!viewport) return;

    // Calculate startX and startY from the center and dimensions
    const startX = viewport.center.x - Math.floor(viewport.width / 2);
    const startY = viewport.center.y - Math.floor(viewport.height / 2);

    // Create height map using the generic method
    const bounds = {
      minX: startX,
      minY: startY,
      width: viewport.width,
      height: viewport.height,
    };

    const heightMap = this.createHeightMap(map, bounds);

    // Return the height map with metadata
    return {
      data: heightMap,
      width: bounds.width,
      height: bounds.height,
      viewportOffsetX: startX,
      viewportOffsetY: startY,
    };
  }

  /**
   * Calculate shadow properties based on current celestial state
   */
  private static calculateShadowProperties() {
    this.calculateShadowLength();
    this.calculateShadowStrength();
  }

  /**
   * Calculate shadow length based on sun elevation
   * Longer shadows when sun is closer to horizon
   */
  private static calculateShadowLength() {
    // Calculate elevation factor - determines shadow length
    let elevationFactor = 1 - SystemSunMoon.elevation;

    // Calculate shadow distance
    SystemShadows.shadowLength = Math.ceil(
      this.BASE_SHADOW_LENGTH +
        elevationFactor *
          this.SHADOW_LENGTH_MULTIPLIER *
          this.BASE_SHADOW_LENGTH
    );

    // Limit shadow length to reasonable bounds
    SystemShadows.shadowLength = Math.max(
      SystemShadows.minShadowLength,
      Math.min(SystemShadows.shadowLength, SystemShadows.maxShadowLength)
    );

    if (!SystemTime.isDayTime) {
      SystemShadows.shadowLength = Math.max(
        SystemShadows.minShadowLength,
        Math.floor(SystemShadows.shadowLength * this.NIGHT_SHADOW_LENGTH_FACTOR)
      ); // Reduce length at night
    }
  }

  /**
   * Calculate shadow strength based on sun elevation
   * Stronger shadows when sun is closer to horizon
   */
  private static calculateShadowStrength() {
    // Strength varies inversely with sun elevation
    let strengthFactor = 1 - SystemSunMoon.elevation;

    // Apply smooth easing to strength factor
    const smoothStrengthFactor =
      strengthFactor * strengthFactor * (3 - 2 * strengthFactor);
    SystemShadows.shadowStrength =
      SystemShadows.minShadowStrength + smoothStrengthFactor * 0.35;

    if (!SystemTime.isDayTime) {
      // Moon shadows are typically more subtle
      SystemShadows.shadowStrength *= this.NIGHT_SHADOW_STRENGTH_FACTOR;
    }
  }

  /**
   * Compute shadow map using ray casting
   * @param heightMapData 2D array of height values
   * @param lightAngle Direction of light in radians
   * @param shadowLength Maximum distance to cast rays
   * @param resolution Step size for ray casting
   * @returns 2D array of shadow values (1=shadowed, 0=lit)
   */
  private static computeShadows(
    heightMapData: { data: number[][]; width: number; height: number },
    lightAngle: number,
    shadowLength: number,
    resolution: number
  ): number[][] {
    // console.log("maxShadowDistance", shadowLength);
    const { data: heightMap, width, height } = heightMapData;
    const shadowMap: number[][] = Array(height)
      .fill(0)
      .map(() => Array(width).fill(0));

    // Direction vectors - For a standard 2D coordinate system where +y is down on screen:
    // With counterclockwise sun motion:
    // Morning (180°/east): dx=-1, dy=0 → shadows cast to right (-dx, same dy)
    // Noon (90°/north): dx=0, dy=-1 → shadows cast downward (same dx, -dy)
    // Evening (0° or 360°/west): dx=1, dy=0 → shadows cast to left (-dx, same dy)
    const dx = Math.cos(lightAngle);
    const dy = Math.sin(lightAngle);

    // For shadow rays, we cast in the opposite direction from the light source
    const shadowDx = -dx;
    const shadowDy = -dy;

    // Debugging
    // console.log(
    //   `Sun angle: ${((lightAngle * 180) / Math.PI).toFixed(1)}°, ` +
    //     `Light direction: dx=${dx.toFixed(2)}, dy=${dy.toFixed(2)}, ` +
    //     `Shadow direction: dx=${shadowDx.toFixed(2)}, dy=${shadowDy.toFixed(2)}`
    // );

    // Set shadow detection parameters
    const baseThreshold = SystemShadows.BASE_SLOPE_THRESHOLD;
    const thresholdRange = SystemShadows.SLOPE_THRESHOLD_RANGE;

    // Scale threshold with sun elevation
    const slopeThreshold = Math.min(
      baseThreshold + thresholdRange * SystemSunMoon.elevation,
      SystemShadows.SLOPE_MAX_THRESHOLD
    );
    // const slopeThreshold = 0.06; // Fixed threshold for now

    // Track how many height differences were encountered for debugging
    let heightDiffsCount = 0;

    // Compute shadows for each position
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const h0 = heightMap[y][x];
        let shadowed = false;
        let distance = resolution;

        // Cast rays OPPOSITE to the light source direction (toward where shadows should go)
        while (distance < shadowLength) {
          // Calculate position along ray
          const rx = Math.floor(x + shadowDx * distance);
          const ry = Math.floor(y + shadowDy * distance);

          // Check if we're still in bounds
          if (rx < 0 || ry < 0 || rx >= width || ry >= height) break;

          const h1 = heightMap[ry][rx];

          // Check if there's higher terrain along the ray path
          if (h1 > h0) {
            heightDiffsCount++;

            // Calculate slope from current point to the blocking terrain
            const heightDiff = h1 - h0;
            const slope = heightDiff / distance;

            // If the slope exceeds our threshold, we're in shadow
            if (slope > slopeThreshold) {
              shadowed = true;
              break;
            }
          }

          distance += resolution;
        }

        // Store shadow result (1 = shadowed, 0 = lit)
        shadowMap[y][x] = shadowed ? 1 : 0;
      }
    }

    // Count and log the number of shadowed tiles for debugging
    // const shadowedCount = shadowMap.flat().filter((v) => v === 1).length;
    // console.log(
    //   `Found ${heightDiffsCount} height differences resulting in ${shadowedCount} shadowed tiles (${(
    //     (shadowedCount * 100) /
    //     (width * height)
    //   ).toFixed(1)}%)`
    // );

    return shadowMap;
  }

  /**
   * Handle when tiles enter the viewport.
   * Important when game is paused, as shadows are updated after turns.
   */
  public static onEnter(viewport: Viewport, map: MapWorld): void {
    if (!GameSettings.options.toggles.enableSunShadows) return;

    // kind of a hack:
    // re-calculate the entire viewport shadows whenever a tile enters the viewport
    SystemShadows.updateShadowMap(viewport, map);
  }
}
