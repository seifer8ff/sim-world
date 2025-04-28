import { BiomeId, Biomes } from "./biomes";
import { BrainAnimal } from "./brains/brain-animal";
import { BrainCow } from "./brains/brain-cow";
import { BrainFish } from "./brains/brain-fish";
import { Description } from "./components/description";
import { ActorBase, WithID, WithPosition } from "./actor";
import { Game } from "./game";
import { GameSettings } from "./game-settings";
import { generateId } from "./misc-utility";
import { Layer } from "./renderer";
import { SystemActors } from "./system-actors";
import { SystemShrubs } from "./system-shrubs";
import { MapWorld } from "./map-world";
import { UserInterface } from "./user-interface";
import { GeneratorNames } from "./generator-names";
import { SystemTrees } from "./system-trees";
import {
  cowAnimationMap,
  defaultAnimationMap,
  mushroomAnimationMap,
} from "./components/animation-map";
import { Point } from "./point";
import { SystemTime } from "./system-time";

// add the initial flora/fauna to the game world
export class GameSetup {
  private landBiomes: BiomeId[];
  private waterBiomes: BiomeId[];
  private airBiomes: BiomeId[];
  private actorManager: SystemActors;
  private map: MapWorld;
  private userInterface: UserInterface;
  private nameGen: GeneratorNames;

  constructor(private game: Game) {
    this.actorManager = this.game.actorManager;
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
    this.spawnInitialPlants();
    this.spawnInitialAnimals();
    SystemTime.setIsPaused(false);
    let skipTurns = SystemTime.dayLength;
    if (GameSettings.options.toggles.dayStart) {
      // also skip the first night if dayStart is enabled
      skipTurns += SystemTime.nightLength;
    }
    for (let i = 0; i < skipTurns; i++) {
      this.game.gameLoop();
    }
    this.game.gameState.worldSetupComplete = true;
  }

  private spawnInitialAnimals(): void {
    let actor: Partial<ActorBase> & WithPosition & WithID;
    const addToSchedule = true;
    for (let i = 0; i < GameSettings.options.spawn.inputs.cowCount; i++) {
      // COW
      // create an actor
      // add components representing cow
      actor = {
        id: generateId(),
        species: "cow",
        layer: Layer.ACTOR,
        position: this.map.getRandomTilePositions(this.landBiomes, 1, true)[0],
        animationMap: cowAnimationMap,
        animId: "cow",
        baseAnimSpeed: 0.3,
      };
      actor.name = this.nameGen.generate("animal");
      actor.range = 10;
      actor.path = [];
      actor.brain = new BrainCow(this.game, actor as any);
      actor.description = new Description(actor);
      this.actorManager.spawn(actor, addToSchedule);
    }
    for (let i = 0; i < GameSettings.options.spawn.inputs.sharkCount; i++) {
      // SHARK
      actor = {
        id: generateId(),
        species: "sharkblue",
        layer: Layer.ACTOR,
        position: this.map.getRandomTilePositions(this.waterBiomes, 1, true)[0],
        animationMap: defaultAnimationMap,
        animId: "sharkblue",
        baseAnimSpeed: 0.3,
      };
      actor.name = this.nameGen.generate("aquatic");
      actor.validBiomes = this.waterBiomes;
      actor.range = 15;
      actor.path = [];
      actor.brain = new BrainFish(this.game, actor as any);
      actor.description = new Description(actor);
      this.actorManager.spawn(actor, addToSchedule);
    }
    for (let i = 0; i < GameSettings.options.spawn.inputs.seagullCount; i++) {
      // SEAGULL
      actor = {
        id: generateId(),
        species: "seagull",
        layer: Layer.ACTOR,
        position: this.map.getRandomTilePositions(this.airBiomes, 1, false)[0],
        animationMap: defaultAnimationMap,
        animId: "seagull",
        baseAnimSpeed: 0.3,
      };
      actor.name = this.nameGen.generate("aquatic");
      actor.validBiomes = this.airBiomes;
      actor.range = 25;
      actor.path = [];
      actor.brain = new BrainAnimal(this.game, actor as any);
      actor.description = new Description(actor);
      this.actorManager.spawn(actor, addToSchedule);
    }
    for (let i = 0; i < GameSettings.options.spawn.inputs.mushroomCount; i++) {
      // MUSHROOM
      actor = {
        id: generateId(),
        species: "mushroom",
        layer: Layer.ACTOR,
        position: this.map.getRandomTilePositions(this.landBiomes, 1, true)[0],
        animationMap: mushroomAnimationMap,
        animId: "mushroom",
        baseAnimSpeed: 2.25,
      };
      actor.name = this.nameGen.generate("animal");
      actor.path = [];
      actor.range = 15;
      actor.brain = new BrainAnimal(this.game, actor as any);
      actor.description = new Description(actor);
      this.actorManager.spawn(actor, addToSchedule);
    }

    this.userInterface.components.updateSideBarContent(
      "Entities",
      SystemActors.queries.withBrain.entities
    );
  }

  private spawnInitialPlants(): void {
    let positions: Point[];
    positions = this.map.getRandomTilePositions(
      this.landBiomes,
      GameSettings.options.spawn.inputs.treeCount,
      true,
      true,
      50000
    );
    for (const pos of positions) {
      SystemTrees.spawnAt(pos, this.actorManager, this.map);
    }

    positions = this.map.getRandomTilePositions(
      SystemShrubs.validBiomes,
      GameSettings.options.spawn.inputs.shrubCount,
      true,
      true,
      50000
    );
    for (const pos of positions) {
      SystemShrubs.spawnAt(pos, this.actorManager, this.map);
    }
  }
}
