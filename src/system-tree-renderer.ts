import { ActorBase } from "./entities/actor";
import { TreeSpecies } from "./entities/tree/tree-species";
import {
  getItemFromRange,
  getNumberFromRange,
  inverseLerp,
} from "./misc-utility";
import { Color, RNG } from "rot-js";
import { ParticleContainer, Sprite, Texture } from "pixi.js";
import { Leaf, Segment, TreeBranch } from "./manager-trees";
import { SystemBranches } from "./system-branches";
import { Point } from "./point";
import { Layer, Renderable } from "./renderer";
import { GameSettings } from "./game-settings";
import { SystemLeaves } from "./system-leaves";
import { Game } from "./game";
import { Tile } from "./tile";
import { Color as ColorType } from "rot-js/lib/color";
import { clamp } from "lodash";
import { LightManager, RGBAColor } from "./light-manager";
import { CompositeTilemap } from "@pixi/tilemap";

// handle spawning, updating, and rendering of tree leaves
export class SystemTreeRenderer {
  constructor() {}

  public static getRandomTrunkBaseTexture(species: TreeSpecies): number {
    return RNG.getUniformInt(0, species.textureSet.trunkBase.length - 1);
  }

  public static getRandomTrunkTexture(species: TreeSpecies): number {
    return RNG.getUniformInt(0, species.textureSet.trunk.length - 1);
  }

  public static getRandomLeafTexture(species: TreeSpecies): number {
    return RNG.getUniformInt(0, species.textureSet.leaf.length - 1);
  }

  public static getTrunkBaseTexture(species: TreeSpecies, index: number) {
    return species.textureSet.trunkBase[index];
  }

  public static getTrunkTexture(species: TreeSpecies, index: number) {
    return species.textureSet.trunk[index];
  }

  public static getLeafTexture(species: TreeSpecies, index: number) {
    return species.textureSet.leaf[index];
  }

  public static generateBaseRenderable(
    game: Game,
    pos: Point
  ): CompositeTilemap {
    const sprite = new CompositeTilemap();
    const spritePos = game.userInterface.camera.TileToScreenCoords(
      pos.x,
      pos.y,
      Layer.TREE
    );
    sprite.position.set(spritePos.x, spritePos.y);
    return sprite;
  }

  public static renderTrunk(
    trunk: TreeBranch,
    renderable: CompositeTilemap,
    species: TreeSpecies,
    trunkBaseTextureIndex: number,
    trunkTextureIndex: number,
    tint: ColorType
  ) {
    if (trunk?.segments?.length) {
      let spriteTexture = SystemTreeRenderer.getTrunkTexture(
        species,
        trunkTextureIndex
      );
      SystemTreeRenderer.renderBranch(trunk, renderable, spriteTexture, tint);

      // render the trunk base AFTER the first trunk segment
      // to ensure it's on top of the trunk
      const trunkBaseTexture = SystemTreeRenderer.getTrunkBaseTexture(
        species,
        trunkBaseTextureIndex
      );
      renderable.tile(trunkBaseTexture, -25, -10, {
        tint: SystemTreeRenderer.adjustTint(tint, 0),
      });
    }
  }

  public static renderBranches(
    branches: TreeBranch[],
    renderable: Renderable,
    species: TreeSpecies,
    branchTextureIndex: number,
    tint: ColorType
  ) {
    if (branches.length > 0) {
      for (let branch of branches) {
        let spriteTexture = SystemTreeRenderer.getTrunkTexture(
          species,
          branchTextureIndex
        );
        SystemTreeRenderer.renderBranch(
          branch,
          renderable as CompositeTilemap,
          spriteTexture,
          tint
        );
      }
    }
  }

  public static renderBranch(
    branch: TreeBranch,
    renderable: CompositeTilemap,
    texture: Texture,
    tint: ColorType
  ): CompositeTilemap {
    let segment: Segment;
    for (let i = 0; i < branch.segments.length; i++) {
      segment = branch.segments[i];
      renderable.tile(texture, segment.position.x, segment.position.y, {
        tint: SystemTreeRenderer.adjustTint(tint, segment.position.y),
      });
    }
    return renderable;
  }

  public static adjustTint(tint: ColorType, yPos: number): RGBAColor {
    let darkenAmount = inverseLerp(yPos, -45, 5);
    darkenAmount = clamp(darkenAmount, 0, 0.16);
    let newTint = Color.interpolate(
      tint,
      LightManager.lightDefaults.shadow,
      darkenAmount
    );
    newTint.push(1);
    return newTint as any as RGBAColor;
  }

