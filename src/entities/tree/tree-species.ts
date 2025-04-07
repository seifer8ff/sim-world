import { Sprite, Texture } from "pixi.js";
import { Tile } from "../../tile";

// textures, including variations, for tree
export interface TreeSpriteSet {
  trunkBase: string[];
  canopy: string[];
}

export interface PlantSpecies {
  id: string;
  name: string;
  iconPath: string;
  spriteSet: TreeSpriteSet;
  growthOptions: PlantGrowthOptions;
}

export interface TreeSpeciesDef {
  id: TreeSpeciesID;
  name: string;
  iconPath: string;
  spriteSet: {
    trunkBase: string[];
    canopy: string[];
  };
  growthOptions: PlantGrowthOptions;
}

export interface PlantGrowthOptions {
  temperature: {
    min: number;
    max: number;
  };
  moisture: {
    min: number;
    max: number;
  };
  height: {
    min: number;
    max: number;
  };
  light: {
    min: number;
    max: number;
  };
}

export type TreeSpeciesID = "pine" | "birch" | "maple" | "cottoncandy";

export enum TreeSpeciesEnum {
  PINE = "pine",
  BIRCH = "birch",
  MAPLE = "maple",
  COTTONCANDY = "cottoncandy",
}

export class TreeSpecies {
  static treeSpecies: {
    [key in TreeSpeciesID as string]: TreeSpecies;
  } = {};
  public id: TreeSpeciesID;
  public name: string;
  public iconPath: string;
  public spriteSet: TreeSpriteSet;
  public growthOptions: {
    temperature: {
      min: number;
      max: number;
    };
    moisture: {
      min: number;
      max: number;
    };
    height: {
      min: number;
      max: number;
    };
    light: {
      min: number;
      max: number;
    };
  };

  constructor(options: TreeSpeciesDef) {
    this.id = options.id; // id of the tree species
    this.name = options.name; // name of the tree species
    this.iconPath = options.iconPath; // path to the icon representing the tree species
    this.growthOptions = options.growthOptions; // growth options for the tree species
    this.spriteSet = options.spriteSet; // sprite set for the tree species

    console.log("new tree species", this);
  }

  static generateSpeciesTextures(paths: string[]) {
    return paths.map((path) => {
      const sprite = Sprite.from(path);
      const texture = sprite?.texture;
      if (sprite) {
        sprite.destroy();
      }
      return texture;
    });
  }

  static processTreeSpecies() {
    if (TreeSpecies.treeSpecies.length) return;
    const speciesDefs: TreeSpeciesDef[] = [
      {
        id: "pine",
        name: "Pine",
        iconPath: "tree_00",
        spriteSet: {
          trunkBase: ["trunk_base_default"],
          canopy: ["trunk_canopy_default"],
        },
        growthOptions: {
          temperature: {
            min: 0,
            max: 100,
          },
          moisture: {
            min: 0,
            max: 100,
          },
          height: {
            min: 0,
            max: 100,
          },
          light: {
            min: 0,
            max: 100,
          },
        },
      },
      {
        id: "birch",
        name: "Birch",
        iconPath: "tree_01",
        spriteSet: {
          trunkBase: ["trunk_base_default"],
          canopy: ["trunk_canopy_default"],
        },
        growthOptions: {
          temperature: {
            min: 0,
            max: 100,
          },
          moisture: {
            min: 0,
            max: 100,
          },
          height: {
            min: 0,
            max: 100,
          },
          light: {
            min: 0,
            max: 100,
          },
        },
      },
      {
        id: "maple",
        name: "Maple",
        iconPath: "tree_01",
        spriteSet: {
          trunkBase: ["trunk_base_default"],
          canopy: ["trunk_canopy_default"],
        },
        growthOptions: {
          temperature: {
            min: 0,
            max: 100,
          },
          moisture: {
            min: 0,
            max: 100,
          },
          height: {
            min: 0,
            max: 100,
          },
          light: {
            min: 0,
            max: 100,
          },
        },
      },
      {
        id: "cottoncandy",
        name: "Cotton Candy",
        iconPath: "tree_01",
        spriteSet: {
          trunkBase: ["trunk_base_default"],
          canopy: ["trunk_canopy_default"],
        },
        growthOptions: {
          temperature: {
            min: 0,
            max: 100,
          },
          moisture: {
            min: 0,
            max: 100,
          },
          height: {
            min: 0,
            max: 100,
          },
          light: {
            min: 0,
            max: 100,
          },
        },
      },
    ];

    speciesDefs.forEach((speciesDef) => {
      TreeSpecies.treeSpecies[speciesDef.id] = new TreeSpecies(speciesDef);
    });
  }
}
