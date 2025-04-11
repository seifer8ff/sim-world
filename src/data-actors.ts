import {
  cowAnimationMap,
  defaultAnimationMap,
  mushroomAnimationMap,
} from "./components/animator";
import { Layer } from "./renderer";

// couldn't we have an animated plant?
// a non animated actor?
// they should all be in one place....

export default {
  plants: [
    {
      id: "pine",
      name: "Pine",
      baseTint: "#475d39",
      color: "#475d39",
      spriteSet: {
        [Layer.GROUNDCOVER]: ["trunk_base_trans"],
        [Layer.SMALLACTOR]: ["tree_desat_trans"],
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
        [Layer.GROUNDCOVER]: ["trunk_base_trans"],
        [Layer.SMALLACTOR]: ["tree_desat_trans"],
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
        [Layer.GROUNDCOVER]: ["trunk_base_trans"],
        [Layer.SMALLACTOR]: ["tree_desat_trans"],
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
        [Layer.GROUNDCOVER]: ["trunk_base_trans"],
        [Layer.SMALLACTOR]: ["tree_desat_trans"],
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
  ],
  animated: [
    {
      // mushroom
      id: "mushroom",
      name: "Mushroom",
      spritePath: "idle_000",
      color: "#C1BF69",
      animationPath: "sprites/mushroom_00/mushroom_00.json",
      animationMap: mushroomAnimationMap,
    },
    {
      // cow
      id: "cow",
      name: "Cow",
      spritePath: "walk_down/walk_down_000",
      color: "#C1BF69",
      animationPath: "sprites/cow_00/cow_00.json",
      animationMap: cowAnimationMap, // Replace with cowAnimationMap if available
    },
    {
      // seagull
      id: "seagull",
      name: "Seagull",
      spritePath: "up/bird_seagull_up_000",
      color: "#C1BF69",
      animationPath: "sprites/bird_seagull/bird_seagull.json",
      animationMap: defaultAnimationMap, // Replace with defaultAnimationMap if available
    },
    {
      // sharkblue
      id: "sharkblue",
      name: "Blue Shark",
      spritePath: "right/right_000",
      color: "#C1BF69",
      animationPath: "sprites/shark_blue/shark_blue.json",
      animationMap: defaultAnimationMap, // Replace with defaultAnimationMap if available
    },
  ],
};
