import { Color as ColorType } from "rot-js/lib/color";
import { Color } from "rot-js";
import { LightPhase } from "./map-shadows";

console.log("spawned light worker");

let lightDefaults: {
  shadowSunset: ColorType;
  shadowSunrise: ColorType;
  ambientOcc: ColorType;
  cloudShadow: ColorType;
  cloudShadowSetting: ColorType;
  blueLight: ColorType;
  yellowLight: ColorType;
  fullLight: ColorType;
};

const init = (e: MessageEvent) => {
  console.log("e.data", e.data.data);
  lightDefaults = e.data.data.lightDefaults;
};

onmessage = (e) => {
  const type = e.data.type;
  if (type === "init") {
    init(e);
    return;
  }

  const {
    x,
    y,
    posIndex,
    dynamicLightMap,
    sunMap,
    occlusionMap,
    cloudMap,
    options,
  }: {
    x: number;
    y: number;
    posIndex: number;
    dynamicLightMap: ColorType;
    sunMap: number;
    occlusionMap: number;
    cloudMap: number;
    options: {
      ambientLight: ColorType;
      isDaytime: boolean;
      lightPhase: LightPhase;
      ambientLightStrength: number;
      minCloudLevel: number;
      maxSunbeamLevel: number;
      shadowStrength: number;
      ambientOcclusionShadowStrength: number;
      cloudStrength: number;
      sunbeamStrength: number;
      remainingPhasePercent: number;
      lightDefaults: {
        shadowSunset: ColorType;
        shadowSunrise: ColorType;
        ambientOcc: ColorType;
        cloudShadow: ColorType;
        cloudShadowSetting: ColorType;
        blueLight: ColorType;
        yellowLight: ColorType;
        fullLight: ColorType;
      };
    };
  } = e?.data.data;
  Object.assign(options, { lightDefaults });
  if (posIndex) {
    const lightColor = calculateLightForPositions(
      x,
      y,
      posIndex,
      dynamicLightMap,
      sunMap,
      occlusionMap,
      cloudMap,
      options
    );

    postMessage([[posIndex, lightColor]]);
  }
};

const calculateLightForPositions = (
  x: number,
  y: number,
  posIndex: number,
  dynamicLightMap: ColorType,
  sunMap: number,
  occlusionMap: number,
  cloudMap: number,
  options: {
    ambientLight: ColorType;
    isDaytime: boolean;
    lightPhase: LightPhase;
    ambientLightStrength: number;
    minCloudLevel: number;
    maxSunbeamLevel: number;
    shadowStrength: number;
    ambientOcclusionShadowStrength: number;
    cloudStrength: number;
    sunbeamStrength: number;
    remainingPhasePercent: number;
    lightDefaults: {
      shadowSunset: ColorType;
      shadowSunrise: ColorType;
      ambientOcc: ColorType;
      cloudShadow: ColorType;
      cloudShadowSetting: ColorType;
      blueLight: ColorType;
      yellowLight: ColorType;
      fullLight: ColorType;
    };
  }
): ColorType => {
  if (!posIndex) {
    return options.ambientLight;
  }
  const lightColor: ColorType = calculateLight(
    dynamicLightMap,
    sunMap,
    occlusionMap,
    cloudMap,
    options
  );
  return lightColor;
};

