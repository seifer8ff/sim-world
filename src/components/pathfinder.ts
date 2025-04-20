import { Point } from "../point";
import { Game } from "../game";
import { Biome, BiomeId, Biomes } from "../biomes";
import { Layer } from "../renderer";
import { Path, RNG } from "rot-js";
import { SystemCollision } from "../system-collision";
import { WithID, WithPosition } from "../actor";

export class Pathfinder {
  private target: Point;
  private path: Point[];

  constructor(
    private game: Game,
    public actor: WithID & WithPosition,
    public range: number,
    public validBiomes?: BiomeId[]
  ) {}

  public hasPath(): boolean {
    return this.path?.length > 0;
  }

  public canPathOverBiome(biome: Biome): boolean {
    // check if biome is valid for traversal
    if (this.validBiomes === undefined || this.validBiomes.length === 0) {
      return true;
    }
    return this.validBiomes.includes(biome?.id);
  }

  public canPathTo(x: number, y: number): boolean {
    const distanceFromTarget = this.actor.position.manhattanDistance(
      new Point(x, y)
    );

    const biome = this.game.map.getBiome(x, y);
    const inRange = distanceFromTarget <= this.range;
    const traversableBiome = this.canPathOverBiome(biome);
    return (
      inRange &&
      traversableBiome &&
      (!SystemCollision.isBlocked(x, y, this.game.map) ||
        SystemCollision.isOccupiedBySelf(x, y, this.actor.id))
    );
  }

  public pathTo(target: Point) {
    this.target = target;
    if (!target) {
      return;
    }
    let astar = new Path.AStar(target.x, target.y, this.canPathTo.bind(this), {
      topology: 4,
    });

    this.path = [];
    astar.compute(
      this.actor.position.x,
      this.actor.position.y,
      this.pathCallback.bind(this)
    );
    this.path.shift(); // remove actor's position
  }

  public getNextPathSegment(): Point {
    // removes path point and returns it
    return this.path?.shift();
  }

  public getRandomPointWithinRange(range: number): Point {
    const posX = RNG.getUniformInt(
      this.actor.position.x - range,
      this.actor.position.x + range
    );
    const posY = RNG.getUniformInt(
      this.actor.position.y - range,
      this.actor.position.y + range
    );
    return new Point(posX, posY);
  }

  private pathCallback(x: number, y: number): void {
    this.path.push(new Point(x, y));
  }
}
