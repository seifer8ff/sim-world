import { Texture } from "pixi.js";
import { BiomeId } from "./biomes";
import { Point } from "./point";
import { Layer } from "./renderer";
import { Season } from "./time-manager";

// tile name/index for non-autotile tiles. The base sprite is used for all variations
export const BaseTileKey = -999;

export interface Tileset {
  [tilesetIdentifier: string]: {
    [season: string]: {
      [tileName: string]: number;
    };
  };
}

// TODO: Turn this into a system, and tiles into actors maybe
export class Tile {
  static readonly size = 32; // target size for terrain layer
  static readonly denseSize = 8; // target and actual pixel size of dense layer tiles
  static readonly terrainTilePixelSize = 16; // actual pixel size of each terrain tile on disk
  static readonly tileDensityRatio = Tile.size / Tile.denseSize;
  static Tilesets: Tileset = {}; // tiles organized by biome and season, used in tilemap
  static textures: Texture[] = []; // array of textures for all tiles, indexed by their unique id
  public static currentId = 0;

  constructor() {}

  // generates a unique tileId for a given biome, season, and tile number
  public static generateTileId(
    biomeId: BiomeId,
    season: string,
    tileName: string | number
  ): number {
    return Tile.Tilesets[biomeId][season][tileName];
  }

  public static getTileId(biomeId: BiomeId, season: Season, tileName: number) {
    return Tile.Tilesets[biomeId][season][tileName];
  }

  public static isDenseLayer(layer: Layer): boolean {
    return layer === Layer.GROUNDCOVER || layer === Layer.SMALLACTOR;
  }

  public static translatePoint(position: Point, from: Layer, to: Layer): Point {
    if (from === to) return position;

    return new Point(
      Tile.translate(position.x, from, to),
      Tile.translate(position.y, from, to)
    );
  }

  // translate x or y position from one layer to another
  public static translate(
    positionParameter: number,
    from: Layer,
    to: Layer
  ): number {
    if (from === to) return positionParameter;

    let ratio = 1;
    if (Tile.isDenseLayer(from)) {
      ratio = 1 / Tile.tileDensityRatio;
    } else if (Tile.isDenseLayer(to)) {
      ratio = Tile.tileDensityRatio;
    }
    return Math.floor(positionParameter * ratio);
  }
}
