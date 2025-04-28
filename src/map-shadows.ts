import { Game } from "./game";
import { LightManager } from "./light-manager";
import { indexToXY, lerp, positionToIndex } from "./misc-utility";
import { HeightLayer, MapWorld } from "./map-world";
import { Point } from "./point";
import { GameSettings } from "./game-settings";
import { Layer } from "./renderer";
import { Camera } from "./camera";
import { DayPhase, SystemTime } from "./system-time";

export enum SunLevels {
  Bright = "Bright",
  Sunny = "Sunny",
  Clear = "Clear",
  Overcast = "Overcast",
  Dark = "Dark",
}

export enum SunDirection {
  Sunup,
  Sundown,
  Topdown,
}

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
export class MapShadows {
  public camera: Camera;
  public lightManager: LightManager;

  // Only store the current shadow values for visible tiles
  public shadowMap: number[];
  public occlusionMap: number[];

  // Shadow parameters
  // these get updated as time passes
  public shadowStrength: number; // current shadow strength based on time, etc
  public ambientOcclusionShadowStrength: number;
  public ambientLightStrength: number;

  // base shadow strength
  // these don't change
  private maxShadowDistance: number; // maximum distance for ray tracing
  private minShadowStrength: number; // minimum shadow strength. Used to calculate this.shadowStrength

  // Sun positioning
  private sunAngle: number; // in radians
  private sunElevation: number; // 0 to 1
  private shadowResolution: number; // step size for ray tracing

  constructor(private game: Game, private map: MapWorld) {
    this.shadowMap = [];
    this.occlusionMap = [];

    this.minShadowStrength = 0.5; // Minimum shadow strength
    // this.shadowStrength = 0.8; // starting point for shadows, will be updated immediately
    this.ambientOcclusionShadowStrength = 1;
    this.ambientLightStrength = GameSettings.options.ambientLightStrength;

    // Default values for shadow calculation
    this.sunAngle = Math.PI / 4; // 45 degrees
    this.sunElevation = 0.5;
    this.shadowResolution = 1.0;
    this.maxShadowDistance = GameSettings.options.maxShadowLength;
  }

  public init() {
    this.camera = this.game.userInterface.camera;
    this.shadowMap = [];
    this.occlusionMap = [];

    // init shadow map and occlusion map with default values
    const mapWidth = GameSettings.options.gameSize.width;
    const mapHeight = GameSettings.options.gameSize.height;
    const mapSize = mapWidth * mapHeight;
    let posIndex = 0;
    for (let x = 0; x < mapWidth; x++) {
      for (let y = 0; y < mapHeight; y++) {
        posIndex = positionToIndex(x, y, Layer.TERRAIN);
        this.shadowMap[posIndex] = this.ambientLightStrength;
        this.occlusionMap[posIndex] = 1; // 1 means no occlusion
      }
    }
    // this.shadowMap = new Array(mapSize).fill(0.5);
    // this.occlusionMap = new Array(mapSize).fill(1); // 1 means no occlusion

    // Initialize shadow and occlusion maps with default values
    // const viewportTiles = this.game.userInterface.camera.viewportPadded.tiles;
    // for (let posIndex of viewportTiles) {
    //   this.shadowMap[posIndex] = this.ambientLightStrength;
    //   this.occlusionMap[posIndex] = 1;
    // }
  }

  /**
   * Update sun position based on time of day
   */
  public turnUpdate() {
    if (!GameSettings.options.toggles.enableShadows) return;

    if (SystemTime.isDayTime) {
      // Update sun angle based on time of day
      this.updateSunPosition();
    } else {
      // Update moon position if needed (not implemented yet)
      this.updateMoonPosition();
    }

    // Compute shadows for visible tiles
    this.updateShadowMap();
  }

