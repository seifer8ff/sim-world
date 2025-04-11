import { Texture } from "pixi.js";
import { BiomeId } from "./biomes";
import { Point } from "./point";
import { Layer } from "./renderer";
import {
  AnimationMap,
  defaultAnimationMap,
  cowAnimationMap,
  mushroomAnimationMap,
} from "./components/animator";

export interface Tile {
  // unique identifier for the tile
  // used to lookup the cached tile sprite and class data
  readonly id: number;
  // path to the sprite image file. sprite gets loaded into cache by this path
  // for animated sprites, this is the path to the icon, used in menus, etc
  readonly spritePath: string;
  readonly color: string; // color used for simple rendering or debugging, in place of sprite
  // path for animation manifest (i.e. sprites/cow_00/cow_00.json). required for animated sprites
  // manifest contains a list of animation frame data
  readonly animationPath?: string;
  // map of animation types to their keys, required for animated sprites
  readonly animationMap?: AnimationMap;
  // ID for the biome this tile belongs to, if applicable (just terrain tiles).
  // useful for looking up biome without having to access large map files
  readonly biomeId?: BiomeId;
}

export const BaseTileKey = "base";

export interface Tileset {
  [tilesetIdentifier: string]: {
    [season: string]: {
      [tileName: string]: Tile;
    };
  };
}

export class Tile implements Tile {
  static readonly size = 32; // target size for terrain layer
  static readonly denseSize = 8; // target and actual pixel size of dense layer tiles
  static readonly terrainTilePixelSize = 16; // actual pixel size of each terrain tile on disk
  static readonly tileDensityRatio = Tile.size / Tile.denseSize;
  static Tilesets: Tileset = {};
  static tiles: Tile[] = []; // all tiles, indexed by their unique id
  static textures: Texture[] = []; // array of textures for all tiles, indexed by their unique id
  private static currentId = 0;

  static readonly mushroom = new Tile(
    "idle_000",
    "#C1BF69",
    "sprites/mushroom_00/mushroom_00.json",
    mushroomAnimationMap
  );
  static readonly cow = new Tile(
    "walk_down/walk_down_000",
    "#C1BF69",
    "sprites/cow_00/cow_00.json",
    cowAnimationMap
  );
  static readonly seagull = new Tile(
    "up/bird_seagull_up_000",
    "#C1BF69",
    "sprites/bird_seagull/bird_seagull.json",
    defaultAnimationMap
  );
  static readonly sharkBlue = new Tile(
    "right/right_000",
    "#C1BF69",
    "sprites/shark_blue/shark_blue.json",
    defaultAnimationMap
  );

  constructor(
    public readonly spritePath: string,
    public readonly color: string,
    public readonly animationPath?: string, // optional path for animation frames, if any
    public readonly animationMap?: AnimationMap, // optional map of animation types to their keys
    public readonly biomeId?: BiomeId, // biome id for terrain tiles
    public readonly id: number = Tile.currentId++ // unique id for this tile
  ) {}

  public static isDenseLayer(layer: Layer): boolean {
    return layer === Layer.GROUNDCOVER || layer === Layer.SMALLACTOR;
  }

  public static translatePoint(position: Point, from: Layer, to: Layer): Point {
    if (from === to) return position;

    const ratio = Tile.isDenseLayer(from)
      ? 1 / Tile.tileDensityRatio
      : Tile.tileDensityRatio;
    return new Point(
      Math.floor(position.x * ratio),
      Math.floor(position.y * ratio)
    );
  }

  // translate x or y position from one layer to another
  public static translate(
    positionParameter: number,
    from: Layer,
    to: Layer
  ): number {
    if (from === to) return positionParameter;

    if (this.isDenseLayer(from)) {
      return Math.floor(positionParameter / Tile.tileDensityRatio);
    } else if (this.isDenseLayer(to)) {
      return Math.floor(positionParameter * Tile.tileDensityRatio);
    }
    return Math.floor(positionParameter);
  }
}
