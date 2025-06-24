import { Color, Lighting } from "rot-js/lib/index";
import { Game } from "./game";
import PreciseShadowcasting from "rot-js/lib/fov/precise-shadowcasting";
import { MapWorld } from "./map-world";
import { Color as ColorType } from "rot-js/lib/color";
import { Tile } from "./tile";
import {
  indexToPosition,
  multiColorLerp,
  positionToIndex,
} from "./misc-utility";
import { BiomeId } from "./biomes";
import { GameSettings } from "./game-settings";
import { Layer } from "./renderer";
import { Query } from "miniplex";
import { ActorBase } from "./actor";
import { Camera } from "./camera";
import { SystemActors } from "./system-actors";
import { SystemCollision } from "./system-collision";
import { DayPhase, SystemTime } from "./system-time";
import { SystemOcclusion } from "./system-occlusion";
import { SystemShadows } from "./system-shadows";
import { SystemClouds } from "./system-clouds";

export const BlockLight: BiomeId[] = [
  "hillslow",
  "hillsmid",
  "hillshigh",
  "grass",
];
export const ReflectWaterLight: BiomeId[] = ["ocean", "oceandeep", "swamp"];
export const ReflectDirtLight: BiomeId[] = ["sandydirt", "beach"];
export const ShadowLight: BiomeId[] = ["grass", "valley"];

export type RGBAColor = [number, number, number, number]; // r,g,b,a [255, 255, 255, 1]

export class LightManager {
  public static lightDefaults: { [key: string]: ColorType };
  public lightMapR: Int32Array; // just the red color of the ColorType [r, g, b]
  public lightMapG: Int32Array;
  public lightMapB: Int32Array;
  private dynamicLightMap: ColorType[]; // x,y -> rgb color array
  private lightingFov: PreciseShadowcasting;
  private lightEmitters: Lighting;
  private lightEmitterById: { [id: string]: [number, number] };
  private ambientLight: ColorType;
  private targetAmbientLight: ColorType;
  private worker: Worker;
  private camera: Camera;

  constructor(private game: Game, private map: MapWorld) {
    LightManager.lightDefaults = {
      fullLight: [255, 255, 255],
      purple: [255, 0, 255],
      highLight: [240, 240, 240],
      mediumLight: [230, 230, 230],
      sunlight: [255, 255, 255],
      yellowLight: [255, 240, 230],
      blueLight: [65, 65, 110],
      moonlight: [90, 90, 150],
      ambientDaylight: [100, 100, 100],
      ambientSunset: [250, 205, 160],
      ambientNightLight: [60, 60, 60],
      shadow: [20, 20, 27], // shadow day or night
      torchBright: [235, 165, 30],
      torchDim: [200, 200, 30],
      fire: [240, 60, 60],
      ambientOcc: [50, 50, 60], // how much to reduce from full brightness when in shadow
      // cloudShadow: [50, 50, 55], // how much to reduce from full brightness when in cloud shadow
      cloudShadow: [20, 20, 27], // how much to reduce from full brightness when in cloud shadow
      cloudShadowSetting: [60, 60, 60], // how much to reduce from full brightness when in cloud shadow
      shadowSunset: [135, 80, 60],
      shadowSunrise: [50, 50, 62], // blue
    };
    this.lightEmitterById = {};
    // this.worker = new Worker(new URL("./light-worker.ts", import.meta.url));
    // this.worker.postMessage({
    //   type: "init",
    //   data: {
    //     lightDefaults: LightManager.lightDefaults,
    //   },
    // });
  }

  private updateLightmapFromWorker(lightData: [number, ColorType][]) {
    lightData.forEach(([index, color], i) => {
      if (!color.length) {
        console.throttle(250).log("no color for index", i, color);
      }
      this.set(index, color);
    });
  }

