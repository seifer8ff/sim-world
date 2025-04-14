// map of animation types to a list of animation names
export interface AnimationMap {
  idle: string[]; // every actor should have at least one idle animation
  walk_up?: string[];
  walk_down?: string[];
  walk_left?: string[];
  walk_right?: string[];
}

export type BaseAnimationKey =
  | "idle"
  | "walk_up"
  | "walk_down"
  | "walk_left"
  | "walk_right";

export const defaultAnimationMap: AnimationMap = {
  idle: ["right"],
  walk_up: ["up"],
  walk_down: ["down"],
  walk_left: ["left"],
  walk_right: ["right"],
};

export const mushroomAnimationMap: AnimationMap = {
  idle: ["idle"],
  walk_up: ["idle"],
  walk_down: ["idle"],
  walk_left: ["idle"],
  walk_right: ["idle"],
};

export const cowAnimationMap: AnimationMap = {
  idle: ["right"],
  walk_up: ["walk_up"],
  walk_down: ["walk_down"],
  walk_left: ["walk_left"],
  walk_right: ["walk_right"],
};
