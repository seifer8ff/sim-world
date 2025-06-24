import { positionToIndex } from "./misc-utility";
import { Layer } from "./renderer";
import { HeightLayerFalloff, ShadowsSettings } from "./system-shadows";
import { HeightLayer } from "./map-world";

console.log("spawned system-shadows-worker");

// Enum for worker message types
export enum ShadowWorkerMessage {
  INIT,
  UPDATE,
  ON_ENTER,
  UPDATE_SHADOW_PROPERTIES,
}

// Global variables
let settings: ShadowsSettings;
let mapBuffer: Float32Array; // reusable buffer for sending map data back
let mapWidth: number;
let mapHeight: number;
let shadowStrength: number;
let shadowLength: number;
let heightLayerMap: HeightLayer[];
let sunAngle: number;
let sunElevation: number;
let isDayTime: boolean;

// Set up message handler
onmessage = (e) => {
  if (e.data.type === ShadowWorkerMessage.INIT) {
    init(e.data.data);
    return;
  }
  if (e.data.type === ShadowWorkerMessage.UPDATE) {
    update();
    return;
  }
  if (e.data.type === ShadowWorkerMessage.UPDATE_SHADOW_PROPERTIES) {
    updateShadowProperties(e.data.data);
    return;
  }
};

/**
 * Initialize the worker with settings
 */
const init = (data: {
  sharedBuffer: SharedArrayBuffer;
  mapWidth: number;
  mapHeight: number;
  settings: ShadowsSettings;
  heightLayerMap: HeightLayer[];
}) => {
  settings = data.settings;
  mapWidth = data.mapWidth;
  mapHeight = data.mapHeight;
  heightLayerMap = data.heightLayerMap;
  mapBuffer = new Float32Array(data.sharedBuffer);

  // Initialize default values
  shadowStrength = 1;
  shadowLength = settings.minShadowLength;
  sunAngle = 0;
  sunElevation = 0;
  isDayTime = true;
};

/**
 * Update shadow properties based on sun position
 */
const updateShadowProperties = (data: {
  sunAngle: number;
  sunElevation: number;
  isDayTime: boolean;
}) => {
  sunAngle = data.sunAngle;
  sunElevation = data.sunElevation;
  isDayTime = data.isDayTime;

  calculateShadowLength();
  calculateShadowStrength();

  // Send updated shadow properties back to main thread
  postMessage({
    type: ShadowWorkerMessage.UPDATE_SHADOW_PROPERTIES,
    data: {
      shadowLength,
      shadowStrength,
    },
  });
};

/**
 * Update shadows for visible tiles
 */
const update = () => {
  updateShadowMap();

  postMessage({
    type: ShadowWorkerMessage.UPDATE,
    data: {
      shadowLength,
      shadowStrength,
    },
  });
};

/**
 * Updates the shadow map based on current sun position
 */
const updateShadowMap = (): void => {
  // const shadowResults: number[] = [];

  // Direction vectors for shadow casting
  const shadowDx = -Math.cos(sunAngle);
  const shadowDy = -Math.sin(sunAngle);

  // process each tile, whether it's in the viewport or not
  for (let i = 0; i < mapWidth; i++) {
    for (let j = 0; j < mapHeight; j++) {
      const posIndex = positionToIndex(
        i,
        j,
        Layer.TERRAIN,
        mapWidth,
        mapHeight
      );
      const tileX = i;
      const tileY = j;

      // Get falloff value for this position
      const h0 = getFalloffAt(posIndex);
      let shadowIntensity = 0;
      let distance = settings.raytracingResolution;

      // Cast rays in the shadow direction
      while (distance < shadowLength) {
        // Calculate position along ray
        const rx = Math.floor(tileX + shadowDx * distance);
        const ry = Math.floor(tileY + shadowDy * distance);

        // Skip if out of bounds
        if (rx < 0 || ry < 0 || rx >= mapWidth || ry >= mapHeight) break;

        const rayPosIndex = positionToIndex(
          rx,
          ry,
          Layer.TERRAIN,
          mapWidth,
          mapHeight
        );
        const h1 = getFalloffAt(rayPosIndex);

        // Check if there's higher terrain along the ray path
        if (h1 > h0) {
          // Calculate shadow intensity based on distance
          // Closer blockages create darker shadows (closer to 1.0)
          // Further blockages create lighter shadows (closer to 0.0)
          const normalizedDistance = Math.min(distance / shadowLength, 1);

          // Scale between 1.0 (closest) and 1.0 (furthest)
          // Linear scaling from dark to light based on distance
          shadowIntensity = 1.0 - 1 * normalizedDistance;

          break; // Stop ray casting once we find any higher terrain
        }

        distance += settings.raytracingResolution;
      }

      // Store shadow result as a value between 0 (no shadow) and 1 (full shadow)
      mapBuffer[posIndex] = shadowIntensity * shadowStrength;
    }
  }
};

