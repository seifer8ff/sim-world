import { Game } from "./game";
import { Layer } from "./renderer";
import { positionToIndex } from "./misc-utility";
import { Point } from "./point";
import { Tile } from "./tile";
import { Query, World } from "miniplex";
import {
  ComponentType,
  ActorBase,
  WithPosition,
  WithID,
  WithAnimation,
  WithTile,
  isPointer,
  isAnimated,
  WithGrowth,
  isUi,
} from "./actor";
import { AnimatedSprite, Sprite } from "pixi.js";
import { SystemAnimated } from "./system-animated";
import { SystemCollision } from "./system-collision";

export class SystemActors {
  public static world: World<ActorBase> = new World<ActorBase>(); // static world for all actors

  public static queries: {
    allPlants: Query<ActorBase>;
    groundCover: Query<ActorBase>;
    groundCoverGrowth: Query<WithPosition & WithGrowth>;
    allTrees: Query<ActorBase>;
    withPosition: Query<ActorBase & WithID & WithPosition>;
    withCollider: Query<ActorBase>;
    withAnimator: Query<ActorBase & WithPosition & WithAnimation>;
    withStaticSprite: Query<ActorBase & WithID & WithTile & WithPosition>;
    withBrain: Query<ActorBase>;
    withUI: Query<ActorBase>;
    withPointer: Query<ActorBase & isUi & isPointer>;
  } = {
    allPlants: null,
    groundCover: null,
    groundCoverGrowth: null,
    allTrees: null,
    withPosition: null,
    withCollider: null,
    withAnimator: null,
    withStaticSprite: null,
    withBrain: null,
    withUI: null,
    withPointer: null,
  };

  constructor(private game: Game) {
    SystemActors.queries.withPosition = SystemActors.world
      .with(ComponentType.id)
      .with(ComponentType.position)
      .with(ComponentType.layer);
    SystemActors.queries.allPlants = SystemActors.queries.withPosition
      .with(ComponentType.lastGrowth)
      .where(({ layer }) => {
        return layer === Layer.GROUNDCOVER || layer === Layer.SMALLACTOR;
      });
    SystemActors.queries.groundCover = SystemActors.queries.withPosition.where(
      ({ layer }) => layer === Layer.GROUNDCOVER
    );
    SystemActors.queries.groundCoverGrowth = SystemActors.queries.groundCover
      .with(ComponentType.lastGrowth)
      .where((actor) => actor.position !== undefined);
    SystemActors.queries.allTrees = SystemActors.queries.withPosition
      .with(ComponentType.species)
      .with(ComponentType.speciesType)
      .where(({ speciesType }) => speciesType === "tree")
      .where(({ layer }) => layer === Layer.SMALLACTOR);
    SystemActors.queries.withCollider = SystemActors.queries.withPosition.with(
      ComponentType.collider
    );
    SystemActors.queries.withAnimator = SystemActors.queries.withPosition
      .with(ComponentType.sprite)
      .with(ComponentType.animId)
      .with(ComponentType.animationMap)
      .with(ComponentType.baseAnimSpeed)
      .with(ComponentType.currentAnimation);
    SystemActors.queries.withStaticSprite = SystemActors.queries.withPosition
      .with(ComponentType.tile)
      .where((actor) => actor.animId == null);
    SystemActors.queries.withUI = SystemActors.queries.withPosition
      .with(ComponentType.sprite)
      .with(ComponentType.isUi);
    SystemActors.queries.withPointer = SystemActors.queries.withUI
      .with(ComponentType.isPointer)
      .where((actor) => actor.isUi);
    SystemActors.queries.withBrain = SystemActors.world.with(
      ComponentType.brain
    );
  }

  public static getNearest(
    point: Point,
    requiredAttributes: (keyof ActorBase)[],
    quantity: number = 1
  ): ActorBase[] {
    let buffer: { actor: ActorBase; distance: number }[] = [];
    let result: ActorBase[] = [];
    let translatedPoint: Point;

    for (const actor of SystemActors.queries.withPosition) {
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

  public static getAt(x: number, y: number): ActorBase[] {
    let result: ActorBase[] = [];
    for (const actor of SystemActors.queries.withPosition) {
      if (actor.position?.x === x && actor.position.y === y) {
        result.push(actor);
      }
    }
    // console.log("result", result);
    return result;
  }

  public spawn(
    actor: ActorBase & WithPosition & WithID,
    addToSchedule: boolean = false
  ): ActorBase {
    if (!actor.position || !actor.id) return null;
    if (isAnimated(actor)) {
      SystemAnimated.setAnimation(actor, "idle");
    }
    SystemActors.world.add(actor);
    if (addToSchedule) {
      this.game.timeManager.addToSchedule(actor, true);
    }
    if (actor.collider) {
      SystemCollision.occupyTile(
        actor.position.x,
        actor.position.y,
        actor.layer,
        actor.id
      );
    }

    // do last to ensure all components are added
    SystemActors.world.add(actor);
    return actor;
  }

  public remove(actor: ActorBase): void {
    if (!actor.position) return;
    SystemCollision.clearEntityTile(
      actor.position.x,
      actor.position.y,
      actor.layer
    );
    SystemActors.world.remove(actor);
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
