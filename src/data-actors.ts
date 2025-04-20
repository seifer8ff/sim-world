import {
  cowAnimationMap,
  defaultAnimationMap,
  mushroomAnimationMap,
} from "./components/animation-map";
import { SpeciesDef, SpeciesType } from "./species";
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
    type: "tree",
    name: "Pine",
    color: "#475d39",
    palette: {
      base: "#ac7c14",
      secondary: "#6d5117",
      accent1: "#3ec31b",
      accent2: "#31881a",
    },
    spriteSet: {
      [Layer.GROUNDCOVER]: ["tree_base_recolor_2"],
      [Layer.SMALLACTOR]: ["tree_top_recolor_2"],
    },
    needs: {
      temperature: {
        min: 10,
        max: 70,
      },
      moisture: {
        min: 40,
        max: 100,
      },
      height: {
        min: 0,
        max: 70,
      },
      light: {
        min: 0,
        max: 100,
      },
    },
  },
  {
    id: "birch",
    type: "tree",
    name: "Birch",
    color: "#d1aa80",
    palette: {
      base: "#e0dcd3", // trunk (white birch bark)
      secondary: "#bab7af", // shadowed trunk (birch bark lines)
      accent1: "#a7d57c", // foliage highlight (light soft green)
      accent2: "#6ca248", // foliage (muted forest green)
    },
    spriteSet: {
      [Layer.GROUNDCOVER]: ["tree_base_recolor_2"],
      [Layer.SMALLACTOR]: ["tree_top_recolor_2"],
    },
    needs: {
      temperature: {
        min: 40,
        max: 100,
      },
      moisture: {
        min: 20,
        max: 100,
      },
      height: {
        min: 70,
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
    type: "tree",
    name: "Maple",
    color: "#b65300",
    palette: {
      base: "#995d43", // trunk (reddish brown)
      secondary: "#804e38", // shadowed trunk (deep brown)
      accent1: "#d19526", // foliage (gold-orange)
      accent2: "#d15f26", // foliage highlight (fiery red)
    },
    spriteSet: {
      [Layer.GROUNDCOVER]: ["tree_base_recolor_2"],
      [Layer.SMALLACTOR]: ["tree_top_recolor_2"],
    },
    needs: {
      temperature: {
        min: 0,
        max: 50,
      },
      moisture: {
        min: 40,
        max: 100,
      },
      height: {
        min: 65,
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
    type: "tree",
    name: "Cotton Candy",
    color: "#ffa7a7",
    palette: {
      base: "#f7e8ff", // trunk (soft white with a lilac tint)
      secondary: "#b8a7c9", // shadowed trunk (cool lavender-gray)
      accent1: "#f0b1d6", // foliage highlight (cotton pink)
      accent2: "#c7a6e5", // foliage (soft lilac purple)
    },
    spriteSet: {
      [Layer.GROUNDCOVER]: ["tree_base_recolor_2"],
      [Layer.SMALLACTOR]: ["tree_top_recolor_2"],
    },
    needs: {
      temperature: {
        min: 0,
        max: 38,
      },
      moisture: {
        min: 30,
        max: 100,
      },
      height: {
        min: 65,
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
    type: "shrub",
    name: "Shrub",
    color: "#95C577",
    palette: {
      base: "#8de570", // light green outer
      secondary: "#3d943f", // dark green inner
      accent1: "#5ab25c", // mid green highlight
      accent2: "#7ac661", // accent
    },
    spriteSet: {
      [Layer.GROUNDCOVER]: ["shrub"],
    },
    needs: {
      temperature: {
        min: 0,
        max: 100,
      },
      moisture: {
        min: 60,
        max: 100,
      },
      height: {
        min: 0,
        max: 82,
      },
      light: {
        min: 0,
        max: 100,
      },
    },
    growsInto: ["pine"],
  },
  {
    id: "shrub-highland",
    type: "shrub",
    name: "Highland Shrub",
    color: "#95C577",
    palette: {
      base: "#128440", //
      secondary: "#85bf9c", //
      accent1: "#2e754a", //
      accent2: "#3dc373", //
    },
    spriteSet: {
      [Layer.GROUNDCOVER]: ["shrub"],
    },
    needs: {
      temperature: {
        min: 0,
        max: 70,
      },
      moisture: {
        min: 10,
        max: 60,
      },
      height: {
        min: 77,
        max: 100,
      },
      light: {
        min: 0,
        max: 100,
      },
    },
    growsInto: ["birch", "maple"],
  },
  {
    // mushroom
    id: "mushroom",
    type: "creature",
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
    type: "creature",
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
    type: "creature",
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
    type: "creature",
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
