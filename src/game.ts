import { RNG } from "rot-js/lib/index";
import { GameState, Stages } from "./game-state";
import { UserInterface } from "./user-interface";
import { Layer, Renderer } from "./renderer";
import { MapWorld } from "./map-world";
import { SystemTime } from "./system-time";
import { GeneratorNames } from "./generator-names";
import Simplex from "rot-js/lib/noise/simplex";
import Noise from "rot-js/lib/noise/noise";
import { ManagerAnimation } from "./manager-animation";
import MainLoop from "mainloop.js";
import { InitAssetsStage1, InitAssetsStage2 } from "./assets";
import { GameSettings } from "./game-settings";
import { SystemActors } from "./system-actors";
import { SystemTrees } from "./system-trees";
import { SystemCollision } from "./system-collision";
import { ActorBase } from "./actor";
import { SystemAnimated } from "./system-animated";
import { SystemStatic } from "./system-static";
import { SystemPathfinder } from "./system-pathfinder";
import { GameSetup } from "./game-setup";
import { SystemPointer } from "./system-pointer";
import { SystemShrubs } from "./system-shrubs";
import { SystemLLM } from "./system-llm";
import { SystemOcclusion } from "./system-occlusion";
import { SystemSunMoon } from "./system-sun-moon";
import { SystemShadows } from "./system-shadows";
import { SystemMoisture } from "./system-moisture";
import { SystemTemperature } from "./system-temperature";
import { SystemPoles } from "./system-poles";
import { SystemClouds } from "./system-clouds";
import { Camera } from "./camera";
import { Application, ICanvas } from "pixi.js";

export class Game {
  public application: Application<ICanvas>; // the main PIXI application
  public settings: GameSettings;
  public noise: Noise;
  public map: MapWorld;
  public gameState: GameState;
  public renderer: Renderer;
  public animManager: ManagerAnimation;
  public actorManager: SystemActors;
  public pathfinder: SystemPathfinder;
  public userInterface: UserInterface;
  public camera: Camera;
  public nameGenerator: GeneratorNames;
  private setup: GameSetup;
  private turnAnimDelayCounter: number = 0; // how long to delay the game loop for (like when animations are playing)

  constructor() {
    console.log("-- game constructor");
    this.settings = new GameSettings(this);
    if (GameSettings.options.gameSeed == undefined) {
      GameSettings.options.gameSeed = Math.floor(RNG.getUniform() * 1000000);
    }
    RNG.setSeed(GameSettings.options.gameSeed);
    console.log("Game seed:", GameSettings.options.gameSeed);
    this.noise = new Simplex();
    this.application = new Application({
      resizeTo: window,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: false,
    });
    this.application.stage.sortableChildren = true;

    this.gameState = new GameState();
    this.setup = new GameSetup(this);
    this.userInterface = new UserInterface(this);

    this.userInterface.gameCanvasContainer.appendChild(
      this.application.view as HTMLCanvasElement
    );
    globalThis.__PIXI_APP__ = this.application;
  }

  public async Init(): Promise<boolean> {
    this.pathfinder = new SystemPathfinder(this);
    this.animManager = new ManagerAnimation(this);
    this.map = new MapWorld(this);
    this.nameGenerator = new GeneratorNames(this);

    this.renderer = new Renderer(this);
    this.actorManager = new SystemActors(this);

    await InitAssetsStage1(); // generates assets that do not require rendering, like spritesheets
    await InitAssetsStage2(this.application); // generates assets that require rendering, like custom textures
    this.renderer.addLayersToStage(this.application.stage);
    this.camera = new Camera(this, this.userInterface);

    return true;
  }

  public start() {
    window.addEventListener("blur", () => {
      SystemTime.setIsPaused(true);
    });
    MainLoop.setBegin(this.startLoop.bind(this))
      .setUpdate(this.mainLoop.bind(this))
      .setDraw(this.renderLoop.bind(this))
      .setEnd(this.endLoop.bind(this))
      .start();
  }

  private async startLoop() {
    // console.log("start loop");
    if (GameSettings.options.toggles.enableStats) {
      this.settings.stats?.begin("main loop");
    }
  }

  private async endLoop() {
    // console.log("end loop");
    if (GameSettings.options.toggles.enableStats) {
      this.settings.stats?.end("main loop");
    }
  }

  private mainLoop(deltaTime: number) {
    if (this.gameState.stage === Stages.Play) {
      // generate the map and entities
      // skip the game loop
      // run the render loop until this.gameState.loading is false
      // to allow UI rendering
      if (this.gameState.loading && !this.gameState.worldSetupComplete) {
        this.setup.initialSetup();
        this.gameState.worldSetupComplete = true;
        return;
      }
      this.uiLoop(deltaTime);

      // handle counting down wait time after a turn (like for animation)
      if (this.turnAnimDelayCounter > 0 && !SystemTime.isPaused) {
        this.turnAnimDelayCounter -= deltaTime * SystemTime.timeScale;
      }
      if (this.turnAnimDelayCounter < 0) {
        this.turnAnimDelayCounter = 0;
      }

      if (!SystemTime.isPaused && this.turnAnimDelayCounter <= 0) {
        this.gameLoop();
        this.turnAnimDelayCounter = GameSettings.options.turnAnimDelay;
        SystemTime.resetTurnAnimTime();
      }
    }
  }