  public init() {
    console.log("init light manager");
    this.camera = this.game.camera;
    const layerCount = Layer.UI;
    let layerSize =
      GameSettings.options.gameSize.width *
      GameSettings.options.gameSize.height *
      Tile.tileDensityRatio; // account for dense grid, like for plants
    let totalSize = layerSize * layerCount; // account for each layer

    this.dynamicLightMap = [];
    this.lightMapR = new Int32Array(totalSize);
    this.lightMapG = new Int32Array(totalSize);
    this.lightMapB = new Int32Array(totalSize);
    this.lightEmitterById = {};

    this.calculateAmbientLight(false); // calculate initial ambient light
    this.calculateAmbientLight(true); // calculate target ambient light
    this.interpolateAmbientLight(); // interpolate between them based on time of day

    // dynamic lighting setup
    this.lightingFov = new PreciseShadowcasting(this.lightPasses.bind(this), {
      topology: 8,
    });
    this.lightEmitters = new Lighting(this.reflectivity.bind(this), {
      range: 6,
      passes: 2,
    });
    this.lightEmitters.setFOV(this.lightingFov);

    this.lightEmitters.compute(this.lightingCallback.bind(this));
    this.clearLightMap(); // set to ambient light
  }

  public calculateAmbientLight(calculateTarget = true) {
    if (!GameSettings.options.toggles.enableGlobalLights) {
      return;
    }
    // Set the target light state instead of the current light state
    let ambientLightToUpdate = this.targetAmbientLight;
    const isDaytime = SystemTime.isDayTime;
    const phase = SystemTime.lightPhase;
    if (!calculateTarget) {
      ambientLightToUpdate = this.ambientLight;
    }
    if (isDaytime) {
      if (phase === DayPhase.morning) {
        ambientLightToUpdate = Color.lerp(
          LightManager.lightDefaults.ambientDaylight,
          LightManager.lightDefaults.sunlight,
          SystemTime.remainingPhasePercent
        );
      } else if (phase === DayPhase.mid) {
        ambientLightToUpdate = LightManager.lightDefaults.sunlight;
      } else {
        ambientLightToUpdate = multiColorLerp(
          [
            LightManager.lightDefaults.ambientDaylight,
            LightManager.lightDefaults.ambientSunset,
            LightManager.lightDefaults.sunlight,
          ],
          SystemTime.remainingPhasePercent
        );
      }
    } else {
      if (phase === DayPhase.morning) {
        ambientLightToUpdate = multiColorLerp(
          [
            LightManager.lightDefaults.ambientDaylight,
            LightManager.lightDefaults.ambientNightLight,
            LightManager.lightDefaults.moonlight,
          ],
          SystemTime.remainingPhasePercent
        );
      } else if (phase === DayPhase.mid) {
        ambientLightToUpdate = LightManager.lightDefaults.moonlight;
      } else {
        ambientLightToUpdate = multiColorLerp(
          [
            LightManager.lightDefaults.ambientDaylight,
            LightManager.lightDefaults.ambientNightLight,
            LightManager.lightDefaults.moonlight,
          ],
          SystemTime.remainingPhasePercent
        );
      }
    }

    if (!calculateTarget) {
      this.ambientLight = ambientLightToUpdate;
    } else {
      this.targetAmbientLight = ambientLightToUpdate;
    }
  }

  private lightPasses(x: number, y: number): boolean {
    const tile = this.map.getTile(x, y);
    if (!tile) {
      return false;
    }

    if (SystemCollision.isMapBlocked(x, y, this.map)) {
      return false;
    }

    if (SystemCollision.isBlockedOnLayer(x, y, Layer.SMALLACTOR)) {
      return false;
    }

    return true;
  }

  public clearDynamicLightMap() {
    this.dynamicLightMap.length = 0;
  }

  public clearLightMap() {
    console.log("clearing light map");
    let posIndex = -1;
    for (let i = 0; i < GameSettings.options.gameSize.width; i++) {
      for (let j = 0; j < GameSettings.options.gameSize.height; j++) {
        posIndex = positionToIndex(i, j, Layer.TERRAIN);
        this.set(posIndex, this.ambientLight);
      }
    }
  }

  public reflectivity(x: number, y: number) {
    const index = positionToIndex(x, y, Layer.TERRAIN);
    const biomeId = this.map.biomeMap.get(index);
    if (!biomeId) {
      return 0;
    }
    const isBlocking = BlockLight.includes(biomeId);
    const isWater = ReflectWaterLight.includes(biomeId);
    const isReflectiveDirt = ReflectDirtLight.includes(biomeId);
    const isShadowed = ShadowLight.includes(biomeId);
    if (isBlocking) {
      return 0;
    }
    if (isShadowed) {
      return 0.13;
    }
    if (isReflectiveDirt) {
      return 0.28;
    }
    if (isWater) {
      return 0.37;
    }
    return 0.22;
  }

