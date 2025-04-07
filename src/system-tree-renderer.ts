import { ActorBase } from "./entities/actor";
import { TreeSpecies } from "./entities/tree/tree-species";
import {
  getItemFromRange,
  getNumberFromRange,
  inverseLerp,
} from "./misc-utility";
import { Color, RNG } from "rot-js";
import { ParticleContainer, Sprite, Texture } from "pixi.js";

import { Point } from "./point";
import { Layer, Renderable, Renderer } from "./renderer";
import { GameSettings } from "./game-settings";

import { Game } from "./game";
import { Tile } from "./tile";
import { Color as ColorType } from "rot-js/lib/color";
import { clamp } from "lodash";
import { LightManager, RGBAColor } from "./light-manager";
import { CompositeTilemap } from "./libs/pixi-tilemap.es";
import { Query } from "miniplex";
import { Viewport } from "./camera";

// handle spawning, updating, and rendering of tree leaves
export class SystemTreeRenderer {
  constructor() {}

  // public static getRandomTrunkBaseTexture(species: TreeSpecies): number {
  //   return RNG.getUniformInt(0, species.spriteSet.trunkBase.length - 1);
  // }

  // public static getRandomTrunkTexture(species: TreeSpecies): number {
  //   return RNG.getUniformInt(0, species.spriteSet.trunk.length - 1);
  // }

  // public static getRandomLeafTexture(species: TreeSpecies): number {
  //   return RNG.getUniformInt(0, species.spriteSet.leaf.length - 1);
  // }

  public static getTrunkBaseTexture(species: TreeSpecies, index: number) {
    return species.spriteSet.trunkBase[index];
  }

  public static drawTrunkBase(
    actors: Query<ActorBase>,
    renderer: Renderer,
    viewport?: Viewport
  ): void {
    let tileVisible;
    for (const { tile, trunkBaseSprite, position, layer } of actors) {
      tileVisible = false;
      // console.log("draw trunk base", trunkBaseSprite, position, Layer[layer]);
      // console.log("tile ID", Tile.Tilesets, Tile.tiles);
      // console.log("draw trunk base, tile", tile, Tile.tiles[tile]);
      // renderer.addTileIdToScene(position, layer, trunkBaseSprite as any);
      if (viewport) {
        const halfWidth = viewport.width / 2;
        const halfHeight = viewport.height / 2;

        const viewportLeft = viewport.center.x - halfWidth;
        const viewportRight = viewport.center.x + halfWidth;
        const viewportTop = viewport.center.y - halfHeight;
        const viewportBottom = viewport.center.y + halfHeight;

        let { x, y } = position;
        x = Tile.translate(x, Layer.SMALLACTOR, Layer.TERRAIN);
        y = Tile.translate(y, Layer.SMALLACTOR, Layer.TERRAIN);

        if (
          x >= viewportLeft &&
          x <= viewportRight &&
          y >= viewportTop &&
          y <= viewportBottom
        ) {
          // return true;
          tileVisible = true;
        }
      } else {
        tileVisible = true;
      }
      if (tileVisible) {
        renderer.addTileIdToScene(position, layer, tile);
      }
    }
  }

  public static drawCanopy(
    actors: Query<ActorBase>,
    renderer: Renderer,
    viewport?: Viewport
  ): void {
    let tileVisible;
    for (const { canopySprite, tile, position } of actors) {
      tileVisible = false;
      if (viewport) {
        const halfWidth = viewport.width / 2;
        const halfHeight = viewport.height / 2;

        const viewportLeft = viewport.center.x - halfWidth;
        const viewportRight = viewport.center.x + halfWidth;
        const viewportTop = viewport.center.y - halfHeight;
        const viewportBottom = viewport.center.y + halfHeight;

        let { x, y } = position;
        x = Tile.translate(x, Layer.SMALLACTOR, Layer.TERRAIN);
        y = Tile.translate(y, Layer.SMALLACTOR, Layer.TERRAIN);

        if (
          x >= viewportLeft &&
          x <= viewportRight &&
          y >= viewportTop &&
          y <= viewportBottom
        ) {
          // return true;
          tileVisible = true;
        }
      } else {
        tileVisible = true;
      }
      if (tileVisible) {
        renderer.addTileIdToScene(position, Layer.CANOPY, Tile.treeCanopy.id);
      }
    }
  }

  // public static getTrunkTexture(species: TreeSpecies, index: number) {
  //   return species.spriteSet.trunk[index];
  // }

  // public static getLeafTexture(species: TreeSpecies, index: number) {
  //   return species.spriteSet.leaf[index];
  // }

  public static renderTrunkBase(
    renderer: Renderer,
    position: Point,
    tileId: number
  ) {
    // renderer.addToScene(position, Layer.SMALLACTOR, renderable);
    // console.log("add tree tile Id to scene", tileId, Tile.tiles[tileId]);
    // renderer.addTileIdToScene(position, Layer.SMALLACTOR, tileId);
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

  // public static tintSegmentSprite(sprite: Sprite, yPos: number) {
  //   let tint = LightManager.lightDefaults.fullLight;
  //   let darkenAmount = inverseLerp(yPos, -45, 5);
  //   darkenAmount = clamp(darkenAmount, 0, 0.16);
  //   tint = Color.interpolate(
  //     tint,
  //     LightManager.lightDefaults.shadow,
  //     darkenAmount
  //   );
  //   sprite.tint = Color.toHex(tint);
  // }

  // public static renderUnderCanopy(
  //   branches: TreeBranch[],
  //   leaves: Map<number, Leaf[]>,
  //   renderable: Renderable,
  //   species: TreeSpecies,
  //   leafTextureIndex: number,
  //   tint: ColorType
  // ) {
  //   if (branches.length > 0) {
  //     const leafTexture = SystemTreeRenderer.getLeafTexture(
  //       species,
  //       leafTextureIndex
  //     );
  //     const expandedTint: RGBAColor = [...tint, 1];

  //     let underLeaves: Leaf[];
  //     for (let branch of branches) {
  //       underLeaves = leaves?.get(branch.id) || [];
  //       underLeaves = underLeaves.filter((leaf) => leaf.underCanopy);
  //       SystemTreeRenderer.renderLeavesForBranch(
  //         branch,
  //         underLeaves,
  //         renderable as CompositeTilemap,
  //         species,
  //         leafTexture,
  //         expandedTint
  //       );
  //     }
  //   }
  // }

  public static tintTree(
    position: Point,
    renderable: ParticleContainer,
    lightManager: LightManager
  ) {
    let translatedX = Tile.translate(
      position.x,
      Layer.SMALLACTOR,
      Layer.TERRAIN
    );
    let translatedY = Tile.translate(
      position.y,
      Layer.SMALLACTOR,
      Layer.TERRAIN
    );
    const colorArray = lightManager.getLightFor(
      translatedX,
      translatedY,
      false
    ) as ColorType;
    const color: ColorType = colorArray;
    if (color === undefined) {
      // position is outside of viewport
      return;
    }
    renderable.tint = Color.toHex(color);
  }
}
