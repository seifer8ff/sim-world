import GameStats from "gamestats.js";
import * as PIXI from "pixi.js";
import { Game } from "./game";
import { TemperatureSettings } from "./system-temperature";

interface AllOptions {
  [key: string]: any;
  temperature: TemperatureSettings;
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
    minShadowLength: 1,
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
      shadowStrengthMultiplier: 0.35, // primary way to adjust shadow strength
      minShadowLength: 3,
      maxShadowLength: 8,
      minShadowStrength: 0.18,
      shadowLengthMultiplier: 2,
      nightShadowLengthFactor: 0.5,
      nightShadowStrengthFactor: 0.8,
      baseSlopeThreshold: 0.015,
      slopeThresholdRange: 0.05,
      slopeMaxThreshold: 0.06,
      raytracingResolution: 1,
    },
    occlusion: {
      dayStartStrength: 2,
      dayMidStrength: 1,
      dayEndStrength: 2,
      nightMidStrength: 4,
      maxOcclusionAmount: 0.17,
    },
    temperature: {
      modifiers: {
        baseTemperature: 0.05, // primary way to adjust temperature, used as base noise Value
        magnetismModifier: 0.35, // how much magnetism affects temperature, making the poles colder
        heightModifier: 0.3, // how much height affects temperature, making higher areas colder
        dayModifier: 0.08, // Maximum temperature increase at midday
        nightModifier: 0.04, // Maximum temperature decrease at night's end
        sunShadowModifier: 0.3, // How much shadows cool the temperature
        occlusionShadowModifier: 0.4, // How much valley occlusion cools the temperature
        cloudShadowModifier: 0.2, // How much clouds cool the temperature
        summerModifier: 0.15, // Significant warming
        springModifier: 0.05, // Mild warming
        fallModifier: -0.05, // Mild cooling
        winterModifier: -0.15, // Significant cooling
      },
      noiseGeneration: {
        baseScale: 0.4, // Base noise scale
        secondaryScale: 0.85, // Secondary noise scale
        tertiaryScale: 2, // third noise scale
        baseWeight: 0.3, // Weight of base noise
        secondaryWeight: 0.45, // Weight of secondary noise
        tertiaryWeight: 0.07, // Weight of third noise
      },
      updateSettings: {
        interval: 5, // Update temperature every 5 turns
        historyLength: 3, // Keep 3 historical values for averaging
      },
    },
    magnetism: {
      noiseScale: 1.2,
    },
    clouds: {
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

  public loadSettings(): void {
    if (GameSettings.options.toggles.enableStats) {
      this.initGameStatsMonitor();
    }
    this.game.resetGame();
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
    this.stats.enableExtension("pixi", [
      PIXI,
      this.game.userInterface.application,
      options,
    ]);
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