  public lightingCallback(x: number, y: number, color: ColorType) {
    if (Camera.inViewport(x, y, Layer.TERRAIN, this.camera.viewportUnpadded)) {
      this.dynamicLightMap[positionToIndex(x, y, Layer.TERRAIN)] = color;
    }
  }

  public interpolateAmbientLight() {
    if (!GameSettings.options.toggles.enableGlobalLights) {
      return;
    }
    const progress = SystemTime.turnAnimTimePercent;
    // Interpolate between the current light state and the target light state based on
    // the progress from start to this.game.options.maxTurnDelay
    this.ambientLight = Color.lerp(
      this.ambientLight,
      this.targetAmbientLight,
      progress
    );
  }

  public turnUpdate() {
    this.clearDynamicLightMap();
    this.calculateAmbientLight();
    // this.calculateLightMap(viewportTiles);
  }

  public renderUpdate(interpPercent: number, viewportTiles: number[]) {
    // Interpolate the light state before computing the lighting
    this.interpolateAmbientLight();
    this.calculateLightMap(viewportTiles);
  }

  public tintActors(
    objs: Query<ActorBase>,
    highlight: boolean = false,
    layer: Layer = Layer.TERRAIN
  ) {
    if (GameSettings.shouldTint()) {
      for (const actor of objs) {
        // for (let i = 0; i < objs.length; i++) {
        if (!actor?.sprite) {
          console.log("no sprite to tint for obj:", actor);
          continue;
        }
        let translatedX = Tile.translate(
          actor.position.x,
          layer,
          Layer.TERRAIN
        );
        let translatedY = Tile.translate(
          actor.position.y,
          layer,
          Layer.TERRAIN
        );
        let colorArray = this.game.map.lightManager.getLightFor(
          translatedX,
          translatedY,
          highlight
        ) as ColorType;
        if (colorArray?.length) {
          // tint the obj
          this.game.renderer.tintObjectWithChildren(actor.sprite, colorArray);
        }
      }
    }
  }

  public recalculateDynamicLighting() {
    if (!GameSettings.options.toggles.enableDynamicLights) {
      return;
    }
    this.lightEmitters.compute(this.lightingCallback.bind(this));
  }

  public clearAllDynamicLights() {
    for (const actor of SystemActors.queries.withAnimator) {
      if (this.lightEmitterById[actor.id]) {
        const [x, y] = this.lightEmitterById[actor.id];
        this.lightEmitters.setLight(x, y, null);
        this.lightEmitterById[actor.id] = null;
      }
    }
  }

  public clearChangedDynamicLights() {
    if (!GameSettings.options.toggles.enableDynamicLights) {
      return;
    }
    for (const actor of SystemActors.queries.withAnimator) {
      if (this.lightEmitterById[actor.id]) {
        const [x, y] = this.lightEmitterById[actor.id];
        if (actor.position.x != x || actor.position.y != y) {
          this.lightEmitters.setLight(x, y, null);
          this.lightEmitterById[actor.id] = null;
        }
      }
    }
  }

  public updateDynamicLighting() {
    if (!GameSettings.options.toggles.enableDynamicLights) {
      return;
    }
    if (SystemTime.isNighttime) {
      for (const actor of SystemActors.queries.withAnimator) {
        let updateLight = false;
        if (!this.lightEmitterById[actor.id]) {
          updateLight = true;
        }
        if (this.lightEmitterById[actor.id]) {
          const [x, y] = this.lightEmitterById[actor.id];
          if (actor.position.x != x || actor.position.y != y) {
            updateLight = true;
          }
        }

        if (updateLight) {
          this.lightEmitterById[actor.id] = [
            actor.position.x,
            actor.position.y,
          ];
          this.lightEmitters.setLight(
            actor.position.x,
            actor.position.y,
            LightManager.lightDefaults.torchBright
          );
        }
      }
    }
  }

  public calculateLightMap(tiles: number[]) {
    const dynamicLightMap = this.dynamicLightMap;
    const shadowMap = SystemShadows.all;
    const cloudMap = SystemClouds.cloudMap;
    let dynamicLightValue: ColorType;
    let shadowValue: number;
    let occlusionValue: number;
    let cloudValue: number;
    let light: ColorType;

    for (let posIndex of tiles) {
      dynamicLightValue = dynamicLightMap[posIndex];
      shadowValue = shadowMap[posIndex];
      occlusionValue = SystemOcclusion.atIndex(posIndex);
      cloudValue = cloudMap[posIndex];

      light = this.calculateLight(
        dynamicLightValue,
        shadowValue,
        occlusionValue,
        cloudValue,
        false
      );
      this.set(posIndex, light);
    }
  }

