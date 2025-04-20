import {
  ActorBase,
  WithPosition,
  WithID,
  WithGrowth,
  WithSpecies,
  WithLayer,
} from "./actor";
import { Species } from "./species";
import { Point } from "./point";
import { Query } from "miniplex";
import { generateId, positionToIndex } from "./misc-utility";
import { Layer } from "./renderer";
import { RNG } from "rot-js";
import { SystemTrees } from "./system-trees";
import { MapWorld } from "./map-world";
import { SystemActors } from "./system-actors";
import { BiomeId, Biomes } from "./biomes";
import { Tile } from "./tile";
import { TimeManager } from "./time-manager";
import { ManagerCollision } from "./manager-collision";

export class SystemShrubs {
  public static spacialMap: Map<number, WithPosition> = new Map<
    number,
    WithPosition
  >(); // position to id map
  public static growthDirections = [
    [new Point(1, 0), new Point(0, 1), new Point(1, 1)],
    [new Point(-1, 0), new Point(0, 1), new Point(-1, 1)],
    [new Point(1, 0), new Point(0, -1), new Point(1, -1)],
    [new Point(-1, 0), new Point(0, -1), new Point(-1, -1)],
  ];
  public static validBiomes: BiomeId[] = [
    Biomes.Biomes.moistdirt.id,
    Biomes.Biomes.hillsmid.id,
    Biomes.Biomes.hillshigh.id,
    Biomes.Biomes.valley.id,
    Biomes.Biomes.snowhillshillsmid.id,
    Biomes.Biomes.snowmoistdirt.id,
  ];
  constructor() {}

  public static getAt(x: number, y: number): WithPosition | null {
    return SystemShrubs.spacialMap.get(
      positionToIndex(x, y, Layer.GROUNDCOVER)
    );
  }

  public static isAt(x: number, y: number): boolean {
    return SystemShrubs.spacialMap.has(
      positionToIndex(x, y, Layer.GROUNDCOVER)
    );
  }

  public static remove(
    shrub: ActorBase & WithPosition & WithID,
    actorManager: SystemActors
  ): void {
    if (shrub) {
      SystemShrubs.spacialMap.delete(
        positionToIndex(shrub.position.x, shrub.position.y, shrub.layer)
      );
      actorManager.remove(shrub); // remove the shrub from the actor manager
    }
  }

  public static spawnAt(
    pos: Point,
    actorManager: SystemActors,
    map: MapWorld
  ): ActorBase {
    // check the needs of the species against the position
    let species: Species[] = Species.getSpeciesForPosition(
      pos,
      Layer.SMALLACTOR,
      "shrub",
      map
    );
    if (species.length) {
      const selectedSpecies = RNG.getItem(species);
      return SystemShrubs.spawnSpeciesAt(pos, selectedSpecies, actorManager);
    }
  }

  public static spawnSpeciesAt(
    pos: Point,
    species: Species,
    actorManager: SystemActors
  ): ActorBase {
    if (pos) {
      let actor: ActorBase & WithID & WithPosition & WithSpecies & WithGrowth =
        {
          id: generateId(),
          layer: Layer.GROUNDCOVER,
          name: species.name,
          speciesType: "shrub",
          position: pos,
          species: species.id,
          firstGrowth: TimeManager.currentTurn,
          lastGrowth: TimeManager.currentTurn, // indicates actor will grow
        };

      SystemShrubs.spacialMap.set(
        positionToIndex(actor.position.x, actor.position.y, actor.layer),
        actor as any
      );

      return actorManager.spawn(actor, false);
    }
    return null;
  }

  public static updateSpacialMap(shrubs: Query<ActorBase & WithLayer>): void {
    SystemShrubs.spacialMap.clear();

    for (const shrub of shrubs) {
      SystemShrubs.spacialMap.set(
        positionToIndex(shrub.position.x, shrub.position.y, shrub.layer),
        shrub as any
      );
    }
  }

  public static updateGrowth(
    shrubs: Query<ActorBase & WithGrowth & WithPosition & WithLayer>,
    actorManager: SystemActors,
    map: MapWorld,
    collision: ManagerCollision
  ): void {
    for (const shrub of shrubs) {
      if (
        TimeManager.currentTurn - shrub.lastGrowth >
        RNG.getUniformInt(10, 30)
      ) {
        SystemShrubs.growShrub(shrub, actorManager, map, collision);
      }
    }
  }

  public static handleDeath(
    shrubs: Query<ActorBase & WithPosition & WithGrowth>,
    actorManager: SystemActors
  ): void {
    for (const shrub of shrubs) {
      if (
        TimeManager.currentTurn - shrub.firstGrowth >
        RNG.getUniformInt(50, 150)
      ) {
        this.remove(shrub, actorManager); // despawn the shrub
      }
    }
  }

