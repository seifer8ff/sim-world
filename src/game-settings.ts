import GameStats from "gamestats.js";
import * as PIXI from "pixi.js";
import { Game } from "./game";
import { TemperatureSettings } from "./system-temperature";
import { MoistureSettings } from "./system-moisture";
import { PolesSettings } from "./system-poles";
import { ShadowsSettings } from "./system-shadows";
import { OcclusionSettings } from "./system-occlusion";

interface AllOptions {
  [key: string]: any;
  temperature: TemperatureSettings;
  moisture: MoistureSettings;
  poles: PolesSettings;
  shadows: ShadowsSettings;
  occlusion: OcclusionSettings;
}

export class GameSettings {
  static options: AllOptions = {
    toggles: {
      enableAutotile: true,
      enableRendering: true,
      enableGlobalLights: true,
      enableDynamicLights: true,
      enableClouds: true,
      enableCloudMask: false,
      enableSunShadows: true,
      enableOcclusionShadows: true,
      enableAnimations: true,
      enableStats: true,
      enableLLM: false,
      dayStart: true,
      debugViewport: false,
      fasterTime: true,
    },
    // general terrain generation settings that should be accessible to the user
    // for now, default values. Later, need to add min and max for sliders
    generation: {
      heightMaskStrength: 0.69, // how much to mask the heightmap, between 0 and 1. 0 = no masking, 1 = full masking
      heightMaskStartDistance: 0.75, // where to start masking, between 0 and 1. 0 = center of map, 1 = edge of map
      landAmountModifier: 1.14, // how much land to generate, 1 is default, 0 is all water
    },
    spawn: {
      inputs: {
        treeCount: 700,
        shrubCount: 900,
        mushroomCount: 10,
        cowCount: 20,
        seagullCount: 13,
        sharkCount: 8,
      },
    },
    gameSize: {
      width: 200,
      height: 200,
    },
    // gameSeed: 1234,
    // gameSeed: 610239,
    gameSeed: 594628,
    // gameSeed: null,
    turnAnimDelay: 500, // two turns per second (1 second / 500ms anim phase = 2)
    mainLoopRate: 1000 / 60, // run main loop at 60 fps (all other loops are lower than this)
    refreshRate: 1000 / 60, // 60 fps
    gameLoopRate: 1000 / 10, // how many times to run the game loop (still limited by turnAnimDelay)
    uiLoopRate: 1000 / 10,
    maxTickRate: 1000 / 60, // 60 game updates per second max
    minTickRate: 1000 / 4, // 2 game updates per second min
    animationSpeed: 0.55, // speed at which pixijs animates AnimatedSprites
    renderChunkCount: 1, // how many chunks to split the world into for rendering MUST BE ODD, ex: 3 = 3x3 = 9 chunks
    hideDenseLayersTileCount: 150 * 150, // hide dense layers (like groundcover) if the tile count exceeds this value
    ambientLightStrength: 0.8,
    viewportPadding: 15, // how many tiles to pad the viewport on each side
    temperatureRange: {
      min: -40,
      max: 140,
    },
    moistureRange: {
      min: 0,
      max: 100,
    },
    heightRange: {
      min: 0,
      max: 100,
    },
    magnetismRange: {
      min: 0,
      max: 100,
    },
    sunlightRange: {
      min: 0,
      max: 100,
    },
    shadows: {
      shadowStrengthMultiplier: 1.2, // primary way to adjust shadow strength
      minShadowLength: 1, // length of 0 means they disappear at noon
      maxShadowLength: 13,
      minShadowStrength: 0.3, // minimum strength of shadows, 0 means no shadows
      shadowLengthMultiplier: 1.4, // shifts shadow length closer to min or max
      nightShadowLengthFactor: 0.8,
      nightShadowStrengthFactor: 0.6,
      baseSlopeThreshold: 0.9,
      slopeThresholdRange: 0.05,
      slopeMaxThreshold: 0.06,
      raytracingResolution: 1,
    },
    occlusion: {
      dayStartStrength: 1.2,
      dayMidStrength: 0.8,
      dayEndStrength: 1.4,
      nightMidStrength: 1.3,
      maxOcclusionAmount: 0.35,
    },
    temperature: {
      generationModifiers: {
        baseTemperature: 0.22, // primary way to adjust temperature, used as base noise Value
        magnetismModifier: 0.8, // how much magnetism affects temperature, making the poles colder
        heightModifier: 0.16, // how much height affects temperature, making higher areas colder
        dayModifier: 0.08, // Maximum temperature increase at midday
        nightModifier: 0.04, // Maximum temperature decrease at night's end
        sunShadowModifier: 0.1, // How much shadows cool the temperature
        occlusionShadowModifier: 0.1, // How much valley occlusion cools the temperature
        cloudShadowModifier: 0.03, // How much clouds cool the temperature
        summerModifier: 0.15, // Significant warming
        springModifier: 0.05, // Mild warming
        fallModifier: -0.05, // Mild cooling
        winterModifier: -0.15, // Significant cooling
      },
      generationSettings: {
        baseScale: 0.4, // Base noise scale
        secondaryScale: 0.85, // Secondary noise scale
        tertiaryScale: 2, // third noise scale
        baseWeight: 0.3, // Weight of base noise
        secondaryWeight: 0.45, // Weight of secondary noise
        tertiaryWeight: 0.07, // Weight of third noise
      },
      updateSettings: {
        interval: 4, // Update temperature every 5 turns
        historyLength: 3, // Keep 3 historical values for averaging
      },
    },
    moisture: {
      modifiers: {
        baseMoisture: 0, // Base moisture level to start from
        multiplier: 1, // multiplies the final noise value before normlizing it
        nearWaterMultiplier: 1.1, // Multiplier for moisture when near water
      },
      noiseGeneration: {
        baseScale: 0.018,
        baseWeight: 0.0, // how much to apply the base noise value
      },
      updateSettings: {
        interval: 5, // Update moisture every 5 turns
        historyLength: 3, // Keep 3 historical values for averaging
      },
    },
    poles: {
      generationSettings: {
        baseScale: 2,
        baseWeight: 1,
      },
      generationModifiers: {
        baseMagnetism: 0, // Base magnetism level to start from
        contrastModifier: 0.45, // Multiplier to increase contrast of the noise value
        northPoleXModifier: 1, // Multiplier for the X position of the north pole
        northPoleYModifier: 1, // Multiplier for the Y position of the north pole
        SouthPoleXModifier: 1, // Multiplier for the X position of the south pole
        southPoleYModifier: 0.2, // Multiplier for the Y position of the south pole
        poleXRadiusModifier: 1.1, // Multiplier for the X radius of both poles
        poleYRadiusModifier: 1.2, // Multiplier for the Y radius of both poles
      },
    },
    clouds: {
      // add simple controls for cloudiness...
      // how to increase and decrease day by day/hour by hour
      // maybe this exists already
      // need to make some days cloudy, some sunny, etc
      // maybe need a full on system-weather that controls multiple systems...
      // OR at this point, maybe we can go back to plant growth
      // plants need temperature, moisture, light, those are all in, right?
      // temp: -40 to 140, changes over time per day (not seasonal yet)
      // moisture: does not change at all, not sure of min/max. Needs changes
      // light: 0 to 100, changes over time per day (not seasonal yet)

      //
      //
      //
      //
      //
      //
      //
      windSpeed: {
        x: 0.5,
        y: -0.2,
      },
      baseWindSpeed: 0.5 / 100,
      windSpeedMax: 0.7,
      windSpeedMin: -0.7,
      windSpeedChangeChance: 0.01,
      windSpeedChangeAmount: 0.05,
      windSpeedChangeDirection: 0.16,
      windSpeedChangeDirectionChance: 0.1,
      cloudMinLevel: 0.6,
      sunbeamMaxLevel: 0.05,
      generation: {
        noiseOffset: 155,
        detailNoiseOffset1: 10,
        detailNoiseOffset2: 15,
        detailIntensityOffset1: 0.12,
        detailIntensityOffset2: -0.08,
      },
      biomeClouds: {
        oceandeep: {
          size: 2,
          intensity: 0.44,
        },
        ocean: {
          size: 4.5,
          intensity: 0.42,
        },
        hillshigh: {
          size: 19,
          intensity: 0.37,
        },
        hillsmid: {
          size: 19,
          intensity: 0.37,
        },
        hillslow: {
          size: 15,
          intensity: 0.33,
        },
        swamp: {
          size: 12,
          intensity: 0.34,
        },
        default: {
          size: 12,
          intensity: 0.33,
        },
      },
    },
  };
  static worldSizeOptions = [
    {
      value: {
        width: 1000,
        height: 1000,
      },
      label: "1000x1000",
    },
    {
      value: {
        width: 500,
        height: 500,
      },
      label: "500x500",
    },
    {
      value: {
        width: 300,
        height: 300,
      },
      label: "300x300",
    },
    {
      value: {
        width: 200,
        height: 200,
      },
      label: "200x200",
    },
    {
      value: {
        width: 100,
        height: 100,
      },
      label: "100x100",
    },
    {
      value: {
        width: 50,
        height: 50,
      },
      label: "50x50",
    },
  ];