  public getAmbientLight(): ColorType {
    return this.ambientLight;
  }

  // public getLightFor(
  //   x: number,
  //   y: number,
  //   highlight: boolean = false,
  //   includeAlpha: boolean = false
  // ): ColorType {
  //   // check if position is in viewport
  //   if (!this.game.userInterface.camera.inViewport(x, y, false)) {
  //     return this.ambientLight;
  //   }
  //   let light = this.get(positionToIndex(x, y, Layer.TERRAIN));

  //   if (highlight) {
  //     light = Color.interpolate(
  //       light,
  //       LightManager.lightDefaults.fullLight,
  //       0.4
  //     );
  //   }
  //   return light;
  // }

  public getLightFor(
    x: number,
    y: number,
    highlight: boolean = false,
    includeAlpha: boolean = false
  ): ColorType | RGBAColor {
    // check if position is in viewport
    if (!Camera.inViewport(x, y, Layer.TERRAIN, this.camera.viewportUnpadded)) {
      return this.ambientLight;
    }
    let light = [];
    light = this.get(positionToIndex(x, y, Layer.TERRAIN));

    if (highlight) {
      light = Color.interpolate(
        light as ColorType,
        LightManager.lightDefaults.fullLight,
        0.4
      );
    }
    if (includeAlpha) {
      light.push(1);
      return light as RGBAColor;
    }
    return light as ColorType;
  }

  public getLightForTree(
    x: number,
    y: number,
    highlight: boolean = false,
    includeAlpha: boolean = false,
    baseTint: ColorType
  ): ColorType | RGBAColor {
    // check if position is in viewport
    if (!Camera.inViewport(x, y, Layer.TERRAIN, this.camera.viewportUnpadded)) {
      return this.ambientLight;
    }
    let light = [];
    light = this.get(positionToIndex(x, y, Layer.TERRAIN));

    if (highlight) {
      light = Color.interpolate(
        light as ColorType,
        LightManager.lightDefaults.fullLight,
        0.4
      );
    }
    if (includeAlpha) {
      light.push(1);
      return light as RGBAColor;
    }

    light = Color.interpolate(baseTint as ColorType, light as ColorType);
    return light as ColorType;
  }

  public getRGBALightFor(
    x: number,
    y: number,
    highlight: boolean = false
  ): RGBAColor {
    let light = this.getLightFor(x, y, highlight);
    return [light[0], light[1], light[2], 1];
  }

  public calculateLight(
    lightValue: ColorType = null,
    shadowValue: number = null,
    occlusionValue: number = null,
    cloudValue: number = null,
    highlight: boolean = false
  ): ColorType {
    const { map } = this.game;
    const ambientLight = this.ambientLight;
    const isDaytime = SystemTime.isDayTime;
    const phase = SystemTime.lightPhase;
    const isNight = SystemTime.isNighttime;
    const isSettingPhase = phase === DayPhase.evening;

    const shadow = isSettingPhase
      ? LightManager.lightDefaults.shadowSunset
      : LightManager.lightDefaults.shadowSunrise;

    const cloudMinLevel = SystemClouds.cloudMinLevel;
    const sunbeamMaxLevel = SystemClouds.sunbeamMaxLevel;
    const shadowStrength = SystemShadows.shadowStrength;
    const ambOccShadowStrength = SystemOcclusion.strengthMultiplier;
    const cloudStrength = SystemClouds.cloudStrength;
    const sunbeamStrength = SystemClouds.sunbeamStrength;
    const isShadowed = shadowValue > 0;
    // const isOccluded = occlusionValue !== 1;
    const isOccluded = occlusionValue > 0;
    const isClouded = cloudValue > cloudMinLevel;
    const isCloudClear = cloudValue < sunbeamMaxLevel;

    // Reuse `cloudShadow` instead of reassigning
    let cloudShadow = Color.multiply(
      isSettingPhase
        ? LightManager.lightDefaults.cloudShadowSetting
        : LightManager.lightDefaults.cloudShadow,
      ambientLight
    );

    if (!isNight && isSettingPhase) {
      cloudShadow = Color.interpolate(
        cloudShadow,
        ambientLight,
        1 - SystemTime.remainingPhasePercent
      );
    }

    // Start with ambient light
    let light = ambientLight;

    if (lightValue) {
      light = Color.add(light, lightValue);
    } else {
      if (isOccluded) {
        // console.log(
        //   "occluded",
        //   occlusionValue
        //   // light,
        //   // LightManager.lightDefaults.ambientOcc
        // );
        // light = LightManager.lightDefaults.ambientOcc;
        light = Color.interpolate(
          light,
          LightManager.lightDefaults.ambientOcc,
          occlusionValue * ambOccShadowStrength
        );
      }
      if (isShadowed) {
        light = Color.interpolate(light, shadow, shadowValue * shadowStrength);
      }
    }

    // Combine ambient light once instead of multiple multiplications
    light = Color.multiply(ambientLight, light);

    if (isClouded && isDaytime) {
      light = Color.interpolate(
        light,
        cloudShadow,
        1 - cloudStrength * (1 - (cloudValue - cloudMinLevel))
      );
    }

    if (isCloudClear) {
      // light = Color.interpolate(
      //   light,
      //   isNight
      //     ? LightManager.lightDefaults.blueLight
      //     : LightManager.lightDefaults.yellowLight,
      //   cloudStrength * ((sunbeamMaxLevel - cloudValue) * sunbeamStrength)
      // );
    }

    if (highlight) {
      light = Color.interpolate(
        light,
        LightManager.lightDefaults.fullLight,
        0.4
      );
    }

    return light;
  }

