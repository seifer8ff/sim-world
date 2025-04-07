import { RNG } from "rot-js";
import { BiomeId, Biomes } from "./biomes";
import { BrainAnimal } from "./brains/brain-animal";
import { BrainCow } from "./brains/brain-cow";
import { BrainFish } from "./brains/brain-fish";
import { Animator } from "./components/animator";
import { Description } from "./components/description";
import { ActorBase, WithID, WithPosition } from "./entities/actor";
import {
  TreeSpecies,
  TreeSpeciesEnum,
  TreeSpeciesID,
} from "./entities/tree/tree-species";
import { Game } from "./game";
import { GameSettings } from "./game-settings";
import { generateId } from "./misc-utility";
import { Layer } from "./renderer";
import { Tile } from "./tile";
import { ManagerActor } from "./manager-actors";
import { ManagerTrees } from "./manager-trees";
import { ManagerShrubs } from "./manager-shrubs";
import { MapWorld } from "./map-world";
import { UserInterface } from "./user-interface";
import { GeneratorNames } from "./generator-names";

// add the initial flora/fauna to the game world
export class GameSetup {
  private landBiomes: BiomeId[];
  private waterBiomes: BiomeId[];
  private airBiomes: BiomeId[];
  private actorManager: ManagerActor;
  private treeManager: ManagerTrees;
  private shrubManager: ManagerShrubs;
  private map: MapWorld;
  private userInterface: UserInterface;
  private nameGen: GeneratorNames;

  constructor(private game: Game) {
    this.actorManager = this.game.actorManager;
    this.treeManager = this.actorManager.treeManager;
    this.shrubManager = this.actorManager.shrubManager;
    this.map = this.game.map;
    this.userInterface = this.game.userInterface;
    this.nameGen = this.game.nameGenerator;
    this.landBiomes = [
      Biomes.Biomes.moistdirt.id,
      Biomes.Biomes.hillsmid.id,
      Biomes.Biomes.hillshigh.id,
      Biomes.Biomes.valley.id,
      Biomes.Biomes.snowhillshillsmid.id,
      Biomes.Biomes.snowmoistdirt.id,
    ];
    this.waterBiomes = [Biomes.Biomes.ocean.id, Biomes.Biomes.oceandeep.id];
    this.airBiomes = [...this.landBiomes, Biomes.Biomes.ocean.id];
  }

  init(): void {
    this.spawnInitialAnimals();
    this.spawnInitialPlants();
    this.game.timeManager.setIsPaused(false);
    for (let i = 0; i < 20; i++) {
      this.game.gameLoop();
    }
    this.game.gameState.worldSetupComplete = true;
  }

  private spawnInitialAnimals(): void {
    let actor: Partial<ActorBase> & WithPosition & WithID;
    for (let i = 0; i < GameSettings.options.spawn.inputs.cowCount; i++) {
      // COW
      // create an actor
      // add components representing cow
      actor = {
        id: generateId(),
        position: this.map.getRandomTilePositions(this.landBiomes, 1, true)[0],
        spritePath: Tile.cow.spritePath,
        animationPath: Tile.cow.animationPath,
        animationMap: Tile.cow.animationMap,
      };
      actor.name = this.nameGen.generate("animal");
      actor.range = 10;
      actor.path = [];
      actor.animator = new Animator(this.game, actor as any, 0.3);
      actor.brain = new BrainCow(this.game, actor as any);
      actor.description = new Description(actor);
      this.actorManager.spawnActor(actor, Layer.ACTOR);
    }
    for (let i = 0; i < GameSettings.options.spawn.inputs.sharkCount; i++) {
      // SHARK
      actor = {
        id: generateId(),
        position: this.map.getRandomTilePositions(this.waterBiomes, 1, true)[0],
        spritePath: Tile.sharkBlue.spritePath,
        animationPath: Tile.sharkBlue.animationPath,
        animationMap: Tile.sharkBlue.animationMap,
      };
      actor.name = this.nameGen.generate("aquatic");
      actor.validBiomes = this.waterBiomes;
      actor.range = 15;
      actor.path = [];
      actor.animator = new Animator(this.game, actor as any, 0.3);
      actor.brain = new BrainFish(this.game, actor as any);
      actor.description = new Description(actor);
      this.actorManager.spawnActor(actor, Layer.ACTOR);
    }
    for (let i = 0; i < GameSettings.options.spawn.inputs.seagullCount; i++) {
      // SEAGULL
      actor = {
        id: generateId(),
        position: this.map.getRandomTilePositions(this.airBiomes, 1, false)[0],
        spritePath: Tile.seagull.spritePath,
        animationPath: Tile.seagull.animationPath,
        animationMap: Tile.seagull.animationMap,
      };
      actor.name = this.nameGen.generate("aquatic");
      actor.validBiomes = this.airBiomes;
      actor.range = 25;
      actor.path = [];
      actor.animator = new Animator(this.game, actor as any, 0.3);
      actor.brain = new BrainAnimal(this.game, actor as any);
      actor.description = new Description(actor);
      this.actorManager.spawnActor(actor, Layer.ACTOR);
    }
    for (let i = 0; i < GameSettings.options.spawn.inputs.mushroomCount; i++) {
      // MUSHROOM
      actor = {
        id: generateId(),
        position: this.map.getRandomTilePositions(this.landBiomes, 1, true)[0],
        spritePath: Tile.mushroom.spritePath,
        animationPath: Tile.mushroom.animationPath,
        animationMap: Tile.mushroom.animationMap,
      };
      actor.name = this.nameGen.generate("animal");
      actor.path = [];
      actor.range = 15;
      actor.animator = new Animator(this.game, actor as any, 2.25);
      actor.brain = new BrainAnimal(this.game, actor as any);
      actor.description = new Description(actor);
      this.actorManager.spawnActor(actor, Layer.ACTOR);
    }

    this.userInterface.components.updateSideBarContent(
      "Entities",
      this.actorManager.withBrain.entities
    );
  }

  private spawnInitialPlants(): void {
    const quarter = Math.floor(GameSettings.options.spawn.inputs.treeCount / 4);
    for (let i = 0; i < GameSettings.options.spawn.inputs.treeCount; i++) {
      let type: TreeSpeciesID;
      type =
        RNG.getUniform() < 0.5 ? TreeSpeciesEnum.PINE : TreeSpeciesEnum.BIRCH;
      // type =
      //   i < quarter
      //     ? TreeSpeciesEnum.PINE
      //     : i < quarter * 2
      //     ? TreeSpeciesEnum.BIRCH
      //     : i < quarter * 3
      //     ? TreeSpeciesEnum.COTTONCANDY
      //     : TreeSpeciesEnum.MAPLE;
      // this.spawnTree(Tree, TreeSpecies.treeSpecies[type]);
      // this.spawnTree(TreeSpecies.treeSpecies[type]);
      this.treeManager.spawn(TreeSpecies.treeSpecies[type]);
    }
    for (let i = 0; i < GameSettings.options.spawn.inputs.shrubCount; i++) {
      this.shrubManager.spawn();
    }
  }
}