  public stats: GameStats;

  constructor(private game: Game) {}

  public loadSettings(data: Record<string, string>): void {
    for (let toggle in GameSettings.options.toggles) {
      GameSettings.options.toggles[toggle] = data[toggle] === "true";
    }
    for (let input in GameSettings.options.spawn.inputs) {
      GameSettings.options.spawn.inputs[input] = parseInt(data[input], 10);
    }

    console.log("Load Game Settings", data, GameSettings.options);

    if (GameSettings.options.toggles.enableStats) {
      this.initGameStatsMonitor();
    }
  }

  public initGameStatsMonitor(): void {
    this.stats = new GameStats();
    this.stats.dom.style.top = "40vh";
    this.stats.dom.style.left = "unset";
    this.stats.dom.style.right = "15px";
    this.stats.dom.style.zIndex = "5000";

    document.body.appendChild(this.stats.dom);

    // OR addtionally with options
    const options = {
      targetFPS: 60,
      // maxMemorySize: 350, // GPU VRAM limit ( the max of the texture memory graph )
      COLOR_MEM_TEXTURE: "#8ddcff", // the display color of the texture memory size in the graph
      COLOR_MEM_BUFFER: "#ffd34d", // the display color of buffer memory size in the graph
    };
    this.stats.enableExtension("pixi", [PIXI, this.game.application, options]);
  }

  public static shouldTint(): boolean {
    return (
      GameSettings.options.toggles.enableGlobalLights ||
      GameSettings.options.toggles.enableDynamicLights ||
      GameSettings.options.toggles.enableSunShadows ||
      GameSettings.options.toggles.enableOcclusionShadows ||
      GameSettings.options.toggles.enableClouds
    );
  }
}
