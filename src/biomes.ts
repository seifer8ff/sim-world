import { MapType, ValueMap, BiomeMap, MapWorld } from "./map-world";
import { positionToIndex } from "./misc-utility";
import { Layer } from "./renderer";

export const ImpassibleBorder: BiomeId[] = [
  // actors cannot move into or out of these biomes
  // without additional movement or abilities
  // for now, totally impassible
  "ocean",
  "oceandeep",
  "hillslow",
  "hillsmid",
  "hillshigh",
  "valley",
  "snowhillshillsmid",
];

export type BiomeId =
  | "ocean"
  | "beach"
  | "moistdirt"
  | "sandydirt"
  | "hillslow"
  | "hillsmid"
  | "hillshigh"
  | "valley"
  | "grass"
  | "shortgrass"
  | "hillgrass"
  | "swamp"
  | "oceandeep"
  // | "snowsandydirt"
  | "snowmoistdirt"
  | "snowhillshillsmid";

export interface GenerationOptions {
  height?: GenerationOption;
  moisture?: GenerationOption;
  temperature?: GenerationOption;
}

export interface GenerationOption {
  min?: number;
  max?: number;
}

export interface Biome {
  id: BiomeId; // basic identifier for the tileset
  name: string; // human readable name
  description: string; // human readable description
  baseTile: string; // filename of the base tile
  autotilePrefix?: string; // filename prefix to append the tileNumber to: grass_spring_ -> grass_spring_00
  skipAutoTileTypes?: BiomeId[]; // list of biomes that should not be autotiled against (autotile against all but these)
  onlyAutoTileTypes?: BiomeId[]; // list of biomes that should only be autotiled against (autotile against only these)
  color: string;
  generationOptions: GenerationOptions;
}

export class Biomes {
  public static inRangeOf(
    value: number,
    range?: { min?: number; max?: number }
  ): boolean {
    if (!range) {
      return true;
    }
    if (!value) {
      return true;
    }
    if (range.min && value < range.min) {
      return false;
    }
    if (range.max && value > range.max) {
      return false;
    }
    return true;
  }

  public static inRangeOfAll(
    x: number,
    y: number,
    maps: {
      height: Map<number, number>;
      temperature: Map<number, number>;
      moisture: Map<number, number>;
    },
    generationOptions: GenerationOptions
  ): boolean {
    const index = positionToIndex(x, y, Layer.TERRAIN);
    // loop through values in GenerationOptions
    if (generationOptions.height) {
      if (!Biomes.inRangeOf(maps.height.get(index), generationOptions.height)) {
        return false;
      }
    }
    if (generationOptions.moisture) {
      if (
        !Biomes.inRangeOf(maps.moisture.get(index), generationOptions.moisture)
      ) {
        return false;
      }
    }
    if (generationOptions.temperature) {
      if (
        !Biomes.inRangeOf(
          maps.temperature.get(index),
          generationOptions.temperature
        )
      ) {
        return false;
      }
    }
    return true;
  }

  public static shiftToBiome(value: number, option: GenerationOption): number {
    const threshold = 0.01;
    // if below the min, shift to the min
    // if above the max, shift to the max
    if (option?.min && value < option.min) {
      return option.min + threshold;
    }
    if (option?.max && value > option.max) {
      return option.max - threshold;
    }
    return value;
  }

