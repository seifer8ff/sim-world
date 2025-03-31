import { ActorBase } from "./entities/actor";
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
import { CompositeTilemap } from "./libs/pixi-tilemap.es";
import { Color } from "rot-js";

export interface Segment {
  position: Point;
  curve: number;
  length: number;
  width: number;
  segmentOrder: number; // resets to 0 for each branch
  overrideTexture?: Texture; // allows for custom textures on segments, like the trunk base
  leafCount?: number;
}

export interface TreeBranch {
  id: number;
  segments: Segment[];
  doneExtending: boolean;
  doneBranching: boolean;
  branchOrder: number;
  branchCount: number; // how many times does this branch, branch
  isTrunk?: boolean;
}

export interface TreeTrunkBase {
  trunkBaseTextureIndex: number;
}

export interface Leaf {
  branchId: number;
  position: Point;
  rotation: number;
  alpha: number;
  underCanopy: boolean;
}

export class ManagerTrees {
  constructor(private game: Game, private world: World) {}

  public init(): void {}

  public spawnAt(pos: Point, species: TreeSpecies): ActorBase {
    if (pos) {
      let actor: ActorBase;
      console.log("spawn at: ", pos);
      let trunkBaseTextureIndex =
        SystemTreeRenderer.getRandomTrunkBaseTexture(species);
      let trunkTextureIndex = SystemTreeRenderer.getRandomTrunkTexture(species);
      let entityProps: ActorBase = {
        id: generateId(),
        name: "Tree",
        position: pos,
        collider: true,
        subType: TileSubType.Tree,
        type: TileType.Plant,
        species: species.id,
        renderable: SystemTreeRenderer.generateBaseRenderable(this.game, pos),
        growthStep: 0,
        trunk: {
          id: generateId(),
          segments: [],
          doneExtending: false,
          doneBranching: false,
          branchOrder: 0,
          branchCount: 0,
          isTrunk: true,
        },
        trunkBaseTextureIndex: trunkBaseTextureIndex,
        trunkTextureIndex: trunkTextureIndex,
        branchTextureIndex: SystemTreeRenderer.getRandomTrunkTexture(species),
        trunkSegmentWidth: getNumberFromRange(
          species.trunkSegmentWidthMin,
          species.trunkSegmentWidthRange
        ),
        trunkSegmentHeight: getNumberFromRange(
          species.trunkSegmentHeightMin,
          species.trunkSegmentHeightRange
        ),
        ...SystemBranches.add(species),
        ...SystemLeaves.add(species),
      };
      actor = this.world.add(entityProps);
      this.game.collisionManager.occupyTile(
        actor.position.x,
        actor.position.y,
        Layer.PLANT,
        actor.id
      );
      this.game.timeManager.addToSchedule(actor, true);
      this.game.renderer.addToScene(
        actor.position,
        Layer.TREE,
        actor.renderable
      );
      return actor;
    }
    return null;
  }

  public spawn(species: TreeSpecies): ActorBase {
    let pos: Point;
    let actor: ActorBase;
    let biomes: BiomeId[];
    switch (species.id) {
      case TreeSpeciesEnum.PINE:
        biomes = [Biomes.Biomes.moistdirt.id];
        break;
      case TreeSpeciesEnum.BIRCH:
        biomes = [Biomes.Biomes.hillsmid.id, Biomes.Biomes.hillshigh.id];
        break;
      case TreeSpeciesEnum.COTTONCANDY:
        biomes = [Biomes.Biomes.valley.id];
        break;
      case TreeSpeciesEnum.MAPLE:
        biomes = [Biomes.Biomes.snowhillshillsmid.id];
        break;
      default:
        biomes = [Biomes.Biomes.moistdirt.id];
        break;
    }
    pos = this.game.map.getRandomTilePositions(biomes, 1, true, true)[0];
    return this.spawnAt(pos, species);
  }

  public growTree(tree: ActorBase): boolean {
    // console.log("-- curve in growth func: ", tree.curve);
    let growSuccess = false;
    growSuccess = SystemBranches.growTrunk(tree);
    if (growSuccess) {
      // only sort on trunk growth- otherwise buggy for leaves
      tree.renderable?.sortChildren();
    }
    if (!growSuccess) {
      growSuccess = SystemBranches.growBranches(0, tree);
    }
    if (tree.trunk.segments.length) {
      SystemLeaves.growLeaves(0, tree);
    }
    return growSuccess;
  }

  public drawTree(tree: ActorBase): void {
    const {
      renderable,
      trunk,
      branches,
      leaves,
      species,
      trunkBaseTextureIndex,
      trunkTextureIndex,
      branchTextureIndex,
      leafTextureIndex,
      position,
    } = tree;
    const treeSpecies = TreeSpecies.treeSpecies[species];
    const translatedX = Tile.translate(position.x, Layer.TREE, Layer.TERRAIN);
    const translatedY = Tile.translate(position.y, Layer.TREE, Layer.TERRAIN);
    const colorArray = this.game.map.lightManager.getLightFor(
      translatedX,
      translatedY,
      false
    );

    SystemTreeRenderer.renderTrunk(
      trunk,
      renderable as CompositeTilemap,
      treeSpecies,
      trunkBaseTextureIndex,
      trunkTextureIndex,
      colorArray
    );

    SystemTreeRenderer.renderUnderCanopy(
      branches,
      leaves,
      renderable,
      treeSpecies,
      leafTextureIndex,
      colorArray
    );

    SystemTreeRenderer.renderBranches(
      branches,
      renderable,
      treeSpecies,
      branchTextureIndex,
      colorArray
    );

    SystemTreeRenderer.renderLeaves(
      branches,
      leaves,
      renderable,
      treeSpecies,
      leafTextureIndex,
      colorArray
    );
  }
}

// public tintSelf(): void {
//   let translatedX = Tile.translate(
//     this.position.x,
//     Layer.TREE,
//     Layer.TERRAIN
//   );
//   let translatedY = Tile.translate(
//     this.position.y,
//     Layer.TREE,
//     Layer.TERRAIN
//   );
//   let colorArray = this.game.map.lightManager.getLightFor(
//     translatedX,
//     translatedY,
//     false
//   );
//   let color: ColorType = colorArray;
//   if (color === undefined) {
//     // position is outside of viewport
//     return;
//   }

//   this.sprite.children.forEach((child: Renderable) => {
//     const order: number = child["order"];
//     if (order !== undefined) {
//       // TODO: improve this logic
//       // Should instead be applied to all segments with a smooth gradient
//       // and ensure it darkens more at the base
//       const darkenAmount = clamp(
//         inverseLerp(
//           order, // calculated from branchOrder + segmentOrder / 10
//           1.4, // how far up the tree to darken
//           0
//         ),
//         0,
//         this.canopyDarkenAmount // how much to darken the base of the tree
//       );
//       color = Color.interpolate(
//         colorArray,
//         LightManager.lightDefaults.shadow,
//         darkenAmount
//       );
//     }
//     if (child["tint"] !== undefined) {
//       (child as any).tint = Color.toHex(color);
//     }
//   });
// }
