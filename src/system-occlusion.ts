import { indexToXY, positionToIndex } from "./misc-utility";
import { HeightLayer, MapWorld } from "./map-world";
import { GameSettings } from "./game-settings";
import { Layer } from "./renderer";
import { DayPhase, SystemTime } from "./system-time";

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
 * Manages occlusion shadow calculations for the map.
 * Occlusion Shadows are calculated in real-time based on height difference between terrain layers.
 */
export class SystemOcclusion {
  public static occlusionMap: number[] = [];

  // Shadow parameters
  // these get updated as time passes
  public static ambientOcclusionShadowStrength: number = 1; // multiplier on the occlusion map itself
  private static readonly DayStartStrength = 1.9; // Strong shadows in morning
  private static readonly DayMidStrength = 0.5; // Minimal shadows at midday
  private static readonly DayEndStrength = 1.8; // Medium-strong shadows in evening
  private static readonly NightMidStrength = 1.3; // Weak shadows at midday
  private static readonly MinAmbientLight = 0.15; // Minimum ambient light

  public static init() {
    // init shadow map and occlusion map with default values
    const mapWidth = GameSettings.options.gameSize.width;
    const mapHeight = GameSettings.options.gameSize.height;
    let posIndex = 0;
    for (let x = 0; x < mapWidth; x++) {
      for (let y = 0; y < mapHeight; y++) {
        posIndex = positionToIndex(x, y, Layer.TERRAIN);
        SystemOcclusion.occlusionMap[posIndex] = 1; // 1 means no occlusion
      }
    }
  }

  /**
   * Update sun position based on time of day
   */
  public static turnUpdate(map: MapWorld, tiles: number[]) {
    if (!GameSettings.options.toggles.enableOcclusionShadows) return;

    SystemOcclusion.calculateShadowProperties();
    SystemOcclusion.updateOcclusionShadowMap(map, tiles);
  }

  public static calculateShadowProperties() {
    // Calculate shadow properties based on time of day
    const phase = SystemTime.lightPhase;
    const remainingPhasePercent = SystemTime.remainingPhasePercent;

    // Use linear interpolation between shadow strengths based on current phase
    let shadowStrength = 0;

    if (SystemTime.isDayTime) {
      switch (phase) {
        case DayPhase.morning:
          // Lerp from morning to midday (morning strength → mid strength)
          shadowStrength = this.lerp(
            this.DayStartStrength,
            this.DayMidStrength,
            remainingPhasePercent // 0 - 1 for morning phase
          );
          break;

        case DayPhase.mid:
          // Mid-day has consistent minimal shadows
          shadowStrength = this.DayMidStrength;
          break;

        case DayPhase.evening:
          // Lerp from midday to evening (mid strength → evening strength)
          shadowStrength = this.lerp(
            this.DayEndStrength,
            this.DayMidStrength,
            remainingPhasePercent // 1 to 0 for evening phase
          );
          break;

        // default:
        //   // Default to midday strength if we're in an unknown phase
        //   shadowStrength = this.DayMidStrength;
        //   break;
      }
    } else {
      // night time
      switch (phase) {
        case DayPhase.morning:
          // Lerp from evening to mid day (evening strength → mid day strength)
          shadowStrength = this.lerp(
            this.DayEndStrength,
            this.NightMidStrength,
            remainingPhasePercent // 0 to 1 for night phase
          );

          break;

        case DayPhase.mid:
          // Mid-day has consistent minimal shadows
          shadowStrength = this.NightMidStrength;
          break;

        case DayPhase.evening:
          // Lerp from midday to morning (mid strength → morning strength)
          shadowStrength = this.lerp(
            this.DayStartStrength,
            this.NightMidStrength,
            remainingPhasePercent // 1 to 0 for evening phase
          );
          break;

        default:
          // Default to midday strength if we're in an unknown phase
          shadowStrength = this.DayMidStrength;
          break;
      }
    }

    // Set the calculated shadow strength
    SystemOcclusion.ambientOcclusionShadowStrength = shadowStrength;
  }

  /**
   * Linear interpolation between two values
   * @param a First value
   * @param b Second value
   * @param t Interpolation factor (0-1)
   * @returns Interpolated value
   */
  private static lerp(a: number, b: number, t: number): number {
    return a * (1 - t) + b * t;
  }

  /**
   * Updates ambient occlusion map for visible tiles
   */
  public static updateOcclusionShadowMap(map: MapWorld, tileIndexes: number[]) {
    // return;
    if (!GameSettings.options.toggles.enableOcclusionShadows) return;

    for (let i = 0; i < tileIndexes.length; i++) {
      const posIndex = tileIndexes[i];
      const [x, y] = indexToXY(posIndex, Layer.TERRAIN);

      // Calculate ambient occlusion based on height differences with adjacent tiles
      const heightLayer = map.heightLayerMap.get(posIndex);

      // Get both immediate and extended neighbors for better occlusion
      const adjacentD1 = map.getAdjacent(x, y, map.heightLayerAdjacencyD1Map);

      const adjacentD2 = map.getAdjacent(x, y, map.heightLayerAdjacencyD2Map);

      if (!adjacentD1 || adjacentD1.length === 0) continue;

      // Calculate occlusion from immediate neighbors (stronger effect)
      const occlusionFactorD1 = SystemOcclusion.calculateOcclusionFactor(
        heightLayer,
        adjacentD1,
        SystemOcclusion.ambientOcclusionShadowStrength // Stronger occlusion effect for immediate neighbors
      );

      // Calculate occlusion from extended neighbors (subtler effect)
      const occlusionFactorD2 =
        adjacentD2 && adjacentD2.length > 0
          ? SystemOcclusion.calculateOcclusionFactor(
              heightLayer,
              adjacentD2,
              SystemOcclusion.ambientOcclusionShadowStrength / 2
            )
          : SystemOcclusion.ambientOcclusionShadowStrength;

      // Combine both occlusion factors, prioritizing the stronger effect
      SystemOcclusion.occlusionMap[posIndex] = Math.min(
        occlusionFactorD1,
        occlusionFactorD2 + 0.2
      );
    }
  }

  /**
   * Calculates shadow occlusion factor based on height differences with adjacent tiles
   */
  private static calculateOcclusionFactor(
    heightLayer: HeightLayer,
    adjacentLayers: HeightLayer[],
    strength: number = SystemOcclusion.ambientOcclusionShadowStrength
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

    return Math.max(occlusionFactor, this.MinAmbientLight); // Ensure minimum ambient light
  }

  /**
   * Handle when tiles enter the viewport.
   * Important when game is paused, as shadows are updated after turns.
   */
  public static onEnter(map: MapWorld, indexes: number[]): void {
    if (!GameSettings.options.toggles.enableOcclusionShadows) return;

    // Update the occlusion map for the new tiles
    SystemOcclusion.updateOcclusionShadowMap(map, indexes);
  }
}
