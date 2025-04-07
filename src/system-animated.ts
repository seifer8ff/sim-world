import { ActorBase } from "./entities/actor";
import { Query } from "miniplex";
import { Layer, Renderer } from "./renderer";
import { Tile } from "./tile";
import { Viewport } from "./camera";

// handle animating sprites
export class SystemAnimated {
  constructor() {}

  public static drawAnimated(
    actors: Query<ActorBase>,
    renderer: Renderer,
    viewport?: Viewport
  ): void {
    let tileVisible;
    for (const { sprite, position } of actors) {
      tileVisible = false;
      if (viewport) {
        const halfWidth = viewport.width / 2;
        const halfHeight = viewport.height / 2;

        const viewportLeft = viewport.center.x - halfWidth;
        const viewportRight = viewport.center.x + halfWidth;
        const viewportTop = viewport.center.y - halfHeight;
        const viewportBottom = viewport.center.y + halfHeight;

        let { x, y } = position;
        // x = Tile.translate(x, Layer.SMALLACTOR, Layer.TERRAIN);
        // y = Tile.translate(y, Layer.SMALLACTOR, Layer.TERRAIN);

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
        renderer.addToScene(position, Layer.ACTOR, sprite);
      }
    }
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

  public static setAnimatorSpeed(
    actors: Query<ActorBase>,
    timeScale: number
  ): void {
    for (const { animator } of actors) {
      animator.scaleAnimSpeed(timeScale);
    }
  }
}
