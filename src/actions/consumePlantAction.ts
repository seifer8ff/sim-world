import { Game } from "../game";
import { Point } from "../point";
import { Action } from "./action";
import { generateId } from "../misc-utility";
import { ActorBase, WithPosition } from "../actor";

export class ConsumePlantAction implements Action {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  durationInTurns: number; // how long the action lasts

  constructor(
    private game: Game,
    private actor: ActorBase,
    public targetPos: Point, // where the action takes place
    public target: WithPosition
  ) {
    this.id = generateId();
    this.name = "Consume Plant";
    this.durationInTurns = 4;
  }

  run(): Promise<any> {
    // console.log(
    //   "consuming:",
    //   this.target,
    //   "at:",
    //   this.targetPos,
    //   "by actor:",
    //   this.actor.id
    // );
    this.game.actorManager.remove(this.target);
    return Promise.resolve();
  }
}
