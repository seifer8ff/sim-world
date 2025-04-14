import { RNG } from "rot-js/lib/index";
import { GameState, Stages } from "./game-state";
import { UserInterface } from "./user-interface";
import { Layer, Renderer } from "./renderer";
import { MapWorld } from "./map-world";
import { TimeManager } from "./time-manager";
import { GeneratorNames } from "./generator-names";
import Simplex from "rot-js/lib/noise/simplex";
import Noise from "rot-js/lib/noise/noise";
import { ManagerAnimation } from "./manager-animation";
import MainLoop from "mainloop.js";
import { InitAssetsStage1, InitAssetsStage2 } from "./assets";
import { GameSettings } from "./game-settings";
import { ManagerActor } from "./manager-actors";
import { SystemTrees } from "./system-trees";
import { ManagerCollision } from "./manager-collision";
import { ActorBase } from "./actor";
import { SystemAnimated } from "./system-animated";
import { SystemStatic } from "./system-static";
import { SystemPathfinder } from "./system-pathfinder";
import { GameSetup } from "./game-setup";
import { SystemPointer } from "./system-pointer";

export class Game {
  public settings: GameSettings;
  public noise: Noise;
  public map: MapWorld;
  public gameState: GameState;
  public renderer: Renderer;
  public animManager: ManagerAnimation;
  public actorManager: ManagerActor;
  public collisionManager: ManagerCollision;
  public pathfinder: SystemPathfinder;
  public timeManager: TimeManager;
  public userInterface: UserInterface;
  public nameGenerator: GeneratorNames;
  private turnAnimDelayCounter: number = 0; // how long to delay the game loop for (like when animations are playing)

  constructor() {
    this.settings = new GameSettings(this);
    if (GameSettings.options.gameSeed == undefined) {
      GameSettings.options.gameSeed = Math.floor(RNG.getUniform() * 1000000);
    }
    RNG.setSeed(GameSettings.options.gameSeed);
    console.log("Game seed:", GameSettings.options.gameSeed);
    this.noise = new Simplex();

    this.timeManager = new TimeManager(this);
    this.animManager = new ManagerAnimation(this);
    this.gameState = new GameState();
    this.map = new MapWorld(this);
    this.nameGenerator = new GeneratorNames(this);
    this.userInterface = new UserInterface(this);
    this.renderer = new Renderer(this);
    this.actorManager = new ManagerActor(this);
  }

  public async Init(): Promise<boolean> {
    await InitAssetsStage1();
    this.gameState.reset();
    await this.userInterface.init();
    await InitAssetsStage2(this.userInterface.application);

    return true;
  }

  public start() {
    window.addEventListener("blur", () => {
      this.timeManager.setIsPaused(true);
    });
    MainLoop.setBegin(this.startLoop.bind(this))
      .setUpdate(this.mainLoop.bind(this))
      .setDraw(this.renderLoop.bind(this))
      .setEnd(this.endLoop.bind(this))
      .start();
  }

  public resetGame(): void {
    this.map.cloudMap.init();
    this.map.polesMap.init();
    this.map.tempMap.init();
    this.map.moistureMap.init();
    this.map.shadowMap.init();
    this.map.lightManager.init();
    this.renderer.init();
    this.gameState.reset();
  }

