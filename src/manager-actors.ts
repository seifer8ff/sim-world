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
import { SpeciesId } from "./species";
import { Query, World } from "miniplex";
import {
  ComponentType,
  ActorBase,
  WithPosition,
  WithID,
  WithAnimation,
  WithTile,
  isPointer,
  isActor,
  isAnimated,
} from "./actor";
import { ManagerShrubs } from "./manager-shrubs";
import { Description } from "./components/description";
import { AnimatedSprite, DisplayObject, Sprite } from "pixi.js";
import { SystemAnimated } from "./system-animated";

export class ManagerActor {
  private world: World<ActorBase>;
  public shrubManager: ManagerShrubs;

  // queries
  public allPositioned: Query<ActorBase>;
  public allPlants: Query<ActorBase>;
  public groundCover: Query<ActorBase>;
  public groundCoverGrowth: Query<ActorBase>;
  public allTrees: Query<ActorBase>;
  public withPosition: Query<ActorBase & WithID & WithPosition>;
  public withCollider: Query<ActorBase>;
  public withAnimator: Query<ActorBase & WithPosition & WithAnimation>;
  public withStaticSprite: Query<ActorBase & WithID & WithTile & WithPosition>;
  public withBrain: Query<ActorBase>;
  public withUI: Query<ActorBase>;
  public withPointer: Query<ActorBase & isPointer>;

  constructor(private game: Game) {
    this.world = new World<ActorBase>();
    this.withPosition = this.world
      .with(ComponentType.id)
      .with(ComponentType.position)
      .with(ComponentType.layer);
    this.allPositioned = this.world.with(ComponentType.position);
    this.allPlants = this.world
      .with(ComponentType.layer)
      .with(ComponentType.canGrow)
      .where(({ layer }) => {
        return layer === Layer.GROUNDCOVER || layer === Layer.SMALLACTOR;
      });
    this.groundCover = this.world
      .with(ComponentType.layer)
      .where(({ layer }) => layer === Layer.GROUNDCOVER);
    this.groundCoverGrowth = this.groundCover.with(ComponentType.canGrow);
    this.allTrees = this.world
      .with(ComponentType.layer)
      .with(ComponentType.species)
      .where(({ layer }) => layer === Layer.SMALLACTOR);
    this.withCollider = this.world
      .with(ComponentType.position)
      .with(ComponentType.collider);
    this.withAnimator = this.withPosition
      .with(ComponentType.sprite)
      .with(ComponentType.animId)
      .with(ComponentType.animationMap)
      .with(ComponentType.baseAnimSpeed)
      .with(ComponentType.currentAnimation);

    this.withStaticSprite = this.withPosition
      .with(ComponentType.tile)
      .where((actor) => actor.animId == null);
    // .where((actor) => actor.animator == null);
    this.withUI = this.world
      .with(ComponentType.id)
      .with(ComponentType.position)
      .with(ComponentType.sprite)
      .with(ComponentType.isUi);
    this.withPointer = this.withPosition
      .with(ComponentType.sprite)
      .with(ComponentType.isUi)
      .with(ComponentType.isPointer);
    this.withBrain = this.world.with(ComponentType.brain);
    this.shrubManager = new ManagerShrubs(this.game, this.world);
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
    speciesId: SpeciesId,
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
    addToSchedule: boolean = false
  ): ActorBase {
    if (!actor.position || !actor.id) return null;
    if (isAnimated(actor)) {
      SystemAnimated.setAnimation(actor, "idle");
    }
    this.world.add(actor);
    if (addToSchedule) {
      this.game.timeManager.addToSchedule(actor, true);
    }
    if (actor.collider) {
      this.game.collisionManager.occupyTile(
        actor.position.x,
        actor.position.y,
        actor.layer,
        actor.id
      );
    }

    // do last to ensure all components are added
    this.world.add(actor);
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
    let removeObj: Sprite | AnimatedSprite;
    if (actor.sprite) {
      removeObj = actor.sprite;
    }

    this.game.renderer.removeFromScene(removeObj, actor.layer);
  }
}
