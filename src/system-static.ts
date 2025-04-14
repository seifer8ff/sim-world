import { ActorBase } from "./actor";
import { Query } from "miniplex";
import { Layer, Renderer } from "./renderer";
import { Camera, Viewport } from "./camera";
import { Tile } from "./tile";
import { indexToPosition } from "./misc-utility";
import { LightManager, RGBAColor } from "./light-manager";
import { Texture } from "pixi.js";
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
      tileTexture = SystemStatic.getTextureFor(
        Species.allSpecies[species],
        Layer.GROUNDCOVER
      );
      if (!tileTexture) continue;

      let { x, y } = position;
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

      if (Camera.inViewport(x, y, layer, viewport)) {
        groundCoverLayer.tile(
          tileTexture,
          Math.floor(x * denseSize - halfTileSize),
          Math.floor(y * denseSize - halfTileSize),
          { alpha: 1, tint: tint }
        );
      }
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
        renderer.renderDisplayObject(sprite, layer);
      }
    }
  }
}