  public async generateWorld(): Promise<boolean> {
    this.gameState.loading = true;
    this.map.generateMap(
      GameSettings.options.gameSize.width,
      GameSettings.options.gameSize.height
    );
    this.collisionManager = new ManagerCollision(this);
    this.pathfinder = new SystemPathfinder(this);
    // let a few turns pass, do any world setup needed
    const gameSetup = new GameSetup(this);
    gameSetup.init();
    return true;
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
      if (!this.gameState.worldSetupComplete) {
        this.generateWorld();
        return;
      }
      this.uiLoop(deltaTime);

      // handle counting down wait time after a turn (like for animation)
      if (this.turnAnimDelayCounter > 0 && !this.timeManager.isPaused) {
        this.turnAnimDelayCounter -= deltaTime * this.timeManager.timeScale;
      }
      if (this.turnAnimDelayCounter < 0) {
        this.turnAnimDelayCounter = 0;
      }

      if (!this.timeManager.isPaused && this.turnAnimDelayCounter <= 0) {
        this.gameLoop();
        this.turnAnimDelayCounter = GameSettings.options.turnAnimDelay;
        this.timeManager.resetTurnAnimTime();
      }
    }
  }

  public gameLoop() {
    const turn = this.timeManager.currentTurn;
    let actors: ActorBase[] = [];

    // loop through ALL actors each turn
    while (turn === this.timeManager.currentTurn) {
      actors.push(this.timeManager.nextOnSchedule());
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
          // console.log(`actor ${actor.name} is ${actor.action.name}`);
          this.timeManager.setDuration(actor?.brain.action.durationInTurns);
        }
      });

      await Promise.all(
        actors.map((actor) => {
          if (actor?.brain?.action) {
            return actor?.brain?.act();
          }
        })
      );

      // grow some of the shrubs
      let maxGrowth = 55;
      for (const shrub of this.actorManager.groundCoverGrowth) {
        if (maxGrowth <= 0) {
          break;
        }
        if (Math.random() < 0.7) {
          //  chance to skip
          continue;
        }
        if (this.actorManager.shrubManager.growShrub(shrub)) {
          maxGrowth--;
        }
      }

      this.map.lightManager.turnUpdate();
      this.map.shadowMap.turnUpdate();
      this.map.cloudMap.turnUpdate();

      // update dynamic lights after all actors have moved
      // will get picked up in next render
      this.map.lightManager.clearChangedDynamicLights();
      this.map.lightManager.updateDynamicLighting();
      this.map.lightManager.recalculateDynamicLighting();

      const viewportUnpadded = this.userInterface.camera.viewportUnpadded;

      // update cache for entities and plants
      SystemAnimated.setAnimationSpeed(
        this.actorManager.withAnimator,
        this.timeManager.timeScale
      );
    });
  }

  private renderLoop(interpPercent: number) {
    if (GameSettings.options.toggles.enableStats) {
      this.settings.stats?.begin();
    }

    this.userInterface.camera.renderUpdate(interpPercent);

    const viewport = this.userInterface.camera.viewportUnpadded;
    const lightManager = this.map.lightManager;

    if (this.gameState.stage === Stages.Play) {
      this.timeManager.renderUpdate(this.turnAnimDelayCounter);

      if (GameSettings.options.toggles.enableShadows) {
        this.map.shadowMap.renderUpdate(interpPercent);
      }

      if (GameSettings.options.toggles.enableClouds) {
        this.map.cloudMap.renderUpdate(interpPercent);
      }

      if (GameSettings.options.toggles.enableGlobalLights) {
        this.map.lightManager.renderUpdate(interpPercent, viewport.tiles);
      }

      if (GameSettings.options.toggles.enableAnimations) {
        this.animManager.animUpdate(); // no deltaTime needed as this uses the gameDelay timing for animation
      }
    }

    SystemPointer.updatePointerPosition(this.actorManager.withPointer);
    SystemPointer.renderPointer(
      this.actorManager.withPointer,
      this.renderer,
      viewport
    );
    this.userInterface.renderUpdate();
    this.userInterface.components.renderUpdate();

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
      SystemStatic.renderUI(this.actorManager.withUI, this.renderer, viewport);
      // at lower zoom levels, skip rendering the dense layers to improve performance
      if (
        viewport.tiles.length < GameSettings.options.hideDenseLayersTileCount
      ) {
        SystemStatic.renderGroundCover(
          this.actorManager.groundCover,
          this.renderer,
          lightManager,
          viewport
        );

        SystemTrees.renderTrees(
          this.actorManager.allTrees,
          this.renderer,
          lightManager,
          viewport
        );

        SystemAnimated.renderAnimated(
          this.actorManager.withAnimator,
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
    this.userInterface.camera.uiUpdate(deltaTime);
    // loop through all ui components and run a refresh on them
    this.userInterface.components.refreshComponents();
  }
}
