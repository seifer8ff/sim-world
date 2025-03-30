import GameStats from "gamestats.js";
import * as PIXI from "pixi.js";
import { Game } from "./game";

export class GameSettings {
  static options = {
    toggles: {
      enableAutotile: true,
      enableRendering: true,
      enableGlobalLights: true,
      enableDynamicLights: true,
      enableClouds: true,
      enableCloudMask: false,
      enableShadows: true,
      enableAnimations: true,
      enableStats: true,
      dayStart: true,
    },
    spawn: {
      inputs: {
        treeCount: 70,
        shrubCount: 350,
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
      GameSettings.options.toggles.enableShadows ||
      GameSettings.options.toggles.enableClouds
    );
  }
}