  public static getTint(yPos: number): RGBAColor {
    let tint = LightManager.lightDefaults.fullLight;
    // console.log("segment.y", yPos);
    let darkenAmount = inverseLerp(yPos, -45, 5);
    // console.log("darkenAmount", darkenAmount);
    darkenAmount = clamp(darkenAmount, 0, 0.16);
    tint = Color.interpolate(
      tint,
      LightManager.lightDefaults.shadow,
      darkenAmount
    );
    tint.push(1);
    return tint as any as RGBAColor;
    // sprite.tint = Color.toHex(tint);
  }

  public static tintSegmentSprite(sprite: Sprite, yPos: number) {
    let tint = LightManager.lightDefaults.fullLight;
    let darkenAmount = inverseLerp(yPos, -45, 5);
    darkenAmount = clamp(darkenAmount, 0, 0.16);
    tint = Color.interpolate(
      tint,
      LightManager.lightDefaults.shadow,
      darkenAmount
    );
    sprite.tint = Color.toHex(tint);
  }

  public static renderUnderCanopy(
    branches: TreeBranch[],
    leaves: Map<number, Leaf[]>,
    renderable: Renderable,
    species: TreeSpecies,
    leafTextureIndex: number,
    tint: ColorType
  ) {
    if (branches.length > 0) {
      const leafTexture = SystemTreeRenderer.getLeafTexture(
        species,
        leafTextureIndex
      );
      const expandedTint: RGBAColor = [...tint, 1];

      let underLeaves: Leaf[];
      for (let branch of branches) {
        underLeaves = leaves?.get(branch.id) || [];
        underLeaves = underLeaves.filter((leaf) => leaf.underCanopy);
        SystemTreeRenderer.renderLeavesForBranch(
          branch,
          underLeaves,
          renderable as CompositeTilemap,
          species,
          leafTexture,
          expandedTint
        );
      }
    }
  }

  public static renderLeaves(
    branches: TreeBranch[],
    leaves: Map<number, Leaf[]>,
    renderable: Renderable,
    species: TreeSpecies,
    leafTextureIndex: number,
    tint: ColorType
  ) {
    if (branches.length > 0) {
      const leafTexture = SystemTreeRenderer.getLeafTexture(
        species,
        leafTextureIndex
      );
      const expandedTint: RGBAColor = [...tint, 1];
      for (let i = branches.length - 1; i >= 0; i--) {
        const branch = branches[i];
        let overLeaves = leaves?.get(branch.id) || [];
        overLeaves = overLeaves.filter((leaf) => !leaf.underCanopy);

        SystemTreeRenderer.renderLeavesForBranch(
          branch,
          overLeaves,
          renderable as CompositeTilemap,
          species,
          leafTexture,
          expandedTint
        );
      }
    }
    // if (branches.length > 0) {
    //   const leafTexture = SystemTreeRenderer.getLeafTexture(
    //     species,
    //     leafTextureIndex
    //   );
    //   let overLeaves: Leaf[];
    //   for (let branch of branches) {
    //     overLeaves = leaves?.get(branch.id) || [];
    //     overLeaves = overLeaves.filter((leaf) => !leaf.underCanopy);
    //     SystemTreeRenderer.renderLeavesForBranch(
    //       branch,
    //       overLeaves,
    //       renderable as CompositeTilemap,
    //       species,
    //       leafTexture
    //     );
    //   }
    // }
  }

  public static renderLeavesForBranch(
    branch: TreeBranch,
    leaves: Leaf[],
    renderable: CompositeTilemap,
    species: TreeSpecies,
    texture: Texture,
    tint: RGBAColor
  ): CompositeTilemap {
    let segment: Segment;
    let leafTexture: Texture;
    // leafTexture = getItemFromRange(species.textureSet.leaf);
    // leafTexture = SystemTreeRenderer.getLeafTexture(species, index);
    // leafTexture = species.textureSet.leaf[0];
    for (let i = branch.segments.length - 1; i >= 0; i--) {
      segment = branch.segments[i];
      for (let j = leaves.length - 1; j >= 0; j--) {
        const leaf = leaves[j];
        renderable.tile(texture, leaf.position.x, leaf.position.y, {
          // rotate: RNG.getItem([0, 2, 4, 6]),
          alpha: leaf.alpha,
          tint: tint,
        });
      }
    }
    return renderable;
  }

  public static tintTree(
    position: Point,
    renderable: ParticleContainer,
    lightManager: LightManager
  ) {
    let translatedX = Tile.translate(position.x, Layer.TREE, Layer.TERRAIN);
    let translatedY = Tile.translate(position.y, Layer.TREE, Layer.TERRAIN);
    let colorArray = lightManager.getLightFor(translatedX, translatedY, false);
    let color: ColorType = colorArray;
    if (color === undefined) {
      // position is outside of viewport
      return;
    }
    renderable.tint = Color.toHex(color);
  }
}
