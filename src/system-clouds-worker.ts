import { getScaledNoise, indexToXY, lerp, normalize } from "./misc-utility";
import { Point } from "./point";
import { BiomeId, Biomes } from "./biomes";
import Noise from "rot-js/lib/noise/noise";
import { RNG } from "rot-js";
import { Layer } from "./renderer";
import Simplex from "rot-js/lib/noise/simplex";
import { MessageType } from "./system-clouds";
import { DayPhase } from "./system-time";
import { SystemTemperature } from "./system-temperature";
import { SystemMoisture } from "./system-moisture";
import { GameSettings } from "./game-settings";

console.log("spawned map-clouds-worker");

let noise: Noise = new Simplex();
let gameWidth: number;
let gameHeight: number;
let cloudStrength: number;
let sunbeamStrength: number;
let windSpeed: Point;
let sunbeamMaxLevel: number;
let cloudMinLevel: number;
let baseWindSpeed: number;
let cloudOffset = new Point(0, 0);

// Wind parameters
let windSpeedMax: number;
let windSpeedMin: number;
let windSpeedChangeChance: number;
let windSpeedChangeAmount: number;
let windSpeedChangeDirection: number;
let windSpeedChangeDirectionChance: number;

// Cloud generation parameters
let cloudGeneration: {
  noiseOffset: number;
  detailNoiseOffset1: number;
  detailNoiseOffset2: number;
  detailIntensityOffset1: number;
  detailIntensityOffset2: number;
};
let biomeClouds: {
  [biomeId: string]: {
    size: number;
    intensity: number;
  };
};

onmessage = (e) => {
  if (e.data.type === MessageType.INIT) {
    init(e.data.data);
    return;
  }
  if (e.data.type === MessageType.UPDATE) {
    update(e.data.data);
    return;
  }
  if (e.data.type === MessageType.INTERPOLATE_STRENGTH) {
    interpolateStrength(e.data.data);
    return;
  }
  if (e.data.type === MessageType.ON_ENTER) {
    onEnter(e.data.data);
    return;
  }
};

const init = (data: {
  gameWidth: number;
  gameHeight: number;
  cloudStrength: number;
  sunbeamStrength: number;
  sunbeamMaxLevel: number;
  cloudMinLevel: number;
  windSpeed: { x: number; y: number };
  baseWindSpeed: number;
  windSpeedMax: number;
  windSpeedMin: number;
  windSpeedChangeChance: number;
  windSpeedChangeAmount: number;
  windSpeedChangeDirection: number;
  windSpeedChangeDirectionChance: number;
  cloudGeneration: {
    noiseOffset: number;
    detailNoiseOffset1: number;
    detailNoiseOffset2: number;
    detailIntensityOffset1: number;
    detailIntensityOffset2: number;
  };
  biomeClouds: {
    [biomeId: string]: {
      size: number;
      intensity: number;
    };
  };
}) => {
  gameWidth = data.gameWidth;
  gameHeight = data.gameHeight;
  cloudStrength = data.cloudStrength;
  sunbeamStrength = data.sunbeamStrength;
  sunbeamMaxLevel = data.sunbeamMaxLevel;
  cloudMinLevel = data.cloudMinLevel;
  windSpeed = new Point(data.windSpeed.x, data.windSpeed.y);
  baseWindSpeed = data.baseWindSpeed;
  // Cache wind settings
  windSpeedMax = data.windSpeedMax;
  windSpeedMin = data.windSpeedMin;
  windSpeedChangeChance = data.windSpeedChangeChance;
  windSpeedChangeAmount = data.windSpeedChangeAmount;
  windSpeedChangeDirection = data.windSpeedChangeDirection;
  windSpeedChangeDirectionChance = data.windSpeedChangeDirectionChance;

  // Cache cloud generation settings
  cloudGeneration = data.cloudGeneration;
  biomeClouds = data.biomeClouds;
};

