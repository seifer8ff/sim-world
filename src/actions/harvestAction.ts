import { Game } from "../game";
import { Point } from "../point";
import { Action } from "./action";
import { generateId } from "../misc-utility";
import { ActorBase, CanFruit, WithPosition } from "../actor";

export class HarvestAction implements Action {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  durationInTurns: number; // how long the action lasts

  constructor(
    private game: Game,
    private actor: ActorBase,
    public targetPos: Point, // where the action takes place
    public target: ActorBase & WithPosition & CanFruit
  ) {
    this.id = generateId();
    this.name = "Harvest";
    this.durationInTurns = 10;
  }

  run(): Promise<any> {
    // TODO: interact with target tile
    // console.log("harvest action");
    // console.log(
    //   "Harvesting:",
    //   this.target,
    //   "at:",
    //   this.targetPos,
    //   "by actor:",
    //   this.actor.id
    // );
    this.target.fruitCount -= 1; // Decrease the fruit count of the target
    if (this.target.fruitCount <= 0) {
      // remove the target from the world
      this.game.actorManager.removeActor(this.target);
      // console.log("Removed target actor:", this.target.id);
    }
    return Promise.resolve();
  }
}