/**
 * Get light falloff value for a specific position.
 */
const getFalloffAt = (posIndex: number): number => {
  let falloffValue = 0;
  //   const heightLayer = heightLayerMap.get(posIndex);
  const heightLayer = heightLayerMap[posIndex];
  if (heightLayer) {
    falloffValue = HeightLayerFalloff[heightLayer];
  } else {
    // Use medium light falloff if no height layer is found
    falloffValue = HeightLayerFalloff.MidHill;
  }
  return falloffValue;
};

/**
 * Calculate shadow length based on sun elevation
 * Longer shadows when sun is closer to horizon
 */
// const calculateShadowLength = () => {
//   // Calculate elevation factor - determines shadow length
//   let elevationFactor = 1 - sunElevation;
//   let shadowLengthRange = settings.maxShadowLength - settings.minShadowLength;

//   // Calculate shadow distance
//   shadowLength = Math.ceil(
//     settings.minShadowLength +
//       elevationFactor * shadowLengthRange * settings.shadowLengthMultiplier // shift closer to min or max
//   );

//   // Limit shadow length to reasonable bounds
//   shadowLength = Math.max(
//     settings.minShadowLength,
//     Math.min(shadowLength, settings.maxShadowLength)
//   );

//   if (!isDayTime) {
//     shadowLength = Math.max(
//       settings.minShadowLength,
//       Math.floor(shadowLength * settings.nightShadowLengthFactor)
//     ); // Reduce length at night
//   }
// };

const calculateShadowLength = () => {
  // Calculate elevation factor - determines shadow length
  let elevationFactor = 1 - sunElevation;
  let shadowLengthRange = settings.maxShadowLength - settings.minShadowLength;

  // Calculate shadow distance
  shadowLength = Math.ceil(
    settings.minShadowLength + elevationFactor * shadowLengthRange
  );

  // Limit shadow length to reasonable bounds
  shadowLength = Math.max(
    settings.minShadowLength,
    Math.min(shadowLength, settings.maxShadowLength)
  );

  // if (!isDayTime) {
  //   shadowLength = Math.max(
  //     settings.minShadowLength,
  //     Math.floor(shadowLength * settings.nightShadowLengthFactor)
  //   ); // Reduce length at night
  // }
};

// const calculateShadowLength = () => {
//   shadowLength = settings.maxShadowLength;
// };

/**
 * Calculate shadow strength based on sun elevation
 * Stronger shadows when sun is closer to horizon
 */

// const calculateShadowStrength = () => {
//   // Use a smooth curve that peaks around 0.15-0.25 elevation
//   // This creates natural shadow behavior: strong at sunrise/sunset, weak at noon
//   let strength = Math.sin(sunElevation * Math.PI);

//   // Apply smooth easing for even more natural transition
//   // strength = strength * strength * (3 - 2 * strength);

//   // Apply settings multiplier and ensure minimum
//   shadowStrength = Math.max(
//     settings.minShadowStrength,
//     strength * settings.shadowStrengthMultiplier
//   );

//   console.log(sunElevation);
// };

// const calculateShadowStrength = () => {
//   // Use a smooth curve that peaks around 0.15-0.25 elevation
//   // This creates natural shadow behavior: strong at sunrise/sunset, weak at noon
//   let strength = Math.sin((sunElevation / 0.9) * (Math.PI / 2));
//   if (sunElevation > 0.9) {
//     // Gradually decrease from 1.0 to some lower value as elevation goes from 0.9 to 1.0
//     const overshoot = (sunElevation - 0.9) / 0.1; // 0 to 1
//     strength = 1.0 - overshoot * 0.3; // Decrease by up to 30%
//   }

//   console.log(sunElevation, strength);
// };

// const calculateShadowStrength = () => {
//   // Use a smooth curve that peaks around 0.15-0.25 elevation
//   // This creates natural shadow behavior: strong at sunrise/sunset, weak at noon
//   let strength = Math.sin((sunElevation / 0.9) * (Math.PI / 2));
//   if (sunElevation > 0.9) {
//     // Gradually decrease from 1.0 to some lower value as elevation goes from 0.9 to 1.0
//     const overshoot = (sunElevation - 0.9) / 0.1; // 0 to 1
//     strength = 1.0 - overshoot * 0.3; // Decrease by up to 30%
//   }

//   console.log(sunElevation, strength);
// };

const calculateShadowStrength = () => {
  let strength = 1 - sunElevation; // 1.0 at horizon, 0.0 at zenith
  strength *= settings.shadowStrengthMultiplier; // Apply multiplier
  if (!isDayTime) {
    strength *= settings.nightShadowStrengthFactor; // apply night multiplier
  } else {
    strength = Math.max(settings.minShadowStrength, strength);
  }

  strength = Math.min(strength, 0.9);
  shadowStrength = strength;

  // console.log(sunElevation, shadowStrength, shadowLength);
};
