import { Game } from "../game";
import { Point } from "../point";
import { Action } from "../actions/action";
import { MoveAction } from "../actions/moveAction";
import { WaitAction } from "../actions/waitAction";
import { HarvestAction } from "../actions/harvestAction";
import { WanderAction } from "../actions/wanderAction";
import { ConsumePlantAction } from "../actions/consumePlantAction";
import {
  ActorBase,
  CanFruit,
  WithAnimation,
  WithID,
  WithLayer,
  WithPathing,
  WithPosition,
} from "../actor";
import { Brain } from "./brain";
import { SystemPathfinder } from "../system-pathfinder";
import { Tile } from "../tile";
import { Layer } from "../renderer";
import { SystemAnimated } from "../system-animated";
import { SystemActors } from "../system-actors";

export class BrainCow implements Brain {
  action: Action | null;
  goal: Action | null;

  constructor(
    private game: Game,
    public actor: ActorBase &
      WithID &
      WithPosition &
      WithPathing &
      WithAnimation &
      WithLayer
  ) {
    this.action = null;
    this.goal = null;
  }

  private planGoal(): Action {
    for (let i = 0; i < 25; i++) {
      const plantTargets: ActorBase[] = SystemActors.getNearest(
        this.actor.position,
        ["lastGrowth", "position"],
        50 // count to return
      ); // hacky way to find shrubs for now
      const plantTarget: ActorBase & WithPosition & WithLayer =
        plantTargets.filter(
          (actor) => actor.layer === Layer.GROUNDCOVER
        )[0] as any;
      if (plantTarget) {
        const translatedPosition = Tile.translatePoint(
          plantTarget.position,
          plantTarget.layer,
          this.actor.layer
        );
        // check if reachable
        return new ConsumePlantAction(
          this.game,
          this.actor,
          translatedPosition,
          plantTarget
        );
      }
    }
    return new WaitAction(this.game, this.actor, this.actor.position!!);
  }

  private planWanderGoal(): Action {
    let attempts = 5;
    while (attempts > 0) {
      const wanderPoint = SystemPathfinder.getRandomPointWithinRange(
        this.actor.position,
        this.actor.range
      );
      const wanderGoal = new WanderAction(this.game, this.actor, wanderPoint);
      if (this.isGoalReachable(wanderGoal)) {
        return new WanderAction(this.game, this.actor, wanderPoint);
      }
      attempts--;
    }
    return new WaitAction(this.game, this.actor, this.actor.position);
  }

  private isGoalReachable(goal: Action): boolean {
    const isSelfBlocked = this.game.collisionManager.isOccupiedBySelf(
      goal.targetPos.x,
      goal.targetPos.y,
      this.actor.id
    );
    return (
      isSelfBlocked ||
      !this.game.collisionManager.isBlocked(goal.targetPos.x, goal.targetPos.y)
    );
  }

  public plan(): void {
    const atGoalPosition = this.goal
      ? this.actor.position?.equals(this.goal?.targetPos)
      : false;
    if (!this.goal) {
      // find new goal
      this.goal = this.planGoal();
    }

    if (this.goal) {
      if (atGoalPosition) {
        // run the action if at the goal position
        this.action = this.goal;
        return;
      }

      if (!this.action) {
        // !!!!! MUST check if target is reachable before this point
        if (this.goal && !SystemPathfinder.hasPath(this.actor.path)) {
          // calculate new path if no path exists
          this.game.pathfinder.pathTo(this.actor, this.goal.targetPos);
          if (!SystemPathfinder.hasPath(this.actor.path)) {
            // no path found
            this.goal = this.planWanderGoal();
            this.game.pathfinder.pathTo(this.actor, this.goal.targetPos);
          }
        }
        if (this.goal && SystemPathfinder.hasPath(this.actor.path)) {
          this.action = new MoveAction(
            this.game,
            this.actor,
            SystemPathfinder.getNextPathSegment(this.actor.path)
          );
          return;
        }
      }
    }
  }

  act(): Promise<any> {
    if (!this.action) {
      return Promise.resolve();
    }
    return this.action
      .run()
      .then((res: { movementVector: [number, number] }) => {
        // face the sprite/anim to the direction of movement
        SystemAnimated.updateFacing(this.actor, res?.movementVector);

        if (this.goal === this.action) {
          // goal completed, pick a new one next turn
          this.goal = null;
        }
        // action completed, pick a new one next turn
        this.action = null;
        return res;
      });
  }
}