const interpolateStrength = (data: {
  lightTransitionPercent: number;
  remainingCyclePercent: number;
  lightPhase: DayPhase;
}) => {
  let remainingLightTransitionPercent;

  if (data.lightPhase === DayPhase.morning) {
    remainingLightTransitionPercent =
      (1 - data.remainingCyclePercent) / data.lightTransitionPercent;
    cloudStrength = lerp(remainingLightTransitionPercent, 1, 0.95);
    sunbeamStrength = lerp(remainingLightTransitionPercent, sunbeamMaxLevel, 1); // prevent sunbeams from flickering
  } else if (data.lightPhase === DayPhase.mid) {
    // smoothly fade between 0 and 1 repeatedly, in a wave
    // const wave = Math.sin(remainingCyclePercent * Math.PI);
    // cloudStrength = lerp(wave, 0.95, 1);
    // sunbeamStrength = lerp(wave, 1, this.sunbeamMaxLevel);
  } else if (data.lightPhase === DayPhase.evening) {
    remainingLightTransitionPercent =
      data.remainingCyclePercent / data.lightTransitionPercent;
    cloudStrength = lerp(remainingLightTransitionPercent, 1, 0.95);
    sunbeamStrength = lerp(remainingLightTransitionPercent, sunbeamMaxLevel, 1);
  }
  cloudStrength = Math.round(cloudStrength * 1000) / 1000;
  sunbeamStrength = Math.round(sunbeamStrength * 1000) / 1000;
};

const update = (data: {
  tileIndexes: number[];
  heights: number[];
  temperatures: number[];
  moistures: number[];
}) => {
  updateWindSpeed();
  updateCloudOffset();
  const updatedCloudMap = updateCloudMapForTiles(
    data.tileIndexes,
    data.heights,
    data.temperatures,
    data.moistures
  );
  postMessage({
    type: MessageType.UPDATE,
    data: { cloudMap: updatedCloudMap, cloudStrength, sunbeamStrength },
  });
};

const onEnter = (data: {
  tileIndexes: number[];
  heights: number[];
  temperatures: number[];
  moistures: number[];
}) => {
  const updatedCloudMap = updateCloudMapForTiles(
    data.tileIndexes,
    data.heights,
    data.temperatures,
    data.moistures
  );
  postMessage({ type: MessageType.ON_ENTER, data: updatedCloudMap });
};

const updateCloudMapForTiles = (
  tileIndexes: number[],
  heights: number[],
  temperatures: number[],
  moistures: number[]
): Map<number, number> => {
  let posIndex: number;
  let posXY: [number, number];
  let height: number;
  let temperature: number;
  let moisture: number;
  const updatedMap = new Map<number, number>();
  for (let i = 0; i < tileIndexes.length; i++) {
    posIndex = tileIndexes[i];
    height = heights[i];
    temperature = temperatures[i];
    moisture = moistures[i];
    posXY = indexToXY(posIndex, Layer.TERRAIN, gameWidth, gameHeight);
    updatedMap.set(
      posIndex,
      generateCloudLevel(
        posXY[0],
        posXY[1],
        height,
        temperature,
        moisture,
        noise
      )
    );
  }
  return updatedMap;
};