  // public calculateLight(
  //   lightMap: ColorType = null, // x,y -> color based on light sources
  //   shadowMap: number = null, // x,y -> number based on sun position
  //   occlusionMap: number = null, // x,y -> number based on occlusion
  //   cloudMap: number = null, // x,y -> number based on cloud cover
  //   highlight: boolean = false
  // ): ColorType {
  //   const ambientLight = this.ambientLight;
  //   const isDaytime = TimeManager.isDayTime;
  //   const phase = TimeManager.lightPhase;
  //   const isNight = TimeManager.isNighttime;
  //   const isSettingPhase = phase === LightPhase.setting;
  //   let shadow = isSettingPhase
  //     ? LightManager.lightDefaults.shadowSunset
  //     : LightManager.lightDefaults.shadowSunrise;
  //   let ambientOccShadow = LightManager.lightDefaults.ambientOcc;
  //   const isShadowed =
  //     Math.abs(shadowMap - this.game.map.shadowMap.ambientLightStrength) > 0.01;
  //   const isOccluded = occlusionMap !== 1;
  //   const isClouded = cloudMap > this.map.cloudMap.cloudMinLevel;
  //   const isCloudClear = cloudMap < this.map.cloudMap.sunbeamMaxLevel;

  //   const shadowStrength = this.game.map.shadowMap.shadowStrength;
  //   let ambOccShadowStrength =
  //     this.game.map.shadowMap.ambientOcclusionShadowStrength;
  //   const cloudStrength = this.game.map.cloudMap.cloudStrength;
  //   const sunbeamStrength = this.game.map.cloudMap.sunbeamStrength;
  //   let cloudShadow = Color.multiply(
  //     isSettingPhase
  //       ? LightManager.lightDefaults.cloudShadowSetting
  //       : LightManager.lightDefaults.cloudShadow,
  //     ambientLight
  //   );
  //   // const cloudShadow = Color.multiply(
  //   //   !isNight && isSettingPhase
  //   //     ? LightManager.lightDefaults.cloudShadowSetting
  //   //     : LightManager.lightDefaults.cloudShadow,
  //   //   ambientLight
  //   // );
  //   // console.log(TimeManager.remainingCyclePercent);
  //   if (!isNight && isSettingPhase) {
  //     // console.log(TimeManager.remainingCyclePercent);

  //     cloudShadow = Color.interpolate(
  //       cloudShadow,
  //       ambientLight,
  //       1 - TimeManager.remainingPhasePercent
  //     );
  //   }

  //   let light = ambientLight;

  //   if (lightMap != undefined) {
  //     // override shadows light if there is a light source
  //     light = Color.add(light, lightMap);
  //   } else {
  //     if (isOccluded) {
  //       light = Color.interpolate(
  //         light,
  //         ambientOccShadow,
  //         (1 - occlusionMap) * ambOccShadowStrength
  //       );
  //     }
  //     if (isShadowed && isDaytime) {
  //       light = Color.interpolate(
  //         light,
  //         shadow,
  //         (1 - shadowMap) * shadowStrength
  //       );
  //     }
  //   }
  //   light = Color.multiply(ambientLight, light);

