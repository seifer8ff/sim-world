import { Game } from "../game";
import { Point } from "../point";
import { Action } from "./action";
import { generateId } from "../misc-utility";
import { ActorBase } from "../actor";

export class WanderAction implements Action {
  readonly id: number;
  readonly name: string;
  durationInTurns: number; // how long the action lasts

  constructor(
    private game: Game,
    private actor: ActorBase,
    public targetPos: Point
  ) {
    this.id = generateId();
    this.name = "Wander Around";
    this.durationInTurns = 3;
  }

  run(): Promise<any> {
    // console.log("run wander action");
    return Promise.resolve();
  }
}
