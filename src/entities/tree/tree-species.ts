import { Sprite, Texture } from "pixi.js";
import { Tile } from "../../tile";

// textures, including variations, for tree
export interface TreeTextureSet {
  trunk: Texture[];
  branch: Texture[];
  trunkBase: Texture[];
  leaf: Texture[];
}

// paths to textures
export interface TreeTextureSetDef {
  trunk: string[];
  branch: string[];
  trunkBase: string[];
  leaf: string[];
}

export interface PlantSpecies {
  id: string;
  name: string;
  iconPath: string;
  textureSet: TreeTextureSet;
  growthOptions: PlantGrowthOptions;
}

export interface TreeSpeciesDef {
  id: TreeSpeciesID;
  name: string;
  iconPath: string;
  textureSet: {
    trunk: string[];
    branch: string[];
    trunkBase: string[];
    leaf: string[];
  };
  growthOptions: PlantGrowthOptions;
  trunkSegmentCount?: number;
  branchSegmentCount?: number;
  trunkSegmentHeightMin?: number;
  trunkSegmentHeightRange?: number;
  trunkSegmentWidthMin?: number;
  trunkSegmentWidthRange?: number;
  trunkSegmentWidthDegrade?: number;
  trunkMaxBranches?: number;
  maxBranchesPerSegment?: number;
  maxBranchesPerSegmentRange?: number;
  branchChance?: number;
  branchChanceDegrade?: number;

  branchSegmentWidthMin?: number;
  branchSegmentWidthRange?: number;
  branchSegmentWidthDegrade?: number;
  branchSegmentHeightMin?: number;
  branchSegmentHeightRange?: number;
  branchSegmentHeightDegrade?: number;
  branchCurveAngle?: number;
  branchForkMin?: number;
  branchForkRange?: number;
  leavesPerSegmentMin?: number;
  maxLeafCount?: number;
  leavesPerSegmentRange?: number;
  leafMinSize?: number;
  leafSizeRange?: number;
  leafDensity?: number;
  leafDistance?: number;

  minLeafAlpha?: number;
  maxLeafAlpha?: number;
  leafCoverageAngle?: number;
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
  public textureSet: TreeTextureSet;
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

  public trunkSegmentCount: number;
  public branchSegmentCount: number;
  public trunkSegmentHeightMin: number;
  public trunkSegmentHeightRange: number;
  public trunkSegmentWidthMin: number;
  public trunkSegmentWidthRange: number;
  public trunkSegmentWidthDegrade: number;
  public trunkMaxBranches: number;
  public maxBranchesPerSegment: number;
  public maxBranchesPerSegmentRange: number;
  public branchChance: number;
  public branchChanceDegrade: number;
  public branchSegmentWidthMin: number;
  public branchSegmentWidthRange: number;
  public branchSegmentWidthDegrade: number;
  public branchSegmentHeightMin: number;
  public branchSegmentHeightRange: number;
  public branchSegmentHeightDegrade: number;
  public branchCurveAngle: number;
  public branchForkMin: number;
  public branchForkRange: number;
  public leavesPerSegmentMin: number;
  public leavesPerSegmentRange: number;
  public leafDensity: number;
  public leafDistance: number;
  public leafMinSize: number;
  public leafSizeRange: number;
  public maxLeafAlpha: number;
  public minLeafAlpha: number;
  public leafCoverageAngle: number;

