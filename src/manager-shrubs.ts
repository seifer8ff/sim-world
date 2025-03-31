import {
  ComponentType,
  ActorBase,
  WithPosition,
  WithID,
} from "./entities/actor";
import { TreeSpecies, TreeSpeciesEnum } from "./entities/tree/tree-species";
import { Game } from "./game";
import { BiomeId, Biomes } from "./biomes";
import { Point } from "./point";
import { World } from "miniplex";
import { generateId, getNumberFromRange } from "./misc-utility";
import { Tile, TileSubType, TileType } from "./tile";
import { SystemBranches } from "./system-branches";
import { SystemLeaves } from "./system-leaves";
import { SystemTreeRenderer } from "./system-tree-renderer";
import { Layer } from "./renderer";
import { Texture } from "pixi.js";
import { Color, RNG } from "rot-js";

export class ManagerShrubs {
  constructor(private game: Game, private world: World) {}

  public init(): void {}

  public spawnAt(pos: Point): ActorBase {
    if (pos) {
      let actor: ActorBase & WithID & WithPosition = {
        id: generateId(),
        name: "Shrub",
        position: pos,
        tile: Tile.shrub.id,
        subType: TileSubType.Shrub,
        type: TileType.Plant,
      };
      return this.game.actorManager.spawnActor(actor, Layer.PLANT);
    }
    return null;
  }

  public spawn(): ActorBase {
    let pos: Point;
    let actor: ActorBase;
    let biomes: BiomeId[];
    switch (true) {
      case true:
        biomes = [Biomes.Biomes.moistdirt.id];
        break;
    }
    pos = this.game.map.getRandomTilePositions(biomes, 1, true, true)[0];
    return this.spawnAt(pos);
  }

  public growShrub(shrub: ActorBase): boolean {
    let growSuccess = false;
    if (!shrub?.position) return growSuccess;

    const positions = new Set<string>();
    const shrubs = this.game.actorManager.allShrubs;
    for (const { position } of shrubs) {
      positions.add(`${position.x},${position.y}`);
    }

    const directions = [
      [new Point(1, 0), new Point(0, 1), new Point(1, 1)],
      [new Point(-1, 0), new Point(0, 1), new Point(-1, 1)],
      [new Point(1, 0), new Point(0, -1), new Point(1, -1)],
      [new Point(-1, 0), new Point(0, -1), new Point(-1, -1)],
    ];

    for (const directionSet of directions) {
      const { x, y } = shrub.position;
      const isSquare = directionSet.every((dir) =>
        positions.has(`${x + dir.x},${y + dir.y}`)
      );

      if (isSquare) {
        // Remove the shrubs and spawn a trunk
        directionSet.forEach((dir) => {
          const adjacentPos = new Point(x + dir.x, y + dir.y);
          const adjacentShrub = this.game.actorManager.getPlantsAt(
            adjacentPos.x,
            adjacentPos.y
          )[0];
          this.world.remove(adjacentShrub);
        });
        this.world.remove(shrub);
        // console.log("--- !!! --- shrub removed to add TREE !!");

        // const trunk = this.world.add({
        //   id: generateId(),
        //   position: shrub.position,
        //   tile: Tile.tree.id,
        //   subType: TileSubType.Tree,
        //   type: TileType.Plant,
        // });
        // this.world.addComponent(trunk, ComponentType.name, "Trunk");
        growSuccess = true;
        break;
      }
    }

    if (!growSuccess) {
      // Try to add a shrub to a touching tile
      // use the positions set to determine which tiles are empty
      // don't use the actormanger.getPlantsA
      const emptyTiles = directions
        .flat()
        .map((dir) => shrub.position.add(dir))
        .filter((pos) => {
          return !positions.has(`${pos.x},${pos.y}`);
        });

      // console.log("emptyTiles", emptyTiles);
      // console.log("positions", positions);

      if (emptyTiles.length > 0) {
        const newShrubPos = RNG.getItem(emptyTiles);
        // console.log("--- !! add shrub at:", newShrubPos);
        this.spawnAt(newShrubPos);
        // const newShrub = this.world.add({
        //   id: generateId(),
        //   position: newShrubPos,
        //   tile: Tile.shrub.id,
        //   subType: TileSubType.Shrub,
        //   type: TileType.Plant,
        // });
        // this.world.addComponent(newShrub, ComponentType.name, "Shrub");
        growSuccess = true;
      }
    }

    return growSuccess;
  }

  // public growShrub(shrub: EntityBase): boolean {
  //   let growSuccess = false;
  //   if (!shrub?.position) return growSuccess;

  //   const directions = [
  //     [new Point(0, 0), new Point(1, 0), new Point(0, 1), new Point(1, 1)],
  //     [new Point(-1, 0), new Point(0, 0), new Point(-1, 1), new Point(0, 1)],
  //     [new Point(0, -1), new Point(1, -1), new Point(0, 0), new Point(1, 0)],
  //     [new Point(-1, -1), new Point(0, -1), new Point(-1, 0), new Point(0, 0)],
  //   ];

  //   for (const directionSet of directions) {
  //     const adjacentShrubs = directionSet
  //       .map((dir) => {
  //         let adjacentPos = shrub.position.add(dir);
  //         // translate from plant layer to actor layer
  //         return this.game.actorManager.getPlantsAt(
  //           adjacentPos.x,
  //           adjacentPos.y
  //         );
  //       })
  //       .filter((plants) => plants.length > 0);

  //     if (adjacentShrubs.length === 4) {
  //       // Remove the shrubs and spawn a trunk
  //       adjacentShrubs.forEach((adjacentShrub) => {
  //         this.world.remove(adjacentShrub);
  //       });
  //       this.world.remove(shrub);
  //       console.log("--- !!! --- shrub removed to add TREE !!");

  //       // const trunk = this.world.add({
  //       //   id: generateId(),
  //       //   position: shrub.position,
  //       //   tile: Tile.tree.id,
  //       //   subType: TileSubType.Tree,
  //       //   type: TileType.Plant,
  //       // });
  //       // this.world.addComponent(trunk, ComponentType.name, "Trunk");
  //       growSuccess = true;
  //       break;
  //     }
  //   }

  //   if (!growSuccess) {
  //     // Try to add a shrub to a touching tile
  //     const emptyTiles = directions
  //       .flat()
  //       .map((dir) => {
  //         const adjacentPos = shrub.position.add(dir);
  //         return this.game.actorManager.getPlantsAt(
  //           adjacentPos.x,
  //           adjacentPos.y
  //         );
  //       })
  //       .filter((plants) => plants.length === 0);

  //     if (emptyTiles.length > 0) {
  //       const newShrubPos =
  //         emptyTiles[getNumberFromRange(0, emptyTiles.length)];
  //       const newShrub = this.world.add({
  //         id: generateId(),
  //         position: newShrubPos,
  //         tile: Tile.shrub.id,
  //         subType: TileSubType.Shrub,
  //         type: TileType.Plant,
  //       });
  //       this.world.addComponent(newShrub, ComponentType.name, "Shrub");
  //       growSuccess = true;
  //     }
  //   }

  //   return growSuccess;
  // }

  public drawShrub(shrub: ActorBase): void {
    const { tile, position } = shrub;
    this.game.renderer.addTileIdToScene(position, Layer.PLANT, tile);
  }
}
