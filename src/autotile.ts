import { Biome, BiomeType, TileType } from "./tile";

export class Autotile {
  static NW = Math.pow(2, 0);
  static N = Math.pow(2, 1);
  static NE = Math.pow(2, 2);
  static W = Math.pow(2, 3);
  static E = Math.pow(2, 4);
  static SW = Math.pow(2, 5);
  static S = Math.pow(2, 6);
  static SE = Math.pow(2, 7);

  static BITMASK = {
    2: 44,
    8: 45,
    10: 39,
    11: 38,
    16: 43,
    18: 41,
    22: 40,
    24: 33,
    26: 31,
    27: 30,
    30: 29,
    31: 28,
    64: 42,
    66: 32,
    72: 37,
    74: 27,
    75: 25,
    80: 35,
    82: 19,
    86: 18,
    88: 21,
    90: 15,
    91: 14,
    94: 13,
    95: 12,
    104: 36,
    106: 26,
    107: 24,
    120: 21,
    122: 7,
    123: 6,
    126: 5,
    127: 4,
    208: 34,
    210: 17,
    214: 16,
    216: 22,
    218: 11,
    219: 10,
    222: 9,
    223: 8,
    248: 20,
    250: 3,
    251: 2,
    254: 1,
    255: 47,
    0: 46,
  };

  public static areValidNeighborBiomes(
    neighborBiome: Biome,
    tileBiome: Biome
  ): boolean {
    if (tileBiome?.biome == "oceandeep" && neighborBiome?.biome == "ocean") {
      return false;
    }

    if (
      tileBiome?.biome == "forestgrass" &&
      neighborBiome?.biome == "grassland"
    ) {
      return false;
    }

    if (
      tileBiome?.biome == "swampdirt" &&
      neighborBiome?.biome == "grassland"
    ) {
      return false;
    }

    if (tileBiome?.biome == "hills" && neighborBiome?.biome == "grassland") {
      return false;
    }

    if (
      tileBiome?.biome == "grassland" &&
      neighborBiome?.biome == "forestgrass"
    ) {
      return true;
    }

    if (neighborBiome == null) {
      return false;
    }

    return true;
  }

  public static shouldAutoTile(
    mapObject: { [pos: string]: Biome },
    x: number,
    y: number,
    tileBiome: Biome
  ): boolean {
    const skipAutoTileTypes: BiomeType[] = ["dirt", "dirttextured"];
    if (skipAutoTileTypes.includes(tileBiome?.biome)) {
      return false;
    }

    const neighborPositions = [
      [x, y - 1], // north
      [x - 1, y], // west
      [x + 1, y], // east
      [x, y + 1], // south
      [x - 1, y - 1], // northwest
      [x + 1, y - 1], // northeast
      [x - 1, y + 1], // southwest
      [x + 1, y + 1], // southeast
    ];

    for (const [nx, ny] of neighborPositions) {
      if (
        !Autotile.areValidNeighborBiomes(tileBiome, mapObject[`${nx},${ny}`])
      ) {
        return false;
      }
    }

    return true;
  }

  public static autotileLookup(
    mapObject: { [pos: string]: Biome },
    x_boundary: number,
    y_boundary: number,
    x: number,
    y: number,
    tileBiome: Biome
  ): number {
    let sum = 0;
    let n = false;
    let e = false;
    let s = false;
    let w = false;

    if (y > 0 && mapObject[`${x},${y - 1}`].biome == tileBiome.biome) {
      n = true;
      sum += Autotile.N;
    }
    if (x > 0 && mapObject[`${x - 1},${y}`].biome == tileBiome.biome) {
      w = true;
      sum += Autotile.W;
    }
    if (x < x_boundary && mapObject[`${x + 1},${y}`].biome == tileBiome.biome) {
      e = true;
      sum += Autotile.E;
    }
    if (y < y_boundary && mapObject[`${x},${y + 1}`].biome == tileBiome.biome) {
      s = true;
      sum += Autotile.S;
    }

    if (
      n &&
      w &&
      y > 0 &&
      x > 0 &&
      mapObject[`${x - 1},${y - 1}`].biome == tileBiome.biome
    )
      sum += Autotile.NW;
    if (
      n &&
      e &&
      y > 0 &&
      x < x_boundary &&
      mapObject[`${x + 1},${y - 1}`].biome == tileBiome.biome
    )
      sum += Autotile.NE;
    if (
      s &&
      w &&
      y < y_boundary &&
      x > 0 &&
      mapObject[`${x - 1},${y + 1}`].biome == tileBiome.biome
    )
      sum += Autotile.SW;
    if (
      s &&
      e &&
      x < x_boundary &&
      y < y_boundary &&
      mapObject[`${x + 1},${y + 1}`].biome == tileBiome.biome
    )
      sum += Autotile.SE;

    return Autotile.BITMASK[sum];
  }

  public static autotile(mapObject: { [pos: string]: Biome }): {
    [pos: string]: TileType;
  } {
    console.log("autotile rawMapObj: ", mapObject);
    const tiles = {};
    const mapKeys = Object.keys(mapObject);
    const [maxX, maxY] = mapKeys.reduce(
      (acc, key) => {
        const [x, y] = key.split(",").map(Number);
        acc[0] = Math.max(acc[0], x);
        acc[1] = Math.max(acc[1], y);
        return acc;
      },
      [0, 0]
    );

    for (let y = 0; y <= maxY; y++) {
      for (let x = 0; x <= maxX; x++) {
        const key = `${x},${y}`;
        const tileValue = mapObject[key];

        if (!this.shouldAutoTile(mapObject, x, y, tileValue)) {
          tiles[key] = 47;
          continue;
        }

        tiles[key] = Autotile.autotileLookup(
          mapObject,
          maxX,
          maxY,
          x,
          y,
          tileValue
        );
      }
    }

    console.log("autotiled map: ", tiles);

    return tiles;
  }
}