  constructor(options: TreeSpeciesDef) {
    this.id = options.id; // id of the tree species
    this.name = options.name; // name of the tree species
    this.iconPath = options.iconPath; // path to the icon representing the tree species
    this.growthOptions = options.growthOptions; // growth options for the tree species
    this.trunkSegmentCount =
      options.trunkSegmentCount !== undefined ? options.trunkSegmentCount : 8; // length of the trunk
    this.branchSegmentCount =
      options.branchSegmentCount !== undefined ? options.branchSegmentCount : 9; // segments in each branch (segments can have different lengths and widths)
    this.trunkSegmentHeightMin =
      options.trunkSegmentHeightMin !== undefined
        ? options.trunkSegmentHeightMin
        : 6; // height of each trunk segment
    this.trunkSegmentHeightRange =
      options.trunkSegmentHeightRange !== undefined
        ? options.trunkSegmentHeightRange
        : 3; // random range added to trunk segment height
    this.trunkSegmentWidthMin =
      options.trunkSegmentWidthMin !== undefined
        ? options.trunkSegmentWidthMin
        : 2; // width of each trunk segment
    this.trunkSegmentWidthRange =
      options.trunkSegmentWidthRange !== undefined
        ? options.trunkSegmentWidthRange
        : 3; // random range added to trunk segment width
    this.trunkSegmentWidthDegrade =
      options.trunkSegmentWidthDegrade !== undefined
        ? options.trunkSegmentWidthDegrade
        : 0.93; // degradation factor for trunk width
    this.trunkMaxBranches =
      options.trunkMaxBranches !== undefined ? options.trunkMaxBranches : 2; // maximum number of branches the trunk can split into
    this.maxBranchesPerSegment =
      options.maxBranchesPerSegment !== undefined
        ? options.maxBranchesPerSegment
        : 2; // maximum number of branches one branch can split into
    this.maxBranchesPerSegmentRange =
      options.maxBranchesPerSegmentRange !== undefined
        ? options.maxBranchesPerSegmentRange
        : 2; // random range added to maxBranchesPerSegment
    this.branchChance =
      options.branchChance !== undefined ? options.branchChance : 1; // starting chance of branching
    this.branchChanceDegrade =
      options.branchChanceDegrade !== undefined
        ? options.branchChanceDegrade
        : 0.1; // how much the chance of branching decreases per branch
    this.branchSegmentWidthMin =
      options.branchSegmentWidthMin !== undefined
        ? options.branchSegmentWidthMin
        : 1; // minimum width of branch
    this.branchSegmentWidthRange =
      options.branchSegmentWidthRange !== undefined
        ? options.branchSegmentWidthRange
        : 2; // range of width of branches
    this.branchSegmentHeightMin =
      options.branchSegmentHeightMin !== undefined
        ? options.branchSegmentHeightMin
        : 2; // minimum length of branch
    this.branchSegmentHeightRange =
      options.branchSegmentHeightRange !== undefined
        ? options.branchSegmentHeightRange
        : 2; // range of length of branches
    this.branchSegmentWidthDegrade =
      options.branchSegmentWidthDegrade !== undefined
        ? options.branchSegmentWidthDegrade
        : 0.92; // degradation factor for branch width
    this.branchSegmentHeightDegrade =
      options.branchSegmentHeightDegrade !== undefined
        ? options.branchSegmentHeightDegrade
        : 0.82; // degradation factor for branch length
    this.branchCurveAngle =
      options.branchCurveAngle !== undefined ? options.branchCurveAngle : 10; // angle at which each branch curves
    this.branchForkMin =
      options.branchForkMin !== undefined ? options.branchForkMin : 20; // minimum angle of branch from the parent branch
    this.branchForkRange =
      options.branchForkRange !== undefined ? options.branchForkRange : 30; // range of angle of branch
    this.leafMinSize =
      options.leafMinSize !== undefined ? options.leafMinSize : 11; // minimum size of each leaf
    this.leafSizeRange =
      options.leafSizeRange !== undefined ? options.leafSizeRange : 8; // range of sizes for each leaf
    this.leafDensity =
      options.leafDensity !== undefined ? options.leafDensity : 1; // density of leaves on each branch/segment
    this.leafDistance =
      options.leafDistance !== undefined ? options.leafDistance : 3; // distance from the end of the branch where leaves are generated
    this.leavesPerSegmentMin =
      options.leavesPerSegmentMin !== undefined
        ? options.leavesPerSegmentMin
        : 1; // minimum number of leaves per segment
    this.leavesPerSegmentRange =
      options.leavesPerSegmentRange !== undefined
        ? options.leavesPerSegmentRange
        : 2; // random range added to leaf count
    this.maxLeafAlpha =
      options.maxLeafAlpha !== undefined ? options.maxLeafAlpha : 1; // maximum opacity of leaves
    this.minLeafAlpha =
      options.minLeafAlpha !== undefined ? options.minLeafAlpha : 0.2; // minimum opacity of leaves
    this.leafCoverageAngle =
      options.leafCoverageAngle !== undefined ? options.leafCoverageAngle : 360; // angle at which the leaves cover the branch
    this.textureSet = {
      // textures for different parts of the tree
      trunk: TreeSpecies.generateSpeciesTextures(options.textureSet.trunk),
      branch: TreeSpecies.generateSpeciesTextures(options.textureSet.branch),
      trunkBase: TreeSpecies.generateSpeciesTextures(
        options.textureSet.trunkBase
      ),
      leaf: TreeSpecies.generateSpeciesTextures(options.textureSet.leaf),
    };
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
        textureSet: {
          trunk: ["trunk_00", "trunk_01", "trunk_02"],
          branch: ["trunk_00", "trunk_01", "trunk_02"],
          trunkBase: ["trunk_base_pine"],
          leaf: [
            "leaf_pine_00",
            "leaf_pine_01",
            "leaf_pine_02",
            "leaf_pine_03",
          ],
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
        trunkSegmentCount: 5,
        trunkSegmentWidthMin: 6,
        trunkSegmentWidthRange: 3,
        trunkSegmentWidthDegrade: 0.88,
        trunkSegmentHeightRange: 0,
        trunkMaxBranches: 3,
        branchSegmentCount: 6,
        branchSegmentWidthDegrade: 0.79,
        branchSegmentWidthMin: 0.9,
        branchSegmentWidthRange: 2.3,
        branchSegmentHeightMin: 3,
        branchSegmentHeightRange: 3,
        branchSegmentHeightDegrade: 0.98,
        branchChance: 1,
        branchChanceDegrade: 0.15,
        maxBranchesPerSegment: 2,
        maxBranchesPerSegmentRange: 2,
        branchCurveAngle: 4,
        branchForkMin: 12,
        branchForkRange: 30,
        leafDensity: 1.3,
      },
      {
        id: "birch",
        name: "Birch",
        iconPath: "tree_01",
        textureSet: {
          trunk: ["trunk_03"],
          branch: ["trunk_03"],
          trunkBase: ["trunk_base_birch"],
          leaf: ["leaf_birch_00", "leaf_birch_01", "leaf_birch_02"],
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
        trunkSegmentCount: 4,
        trunkSegmentHeightMin: 5,
        trunkSegmentHeightRange: 3,
        trunkSegmentWidthMin: 4,
        trunkSegmentWidthRange: 3,
        trunkSegmentWidthDegrade: 0.98,
        trunkMaxBranches: 1,

        branchSegmentCount: 8,
        branchSegmentHeightMin: 4,
        branchSegmentHeightRange: 4,
        branchSegmentHeightDegrade: 0.9,
        branchSegmentWidthDegrade: 0.9,
        branchSegmentWidthMin: 0.8,
        branchSegmentWidthRange: 0.4,
        branchChance: 1,
        branchChanceDegrade: 0.27,
        maxBranchesPerSegment: 2,
        maxBranchesPerSegmentRange: 1,
        branchCurveAngle: 5,
        branchForkMin: 10,
        branchForkRange: 5,
        leafDistance: 2.3,
        // leavesPerSegmentMin: 6,
        // leavesPerSegmentRange: 3,
        // leafDensity: 1.3,
        leafSizeRange: 6,
        leafMinSize: 8,
      },
      {
        id: "maple",
        name: "Maple",
        iconPath: "tree_01",
        textureSet: {
          trunk: ["trunk_03"],
          branch: ["trunk_03"],
          trunkBase: ["trunk_base_birch"],
          leaf: ["leaf_maple_00", "leaf_maple_01", "leaf_maple_02"],
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
        textureSet: {
          trunk: ["trunk_03"],
          branch: ["trunk_03"],
          trunkBase: ["trunk_base_birch"],
          leaf: ["leaf_pink_00", "leaf_pink_01", "leaf_pink_02"],
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
        minLeafAlpha: 0.1,
        maxLeafAlpha: 0.75,
      },
    ];

    speciesDefs.forEach((speciesDef) => {
      TreeSpecies.treeSpecies[speciesDef.id] = new TreeSpecies(speciesDef);
    });
  }
}