  //   if (isClouded && isDaytime) {
  //     //darken the light very slightly based on cloudStrength
  //     // 1 - cloudLevel to darken the areas where cloud level is high.
  //     // cloudLevel - cloudMinLevel to only darken clouds where the cloud level is above a certain threshold.
  //     light = Color.interpolate(
  //       light,
  //       cloudShadow,
  //       1 - cloudStrength * (1 - (cloudMap - this.map.cloudMap.cloudMinLevel))
  //     );
  //   }

  //   if (isCloudClear) {
  //     // // light = Color.interpolate(light, ambientOccShadow, 1 - shadowStrength);
  //     // light = Color.interpolate(ambientOccShadow, light, shadowStrength * 0.9);
  //     // light = Color.interpolate(
  //     //   light,
  //     //   this.game.map.lightManager.lightDefaults.purple,
  //     //   cloudStrength * cloudLevel
  //     // );
  //     light = Color.interpolate(
  //       light,
  //       // LightManager.lightDefaults.purple,
  //       isNight
  //         ? LightManager.lightDefaults.blueLight
  //         : LightManager.lightDefaults.yellowLight,
  //       cloudStrength *
  //         ((this.map.cloudMap.sunbeamMaxLevel - cloudMap) * sunbeamStrength)
  //     );

  //     // light = Color.interpolate(
  //     //   light,
  //     //   isNight
  //     //     ? this.game.map.lightManager.lightDefaults.blueLight
  //     //     : this.game.map.lightManager.lightDefaults.yellowLight,
  //     //   cloudStrength *
  //     //     ((0.25 - cloudLevel) * 1)
  //     // );
  //   }

  //   if (highlight) {
  //     light = Color.interpolate(
  //       light,
  //       LightManager.lightDefaults.fullLight,
  //       0.4
  //     );
  //   }
  //   return light;
  // }

  public getTotalLight(x: number, y: number): number {
    const posIndex = positionToIndex(x, y, Layer.TERRAIN);
    // console.throttle(250).log("lightFromClouds", lightFromClouds, cloudLevel);
    let totalLight = 1;
    if (GameSettings.options.toggles.enableGlobalLights) {
      totalLight = SystemTime.remainingPhasePercent;
    }

    if (GameSettings.options.toggles.enableOcclusionShadows) {
      const occlusionAmount = SystemOcclusion.atIndex(posIndex);
      const isOccluded = occlusionAmount > 0;
      if (isOccluded) {
        // console.log("occlusionAmount", occlusionAmount);
        totalLight *= 1 - occlusionAmount * SystemOcclusion.strengthMultiplier;
      }
    }

    if (GameSettings.options.toggles.enableSunShadows) {
      const shadowAmount = SystemShadows.all[posIndex];
      const isShadowed = shadowAmount > 0;
      if (isShadowed) {
        // console.log("shadowAmount", shadowAmount);
        totalLight *= 1 - shadowAmount * SystemShadows.shadowStrength;
      }
    }
    // if (isShadowed) {
    //   totalLight *= shadowAmount;
    // }

    if (GameSettings.options.toggles.enableClouds) {
      let cloudAmount = SystemClouds.atIndex(posIndex);
      cloudAmount -= SystemClouds.cloudMinLevel;
      const isCloudy = cloudAmount > 0;
      if (isCloudy) {
        // console.log("cloudAmount", cloudAmount);
        totalLight *= 1 - cloudAmount * SystemClouds.cloudStrength;
      }
    }
    // can go over 1 due to lightening effect from sunbeams/clouds
    if (totalLight < 0) {
      totalLight = 0;
    }
    if (totalLight > 1) {
      totalLight = 1;
    }
    return totalLight;
  }

  public get(index: number): ColorType {
    return [
      this.lightMapR[index],
      this.lightMapG[index],
      this.lightMapB[index],
    ];
  }

  public set(index: number, color: ColorType) {
    this.lightMapR[index] = color[0];
    this.lightMapG[index] = color[1];
    this.lightMapB[index] = color[2];
  }

  public onEnter(indexes: number[]) {}
}
