import { RNG } from "rot-js/lib/index";
import { Game } from "./game";
import { Layer } from "./renderer";
import { generateId } from "./misc-utility";
import { Point } from "./point";
import { GameSettings } from "./game-settings";
import { BiomeId, Biomes } from "./biomes";
import { BrainFish } from "./brains/brain-fish";
import { BrainAnimal } from "./brains/brain-animal";
import { BrainMushroom } from "./brains/brain-mushroom";
import { BrainBird } from "./brains/brain-bird";
import { Tile, TileSubType, TileType } from "./tile";
import {
  TreeSpecies,
  TreeSpeciesEnum,
  TreeSpeciesID,
} from "./entities/tree/tree-species";
import { Query, World } from "miniplex";
import {
  ComponentType,
  ActorBase,
  WithPosition,
  WithID,
  WithAnimator,
} from "./entities/actor";
import { ManagerTrees } from "./manager-trees";
import { ManagerShrubs } from "./manager-shrubs";
import { Animator } from "./components/animator";
import { Description } from "./components/description";

export class ManagerActor {
  private landBiomes: BiomeId[];
  private waterBiomes: BiomeId[];
  private airBiomes: BiomeId[];
  private world: World<ActorBase>;
  public treeManager: ManagerTrees;
  public shrubManager: ManagerShrubs;

  // queries
  public allPositioned: Query<ActorBase>;
  public allPlants: Query<ActorBase>;
  public allShrubs: Query<ActorBase>;
  public allTrees: Query<ActorBase>;
  public withPosition: Query<ActorBase & WithPosition>;
  public withCollider: Query<ActorBase>;
  public withAnimator: Query<ActorBase & WithID & WithPosition & WithAnimator>;
  public withBrain: Query<ActorBase>;

  constructor(private game: Game) {
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
    this.world = new World<ActorBase>();
    this.withPosition = this.world.with(ComponentType.position);
    this.allPositioned = this.world.with(ComponentType.position);
    this.allPlants = this.world
      .with(ComponentType.type)
      .where(({ type }) => type === TileType.Plant);
    this.allShrubs = this.world
      .with(ComponentType.subType)
      .where(({ subType }) => subType === TileSubType.Shrub);
    this.allTrees = this.world
      .with(ComponentType.subType)
      .where(({ subType }) => subType === TileSubType.Tree);
    this.withCollider = this.world
      .with(ComponentType.position)
      .with(ComponentType.collider);
    this.withAnimator = this.world
      .with(ComponentType.id)
      .with(ComponentType.position)
      .with(ComponentType.animator)
      .where((actor) => actor.animatedTile !== undefined);
    this.withBrain = this.world.with(ComponentType.brain);
    this.shrubManager = new ManagerShrubs(this.game, this.world);
    this.treeManager = new ManagerTrees(this.game, this.world);
  }

  public addInitialActors(): void {
    this.addAnimals();
    this.addPlants();
  }

  getRandomActorPositions(subtype: TileSubType, quantity: number = 1): Point[] {
    let buffer: Point[] = [];
    let result: Point[] = [];
    for (const { position, subType } of this.withPosition) {
      if (subType === subtype) {
        buffer.push(position);
      }
    }

    let index: number;
    while (buffer.length > 0 && result.length < quantity) {
      index = Math.floor(RNG.getUniform() * buffer.length);
      result.push(buffer.splice(index, 1)[0]);
    }
    return result;
  }

  public getRandomTreePositions(
    speciesId: TreeSpeciesID,
    quantity: number = 1
  ): Point[] {
    let buffer: Point[] = [];
    let result: Point[] = [];
    for (const { species, position } of this.allTrees) {
      if (species === speciesId) {
        buffer.push(position);
      }
    }

    let index: number;
    while (buffer.length > 0 && result.length < quantity) {
      index = Math.floor(RNG.getUniform() * buffer.length);
      result.push(buffer.splice(index, 1)[0]);
    }
    return result;
  }

  public getActorsAt(x: number, y: number): ActorBase[] {
    let result: ActorBase[] = [];
    for (const actor of this.withPosition) {
      if (actor.position?.x === x && actor.position.y === y) {
        result.push(actor);
      }
    }
    // console.log("result", result);
    return result;
  }

  public getPlantsAt(x: number, y: number): ActorBase[] {
    let result: ActorBase[] = [];
    for (const actor of this.allPlants) {
      if (actor.position?.x === x && actor.position.y === y) {
        result.push(actor);
      }
    }
    // console.log("result", result);
    return result;
  }

