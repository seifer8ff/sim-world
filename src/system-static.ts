import { ActorBase } from "./actor";
import { Query } from "miniplex";
import { Layer, Renderer } from "./renderer";
import { Camera, Viewport } from "./camera";
import { Tile } from "./tile";
import { indexToPosition } from "./misc-utility";
import { LightManager, RGBAColor } from "./light-manager";
import { DisplayObject, Texture } from "pixi.js";
import { MapWorld } from "./map-world";
import { Color as ColorType } from "rot-js/lib/color";
import { Species, SpeciesId } from "./species";
import { RNG } from "rot-js";
import { IconLayer } from "./data-actors";

// handle drawing not animated sprites
export class SystemStatic {
  public static textures: {
    [key in SpeciesId]?: { [key in Layer]?: Texture[] };
  } = {};

  constructor() {}

  public static getTextureFor(
    species: Species,
    layer: Layer | IconLayer,
    index?: number
  ): Texture {
    if (!species.spriteSet[layer]) return null;
    if (index === undefined) {
      index = RNG.getUniformInt(0, species.spriteSet[layer].length - 1);
    }
    return SystemStatic.textures[species.id][layer][index];
  }

  public static getIconForSpecies(speciesId: SpeciesId): Texture {
    return SystemStatic.getTextureFor(
      Species.allSpecies[speciesId],
      IconLayer.ICON
    );
  }

  public static renderTerrainTiles(
    tileIds: number[],
    renderer: Renderer,
    lightManager: LightManager,
    map: MapWorld
  ) {
    const tileSize = Tile.size;
    const halfTileSize = Tile.size / 2;
    let tileTexture: Texture | undefined = undefined;

    for (const tileIndex of tileIds) {
      if (tileIndex === -1) {
        continue;
      }

      const { x, y } = indexToPosition(tileIndex, Layer.TERRAIN);
      const tint = lightManager.getLightFor(x, y, false, true) as RGBAColor;

      const tileId = map.getTileIdByIndex(tileIndex); // tileIndex is always terrain density
      if (!tileId || tileId === -1) continue;

      tileTexture = Tile.textures[tileId];
      if (!tileTexture) return;

      const terrainLayer = renderer.terrainLayer[0];
      const scaleX = terrainLayer.scale.x;
      const scaleY = terrainLayer.scale.y;

      terrainLayer.tile(
        tileTexture,
        Math.floor(x * (tileSize / scaleX) - halfTileSize / scaleX),
        Math.floor(y * (tileSize / scaleY) - halfTileSize / scaleY),
        { alpha: 1, tint: tint }
      );
    }
  }

  // public static renderGroundCover(
  //   actors: Query<ActorBase>,
  //   renderer: Renderer,
  //   lightManager: LightManager,
  //   viewport: Viewport
  // ): void {
  //   const denseSize = Tile.denseSize;
  //   const halfTileSize = Tile.size / 2;
  //   const groundCoverLayer = renderer.groundCoverLayer[0];
  //   let tileTexture: Texture | undefined = undefined;
  //   let tint: ColorType;
  //   let actor: ActorBase;

  //   const denseRatio = Tile.tileDensityRatio;

  //   for (const tileIndex of viewport.tiles) {
  //     let terrainPos = indexToPosition(tileIndex, Layer.TERRAIN);
  //     const startGroundCoverPos = Tile.translatePoint(
  //       terrainPos,
  //       Layer.TERRAIN,
  //       Layer.GROUNDCOVER
  //     );
  //     let groundCoverPos = new Point(
  //       startGroundCoverPos.x,
  //       startGroundCoverPos.y
  //     );

  //     for (let dx = 0; dx < denseRatio; dx++) {
  //       for (let dy = 0; dy < denseRatio; dy++) {
  //         groundCoverPos.x = startGroundCoverPos.x + dx;
  //         groundCoverPos.y = startGroundCoverPos.y + dy;
  //         if (ManagerShrubs.isShrubAt(groundCoverPos.x, groundCoverPos.y)) {
  //           actor = ManagerShrubs.getShrubAt(
  //             groundCoverPos.x,
  //             groundCoverPos.y
  //           );
  //           // if (!actor) continue;
  //           tint = lightManager.getLightFor(
  //             terrainPos.x,
  //             terrainPos.y,
  //             false,
  //             true
  //           ) as ColorType;

  //           tileTexture = SystemStatic.getTextureFor(
  //             Species.allSpecies[actor.species],
  //             Layer.GROUNDCOVER
  //           );
  //           if (!tileTexture) continue;

  //           groundCoverLayer.tile(
  //             tileTexture,
  //             Math.floor(groundCoverPos.x * denseSize - halfTileSize),
  //             Math.floor(groundCoverPos.y * denseSize - halfTileSize),
  //             { alpha: 1, tint: tint }
  //           );
  //         }
  //       }
  //     }
  //   }
  // }

  public static renderGroundCover(
    actors: Query<ActorBase>,
    renderer: Renderer,
    lightManager: LightManager,
    viewport: Viewport
  ): void {
    const denseSize = Tile.denseSize;
    const halfTileSize = Tile.size / 2;

    const groundCoverLayer = renderer.groundCoverLayer[0];
    let tileTexture: Texture | undefined = undefined;
    let tint: ColorType;

    for (const { position, layer, species } of actors) {
      if (!Camera.inViewport(position.x, position.y, layer, viewport)) {
        continue;
      }
      tileTexture = SystemStatic.getTextureFor(
        Species.allSpecies[species],
        Layer.GROUNDCOVER
      );
      if (!tileTexture) continue;

      let terrainPos = Tile.translatePoint(
        position,
        layer, // actor's layer
        Layer.TERRAIN // translate to terrain layer for distance calculation
      );
      tint = lightManager.getLightFor(
        terrainPos.x,
        terrainPos.y,
        false,
        true
      ) as ColorType;

      groundCoverLayer.tile(
        tileTexture,
        Math.floor(position.x * denseSize - halfTileSize),
        Math.floor(position.y * denseSize - halfTileSize),
        { alpha: 1, tint: tint }
      );
    }
  }

  public static renderUI(
    actors: Query<ActorBase>,
    renderer: Renderer,
    viewport: Viewport
  ): void {
    for (const { sprite, position, layer } of actors) {
      let { x, y } = position;

      if (Camera.inViewport(x, y, layer, viewport)) {
        renderer.renderDisplayObject(sprite as DisplayObject, layer);
      }
    }
  }
}