  static readonly Biomes: { [key in BiomeId]: Biome } = {
    ocean: {
      id: "ocean",
      name: "Ocean",
      description: "Salty water- not suitable for drinking.",
      baseTile: "biomes/ocean/ocean_spring_sandydirt_00",
      autotilePrefix: "biomes/ocean/ocean_spring_sandydirt_",
      skipAutoTileTypes: ["oceandeep"],
      color: "#0080e5",
      generationOptions: {
        height: {
          max: 0.5,
        },
      },
    },
    oceandeep: {
      id: "oceandeep",
      name: "Deep Ocean",
      description: "Deep and dark.",
      baseTile: "biomes/oceandeep/oceandeep_ocean_47",
      autotilePrefix: "biomes/oceandeep/oceandeep_spring_ocean_",
      color: "#004db2",
      generationOptions: {
        height: {
          max: 0.25,
        },
      },
    },

    beach: {
      id: "beach",
      name: "Beach",
      description: "Where the ocean meets the land.",
      baseTile: "biomes/beach/beach_spring_sandydirt_47",
      autotilePrefix: "biomes/beach/beach_spring_sandydirt_",
      color: "#e8d36a",
      generationOptions: {
        height: {
          min: 0.5,
          max: 0.52,
        },
      },
    },
    moistdirt: {
      // key will match BiomeType
      id: "moistdirt",
      name: "Dirt",
      description: "Thick soil.",
      baseTile: "biomes/moistdirt/moistdirt_base",
      autotilePrefix: "biomes/snow/snow_spring_moistdirt_", //  moist dirt only tiles against snow
      onlyAutoTileTypes: ["snowmoistdirt"],
      color: "#665b47",
      generationOptions: {
        height: {
          min: 0.52,
        },
        moisture: {
          min: 0.35,
        },
      },
    },
    sandydirt: {
      id: "sandydirt",
      name: "Sandy Dirt",
      description: "The kind with little rocks and sharp bits.",
      baseTile: "biomes/sandydirt/sandydirt_spring_moistdirt_00",
      autotilePrefix: "biomes/sandydirt/sandydirt_spring_moistdirt_",
      skipAutoTileTypes: ["beach", "ocean"],
      color: "#ddd29b",
      generationOptions: {
        height: {
          min: 0.5,
        },
        moisture: {
          min: 0,
          max: 1,
        },
      },
    },
    hillslow: {
      id: "hillslow",
      name: "Low Hills",
      description: "low hills.",
      color: "#6e6864",
      baseTile: "biomes/hillslow/hillslow_spring_moistdirt_47",
      autotilePrefix: "biomes/hillslow/hillslow_spring_moistdirt_",
      skipAutoTileTypes: ["hillsmid", "hillshigh"],
      generationOptions: {
        height: {
          min: 0.64,
          max: 0.7,
        },
      },
    },
    hillsmid: {
      id: "hillsmid",
      name: "Mid Hills",
      description: "Mid hills.",
      color: "#918379",
      baseTile: "biomes/hillsmid/hillsmid_spring_moistdirt_47",
      autotilePrefix: "biomes/hillsmid/hillsmid_spring_moistdirt_",
      skipAutoTileTypes: ["hillshigh", "snowhillshillsmid"],
      generationOptions: {
        height: {
          min: 0.7,
          max: 0.78,
        },
      },
    },
    hillshigh: {
      id: "hillshigh",
      name: "High Hills",
      description: "High hills.",
      color: "#b59e8d",
      baseTile: "biomes/hillshigh/hillshigh_spring_moistdirt_47",
      autotilePrefix: "biomes/hillshigh/hillshigh_spring_moistdirt_",
      // skipAutoTileTypes: ["hillsmid", "hillslow"],
      generationOptions: {
        height: {
          min: 0.78,
        },
      },
    },
    grass: {
      id: "grass",
      name: "Wild Grass",
      description: "Tall grass perfect for small animals to hide in.",
      color: "#74c857",
      baseTile: "biomes/grass/grass_spring_moistdirt_47",
      autotilePrefix: "biomes/grass/grass_spring_moistdirt_",
      generationOptions: {
        moisture: {
          min: 0.5,
          max: 0.7,
        },
        temperature: {
          min: 0.4,
          max: 0.7,
        },
      },
    },
    shortgrass: {
      id: "shortgrass",
      name: "Short Grass",
      description: "Pleasantly short grass, found commonly most everywhere.",
      color: "#74c857",
      baseTile: "biomes/shortgrass/shortgrass_spring_moistdirt_47",
      autotilePrefix: "biomes/shortgrass/shortgrass_spring_moistdirt_",
      generationOptions: {
        moisture: {
          min: 0.6,
          max: 0.8,
        },
        temperature: {
          min: 0.28,
          max: 0.6,
        },
      },
    },
    hillgrass: {
      id: "hillgrass",
      name: "Pale Grass",
      description: "Prickly and pale, this grass thrives at higher elevations.",
      color: "#398350",
      baseTile: "biomes/forestgrass/forestgrass_spring_moistdirt_47",
      autotilePrefix: "biomes/forestgrass/forestgrass_spring_moistdirt_",
      generationOptions: {
        height: {
          min: 0.75,
        },
        moisture: {
          min: 0.65,
          max: 0.8,
        },
      },
    },
    swamp: {
      id: "swamp",
      name: "Swamp",
      description: "The murky water could be hiding anything...",
      baseTile: "biomes/swamp/swamp_spring_moistdirt_47",
      autotilePrefix: "biomes/swamp/swamp_spring_moistdirt_",
      color: "#606d4c",
      generationOptions: {
        height: {
          min: 0.5,
          max: 0.6,
        },
        moisture: {
          min: 0.8,
        },
        temperature: {
          min: 0.5,
          max: 0.8,
        },
      },
    },
    valley: {
      id: "valley",
      name: "Valley",
      description: "A low-lying area protected by hills.",
      baseTile: "biomes/valley/valley_spring_moistdirt_47",
      autotilePrefix: "biomes/valley/valley_spring_moistdirt_",
      color: "#8df48d",
      generationOptions: {
        height: {
          min: 0.5,
          max: 0.6,
        },
        moisture: {
          min: 0.5,
          max: 0.8,
        },
        temperature: {
          min: 0.4,
          max: 0.8,
        },
      },
    },
    // snowsandydirt: {
    //   id: "snowsandydirt",
    //   name: "Snow",
    //   description: "A blanket of snow covers the ground.",
    //   baseTile: "biomes/snow/snow_base",
    //   // autotilePrefix: "biomes/sandydirt/sandydirt_spring_snow_",
    //   color: "#fefefe",
    //   generationOptions: {
    //     height: {
    //       min: 0.6,
    //     },
    //     temperature: {
    //       max: 0.3,
    //     },
    //   },
    // },
    snowmoistdirt: {
      id: "snowmoistdirt",
      name: "Snow",
      description: "A blanket of snow covers the ground.",
      baseTile: "biomes/snow/snow_base",
      // autotilePrefix: "biomes/snow/snow_spring_moistdirt_",
      color: "#fefefe",
      generationOptions: {
        height: {
          min: 0.6,
        },
        // moisture: {
        //   min: 0.3,
        // },
        temperature: {
          max: 0.3,
        },
      },
    },
    snowhillshillsmid: {
      id: "snowhillshillsmid",
      name: "Snow",
      description: "A blanket of snow covers the ground.",
      baseTile: "biomes/snowhills/snowhills_spring_hillsmid_47",
      autotilePrefix: "biomes/snowhills/snowhills_spring_hillsmid_",
      color: "#c2eaf0",
      generationOptions: {
        height: {
          min: 0.6,
        },
        // moisture: {
        //   min: 0.3,
        // },
        temperature: {
          max: 0.3,
        },
      },
    },
  };

  constructor() {}

  public static getBiome(id: BiomeId): Biome {
    return Biomes.Biomes[id];
  }
}
