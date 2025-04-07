import { RNG } from "rot-js/lib/index";
import { Game } from "./game";
import { Layer } from "./renderer";
import { generateId, positionToIndex } from "./misc-utility";
import { Point } from "./point";
import { GameSettings } from "./game-settings";
import { BiomeId, Biomes } from "./biomes";
import { BrainFish } from "./brains/brain-fish";
import { BrainAnimal } from "./brains/brain-animal";
import { BrainCow } from "./brains/brain-cow";
import { Tile } from "./tile";
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
  WithTile,
  WithTrunkBase,
  WithCanopy,
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
  public groundCover: Query<ActorBase>;
  public allTrees: Query<ActorBase>;
  public withPosition: Query<ActorBase & WithPosition>;
  public withCollider: Query<ActorBase>;
  public withAnimator: Query<ActorBase & WithID & WithPosition & WithAnimator>;
  public withStaticSprite: Query<ActorBase & WithID & WithTile & WithPosition>;
  public withTrunkBase: Query<
    ActorBase & WithID & WithPosition & WithTrunkBase
  >;
  public withTrunkBaseVisible: Query<
    ActorBase & WithID & WithPosition & WithTrunkBase
  >;
  public withCanopy: Query<ActorBase & WithID & WithPosition & WithCanopy>;
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
    this.allPlants = this.world.with(ComponentType.layer).where(({ layer }) => {
      return layer === Layer.GROUNDCOVER || layer === Layer.SMALLACTOR;
    });
    // this.allPlants = this.world
    //   .with(ComponentType.type)
    //   .where(({ type }) => type === TileType.Plant);
    this.groundCover = this.world
      .with(ComponentType.layer)
      .where(({ layer }) => layer === Layer.GROUNDCOVER);
    this.allTrees = this.world.with(ComponentType.trunkBaseSprite);
    this.withCollider = this.world
      .with(ComponentType.position)
      .with(ComponentType.collider);
    this.withAnimator = this.world
      .with(ComponentType.id)
      .with(ComponentType.position)
      .with(ComponentType.animator)
      .where((actor) => actor.animator !== undefined);
    this.withStaticSprite = this.world
      .with(ComponentType.id)
      .with(ComponentType.position)
      .with(ComponentType.tile)
      .where((actor) => actor.animator == null);
    this.withTrunkBase = this.world
      .with(ComponentType.id)
      .with(ComponentType.position)
      .with(ComponentType.trunkBaseSprite);
    this.withCanopy = this.world
      .with(ComponentType.id)
      .with(ComponentType.position)
      .with(ComponentType.canopySprite);
    this.withBrain = this.world.with(ComponentType.brain);
    this.shrubManager = new ManagerShrubs(this.game, this.world);
    this.treeManager = new ManagerTrees(this.game, this.world);
  }

  getRandomActorPositions(
    requiredAttributes: (keyof ActorBase)[],
    quantity: number = 1
  ): Point[] {
    let buffer: Point[] = [];
    let result: Point[] = [];
    for (const actor of this.withPosition) {
      // Check if all required attributes exist on the actor
      const hasRequiredAttributes = requiredAttributes.every(
        (key) => actor[key] !== undefined
      );

      if (hasRequiredAttributes) {
        buffer.push(actor.position);
      }
    }

    let index: number;
    while (buffer.length > 0 && result.length < quantity) {
      index = Math.floor(RNG.getUniform() * buffer.length);
      result.push(buffer.splice(index, 1)[0]);
    }
    return result;
  }

  getNearestActors(
    point: Point,
    requiredAttributes: (keyof ActorBase)[],
    quantity: number = 1
  ): ActorBase[] {
    let buffer: { actor: ActorBase; distance: number }[] = [];
    let result: ActorBase[] = [];
    let translatedPoint: Point;

    for (const actor of this.withPosition) {
      // Check if all required attributes exist on the actor
      const hasRequiredAttributes = requiredAttributes.every(
        (key) => actor[key] !== undefined
      );

      if (hasRequiredAttributes) {
        translatedPoint = Tile.translatePoint(
          actor.position,
          actor.layer, // actor's layer
          Layer.TERRAIN // translate to terrain layer for distance calculation
        );
        const distance = Math.sqrt(
          Math.pow(translatedPoint.x - point.x, 2) +
            Math.pow(translatedPoint.y - point.y, 2)
        );
        buffer.push({ actor, distance });
      }
    }

    // Sort buffer by distance
    buffer.sort((a, b) => a.distance - b.distance);

    // Collect the closest positions up to the specified quantity
    for (let i = 0; i < Math.min(quantity, buffer.length); i++) {
      result.push(buffer[i].actor);
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

  public getGroundCoverAt(x: number, y: number): ActorBase[] {
    let result: ActorBase[] = [];
    for (const actor of this.groundCover) {
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
    if (!actor.animator && actor.sprite) {
      // animated sprites are handled by the animator component
      this.game.renderer.addToScene(actor.position, layer, actor.sprite);
    }

    this.game.timeManager.addToSchedule(actor, true);
    this.game.collisionManager.occupyTile(
      actor.position.x,
      actor.position.y,
      Layer.ACTOR,
      actor.id
    );
    return actor;
  }

  public removeActor(actor: ActorBase): void {
    if (!actor.position) return;
    this.game.collisionManager.clearEntityTile(
      actor.position.x,
      actor.position.y,
      actor.layer
    );
    this.world.remove(actor);
    this.game.timeManager.removeFromSchedule(actor);
    const tileIndex = positionToIndex(
      actor.position.x,
      actor.position.y,
      actor.layer
    );
    this.game.renderer.removeFromCache(actor.position, actor.layer);
    this.game.renderer.removeFromScene(tileIndex, actor.layer);
  }
}