const generateCloudLevel = (
  x: number,
  y: number,
  height: number,
  temperature: number,
  moisture: number,
  noise: Noise
): number => {
  let noiseX = x / gameWidth - 0.5;
  let noiseY = y / gameHeight - 0.5;

  noiseX += cloudOffset.x;
  noiseY += cloudOffset.y;

  let cloudLevel = 0;
  let cloudLevelNoise = 0;
  let offset = cloudGeneration.noiseOffset;
  const seaLevel = Biomes.Biomes.ocean.generationOptions.height.max + 0;
  // set a variable between - and 1 indicatining how far above sea level it is
  const aboveSeaLevel = height - seaLevel;
  // console.log(aboveSeaLevel);
  const belowSeaLevel = seaLevel - height;
  const cloudConfig = {
    size: 2,
    intensity: 0.5,
  };

  // console.log(temperature, moisture, height);

  // set size to default, fully clouded sky
  cloudConfig.size = 0.001;

  // Calculate cloud intensity based primarily on height relative to sea level
  const minIntensity = 0.28; // Minimum intensity (for high elevations)
  const maxIntensity = 0.55; // Maximum intensity (for below sea level)
  const midIntensity = 0.45; // Starting intensity just above sea level
  const transitionHeight = 0.15; // How far below sea level for max intensity
  const seaLevelTransitionZone = transitionHeight; // Smoothing zone around sea level

  let intensityFromHeight;

  if (aboveSeaLevel <= -transitionHeight) {
    // Deep below sea level - maximum intensity
    intensityFromHeight = maxIntensity;
  } else if (aboveSeaLevel <= seaLevelTransitionZone) {
    // Transition zone around sea level (from below to slightly above)
    // Map from -transitionHeight to seaLevelTransitionZone → maxIntensity to midIntensity
    const transitionRange = transitionHeight + seaLevelTransitionZone;
    const normalizedPos = (aboveSeaLevel + transitionHeight) / transitionRange;
    intensityFromHeight = lerp(normalizedPos, maxIntensity, midIntensity); // Use midIntensity for smoother curve
  } else {
    // Above sea level and transition zone - intensity decreases as height increases

    // Start from mid-high intensity and decrease to minimum as height increases
    intensityFromHeight = Math.max(
      minIntensity,
      midIntensity - height * (midIntensity - minIntensity)
    );
  }
  //
  //
  //

  // Temperature influence on cloud formation
  const optimalCloudTemp = 0.65; // Temperature where cloud coverage peaks
  const minCloudIntensity = 0.29; // Minimum cloud intensity at temperature extremes
  const tempRange = 0.5; // Range over which temperature affects clouds (controls falloff rate)

  // Calculate how far we are from optimal temperature (normalized distance 0-1)
  const distanceFromOptimal = Math.abs(temperature - optimalCloudTemp);
  const normalizedDistance = Math.min(1, distanceFromOptimal / tempRange);

  // Cloud intensity falls off linearly from peak (at optimal temp) to minimum (at edges)
  // This ensures a smooth gradient without sudden flashing
  const tempInfluence =
    minCloudIntensity + (1 - minCloudIntensity) * (1 - normalizedDistance);

  const tempInfluenceWeight = 1; // How much temperature affects cloud formation

  //
  //
  //

  // Blend height-based intensity with temperature influence
  cloudConfig.intensity =
    (1 - tempInfluenceWeight) * intensityFromHeight +
    tempInfluenceWeight * tempInfluence;

  const cloudSize = cloudConfig.size;
  const cloudIntensity = cloudConfig.intensity;

  // basic big smooth soft clouds and sunbeams
  cloudLevelNoise =
    cloudIntensity *
    getScaledNoise(noise, cloudSize * noiseX, cloudSize * noiseY);
  cloudLevel += cloudLevelNoise;
  // medium clouds where there are no sunbeams
  cloudLevelNoise =
    (cloudIntensity + cloudGeneration.detailIntensityOffset1) *
    getScaledNoise(
      noise,
      cloudSize + cloudGeneration.detailNoiseOffset1 * (noiseX + offset),
      cloudSize + cloudGeneration.detailNoiseOffset1 * (noiseY + offset)
    );

  if (cloudLevel > sunbeamMaxLevel) {
    cloudLevel += cloudLevelNoise;
  }
  cloudLevelNoise =
    (cloudIntensity + cloudGeneration.detailIntensityOffset2) *
    getScaledNoise(
      noise,
      cloudSize + cloudGeneration.detailNoiseOffset2 * (noiseX + offset),
      cloudSize + cloudGeneration.detailNoiseOffset2 * (noiseY + offset)
    );

  if (cloudLevel > sunbeamMaxLevel) {
    cloudLevel += cloudLevelNoise;
  }

  if (cloudLevel > 1) {
    cloudLevel = 1;
  } else if (cloudLevel < 0) {
    cloudLevel = 0;
  }
  return cloudLevel;
};

// const generateCloudLevel = (
//   x: number,
//   y: number,
//   height: number,
//   temperature: number,
//   moisture: number,
//   noise: Noise
// ): number => {
//   let noiseX = x / gameWidth - 0.5;
//   let noiseY = y / gameHeight - 0.5;

//   noiseX += cloudOffset.x;
//   noiseY += cloudOffset.y;

//   let cloudLevel = 0;
//   let cloudLevelNoise = 0;
//   let offset = cloudGeneration.noiseOffset;
//   const seaLevel = Biomes.Biomes.ocean.generationOptions.height.max + 0;
//   // Biomes.Biomes.ocean.generationOptions.height.max / 5; // make the intensity boundary less sharp
//   // const belowSeaLevel = height < seaLevel;
//   // set a variable between - and 1 indicatining how far above sea level it is
//   const aboveSeaLevel = height - seaLevel;
//   // console.log(aboveSeaLevel);
//   const belowSeaLevel = height < seaLevel;
//   const cloudConfig = {
//     size: 2,
//     intensity: 0.5,
//   };

