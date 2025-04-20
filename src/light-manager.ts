import { Color, Lighting } from "rot-js/lib/index";
import { Game } from "./game";
import PreciseShadowcasting from "rot-js/lib/fov/precise-shadowcasting";
import { MapWorld } from "./map-world";
import { Color as ColorType } from "rot-js/lib/color";
import { Tile } from "./tile";
import { multiColorLerp, positionToIndex } from "./misc-utility";
import { BiomeId } from "./biomes";
import { LightPhase } from "./map-shadows";
import { GameSettings } from "./game-settings";
import { Layer } from "./renderer";
import { Query } from "miniplex";
import { ActorBase } from "./actor";
import { Camera } from "./camera";
import { SystemActors } from "./system-actors";

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
      shadowSunset: [200, 60, 40],
      shadowSunrise: [30, 30, 42], // blue
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
    this.camera = this.game.userInterface.camera;
    const layerCount = Layer.UI;
    let layerSize =
      GameSettings.options.gameSize.width *
      Tile.tileDensityRatio *
      GameSettings.options.gameSize.height *
      Tile.tileDensityRatio; // account for dense grid, like for plants
    let totalSize = layerSize * layerCount; // account for each layer
    // console.log(
    //   "total tile size across all layers, single",
    //   totalSize,
    //   layerSize
    // );
    // this.spriteIndexCache = new Int32Array(totalSize).fill(-1);

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
    const isDaytime = this.game.timeManager.isDayTime;
    const phase = this.game.timeManager.lightPhase;
    if (!calculateTarget) {
      ambientLightToUpdate = this.ambientLight;
    }
    if (isDaytime) {
      if (phase === LightPhase.rising) {
        ambientLightToUpdate = Color.lerp(
          LightManager.lightDefaults.ambientDaylight,
          LightManager.lightDefaults.sunlight,
          this.game.timeManager.remainingPhasePercent
        );
      } else if (phase === LightPhase.peak) {
        ambientLightToUpdate = LightManager.lightDefaults.sunlight;
      } else {
        ambientLightToUpdate = multiColorLerp(
          [
            LightManager.lightDefaults.ambientDaylight,
            LightManager.lightDefaults.ambientSunset,
            LightManager.lightDefaults.sunlight,
          ],
          this.game.timeManager.remainingPhasePercent
        );
      }
    } else {
      if (phase === LightPhase.rising) {
        ambientLightToUpdate = multiColorLerp(
          [
            LightManager.lightDefaults.ambientDaylight,
            LightManager.lightDefaults.ambientNightLight,
            LightManager.lightDefaults.moonlight,
          ],
          this.game.timeManager.remainingPhasePercent
        );
      } else if (phase === LightPhase.peak) {
        ambientLightToUpdate = LightManager.lightDefaults.moonlight;
      } else {
        ambientLightToUpdate = multiColorLerp(
          [
            LightManager.lightDefaults.ambientDaylight,
            LightManager.lightDefaults.ambientNightLight,
            LightManager.lightDefaults.moonlight,
          ],
          this.game.timeManager.remainingPhasePercent
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

    if (this.game.collisionManager.isMapBlocked(x, y)) {
      return false;
    }

    if (this.game.collisionManager.isBlockedOnLayer(x, y, Layer.SMALLACTOR)) {
      return false;
    }

    return true;
  }

  public clearDynamicLightMap() {
    this.dynamicLightMap.length = 0;
  }

  public clearLightMap() {
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
    const progress = this.game.timeManager.turnAnimTimePercent;
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
    if (this.game.timeManager.isNighttime) {
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
    const sunMap = this.map.shadowMap.shadowMap;
    const occlusionMap = this.map.shadowMap.occlusionMap;
    const cloudMap = this.map.cloudMap.cloudMap;
    let dynamicLightValue: ColorType;
    let sunValue: number;
    let occlusionValue: number;
    let cloudValue: number;
    let light: ColorType;

    for (let posIndex of tiles) {
      dynamicLightValue = dynamicLightMap[posIndex];
      sunValue = sunMap[posIndex];
      occlusionValue = occlusionMap[posIndex];
      cloudValue = cloudMap[posIndex];
      light = this.calculateLight(
        dynamicLightValue,
        sunValue,
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
    lightMap: ColorType = null,
    shadowMap: number = null,
    occlusionMap: number = null,
    cloudMap: number = null,
    highlight: boolean = false
  ): ColorType {
    const { timeManager, map } = this.game;
    const { shadowMap: globalShadowMap, cloudMap: globalCloudMap } = map;
    const ambientLight = this.ambientLight;
    const isDaytime = timeManager.isDayTime;
    const phase = timeManager.lightPhase;
    const isNight = timeManager.isNighttime;
    const isSettingPhase = phase === LightPhase.setting;

    const shadow = isSettingPhase
      ? LightManager.lightDefaults.shadowSunset
      : LightManager.lightDefaults.shadowSunrise;

    const cloudMinLevel = globalCloudMap.cloudMinLevel;
    const sunbeamMaxLevel = globalCloudMap.sunbeamMaxLevel;
    const shadowStrength = globalShadowMap.shadowStrength;
    const ambOccShadowStrength = globalShadowMap.ambientOcclusionShadowStrength;
    const cloudStrength = globalCloudMap.cloudStrength;
    const sunbeamStrength = globalCloudMap.sunbeamStrength;

    // const isShadowed =
    //   Math.abs(shadowMap - globalShadowMap.ambientLightStrength) > 0.01;
    const isShadowed =
      shadowMap - GameSettings.options.ambientLightStrength > 0.01 ||
      shadowMap - GameSettings.options.ambientLightStrength < -0.01;
    const isOccluded = occlusionMap !== 1;
    const isClouded = cloudMap > cloudMinLevel;
    const isCloudClear = cloudMap < sunbeamMaxLevel;

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
        1 - timeManager.remainingPhasePercent
      );
    }

    // Start with ambient light
    let light = ambientLight;

    if (lightMap) {
      light = Color.add(light, lightMap);
    } else {
      if (isOccluded) {
        light = Color.interpolate(
          light,
          LightManager.lightDefaults.ambientOcc,
          (1 - occlusionMap) * ambOccShadowStrength
        );
      }
      if (isShadowed && isDaytime) {
        light = Color.interpolate(
          light,
          shadow,
          (1 - shadowMap) * shadowStrength
        );
      }
    }

    // Combine ambient light once instead of multiple multiplications
    light = Color.multiply(ambientLight, light);

    if (isClouded && isDaytime) {
      light = Color.interpolate(
        light,
        cloudShadow,
        1 - cloudStrength * (1 - (cloudMap - cloudMinLevel))
      );
    }

    if (isCloudClear) {
      light = Color.interpolate(
        light,
        isNight
          ? LightManager.lightDefaults.blueLight
          : LightManager.lightDefaults.yellowLight,
        cloudStrength * ((sunbeamMaxLevel - cloudMap) * sunbeamStrength)
      );
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
  //   const isDaytime = this.game.timeManager.isDayTime;
  //   const phase = this.game.timeManager.lightPhase;
  //   const isNight = this.game.timeManager.isNighttime;
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
  //   // console.log(this.game.timeManager.remainingCyclePercent);
  //   if (!isNight && isSettingPhase) {
  //     // console.log(this.game.timeManager.remainingCyclePercent);

  //     cloudShadow = Color.interpolate(
  //       cloudShadow,
  //       ambientLight,
  //       1 - this.game.timeManager.remainingPhasePercent
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
