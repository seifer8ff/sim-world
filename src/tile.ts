import { BiomeId } from "./biomes";
import { Point } from "./point";
import { Layer } from "./renderer";

// high level types
export const enum TileType {
  Terrain,
  Entity,
  Plant,
  Player, // later: any tile can be marked as the player
}

// combined enum of specific types of TileTypes
// can be used for pathing, z index, etc
export enum TileSubType {
  Human = "Human",
  Animal = "Animal", // land dweller
  Fish = "Fish", // water dweller
  Bird = "Bird", // air dweller
  Shrub = "Shrub",
  Tree = "Tree",
}

export const BaseTileKey = "base";

export interface Tileset {
  [tilesetIdentifier: string]: {
    [season: string]: {
      [tileName: string]: Tile;
    };
  };
}

export class Tile {
  private static currentId = 0;

  static readonly size = 32;
  static readonly denseSize = 8;
  static readonly terrainTilePixelSize = 16; // actual pixel size of each terrain tile on disk
  static readonly tileDensityRatio = Tile.size / Tile.denseSize;
  static readonly player = new Tile(
    TileType.Player,
    "human_00",
    "human_00",
    "#D2D2D2"
  );
  static readonly person = new Tile(
    TileType.Entity,
    "human_00",
    "human_00",
    "#E7E6AC"
  );
  static readonly mushroom = new Tile(
    TileType.Entity,
    "sprites/mushroom_00/mushroom_00.json",
    "idle_000",
    "#C1BF69",
    ["idle"]
  );
  static readonly cow = new Tile(
    TileType.Entity,
    "sprites/cow_00/cow_00.json",
    "walk_down/walk_down_000",
    "#C1BF69",
    ["walk_up", "walk_right", "walk_left", "walk_down"]
  );
  static readonly seagull = new Tile(
    TileType.Entity,
    "sprites/bird_seagull/bird_seagull.json",
    "up/bird_seagull_up_000",
    "#C1BF69",
    ["up", "right", "left", "down"]
  );
  static readonly sharkBlue = new Tile(
    TileType.Entity,
    "sprites/shark_blue/shark_blue.json",
    "right/right_000",
    "#C1BF69",
    ["up", "right", "left", "down"]
  );
  static readonly shrub = new Tile(
    TileType.Plant,
    "plant-8x8",
    "plant-8x8",
    "#95C577"
  );
  static readonly tree = new Tile(
    TileType.Plant,
    "tree-trunk",
    "tree-trunk",
    "#95C577"
  );

  static Tilesets: Tileset = {};
  static tiles: Tile[] = []; // all tiles, indexed by their unique id
  // sprite: Sprite | AnimatedSprite | Graphics;
  public readonly id: number;

  constructor(
    public readonly type: TileType,
    public readonly spritePath: string,
    public readonly iconPath: string,
    public readonly color: string,
    public readonly animationKeys?: string[],
    // public readonly animated: boolean = false,
    public readonly biomeId?: BiomeId
  ) {
    this.id = Tile.currentId++;
    // if (animated) {
    //   const animations = Assets.cache.get(this.spritePath).data.frames;
    //   const animKeys = Object.keys(animations).sort();
    //   this.sprite = AnimatedSprite.fromFrames(animKeys);
    //   // (this.sprite as AnimatedSprite).animationSpeed =
    //   //   this.game.options.animationSpeed * this.game.timeManager.timeScale;
    //   (this.sprite as AnimatedSprite).loop = true;
    //   (this.sprite as AnimatedSprite).play();
    // } else {
    //   this.sprite = Sprite.from(this.spritePath);
    // }
  }

  public static translatePoint(position: Point, from: Layer, to: Layer): Point {
    if (from === to) return position;

    if (from === Layer.PLANT || from === Layer.TREE) {
      return new Point(
        Math.floor(position.x / Tile.tileDensityRatio),
        Math.floor(position.y / Tile.tileDensityRatio)
      );
    } else if (to === Layer.PLANT || to === Layer.TREE) {
      return new Point(
        position.x * Tile.tileDensityRatio,
        position.y * Tile.tileDensityRatio
      );
    }
    return position;
  }

  // translate x or y position from one layer to another
  public static translate(
    positionParameter: number,
    from: Layer,
    to: Layer
  ): number {
    if (from === to) return positionParameter;

    if (from === Layer.PLANT || from === Layer.TREE) {
      return Math.floor(positionParameter / Tile.tileDensityRatio);
    } else if (to === Layer.PLANT || to === Layer.TREE) {
      return Math.floor(positionParameter * Tile.tileDensityRatio);
    }
    return Math.floor(positionParameter);
  }
}
