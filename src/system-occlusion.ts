import { indexToXY, lerp, positionToIndex } from "./misc-utility";
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
  // multiplier on the occlusion map itself. Changes based on time of day, etc
  public static strengthMultiplier: number = 1;

  // strength of occlusion shadows at different times of day
  private static readonly DayStartStrength = 2; // Strong shadows in morning
  private static readonly DayMidStrength = 1; // Minimal shadows at midday
  private static readonly DayEndStrength = 2; // Medium-strong shadows in evening
  private static readonly NightMidStrength = 4; // strong shadows at midday
  private static readonly MaxOcclusionAmount = 0.17; // cutoff value for occlusion map shadow strength

  public static init() {
    // init shadow map and occlusion map with default values
    const mapWidth = GameSettings.options.gameSize.width;
    const mapHeight = GameSettings.options.gameSize.height;
    let posIndex = 0;
    for (let x = 0; x < mapWidth; x++) {
      for (let y = 0; y < mapHeight; y++) {
        posIndex = positionToIndex(x, y, Layer.TERRAIN);
        SystemOcclusion.occlusionMap[posIndex] = 0; // 0 means no occlusion
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
          shadowStrength = lerp(
            remainingPhasePercent, // 0 - 1 for morning phase
            this.DayStartStrength,
            this.DayMidStrength
          );
          break;

        case DayPhase.mid:
          // Mid-day has consistent minimal shadows
          shadowStrength = this.DayMidStrength;
          break;

        case DayPhase.evening:
          // Lerp from midday to evening (mid strength → evening strength)
          shadowStrength = lerp(
            remainingPhasePercent, // 1 to 0 for evening phase
            this.DayEndStrength,
            this.DayMidStrength
          );
          break;
      }
    } else {
      // night time
      switch (phase) {
        case DayPhase.morning:
          // Lerp from evening to mid day (evening strength → mid day strength)
          shadowStrength = lerp(
            remainingPhasePercent, // 0 to 1 for night phase
            this.DayEndStrength,
            this.NightMidStrength
          );

          break;

        case DayPhase.mid:
          // Mid-day has consistent minimal shadows
          shadowStrength = this.NightMidStrength;
          break;

        case DayPhase.evening:
          // Lerp from midday to morning (mid strength → morning strength)
          shadowStrength = lerp(
            remainingPhasePercent, // 1 to 0 for evening phase
            this.DayStartStrength,
            this.NightMidStrength
          );
          break;

        default:
          // Default to midday strength if we're in an unknown phase
          shadowStrength = this.DayMidStrength;
          break;
      }
    }

    // Set the calculated shadow strength
    SystemOcclusion.strengthMultiplier = shadowStrength;
  }

  /**
   * Updates ambient occlusion map for visible tiles
   */
  public static updateOcclusionShadowMap(
    map: MapWorld,
    updateTileIndexes: number[]
  ) {
    // return;
    if (!GameSettings.options.toggles.enableOcclusionShadows) return;

    for (let i = 0; i < updateTileIndexes.length; i++) {
      const posIndex = updateTileIndexes[i];
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
        1 // Stronger occlusion effect for immediate neighbors
      );

      // Calculate occlusion from extended neighbors (subtler effect)
      const occlusionFactorD2 =
        adjacentD2 && adjacentD2.length > 0
          ? SystemOcclusion.calculateOcclusionFactor(
              heightLayer,
              adjacentD2,
              1 / 3 // Weaker occlusion effect for extended neighbors
            )
          : 0;

      // Combine both occlusion factors, prioritizing the stronger effect
      SystemOcclusion.occlusionMap[posIndex] = Math.max(
        occlusionFactorD1,
        occlusionFactorD2
      );
    }
  }

  /**
   * Calculates shadow occlusion factor based on height differences with adjacent tiles
   */
  private static calculateOcclusionFactor(
    heightLayer: HeightLayer,
    adjacentLayers: HeightLayer[],
    strength: number = SystemOcclusion.strengthMultiplier
  ): number {
    let occlusionFactor = 0.0; // No occlusion by default
    let surroundingHigherTilesCount = 0;

    for (const adjacentLayer of adjacentLayers) {
      if (!adjacentLayer) continue;

      const heightDiff =
        HeightDropoff[adjacentLayer] - HeightDropoff[heightLayer];
      if (heightDiff > 0) {
        // Higher adjacent terrain causes occlusion
        surroundingHigherTilesCount++;

        // Stronger occlusion with greater height differences
        const layerOcclusion = heightDiff * strength;
        occlusionFactor = Math.max(occlusionFactor, layerOcclusion);
      }
    }

    // Apply additional occlusion when surrounded by multiple higher tiles (valley effect)
    if (surroundingHigherTilesCount > 2) {
      occlusionFactor *= 1 + (surroundingHigherTilesCount - 2) * 0.1;
    }

    // Limit the occlusion factor to a maximum value
    return Math.min(this.MaxOcclusionAmount, occlusionFactor);
  }

  /**
   * Handle when tiles enter the viewport.
   * Important when game is paused, as shadows are updated after turns.
   */
  public static onEnter(map: MapWorld, updateTileIndexes: number[]): void {
    if (!GameSettings.options.toggles.enableOcclusionShadows) return;

    // Update the occlusion map for the new tiles
    SystemOcclusion.updateOcclusionShadowMap(map, updateTileIndexes);
  }
}