  public gameLoop() {
    const turn = SystemTime.currentTurn;
    const viewport = this.camera.viewportUnpadded;
    let actors: ActorBase[] = [];

    // console.log("game loop, viewport", viewport);

    // loop through ALL actors each turn
    while (turn === SystemTime.currentTurn) {
      actors.push(SystemTime.nextOnSchedule());
    }
    return Promise.all(
      actors.map((actor) => {
        if (actor && actor?.brain) {
          return actor?.brain.plan();
        }
      })
    ).then(async () => {
      actors.forEach((actor) => {
        if (actor?.brain?.action) {
          SystemTime.setDuration(actor?.brain.action.durationInTurns);
        }
      });

      await Promise.all(
        actors.map((actor) => {
          if (actor?.brain?.action) {
            return actor?.brain?.act();
          }
        })
      );

      if (this.gameState.loading) {
        return;
      }

      // actor-related updates
      SystemShrubs.updateSpacialMap(SystemActors.queries.groundCoverGrowth);
      SystemShrubs.updateGrowth(
        SystemActors.queries.groundCoverGrowth,
        this.actorManager,
        this.map
      );
      SystemShrubs.handleDeath(
        SystemActors.queries.groundCoverGrowth,
        this.actorManager
      );

      this.map.lightManager.turnUpdate();
      SystemSunMoon.turnUpdate();
      SystemTemperature.turnUpdate();
      SystemOcclusion.turnUpdate();
      SystemShadows.turnUpdate();
      SystemClouds.turnUpdate(this.map);

      // update dynamic lights after all actors have moved
      // will get picked up in next render
      this.map.lightManager.clearChangedDynamicLights();
      this.map.lightManager.updateDynamicLighting();
      this.map.lightManager.recalculateDynamicLighting();

      SystemAnimated.setAnimationSpeed(
        SystemActors.queries.withAnimator,
        SystemTime.timeScale
      );
    });
  }

  private renderLoop(interpPercent: number) {
    if (GameSettings.options.toggles.enableStats) {
      this.settings.stats?.begin();
    }

    this.camera.renderUpdate(interpPercent);

    const viewport = this.camera.viewportUnpadded;
    const lightManager = this.map.lightManager;

    if (this.gameState.stage === Stages.Play) {
      SystemTime.renderUpdate(this.turnAnimDelayCounter);

      if (GameSettings.options.toggles.enableClouds) {
        SystemClouds.renderUpdate(interpPercent, viewport.tiles);
      }

      if (GameSettings.options.toggles.enableGlobalLights) {
        this.map.lightManager.renderUpdate(interpPercent, viewport.tiles);
      }

      if (GameSettings.options.toggles.enableAnimations) {
        this.animManager.animUpdate(); // no deltaTime needed as this uses the gameDelay timing for animation
      }
    }

    SystemPointer.updatePointerPosition(SystemActors.queries.withPointer);
    SystemPointer.renderPointer(
      SystemActors.queries.withPointer,
      this.renderer,
      viewport
    );
    this.userInterface.renderUpdate();

    if (this.gameState.stage === Stages.Play) {
      this.renderer.clearSceneLayers([
        Layer.TERRAIN,
        Layer.GROUNDCOVER,
        Layer.SMALLACTOR,
        Layer.ACTOR,
      ]);
      SystemStatic.renderTerrainTiles(
        viewport.tiles,
        this.renderer,
        lightManager,
        this.map
      );
      SystemStatic.renderUI(
        SystemActors.queries.withUI,
        this.renderer,
        viewport
      );
      // at lower zoom levels, skip rendering the dense layers to improve performance
      if (
        viewport.tiles.length < GameSettings.options.hideDenseLayersTileCount
      ) {
        SystemStatic.renderGroundCover(
          SystemActors.queries.groundCover,
          this.renderer,
          lightManager,
          viewport
        );

        SystemTrees.renderTrees(
          SystemActors.queries.allTrees,
          this.renderer,
          lightManager,
          viewport
        );

        SystemAnimated.renderAnimated(
          SystemActors.queries.withAnimator,
          this.renderer,
          this.map.lightManager,
          viewport
        );
      }
    }

    if (GameSettings.options.toggles.enableStats) {
      this.settings.stats?.end();
    }
  }

  private async uiLoop(deltaTime: number) {
    this.camera.uiUpdate(deltaTime);
    // loop through all ui components and run a refresh on them
    this.userInterface.components.refreshComponents();
  }
}