//   // base size and intensity on:
//   // temp and moisture level
//   // height
//   // if below sea level, increase size and intensity
//   // if high temp and high moisture, increase size and intensity
//   // if high moisture, increase intensity
//   // if low temp, decrease size
//   //do this in an algorithmic way, maybe using lerp

//   // mostly cloudy = cloudConfig.size: 5, cloudConfig.intensity: 0.85
//   // partially cloudy = cloudConfig.size: 0.05, cloudConfig.intensity: 0.6
//   // clear = cloudConfig.size: 0.1, cloudConfig.intensity: 0.27
//   // moonlight = cloudConfig.size: 0.03, cloudConfig.intensity: 0.8

//   const normalizedTemperature = normalize(
//     (temperature - GameSettings.options.temperatureRange.min) /
//       (GameSettings.options.temperatureRange.max -
//         GameSettings.options.temperatureRange.min),
//     0,
//     1
//   );
//   // cloudConfig.size = lerp(1 - normalizedCloudSize, 0.1, 5);
//   cloudConfig.size = 0.001;
//   if (aboveSeaLevel > 0) {
//     // decrease the size of the clouds as they go above sea level
//     // cloudConfig.size = lerp(aboveSeaLevel, cloudConfig.size, 2);
//   }
//   // cloudConfig.size = 30;
//   // if (belowSeaLevel) {
//   //   cloudConfig.size = 0.001;
//   // }
//   // if (aboveSeaLevel > 0) {
//   //   cloudConfig.size = lerp(aboveSeaLevel, )
//   // }

//   const normalizedMoisture = normalize(
//     (moisture - GameSettings.options.moistureRange.min) /
//       (GameSettings.options.moistureRange.max -
//         GameSettings.options.moistureRange.min),
//     0,
//     1
//   );
//   // base visibility of clouds, goes down as they go above sea level
//   let baseVisibility = 0.15;

//   if (aboveSeaLevel > 0) {
//     // normalizedHeight = aboveSeaLevel;
//     // baseVisibility = lerp(1 - aboveSeaLevel, -0.5, 0.15);
//     // console.log(baseVisibility);
//     baseVisibility = -0.0;
//   }

//   // if (belowSeaLevel) {
//   //   // normalizedHeight = 0.3;
//   //   normalizedHeight = normalize((seaLevel - height) / seaLevel, 0, 0.15);
//   //   // console.log("below sea level", normalizedHeight);
//   // }
//   // console.log(normalizedHeight);
//   //take into account the temperature and moisture values
//   // let intensity =
//   //   0.15 + normalizedHeight + (normalizedTemperature + normalizedMoisture) / 2;
//   let intensity =
//     baseVisibility + (normalizedTemperature + normalizedMoisture) / 2;

//   cloudConfig.intensity = lerp(intensity, 0.29, 0.9);
//   // cloudConfig.intensity = 0.8;

//   const cloudSize = cloudConfig.size;
//   const cloudIntensity = cloudConfig.intensity;

//   // basic big smooth soft clouds and sunbeams
//   cloudLevelNoise =
//     cloudIntensity *
//     getScaledNoise(noise, cloudSize * noiseX, cloudSize * noiseY);
//   cloudLevel += cloudLevelNoise;
//   // medium clouds where there are no sunbeams
//   cloudLevelNoise =
//     (cloudIntensity + cloudGeneration.detailIntensityOffset1) *
//     getScaledNoise(
//       noise,
//       cloudSize + cloudGeneration.detailNoiseOffset1 * (noiseX + offset),
//       cloudSize + cloudGeneration.detailNoiseOffset1 * (noiseY + offset)
//     );

//   if (cloudLevel > sunbeamMaxLevel) {
//     cloudLevel += cloudLevelNoise;
//   }
//   cloudLevelNoise =
//     (cloudIntensity + cloudGeneration.detailIntensityOffset2) *
//     getScaledNoise(
//       noise,
//       cloudSize + cloudGeneration.detailNoiseOffset2 * (noiseX + offset),
//       cloudSize + cloudGeneration.detailNoiseOffset2 * (noiseY + offset)
//     );

