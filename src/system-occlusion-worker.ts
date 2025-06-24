import { lerp, positionToIndex } from "./misc-utility";
import { Layer } from "./renderer";
import { DayPhase } from "./system-time";
import {
  HeightDropoff,
  OcclusionSettings,
  OcclusionWorkerMessage,
} from "./system-occlusion";
import { HeightLayer, MapWorld } from "./map-world";
import { Tile } from "./tile";

console.log("spawned system-occlusion-worker");

let settings: OcclusionSettings;
let mapBuffer: Float32Array; // reusable buffer for sending map data back
let mapWidth: number;
let mapHeight: number;
let strengthMultiplier: number = 1;
let heightLayerMap: HeightLayer[];
let heightLayerAdjacencyD1Map: HeightLayer[][];
let heightLayerAdjacencyD2Map: HeightLayer[][];

onmessage = (e) => {
  if (e.data.type === OcclusionWorkerMessage.INIT) {
    init(e.data.data);
    return;
  }
  if (e.data.type === OcclusionWorkerMessage.UPDATE) {
    update();
    return;
  }
  if (e.data.type === OcclusionWorkerMessage.INTERPOLATE_STRENGTH) {
    interpolateStrength(e.data.data);
    return;
  }
};

const init = (data: {
  sharedBuffer: SharedArrayBuffer;
  mapWidth: number;
  mapHeight: number;
  settings: OcclusionSettings;
  heightLayerMap: HeightLayer[];
  heightLayerAdjacencyD1Map: HeightLayer[][];
  heightLayerAdjacencyD2Map: HeightLayer[][];
}) => {
  mapBuffer = new Float32Array(data.sharedBuffer);
  settings = data.settings;
  mapWidth = data.mapWidth;
  mapHeight = data.mapHeight;
  heightLayerMap = data.heightLayerMap;
  heightLayerAdjacencyD1Map = data.heightLayerAdjacencyD1Map;
  heightLayerAdjacencyD2Map = data.heightLayerAdjacencyD2Map;
};

const interpolateStrength = (data: {
  remainingCyclePercent: number;
  lightPhase: DayPhase;
  isDaytime: boolean;
}) => {
  calculateShadowProperties(
    data.lightPhase,
    data.remainingCyclePercent,
    data.isDaytime
  );
};

const update = () => {
  updateOcclusionShadowMap();
  // console.log("occlusion update", updatedOcclusionMap);
  postMessage({
    type: OcclusionWorkerMessage.UPDATE,
    data: {
      strengthMultiplier,
    },
  });
};

/**
 * Calculate shadow properties based on time of day.
 */
const calculateShadowProperties = (
  lightPhase: number,
  remainingPhasePercent: number,
  isDaytime: boolean
) => {
  // Calculate shadow properties based on time of day
  // Use linear interpolation between shadow strengths based on current phase
  let shadowStrength = 0;

  if (isDaytime) {
    switch (lightPhase) {
      case DayPhase.morning:
        // Lerp from morning to midday (morning strength → mid strength)
        shadowStrength = lerp(
          remainingPhasePercent, // 0 - 1 for morning phase
          settings.dayStartStrength,
          settings.dayMidStrength
        );
        break;

      case DayPhase.mid:
        // Mid-day has consistent minimal shadows
        shadowStrength = settings.dayMidStrength;
        break;

      case DayPhase.evening:
        // Lerp from midday to evening (mid strength → evening strength)
        shadowStrength = lerp(
          remainingPhasePercent, // 1 to 0 for evening phase
          settings.dayEndStrength,
          settings.dayMidStrength
        );
        break;
    }
  } else {
    // night time
    switch (lightPhase) {
      case DayPhase.morning:
        // Lerp from evening to mid day (evening strength → mid day strength)
        shadowStrength = lerp(
          remainingPhasePercent, // 0 to 1 for night phase
          settings.dayEndStrength,
          settings.nightMidStrength
        );
        break;

      case DayPhase.mid:
        // Mid-day has consistent minimal shadows
        shadowStrength = settings.nightMidStrength;
        break;

      case DayPhase.evening:
        // Lerp from midday to morning (mid strength → morning strength)
        shadowStrength = lerp(
          remainingPhasePercent, // 1 to 0 for evening phase
          settings.dayStartStrength,
          settings.nightMidStrength
        );
        break;

      default:
        // Default to midday strength if we're in an unknown phase
        shadowStrength = settings.dayMidStrength;
        break;
    }
  }

  // Set the calculated shadow strength
  strengthMultiplier = shadowStrength;
};

/**
 * Updates ambient occlusion map for all tiles
 */
const updateOcclusionShadowMap = (): void => {
  for (let i = 0; i < mapWidth; i++) {
    for (let j = 0; j < mapHeight; j++) {
      // console.log(i, j);
      const posIndex = positionToIndex(
        i,
        j,
        Layer.TERRAIN,
        mapWidth,
        mapHeight
      );
      // console.log(i, j, posIndex);
      // console.log(posIndex);
      const tileX = i;
      const tileY = j;

      // Calculate ambient occlusion based on height differences with adjacent tiles
      // const heightLayer = heightLayerMap.get(posIndex);
      const heightLayer = heightLayerMap[posIndex];

      // Get both immediate and extended neighbors for better occlusion
      const adjacentD1 = heightLayerAdjacencyD1Map[posIndex];
      const adjacentD2 = heightLayerAdjacencyD2Map[posIndex];

      let occlusionFactorD1 = 0;
      let occlusionFactorD2 = 0;

      if (adjacentD1 && adjacentD1) {
        // Calculate occlusion from immediate neighbors (stronger effect)
        occlusionFactorD1 = calculateOcclusionFactor(
          heightLayer,
          adjacentD1,
          1 // Stronger occlusion effect for immediate neighbors
        );
      }

      if (adjacentD2 && adjacentD2.length > 0) {
        // Calculate occlusion from extended neighbors (subtler effect)
        occlusionFactorD2 =
          adjacentD2 && adjacentD2.length > 0
            ? calculateOcclusionFactor(
                heightLayer,
                adjacentD2,
                1 / 3 // Weaker occlusion effect for extended neighbors
              )
            : 0;
      }

      // Combine both occlusion factors
      mapBuffer[posIndex] = occlusionFactorD1 + occlusionFactorD2;
    }
  }
};

/**
 * Calculates shadow occlusion factor based on height differences with adjacent tiles
 */
const calculateOcclusionFactor = (
  heightLayer: HeightLayer,
  adjacentLayers: HeightLayer[],
  strength: number
): number => {
  // console.log("adjacentLayers", adjacentLayers);
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
  return Math.min(
    settings.maxOcclusionAmount,
    occlusionFactor * strengthMultiplier
  );
};
