import { Game } from "../game";
import { Point } from "../point";
import { Action } from "./action";
import { generateId } from "../misc-utility";
import { ActorBase } from "../entities/actor";

export class HarvestAction implements Action {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  durationInTurns: number; // how long the action lasts

  constructor(
    private game: Game,
    private actor: ActorBase,
    public targetPos: Point
  ) {
    this.id = generateId();
    this.name = "Harvest Shrubs";
    this.durationInTurns = 10;
  }

  run(): Promise<any> {
    // TODO: interact with target tile
    // console.log("harvest action");
    return Promise.resolve();
  }
}
