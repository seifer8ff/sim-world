import { Point } from "../point";
import { Tile } from "../tile";
import { Layer, Renderable } from "../renderer";
import { TreeSpeciesID } from "./tree/tree-species";
import { AnimatedSprite, Sprite } from "pixi.js";
import { AnimationMap, Animator } from "../components/animator";
import { Brain } from "../brains/brain";
import { Description } from "../components/description";
import { BiomeId } from "../biomes";

export interface WithID {
  id: number;
}

export interface WithName {
  name?: string;
}

export type CanFruit = {
  fruitCount: number; // number of fruits currently available on the actor
};

export interface WithPosition {
  position: Point;
  collider?: boolean;
}

export interface WithPathing {
  path: Point[]; // current path to action.target
  range: number; // range of movement
  validBiomes?: BiomeId[]; // biomes actor can traverse. TODO: modify movement cost based on biome
}

export interface WithDescription {
  description: Description;
}

export interface WithSprite {
  sprite: Sprite | AnimatedSprite;
  spritePath: string; // path to the sprite image file
}

export interface WithLayer {
  layer: Layer; // the layer this actor is on (e.g. GROUNDCOVER, TREES, etc.)
}

export interface WithTile extends WithLayer {
  tile: number; // tile index. Used in rendering tilemaps to retrieve Tile.textures[tile]
}

export interface WithBrain {
  brain: Brain; // special complex component in charge of AI/planning
}

export interface WithAnimator {
  animator: Animator; // class that handles playing animations for the actor
  animationMap: AnimationMap; // map of animation keys to a list of animation names
  animationPath: string; // path to the animation JSON file
}

export interface WithRenderable {
  renderable?: Renderable;
}

export interface WithGrowth {
  canGrow?: boolean; // whether the actor can grow or not
  growthStep?: number;
}

export interface WithSpecies {
  species?: TreeSpeciesID;
}

export interface WithTrunkBase {
  trunkBaseSprite: string;
}

export interface WithCanopy {
  canopySprite: string;
}

export type ActorBase = Partial<
  WithID &
    WithName &
    WithPosition &
    WithPathing &
    WithDescription &
    WithTile &
    WithSprite &
    WithAnimator &
    WithBrain &
    WithRenderable &
    WithGrowth &
    WithSpecies &
    CanFruit &
    WithTrunkBase &
    WithCanopy
>;

export enum ComponentType {
  animatedSprite = "animatedSprite",
  id = "id",
  name = "name",
  position = "position",
  collider = "collider",
  tile = "tile",
  layer = "layer",
  renderable = "renderable",
  species = "species",
  canGrow = "canGrow",
  growthStep = "growthStep",
  trunk = "trunk",
  trunkTextureIndex = "trunkTextureIndex",
  animator = "animator",
  animatedTile = "animatedTile",
  sprite = "sprite",
  brain = "brain",
  path = "path",
  range = "range",
  validBiomes = "validBiomes",
  trunkBaseSprite = "trunkBaseSprite",
  canopySprite = "canopySprite",
  fruitCount = "fruitCount",
}

export function isActor(object: any): object is ActorBase {
  return object && "id" in object && "position" in object;
}
