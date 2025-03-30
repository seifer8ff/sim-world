import { getScaledNoise, indexToXY, lerp } from "./misc-utility";
import { Point } from "./point";
import { BiomeId, Biomes } from "./biomes";
import Noise from "rot-js/lib/noise/noise";
import { LightPhase } from "./map-shadows";
import { RNG } from "rot-js";
import { Layer } from "./renderer";
import Simplex from "rot-js/lib/noise/simplex";
import { MessageType } from "./map-clouds";

console.log("spawned map-clouds-worker");

let noise: Noise = new Simplex();
let gameWidth: number;
let gameHeight: number;
let cloudStrength: number;
let sunbeamStrength: number;
let windSpeed = new Point(0.5, -0.2);
let sunbeamMaxLevel: number;
let baseWindSpeed = 0.5 / 100;
let cloudOffset = new Point(0, 0);

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
}) => {
  gameWidth = data.gameWidth;
  gameHeight = data.gameHeight;
  cloudStrength = data.cloudStrength;
  sunbeamStrength = data.sunbeamStrength;
  sunbeamMaxLevel = data.sunbeamMaxLevel;
};

const interpolateStrength = (data: {
  lightTransitionPercent: number;
  remainingCyclePercent: number;
  lightPhase: LightPhase;
}) => {
  let remainingLightTransitionPercent;

  if (data.lightPhase === LightPhase.rising) {
    remainingLightTransitionPercent =
      (1 - data.remainingCyclePercent) / data.lightTransitionPercent;
    cloudStrength = lerp(remainingLightTransitionPercent, 1, 0.95);
    sunbeamStrength = lerp(remainingLightTransitionPercent, sunbeamMaxLevel, 1); // prevent sunbeams from flickering
  } else if (data.lightPhase === LightPhase.peak) {
    // smoothly fade between 0 and 1 repeatedly, in a wave
    // const wave = Math.sin(remainingCyclePercent * Math.PI);
    // cloudStrength = lerp(wave, 0.95, 1);
    // sunbeamStrength = lerp(wave, 1, this.sunbeamMaxLevel);
  } else if (data.lightPhase === LightPhase.setting) {
    remainingLightTransitionPercent =
      data.remainingCyclePercent / data.lightTransitionPercent;
    cloudStrength = lerp(remainingLightTransitionPercent, 1, 0.95);
    sunbeamStrength = lerp(remainingLightTransitionPercent, sunbeamMaxLevel, 1);
  }
  cloudStrength = Math.round(cloudStrength * 1000) / 1000;
  sunbeamStrength = Math.round(sunbeamStrength * 1000) / 1000;
};

const update = (data: { tileIndexes: number[]; biomeIds: BiomeId[] }) => {
  updateWindSpeed();
  updateCloudOffset();
  const updatedCloudMap = updateCloudMapForTiles(
    data.tileIndexes,
    data.biomeIds
  );
  postMessage({
    type: MessageType.UPDATE,
    data: { cloudMap: updatedCloudMap, cloudStrength, sunbeamStrength },
  });
};

const onEnter = (data: { tileIndexes: number[]; biomeIds: BiomeId[] }) => {
  const updatedCloudMap = updateCloudMapForTiles(
    data.tileIndexes,
    data.biomeIds
  );
  postMessage({ type: MessageType.ON_ENTER, data: updatedCloudMap });
};

const updateCloudMapForTiles = (
  tileIndexes: number[],
  biomeIds: BiomeId[]
): Map<number, number> => {
  let posIndex: number;
  let posXY: [number, number];
  let biomeId: BiomeId;
  const updatedMap = new Map<number, number>();
  for (let i = 0; i < tileIndexes.length; i++) {
    posIndex = tileIndexes[i];
    biomeId = biomeIds[i];
    posXY = indexToXY(posIndex, Layer.TERRAIN, gameWidth, gameHeight);
    updatedMap.set(
      posIndex,
      generateCloudLevel(posXY[0], posXY[1], biomeId, noise)
    );
  }
  return updatedMap;
};

const generateCloudLevel = (
  x: number,
  y: number,
  biomeId: BiomeId,
  noise: Noise
): number => {
  let noiseX = x / gameWidth - 0.5;
  let noiseY = y / gameHeight - 0.5;

  noiseX += cloudOffset.x;
  noiseY += cloudOffset.y;

  let cloudLevel = 0;
  let cloudLevelNoise = 0;
  let offset = 155; // any value works, just offsets the noise for other octaves

  let cloudSize = 10;
  let cloudIntensity = 0.33;

  switch (biomeId) {
    case Biomes.Biomes.oceandeep.id:
      cloudSize = 2;
      cloudIntensity = 0.44;
      break;
    case Biomes.Biomes.ocean.id:
      cloudSize = 4.5;
      cloudIntensity = 0.42;
      break;
    case Biomes.Biomes.hillshigh.id:
    case Biomes.Biomes.hillsmid.id:
      cloudSize = 19;
      cloudIntensity = 0.37;
      break;
    case Biomes.Biomes.hillslow.id:
      cloudSize = 15;
      cloudIntensity = 0.33;
    case Biomes.Biomes.swamp.id:
      cloudIntensity = 0.34;
    default:
      cloudSize = 12;
      break;
  }

  // basic big smooth soft clouds and sunbeams
  cloudLevelNoise =
    cloudIntensity *
    getScaledNoise(noise, cloudSize * noiseX, cloudSize * noiseY);
  cloudLevel += cloudLevelNoise;

  // medium clouds where there are no sunbeams
  cloudLevelNoise =
    (cloudIntensity + 0.12) *
    getScaledNoise(
      noise,
      cloudSize + 10 * (noiseX + offset),
      cloudSize + 10 * (noiseY + offset)
    );

  if (cloudLevel > sunbeamMaxLevel) {
    cloudLevel += cloudLevelNoise;
  }

  cloudLevelNoise =
    (cloudIntensity - 0.08) *
    getScaledNoise(
      noise,
      cloudSize + 15 * (noiseX + offset),
      cloudSize + 15 * (noiseY + offset)
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

const updateCloudOffset = () => {
  cloudOffset.x += windSpeed.x * baseWindSpeed;
  cloudOffset.y += windSpeed.y * baseWindSpeed;
};

const updateWindSpeed = () => {
  // each frame, modify windspeed such that it changes direction gradually over time
  const windSpeedMax = 0.7;
  const windSpeedMin = -0.7;
  const windSpeedChangeChance = 0.01;
  const windSpeedChangeAmount = 0.05;
  const windSpeedChangeDirection = 0.16;
  const windSpeedChangeDirectionChance = 0.1;

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
