import { Point } from "./point";
import { Tile } from "./tile";
import { Layer } from "./renderer";
import { SpeciesId } from "./species";
import { AnimatedSprite, Sprite } from "pixi.js";
import { Brain } from "./brains/brain";
import { Description } from "./components/description";
import { BiomeId } from "./biomes";
import { AnimationMap, BaseAnimationKey } from "./components/animation-map";
import { AnimId } from "./system-animated";

export type ActorTypeId = SpeciesId | AnimId; // lookup id for textures

export interface WithID {
  id: number;
}

export interface WithName extends WithID {
  name?: string;
}

export type CanFruit = {
  fruitCount: number; // number of fruits currently available on the actor
};

export interface WithLayer extends WithID {
  layer: Layer; // the layer this actor is on (e.g. GROUNDCOVER, TREES, etc.)
}

export interface WithPosition extends WithLayer {
  position: Point;
  collider?: boolean;
}

export interface WithPathing extends WithPosition {
  path: Point[]; // current path to action.target
  range: number; // range of movement
  validBiomes?: BiomeId[]; // biomes actor can traverse. TODO: modify movement cost based on biome
}

export interface WithDescription {
  description: Description;
}

export interface WithSprite extends WithPosition {
  sprite: Sprite | AnimatedSprite;
  spritePath?: string; // path to the sprite image file
}

export interface WithTile extends WithPosition {
  tile: number; // tile index. Used in rendering tilemaps to retrieve Tile.textures[tile]
}

export interface WithBrain extends WithPosition {
  brain: Brain; // special complex component in charge of AI/planning
}

export interface WithAnimation extends WithSprite {
  animId: ActorTypeId; // the id to lookup the anim's texture set, matches speciesId if it exists
  animationMap: AnimationMap; // map of animation keys to a list of animation names
  baseAnimSpeed: number; // the baseline speed to animate the actor, modified by timescale
  currentAnimation: BaseAnimationKey; // the current animation being played
}

export interface WithGrowth {
  canGrow?: boolean; // whether the actor can grow or not
  growthStep?: number;
}

export interface WithSpecies {
  species?: SpeciesId;
}

export interface isUi {
  isUi: boolean;
}

export interface isPointer extends isUi, WithPosition {
  isPointer: boolean;
  pointerTarget?: ActorBase; // the actor this pointer is pointing to
}

export type ActorBase = Partial<
  WithID &
    WithName &
    WithPosition &
    WithPathing &
    WithDescription &
    WithTile &
    WithSprite &
    WithAnimation &
    WithBrain &
    WithGrowth &
    WithSpecies &
    CanFruit &
    isUi &
    isPointer
>;

export enum ComponentType {
  animatedSprite = "animatedSprite",
  id = "id",
  name = "name",
  position = "position",
  collider = "collider",
  tile = "tile",
  layer = "layer",
  species = "species",
  canGrow = "canGrow",
  growthStep = "growthStep",
  sprite = "sprite",
  brain = "brain",
  path = "path",
  range = "range",
  validBiomes = "validBiomes",
  fruitCount = "fruitCount",
  isUi = "isUi",
  isPointer = "isPointer",
  pointerTarget = "pointerTarget",
  animId = "animId",
  animationMap = "animationMap",
  baseAnimSpeed = "baseAnimSpeed",
  currentAnimation = "currentAnimation",
}

export function isActor(object: any): object is ActorBase {
  return typeof object === "object" && "id" in object && "position" in object;
}

export function isAnimated(object: any): object is ActorBase & WithAnimation {
  return (
    typeof object === "object" && "animId" in object && "animationMap" in object
  );
}