  private addAnimals(): void {
    let actor: Partial<ActorBase> & WithPosition & WithID;
    for (let i = 0; i < GameSettings.options.spawn.inputs.cowCount; i++) {
      // COW
      // create an actor
      // add components representing cow
      actor = {
        id: generateId(),
        position: this.game.map.getRandomTilePositions(
          this.landBiomes,
          1,
          true
        )[0],
        animatedTile: Tile.cow,
        type: TileType.Entity,
        subType: TileSubType.Animal,
      };
      actor.name = this.game.nameGenerator.generate(actor.subType);
      actor.range = 10;
      actor.path = [];
      actor.animator = new Animator(this.game, actor as any, 0.3);
      actor.brain = new BrainAnimal(this.game, actor as any);
      actor.description = new Description(actor);
      this.spawnActor(actor, Layer.ENTITY);
    }
    for (let i = 0; i < GameSettings.options.spawn.inputs.sharkCount; i++) {
      // SHARK
      actor = {
        id: generateId(),
        position: this.game.map.getRandomTilePositions(
          this.waterBiomes,
          1,
          true
        )[0],
        animatedTile: Tile.sharkBlue,
        type: TileType.Entity,
        subType: TileSubType.Fish,
      };
      actor.name = this.game.nameGenerator.generate(actor.subType);
      actor.validBiomes = this.waterBiomes;
      actor.range = 15;
      actor.path = [];
      actor.animator = new Animator(this.game, actor as any, 0.3);
      actor.brain = new BrainFish(this.game, actor as any);
      actor.description = new Description(actor);
      this.spawnActor(actor, Layer.ENTITY);
    }
    for (let i = 0; i < GameSettings.options.spawn.inputs.seagullCount; i++) {
      // SEAGULL
      actor = {
        id: generateId(),
        position: this.game.map.getRandomTilePositions(
          this.airBiomes,
          1,
          false
        )[0],
        animatedTile: Tile.seagull,
        type: TileType.Entity,
        subType: TileSubType.Bird,
      };
      actor.name = this.game.nameGenerator.generate(actor.subType);
      actor.validBiomes = this.airBiomes;
      actor.range = 25;
      actor.path = [];
      actor.animator = new Animator(this.game, actor as any, 0.3);
      actor.brain = new BrainBird(this.game, actor as any);
      actor.description = new Description(actor);
      this.spawnActor(actor, Layer.ENTITY);
    }
    for (let i = 0; i < GameSettings.options.spawn.inputs.mushroomCount; i++) {
      // MUSHROOM
      actor = {
        id: generateId(),
        position: this.game.map.getRandomTilePositions(
          this.landBiomes,
          1,
          true
        )[0],
        animatedTile: Tile.mushroom,
        type: TileType.Entity,
        subType: TileSubType.Animal,
      };
      actor.name = this.game.nameGenerator.generate(actor.subType);
      actor.path = [];
      actor.range = 15;
      actor.animator = new Animator(this.game, actor as any, 2.25);
      actor.brain = new BrainMushroom(this.game, actor as any);
      actor.description = new Description(actor);
      this.spawnActor(actor, Layer.ENTITY);
    }

    this.game.renderer.renderChunkedLayers(
      [Layer.ENTITY],
      GameSettings.options.gameSize.width,
      GameSettings.options.gameSize.height,
      new Point(
        Math.floor(GameSettings.options.gameSize.width / 2),
        Math.floor(GameSettings.options.gameSize.height / 2)
      )
    );

    this.game.userInterface.components.updateSideBarContent(
      "Entities",
      this.withBrain.entities
    );
  }

  private addPlants(): void {
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

  public spawnActor(
    actor: ActorBase & WithPosition & WithID,
    layer: Layer
  ): ActorBase {
    this.world.add(actor);
    if (actor.position) {
      this.game.collisionManager.occupyTile(
        actor.position.x,
        actor.position.y,
        layer,
        actor.id
      );
    }
    if (actor.sprite) {
      this.game.renderer.addToScene(actor.position, layer, actor.sprite);
    }

    this.game.timeManager.addToSchedule(actor, true);
    this.game.collisionManager.occupyTile(
      actor.position.x,
      actor.position.y,
      Layer.ENTITY,
      actor.id
    );
    return actor;
  }

  public getWithPosition(): Query<ActorBase & WithPosition> {
    return this.withPosition;
  }
}