//   if (cloudLevel > sunbeamMaxLevel) {
//     cloudLevel += cloudLevelNoise;
//   }

//   if (cloudLevel > 1) {
//     cloudLevel = 1;
//   } else if (cloudLevel < 0) {
//     cloudLevel = 0;
//   }
//   return cloudLevel;
// };

// const generateCloudLevel = (
//   x: number,
//   y: number,
//   biomeId: BiomeId,
//   noise: Noise
// ): number => {
//   let noiseX = x / gameWidth - 0.5;
//   let noiseY = y / gameHeight - 0.5;

//   noiseX += cloudOffset.x;
//   noiseY += cloudOffset.y;

//   let cloudLevel = 0;
//   let cloudLevelNoise = 0;
//   let offset = cloudGeneration.noiseOffset;
//   // Get biome-specific cloud settings for this biome or use default
//   // const biomeConfig = biomeClouds[biomeId] || biomeClouds["default"];
//   // const cloudSize = biomeConfig.size;
//   // const cloudIntensity = biomeConfig.intensity;
//   const cloudConfig = {
//     size: 1,
//     intensity: 1,
//   }

//   // basic big smooth soft clouds and sunbeams
//   cloudLevelNoise =
//     cloudIntensity *
//     getScaledNoise(noise, cloudSize * noiseX, cloudSize * noiseY);
//   cloudLevel += cloudLevelNoise;
//   // medium clouds where there are no sunbeams
//   cloudLevelNoise =
//     (cloudIntensity + cloudGeneration.detailIntensityOffset1) *
//     getScaledNoise(
//       noise,
//       cloudSize + cloudGeneration.detailNoiseOffset1 * (noiseX + offset),
//       cloudSize + cloudGeneration.detailNoiseOffset1 * (noiseY + offset)
//     );

//   if (cloudLevel > sunbeamMaxLevel) {
//     cloudLevel += cloudLevelNoise;
//   }
//   cloudLevelNoise =
//     (cloudIntensity + cloudGeneration.detailIntensityOffset2) *
//     getScaledNoise(
//       noise,
//       cloudSize + cloudGeneration.detailNoiseOffset2 * (noiseX + offset),
//       cloudSize + cloudGeneration.detailNoiseOffset2 * (noiseY + offset)
//     );

//   if (cloudLevel > sunbeamMaxLevel) {
//     cloudLevel += cloudLevelNoise;
//   }

//   if (cloudLevel > 1) {
//     cloudLevel = 1;
//   } else if (cloudLevel < 0) {
//     cloudLevel = 0;
//   }
//   return cloudLevel;
// };

const updateCloudOffset = () => {
  cloudOffset.x += windSpeed.x * baseWindSpeed;
  cloudOffset.y += windSpeed.y * baseWindSpeed;
};

const updateWindSpeed = () => {
  // each frame, modify windspeed such that it changes direction gradually over time
  // We now use the cached wind settings from GameSettings

  if (RNG.getUniform() < windSpeedChangeChance) {
    windSpeed.x +=
      RNG.getUniform() < 0.5 ? windSpeedChangeAmount : -windSpeedChangeAmount;
  }
  if (RNG.getUniform() < windSpeedChangeChance) {
    windSpeed.y +=
      RNG.getUniform() < 0.5 ? windSpeedChangeAmount : -windSpeedChangeAmount;
  }
  if (RNG.getUniform() < windSpeedChangeDirectionChance) {
    windSpeed.x +=
      RNG.getUniform() < 0.5
        ? windSpeedChangeDirection
        : -windSpeedChangeDirection;
  }
  if (RNG.getUniform() < windSpeedChangeDirectionChance) {
    windSpeed.y +=
      RNG.getUniform() < 0.5
        ? windSpeedChangeDirection
        : -windSpeedChangeDirection;
  }
  windSpeed.x = Math.min(windSpeedMax, Math.max(windSpeedMin, windSpeed.x));
  windSpeed.y = Math.min(windSpeedMax, Math.max(windSpeedMin, windSpeed.y));
};