  public static growShrub(
    shrub: ActorBase,
    actorManager: SystemActors,
    map: MapWorld,
    collision: ManagerCollision
  ): boolean {
    shrub.lastGrowth = TimeManager.currentTurn;
    SystemActors.world.reindex(shrub);
    let growSuccess = false;
    if (!shrub?.position) return growSuccess;

    if (!Species.allSpecies[shrub.species].growsInto) return growSuccess;

    const odds = {
      skipGrowth: 0.5, // chance to skip growth entirely
      skipTreeGrowth: 0.8, // chance to skip growing into a tree
      skipShrubAddition: 0.1, // chance to skip adding a shrub
      suitablePosScore: 0.6, // minimum score for a suitable pos
    };

    if (RNG.getUniform() < odds.skipGrowth) {
      return growSuccess;
    }

    const growIntoSpecies = RNG.getItem(
      Species.allSpecies[shrub.species].growsInto
    );

    if (this.growIntoTree(shrub, growIntoSpecies, actorManager, map, odds)) {
      return true;
    }

    return this.addShrub(shrub, actorManager, map, collision, odds);
  }

  private static addShrub(
    shrub: ActorBase,
    actorManager: SystemActors,
    map: MapWorld,
    collision: ManagerCollision,
    odds: { skipShrubAddition: number; suitablePosScore: number }
  ): boolean {
    if (RNG.getUniform() < odds.skipShrubAddition) {
      return false;
    }

    const emptyTiles = this.getGrowthPositions(shrub, collision);

    if (emptyTiles.length > 0) {
      const suitableTiles = this.calculateNeedsScores(
        emptyTiles,
        shrub,
        map,
        odds.suitablePosScore
      );

      if (suitableTiles.length > 0) {
        const bestTile = suitableTiles.reduce((best, current) =>
          current.score > best.score ? current : best
        );

        SystemShrubs.spawnSpeciesAt(
          bestTile.pos,
          Species.allSpecies[shrub.species],
          actorManager
        );
        return true;
      }
    }

    return false;
  }

  private static growIntoTree(
    shrub: ActorBase,
    growIntoSpecies: string,
    actorManager: SystemActors,
    map: MapWorld,
    odds: { skipTreeGrowth: number }
  ): boolean {
    for (const directionSet of SystemShrubs.growthDirections) {
      const { x, y } = shrub.position;
      const isComplete = directionSet.every((dir) =>
        SystemShrubs.spacialMap.has(
          positionToIndex(x + dir.x, y + dir.y, shrub.layer)
        )
      );

      if (isComplete) {
        if (RNG.getUniform() < odds.skipTreeGrowth) {
          return false;
        }

        if (
          Species.needsScore(
            shrub.position,
            shrub.layer,
            Species.allSpecies[growIntoSpecies].needs,
            map
          ) < 0.7
        ) {
          return false;
        }

        SystemTrees.spawnSpeciesAt(
          Species.allSpecies[growIntoSpecies],
          shrub.position,
          actorManager
        );
        SystemActors.world.remove(shrub);
        return true;
      }
    }
    return false;
  }

  private static getGrowthPositions(
    shrub: ActorBase,
    collision: ManagerCollision
  ): Point[] {
    return SystemShrubs.growthDirections
      .flat()
      .map((dir) => shrub.position.add(dir))
      .filter((pos) => {
        const isBlocked = collision.isMapBlocked(pos.x, pos.y, shrub.layer); // check if the tile is blocked by terrain or other actors
        return (
          !isBlocked &&
          !SystemShrubs.spacialMap.has(
            positionToIndex(pos.x, pos.y, shrub.layer)
          )
        );
      });
  }

  private static calculateNeedsScores(
    emptyTiles: Point[],
    shrub: ActorBase,
    map: MapWorld,
    suitableTileScore: number
  ): { pos: Point; score: number }[] {
    return emptyTiles
      .filter((pos) => {
        const biome = map.getBiome(
          Tile.translate(pos.x, shrub.layer, Layer.TERRAIN),
          Tile.translate(pos.y, shrub.layer, Layer.TERRAIN)
        );
        return biome && SystemShrubs.validBiomes.includes(biome.id);
      })
      .map((pos) => ({
        pos,
        score: Species.needsScore(
          pos,
          shrub.layer,
          Species.allSpecies[shrub.species].needs,
          map
        ),
      }))
      .filter(({ score }) => score > suitableTileScore);
  }
}