  /**
   * Update shadows during rendering (every frame)
   */
  public renderUpdate(interpPercent: number) {
    if (!GameSettings.options.toggles.enableShadows) return;

    // Only recalculate shadows when needed (e.g., camera moved)
    const visibleTileIndexes =
      this.game.userInterface.camera.viewportPadded.tiles;

    // Possibly interpolate sun position for smooth transitions
    // const smoothSunAngle = lerp(interpPercent, this.prevSunAngle, this.sunAngle);

    // Compute real-time shadows for visible tiles
    this.updateOcclusionShadowMap(visibleTileIndexes);
  }

  /**
   * Updates the shadow map based on current sun position
   */
  private updateShadowMap() {
    // return;
    if (!GameSettings.options.toggles.enableShadows) return;

    const viewportTiles = this.game.userInterface.camera.viewportPadded.tiles;

    // Convert 1D height map to 2D for the shadow computation algorithm
    const heightMap = this.createHeightMapForViewport();
    if (!heightMap) return;

    // Compute shadows using the ray-tracing algorithm
    const shadowValues = this.computeShadows(
      heightMap,
      this.sunAngle,
      this.maxShadowDistance,
      this.shadowResolution
    );

    // Apply shadow values to the shadow map
    for (let i = 0; i < viewportTiles.length; i++) {
      const posIndex = viewportTiles[i];
      const [x, y] = indexToXY(posIndex, Layer.TERRAIN);

      // Apply shadow value from computation
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

        // Calculate final shadow value - stronger shadows during morning/evening
        // Adjust shadow strength based on time of day
        const shadowIntensity =
          this.sunElevation < 0.3
            ? this.shadowStrength * 1.5 // Stronger shadows at low sun angles
            : this.shadowStrength;

        this.shadowMap[posIndex] =
          shadowValue === 1
            ? this.ambientLightStrength * (1 - shadowIntensity)
            : this.ambientLightStrength;
      }
    }
  }

  /**
   * Updates ambient occlusion map for visible tiles
   */
  public updateOcclusionShadowMap(tileIndexes: number[]) {
    // return;
    if (!GameSettings.options.toggles.enableShadows) return;

    for (let i = 0; i < tileIndexes.length; i++) {
      const posIndex = tileIndexes[i];
      const [x, y] = indexToXY(posIndex, Layer.TERRAIN);

      // Calculate ambient occlusion based on height differences with adjacent tiles
      const heightLayer = this.map.heightLayerMap.get(posIndex);

      // Get both immediate and extended neighbors for better occlusion
      const adjacentD1 = this.map.getAdjacent(
        x,
        y,
        this.map.heightLayerAdjacencyD1Map
      );

      const adjacentD2 = this.map.getAdjacent(
        x,
        y,
        this.map.heightLayerAdjacencyD2Map
      );

      if (!adjacentD1 || adjacentD1.length === 0) continue;

      // Calculate occlusion from immediate neighbors (stronger effect)
      const occlusionFactorD1 = this.calculateOcclusionFactor(
        heightLayer,
        adjacentD1,
        this.ambientOcclusionShadowStrength // Stronger occlusion effect for immediate neighbors
      );

      // Calculate occlusion from extended neighbors (subtler effect)
      const occlusionFactorD2 =
        adjacentD2 && adjacentD2.length > 0
          ? this.calculateOcclusionFactor(
              heightLayer,
              adjacentD2,
              this.ambientOcclusionShadowStrength / 2
            )
          : this.ambientOcclusionShadowStrength;

      // Combine both occlusion factors, prioritizing the stronger effect
      this.occlusionMap[posIndex] = Math.min(
        occlusionFactorD1,
        occlusionFactorD2 + 0.2
      );
    }
  }

  /**
   * Calculates shadow occlusion factor based on height differences with adjacent tiles
   */
  private calculateOcclusionFactor(
    heightLayer: HeightLayer,
    adjacentLayers: HeightLayer[],
    strength: number = this.ambientOcclusionShadowStrength
  ): number {
    let occlusionFactor = 1.0; // No occlusion by default
    let surroundingHigherTilesCount = 0;

    for (const adjacentLayer of adjacentLayers) {
      if (!adjacentLayer) continue;

      const heightDiff =
        HeightDropoff[adjacentLayer] - HeightDropoff[heightLayer];
      if (heightDiff > 0) {
        // Higher adjacent terrain causes occlusion
        surroundingHigherTilesCount++;

        // Stronger occlusion with greater height differences
        const layerOcclusion = 1 - heightDiff * strength;
        occlusionFactor = Math.min(occlusionFactor, layerOcclusion);
      }
    }

    // Apply additional occlusion when surrounded by multiple higher tiles (valley effect)
    if (surroundingHigherTilesCount > 2) {
      occlusionFactor *= 1 - (surroundingHigherTilesCount - 2) * 0.05;
    }

    return Math.max(occlusionFactor, 0.15); // Ensure minimum ambient light
  }

  /**
   * Creates a 2D height map for the current viewport for shadow computation
   */
  private createHeightMapForViewport() {
    const viewportBounds = this.camera?.viewportPadded;
    if (!viewportBounds) return;
    // Calculate startX and startY from the center and dimensions
    const startX =
      viewportBounds.center.x - Math.floor(viewportBounds.width / 2);
    const startY =
      viewportBounds.center.y - Math.floor(viewportBounds.height / 2);
    const width = viewportBounds.width;
    const height = viewportBounds.height;

    // Create a 2D array for the height map
    const heightMap = Array(height)
      .fill(0)
      .map(() => Array(width).fill(0));

    // Fill the height map with terrain height values
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const worldX = startX + x;
        const worldY = startY + y;
        const posIndex = positionToIndex(worldX, worldY, Layer.TERRAIN);

        // Get height value for this position
        let heightValue = 0;
        const heightLayer = this.map.heightLayerMap.get(posIndex);
        if (heightLayer) {
          heightValue = HeightDropoff[heightLayer];
        } else {
          // Use raw height value as fallback
          heightValue = this.map.heightMap.get(posIndex) || 0;
        }

        heightMap[y][x] = heightValue;
      }
    }

    // Return the height map with metadata
    return {
      data: heightMap,
      width,
      height,
      viewportOffsetX: startX,
      viewportOffsetY: startY,
    };
  }

  /**
   * Updates sun position based on time of day and season
   */
  private updateSunPosition() {
    // Get time parameters
    const dayLength = SystemTime.dayLength;
    const nightLength = SystemTime.nightLength;
    const currentTime = SystemTime.currentTime;
    const isDaytime = SystemTime.isDayTime;
    const lightPhase = SystemTime.lightPhase;
    const totalDayLength = dayLength + nightLength;

    // Calculate day/night cycle progress
    const daytimeProgress = currentTime / dayLength; // 0 to 1 during day\

    // DAY TIME - SUN POSITION

    // Calculate sun elevation using smoothed sine curve
    // Sun: highest at noon (daytime progress = 0.5)
    this.sunElevation = Math.max(0.05, Math.sin(Math.PI * daytimeProgress));

    // Calculate sun angle for COUNTERCLOCKWISE motion
    // Complete 180-degree cycle during day where:
    // - Dawn: sun angle = 0 or 2π (0° or 360°) [East]
    // - Noon: sun angle = π/2 (90°) [North]
    // - Dusk: sun angle = π (180°) [West]
    this.sunAngle = Math.PI * daytimeProgress;

    this.applyShadowEnhancement(lightPhase);

    // Calculate shadow length based on celestial elevation
    this.calculateShadowProperties();

    // Log celestial position details for debugging
    console.log(
      `sun: time=${currentTime}/${totalDayLength}, progress=${
        isDaytime
          ? daytimeProgress.toFixed(2)
          : ((currentTime - dayLength) / nightLength).toFixed(2)
      }, ` +
        `angle=${((this.sunAngle * 180) / Math.PI).toFixed(1)}°, ` +
        `elevation=${this.sunElevation.toFixed(2)}, ` +
        `shadowDist=${this.maxShadowDistance.toFixed(1)}, ` +
        `strength=${this.shadowStrength.toFixed(2)}` +
        (lightPhase === DayPhase.evening ? " [EVENING]" : "")
    );
  }

  /**
   * Updates moon position during nighttime
   */
  private updateMoonPosition() {
    const nightLength = SystemTime.nightLength;
    const currentTime = SystemTime.currentTime;
    const dayLength = SystemTime.dayLength;
    const totalDayLength = dayLength + nightLength;

    // Calculate nighttime progress (0 at dusk, 1 at dawn)
    const nightProgress = (currentTime - dayLength) / nightLength;

    // Calculate moon elevation using smoothed sine curve
    // Moon: highest at midnight (night progress = 0.5)
    this.sunElevation = Math.max(0.05, Math.sin(Math.PI * nightProgress));

    // Calculate moon angle for COUNTERCLOCKWISE motion continuing from sunset
    // Complete 180-degree cycle during night where:
    // - Dusk: moon angle = π (180°) [West] (continuing from sun's position)
    // - Midnight: moon angle = 3π/2 (270°) [South]
    // - Dawn: moon angle = 0 or 2π (0° or 360°) [East] (ready for sun to appear)
    // this.sunAngle = Math.PI + Math.PI * nightProgress;
    this.sunAngle = Math.PI * nightProgress;
    console.log(
      `moon: time=${currentTime}/${totalDayLength}, progress=${(
        (currentTime - dayLength) /
        nightLength
      ).toFixed(2)}, ` +
        `angle=${((this.sunAngle * 180) / Math.PI).toFixed(1)}°, ` +
        `elevation=${this.sunElevation.toFixed(2)}, ` +
        `shadowDist=${this.maxShadowDistance.toFixed(1)}, ` +
        `strength=${this.shadowStrength.toFixed(2)}`
    );
  }

  /**
   * Apply shadow enhancement for specific day phases
   * This function adjusts the sun's elevation based on the time of day
   * to create more dramatic and realistic shadow effects.
   */
  private applyShadowEnhancement(lightPhase: DayPhase) {
    // Special handling for evening shadows
    if (lightPhase === DayPhase.evening) {
      // Control parameters for the evening shadow transition
      const transitionSpeed = 2.0; // Higher values make the transition happen faster
      const initialShadowBoost = 0.0; // Starting boost at the beginning of evening phase

      // Calculate how far we are through the evening phase (0 to 1)
      const eveningProgress = 1 - SystemTime.remainingPhasePercent;

      // Create accelerating transition effect that starts slow and speeds up
      // This uses a power function to create a non-linear progression
      // The result ranges from initialShadowBoost (at start) to ~1.0 (at end)
      const quickTransition = Math.min(
        1.0,
        Math.pow(eveningProgress * transitionSpeed, 2) + initialShadowBoost
      );

      // Artificially lower the sun's elevation during evening to create longer shadows
      // This simulates the real-world phenomenon of longer shadows at sunset
      const minElevation = 0.05; // Prevent the sun from going completely flat
      const originalElevation = this.sunElevation; // Store original calculated elevation

      // Reduce the sun's elevation proportionally to the evening's progression
      // The 0.8 factor controls how much to lower the sun (80% max reduction)
      this.sunElevation = Math.max(
        minElevation,
        originalElevation * (1 - quickTransition * 0.8)
      );
    }

    // Could add similar enhancements for other phases as needed
  }

  /**
   * Calculate shadow properties based on current celestial state
   */
  private calculateShadowProperties() {
    // --- Shadow Length Calculation ---
    const baseShadowLength = 4;
    const shadowLengthMultiplier = 2;

    // Calculate elevation factor - determines shadow length
    let elevationFactor = 1 - this.sunElevation;

    // Calculate shadow distance
    this.maxShadowDistance =
      baseShadowLength +
      elevationFactor * shadowLengthMultiplier * baseShadowLength;

    // Limit shadow length to reasonable bounds
    this.maxShadowDistance = Math.max(3, Math.min(8, this.maxShadowDistance));

    if (!SystemTime.isDayTime) {
      this.maxShadowDistance = Math.max(
        1,
        Math.floor(this.maxShadowDistance * 0.5)
      ); // Reduce length at night
    }

    // --- Shadow Strength Calculation ---
    // Strength varies inversely with sun elevation
    let strengthFactor = 1 - this.sunElevation;

    // Apply smooth easing to strength factor
    const smoothStrengthFactor =
      strengthFactor * strengthFactor * (3 - 2 * strengthFactor);
    this.shadowStrength = this.minShadowStrength + smoothStrengthFactor * 0.35;

    if (!SystemTime.isDayTime) {
      // Moon shadows are typically more subtle
      this.shadowStrength *= 0.6; // Reduce strength at night
    }

    // Adjust resolution for shadow calculation
    this.shadowResolution = 0.8 + this.maxShadowDistance / 20;
  }

  /**
   * Compute shadow map using ray casting
   * @param heightMapData 2D array of height values
   * @param lightAngle Direction of light in radians
   * @param maxDistance Maximum distance to cast rays
   * @param resolution Step size for ray casting
   * @returns 2D array of shadow values (1=shadowed, 0=lit)
   */
  private computeShadows(
    heightMapData: { data: number[][]; width: number; height: number },
    lightAngle: number,
    maxDistance: number,
    resolution: number
  ): number[][] {
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
    console.log(
      `Sun angle: ${((lightAngle * 180) / Math.PI).toFixed(1)}°, ` +
        `Light direction: dx=${dx.toFixed(2)}, dy=${dy.toFixed(2)}, ` +
        `Shadow direction: dx=${shadowDx.toFixed(2)}, dy=${shadowDy.toFixed(2)}`
    );

    // Set shadow detection parameters
    const baseThreshold = 0.02;
    const thresholdRange = 0.06;

    // Scale threshold with sun elevation
    const slopeThreshold = Math.min(
      baseThreshold + thresholdRange * this.sunElevation,
      0.06
    );

    // Track how many height differences were encountered for debugging
    let heightDiffsCount = 0;

    // Compute shadows for each position
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const h0 = heightMap[y][x];
        let shadowed = false;
        let distance = resolution;

        // Cast rays OPPOSITE to the light source direction (toward where shadows should go)
        while (distance < maxDistance) {
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
    const shadowedCount = shadowMap.flat().filter((v) => v === 1).length;
    console.log(
      `Found ${heightDiffsCount} height differences resulting in ${shadowedCount} shadowed tiles (${(
        (shadowedCount * 100) /
        (width * height)
      ).toFixed(1)}%)`
    );

    return shadowMap;
  }

  /**
   * Get shadow value for a specific position
   */
  get(x: number, y: number): number {
    return (
      this.shadowMap[positionToIndex(x, y, Layer.TERRAIN)] ||
      this.ambientLightStrength
    );
  }

  /**
   * Set shadow value for a specific position
   */
  set(x: number, y: number, sunlightAmount: number): void {
    this.shadowMap[positionToIndex(x, y, Layer.TERRAIN)] = sunlightAmount;
  }

  /**
   * Handle when tiles enter the viewport.
   * Important when game is paused, as shadows are updated after turns.
   */
  public onEnter(indexes: number[]): void {
    if (!GameSettings.options.toggles.enableShadows) return;

    // Update the occlusion map for the new tiles
    this.updateOcclusionShadowMap(indexes);

    // Calculate shadows for the new tiles
    const visibleTileIndexes =
      this.game.userInterface.camera.viewportPadded.tiles;
    this.updateShadowMap();
  }
}
