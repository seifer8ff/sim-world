import { RNG } from "rot-js/lib/index";
import { Player } from "./entities/player";
import { GameState, Stages } from "./game-state";
import { Tile } from "./tile";
import { UserInterface } from "./user-interface";
import { Layer, Renderer } from "./renderer";
import { MapWorld } from "./map-world";
import { TimeManager } from "./time-manager";
import { GeneratorNames } from "./generator-names";
import { TileStats } from "./web-components/tile-info";
import Simplex from "rot-js/lib/noise/simplex";
import Noise from "rot-js/lib/noise/noise";
import { ManagerAnimation } from "./manager-animation";
import { ParticleContainer, Sprite, Ticker } from "pixi.js";
import * as MainLoop from "mainloop.js";

import { InitAssets } from "./assets";
import { GameSettings } from "./game-settings";
import { ManagerActor } from "./manager-actors";
import { positionToIndex } from "./misc-utility";
import { Biomes } from "./biomes";
import { TreeSpecies } from "./entities/tree/tree-species";
import { SystemTreeRenderer } from "./system-tree-renderer";
import { ManagerCollision } from "./manager-collision";
import { ActorBase } from "./entities/actor";
import { SystemAnimated } from "./system-animated";
import { SystemPathfinder } from "./system-pathfinder";

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
    this.userInterface = new UserInterface(this);
    this.gameState = new GameState();
    this.map = new MapWorld(this);
    this.nameGenerator = new GeneratorNames(this);
    this.renderer = new Renderer(this);
    this.actorManager = new ManagerActor(this);
    this.collisionManager = new ManagerCollision(this);
    this.pathfinder = new SystemPathfinder(this);
  }

  public async Init(): Promise<boolean> {
    await InitAssets();
    this.gameState.reset();
    await this.userInterface.init();

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

  getTerrainTileAt(x: number, y: number): Tile {
    return this.map.getTile(x, y);
  }

  getTileInfoAt(x: number, y: number): TileStats {
    const index = positionToIndex(x, y, Layer.TERRAIN);
    return {
      height: this.map.heightMap.get(index),
      magnetism: this.map.polesMap.magnetismMap.get(index),
      temperaturePercent: this.map.tempMap.getTempByIndex(index),
      moisture: this.map.moistureMap.getMoistureByIndex(index),
      sunlight: this.map.getTotalLight(x, y),
      biome: Biomes.Biomes[this.map.biomeMap.get(index)],
    };
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

  private worldSetup(): void {
    // any initialization that requires the real game loop:
    //    things like actors moving, tinting of tiles, etc
    this.actorManager.addInitialActors();
    for (let i = 0; i < 2; i++) {
      this.gameLoop();
    }
    this.gameState.worldSetupComplete = true;
  }

  private mainLoop(deltaTime: number) {
    if (this.gameState.stage === Stages.Play) {
      if (!this.gameState.worldSetupComplete) {
        // let a few turns pass, do any world setup needed
        this.worldSetup();
        return;
      }

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

    this.uiLoop(deltaTime);
  }

  private gameLoop() {
    // console.log(
    //   "----- game loop, turn: " + this.timeManager.currentTurn + " -------"
    // );
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

      // return Promise.all(
      //   actors.map((actor) => {
      //     if (actor && actor?.plan) {
      //       return actor?.plan();
      //     }
      //   })
      // ).then(async () => {
      //   actors.forEach((actor) => {
      //     if (actor?.action) {
      //       // console.log(`actor ${actor.name} is ${actor.action.name}`);
      //       this.timeManager.setDuration(actor.action.durationInTurns);
      //     }
      //   });

      //   await Promise.all(
      //     actors.map((actor) => {
      //       if (actor?.action) {
      //         return actor?.act();
      //       }
      //     })
      //   );

      // grow some of the shrubs
      let maxGrowth = 55;
      for (const shrub of this.actorManager.allShrubs) {
        if (maxGrowth <= 0) {
          break;
        }
        if (this.actorManager.shrubManager.growShrub(shrub)) {
          maxGrowth--;
        }
      }

      // grow all of the trees
      for (const tree of this.actorManager.allTrees) {
        this.actorManager.treeManager.growTree(tree);
      }

      // clear cache for dynamic layers:
      // - terrain layer's cache is handled at lower level by marking tiles as dirty
      // - entity layer's cache is handled at lower level to allow lerp animations
      this.renderer.clearCache(Layer.PLANT);
      // this.renderer.clearCache(Layer.TREE);
      // this.renderer.clearCache(Layer.UI);

      this.map.lightManager.turnUpdate();
      this.map.shadowMap.turnUpdate();
      this.map.cloudMap.turnUpdate();

      // update dynamic lights after all actors have moved
      // will get picked up in next render
      this.map.lightManager.clearChangedDynamicLights();
      this.map.lightManager.updateDynamicLighting();
      this.map.lightManager.recalculateDynamicLighting();

      // update cache for entities and plants
      SystemAnimated.setAnimatorSpeed(
        this.actorManager.withAnimator,
        this.timeManager.timeScale
      );
      SystemAnimated.drawAnimated(
        this.actorManager.withAnimator,
        this.renderer
      );
      this.drawShrubs();
      this.drawTrees();
      //
      // important that this comes last
      // run a tint pass on all actors (entities, trees, etc)
      this.map.lightManager.tintActors(this.actorManager.withAnimator, true);
    });
  }

  private drawTrees(): void {
    const viewport = this.userInterface.camera.viewportPadded;
    const halfWidth = viewport.width / 2;
    const halfHeight = viewport.height / 2;

    const viewportLeft = viewport.center.x - halfWidth;
    const viewportRight = viewport.center.x + halfWidth;
    const viewportTop = viewport.center.y - halfHeight;
    const viewportBottom = viewport.center.y + halfHeight;

    this.renderer.clearSceneLayer(Layer.TREE);

    for (const tree of this.actorManager.allTrees) {
      let { x, y } = tree.position;
      x = Tile.translate(x, Layer.TREE, Layer.TERRAIN);
      y = Tile.translate(y, Layer.TREE, Layer.TERRAIN);

      // for now, grow all trees
      // later, implement turn-based growth
      // this.actorManager.treeManager.growTree(tree);
      // Check if the tree is within the viewport boundaries
      if (
        x >= viewportLeft &&
        x <= viewportRight &&
        y >= viewportTop &&
        y <= viewportBottom
      ) {
        this.actorManager.treeManager.drawTree(tree);
      }
    }
  }

  private drawShrubs(): void {
    const viewport = this.userInterface.camera.viewportPadded;
    const halfWidth = viewport.width / 2;
    const halfHeight = viewport.height / 2;

    const viewportLeft = viewport.center.x - halfWidth;
    const viewportRight = viewport.center.x + halfWidth;
    const viewportTop = viewport.center.y - halfHeight;
    const viewportBottom = viewport.center.y + halfHeight;

    // this.renderer.clearSceneLayer(Layer.PLANT);

    for (const shrub of this.actorManager.allShrubs) {
      // console.log("shrub", shrub);
      let { x, y } = shrub.position;
      x = Tile.translate(x, Layer.PLANT, Layer.TERRAIN);
      y = Tile.translate(y, Layer.PLANT, Layer.TERRAIN);

      // Check if the shrub is within the viewport boundaries
      if (
        x >= viewportLeft &&
        x <= viewportRight &&
        y >= viewportTop &&
        y <= viewportBottom
      ) {
        this.actorManager.shrubManager.drawShrub(shrub);
      }
    }
  }

  private renderLoop(interpPercent: number) {
    if (GameSettings.options.toggles.enableStats) {
      this.settings.stats?.begin();
    }
    this.renderer.clearCache(Layer.UI); // clear UI cache during render since it updates outside of game loop

    this.map.draw();

    this.userInterface.camera.renderUpdate(interpPercent);

    if (this.gameState.stage === Stages.Play) {
      this.timeManager.renderUpdate(this.turnAnimDelayCounter);

      if (GameSettings.options.toggles.enableShadows) {
        this.map.shadowMap.renderUpdate(interpPercent);
      }

      if (GameSettings.options.toggles.enableClouds) {
        this.map.cloudMap.renderUpdate(interpPercent);
      }

      if (GameSettings.options.toggles.enableGlobalLights) {
        this.map.lightManager.renderUpdate(interpPercent);
      }

      if (GameSettings.options.toggles.enableAnimations) {
        this.animManager.animUpdate(); // no deltaTime needed as this uses the gameDelay timing for animation
      }
    }

    this.userInterface.renderUpdate();
    this.userInterface.components.renderUpdate();

    if (this.gameState.stage === Stages.Play) {
      let viewportInTiles = this.userInterface.camera.viewportPadded;
      this.renderer.renderChunkedLayers(
        [Layer.TERRAIN],
        viewportInTiles.width,
        viewportInTiles.height,
        viewportInTiles.center
      );
      viewportInTiles = this.userInterface.camera.viewportUnpadded;
      this.renderer.renderChunkedLayers(
        [Layer.UI, Layer.PLANT, Layer.ENTITY, Layer.UI],
        viewportInTiles.width,
        viewportInTiles.height,
        viewportInTiles.center
      );

      // this.renderer.renderLayers(
      //   [Layer.TERRAIN, Layer.ENTITY, Layer.UI],
      //   viewportInTiles.width,
      //   viewportInTiles.height,
      //   viewportInTiles.center.x,
      //   viewportInTiles.center.y,
      //   0
      // );
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
