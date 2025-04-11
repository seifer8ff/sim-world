import { WithID, WithPathing, WithPosition } from "./actor";
import { Path, RNG } from "rot-js";
import { Point } from "./point";
import { Biome, BiomeId } from "./biomes";
import { Game } from "./game";

// handle finding paths
export class SystemPathfinder {
  constructor(private game: Game) {}

  public static hasPath(path: Point[]): boolean {
    return path?.length > 0;
  }

  public static canPathOverBiome(
    biome: Biome,
    validBiomes?: BiomeId[]
  ): boolean {
    // check if biome is valid for traversal
    if (validBiomes === undefined || validBiomes.length === 0) {
      return true;
    }
    return validBiomes.includes(biome?.id);
  }

  public canPathTo(
    actor: WithID & WithPosition & WithPathing,
    x: number,
    y: number
  ): boolean {
    const distanceFromTarget = actor.position.manhattanDistance(
      new Point(x, y)
    );

    const biome = this.game.map.getBiome(x, y);
    const inRange = distanceFromTarget <= actor.range;
    const traversableBiome = SystemPathfinder.canPathOverBiome(
      biome,
      actor.validBiomes
    );
    return (
      inRange &&
      traversableBiome &&
      (!this.game.collisionManager.isBlocked(x, y) ||
        this.game.collisionManager.isOccupiedBySelf(x, y, actor.id))
    );
  }

  public pathTo(
    actor: WithID & WithPosition & WithPathing,
    target: Point
  ): void {
    if (!target) {
      return;
    }
    let astar = new Path.AStar(
      target.x,
      target.y,
      (x: number, y: number) => this.canPathTo(actor, x, y),
      {
        topology: 4,
      }
    );

    actor.path = [];
    astar.compute(actor.position.x, actor.position.y, (x: number, y: number) =>
      actor.path.push(new Point(x, y))
    );
    actor.path.shift(); // remove actor's initial position
  }

  public static getNextPathSegment(path: Point[]): Point {
    // removes path point and returns it
    return path?.shift();
  }

  public static getRandomPointWithinRange(
    actorPosition: Point,
    range: number
  ): Point {
    const posX = RNG.getUniformInt(
      actorPosition.x - range,
      actorPosition.x + range
    );
    const posY = RNG.getUniformInt(
      actorPosition.y - range,
      actorPosition.y + range
    );
    return new Point(posX, posY);
  }
}
