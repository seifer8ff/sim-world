import {
  cowAnimationMap,
  defaultAnimationMap,
  mushroomAnimationMap,
} from "./components/animation-map";
import { SpeciesDef } from "./species";
import { Layer } from "./renderer";

// couldn't we have an animated plant?
// a non animated actor?
// they should all be in one place....

export enum IconLayer {
  ICON = 10, // icons don't have a layer in the renderer, but are used in various UI locations
}

const dataActors: SpeciesDef[] = [
  {
    id: "pine",
    name: "Pine",
    baseTint: "#475d39",
    color: "#475d39",
    spriteSet: {
      [Layer.GROUNDCOVER]: ["tree_base"],
      [Layer.SMALLACTOR]: ["tree_top"],
    },
    needs: {
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
    baseTint: "#d1aa80",
    color: "#d1aa80",
    spriteSet: {
      [Layer.GROUNDCOVER]: ["tree_base"],
      [Layer.SMALLACTOR]: ["tree_top"],
    },
    needs: {
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
    baseTint: "#b65300",
    color: "#b65300",
    spriteSet: {
      [Layer.GROUNDCOVER]: ["tree_base"],
      [Layer.SMALLACTOR]: ["tree_top"],
    },
    needs: {
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
    baseTint: "#ffa7a7",
    color: "#ffa7a7",
    spriteSet: {
      [Layer.GROUNDCOVER]: ["tree_base"],
      [Layer.SMALLACTOR]: ["tree_top"],
    },
    needs: {
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
    id: "shrub",
    name: "Shrub",
    color: "#95C577",
    spriteSet: {
      [Layer.GROUNDCOVER]: ["plant-8x8"],
    },
    needs: {
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
    // mushroom
    id: "mushroom",
    name: "Mushroom",
    spriteSet: {
      [IconLayer.ICON]: ["idle_000"],
      [Layer.ACTOR]: ["sprites/mushroom_00/mushroom_00.json"],
    },
    color: "#C1BF69",
    animationMap: mushroomAnimationMap,
    needs: {
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
    // cow
    id: "cow",
    name: "Cow",
    spriteSet: {
      [IconLayer.ICON]: ["walk_down/walk_down_000"],
      [Layer.ACTOR]: ["sprites/cow_00/cow_00.json"],
    },
    color: "#C1BF69",
    animationMap: cowAnimationMap,
    needs: {
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
    // seagull
    id: "seagull",
    name: "Seagull",
    spriteSet: {
      [IconLayer.ICON]: ["up/bird_seagull_up_000"],
      [Layer.ACTOR]: ["sprites/bird_seagull/bird_seagull.json"],
    },
    color: "#C1BF69",
    animationMap: defaultAnimationMap,
    needs: {
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
    // sharkblue
    id: "sharkblue",
    name: "Blue Shark",
    spriteSet: {
      [IconLayer.ICON]: ["right/right_000"],
      [Layer.ACTOR]: ["sprites/shark_blue/shark_blue.json"],
    },
    color: "#C1BF69",
    animationMap: defaultAnimationMap,
    needs: {
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

export default dataActors;