const calculateLight = (
  lightMap: ColorType, // x,y -> color based on light sources
  shadowMap: number, // x,y -> number based on sun position
  occlusionMap: number, // x,y -> number based on occlusion
  cloudMap: number, // x,y -> number based on cloud cover
  options: {
    ambientLight: ColorType;
    isDaytime: boolean;
    lightPhase: LightPhase;
    ambientLightStrength: number;
    minCloudLevel: number;
    maxSunbeamLevel: number;
    shadowStrength: number;
    ambientOcclusionShadowStrength: number;
    cloudStrength: number;
    sunbeamStrength: number;
    remainingPhasePercent: number;
    lightDefaults: {
      shadowSunset: ColorType;
      shadowSunrise: ColorType;
      ambientOcc: ColorType;
      cloudShadow: ColorType;
      cloudShadowSetting: ColorType;
      blueLight: ColorType;
      yellowLight: ColorType;
      fullLight: ColorType;
    };
  },
  highlight: boolean = false
): ColorType => {
  const isNight = !options.isDaytime;
  const isSettingPhase = options.lightPhase === LightPhase.setting;
  let shadow = isSettingPhase
    ? options.lightDefaults.shadowSunset
    : options.lightDefaults.shadowSunrise;
  let ambientOccShadow = options.lightDefaults.ambientOcc;
  const isShadowed = Math.abs(shadowMap - options.ambientLightStrength) > 0.01;
  const isOccluded = occlusionMap !== 1;
  const isClouded = cloudMap > options.minCloudLevel;
  const isCloudClear = cloudMap < options.maxSunbeamLevel;

  const shadowStrength = options.shadowStrength;
  let ambOccShadowStrength = options.ambientOcclusionShadowStrength;
  const cloudStrength = options.cloudStrength;
  const sunbeamStrength = options.sunbeamStrength;
  let cloudShadow = Color.multiply(
    isSettingPhase
      ? options.lightDefaults.cloudShadowSetting
      : options.lightDefaults.cloudShadow,
    options.ambientLight
  );
  // const cloudShadow = Color.multiply(
  //   !isNight && isSettingPhase
  //     ? this.lightDefaults.cloudShadowSetting
  //     : this.lightDefaults.cloudShadow,
  //   ambientLight
  // );
  // console.log(this.game.timeManager.remainingCyclePercent);
  if (!isNight && isSettingPhase) {
    // console.log(this.game.timeManager.remainingCyclePercent);

    cloudShadow = Color.interpolate(
      cloudShadow,
      options.ambientLight,
      1 - options.remainingPhasePercent
    );
  }

  let light = options.ambientLight;

  if (lightMap != undefined) {
    // override shadows light if there is a light source
    light = Color.add(light, lightMap);
  } else {
    if (isOccluded) {
      light = Color.interpolate(
        light,
        ambientOccShadow,
        (1 - occlusionMap) * ambOccShadowStrength
      );
    }
    if (isShadowed && options.isDaytime) {
      light = Color.interpolate(
        light,
        shadow,
        (1 - shadowMap) * shadowStrength
      );
    }
  }
  light = Color.multiply(options.ambientLight, light);

  if (isClouded && options.isDaytime) {
    //darken the light very slightly based on cloudStrength
    // 1 - cloudLevel to darken the areas where cloud level is high.
    // cloudLevel - cloudMinLevel to only darken clouds where the cloud level is above a certain threshold.
    light = Color.interpolate(
      light,
      cloudShadow,
      1 - cloudStrength * (1 - (cloudMap - options.minCloudLevel))
    );
  }

  if (isCloudClear) {
    // // light = Color.interpolate(light, ambientOccShadow, 1 - shadowStrength);
    // light = Color.interpolate(ambientOccShadow, light, shadowStrength * 0.9);
    // light = Color.interpolate(
    //   light,
    //   this.game.map.options.purple,
    //   cloudStrength * cloudLevel
    // );
    light = Color.interpolate(
      light,
      // this.lightDefaults.purple,
      isNight
        ? options.lightDefaults.blueLight
        : options.lightDefaults.yellowLight,
      cloudStrength * ((options.maxSunbeamLevel - cloudMap) * sunbeamStrength)
    );

    // light = Color.interpolate(
    //   light,
    //   isNight
    //     ? this.game.map.options.blueLight
    //     : this.game.map.options.yellowLight,
    //   cloudStrength *
    //     ((0.25 - cloudLevel) * 1)
    // );
  }

  if (highlight) {
    light = Color.interpolate(light, options.lightDefaults.fullLight, 0.4);
  }
  return light;
};
