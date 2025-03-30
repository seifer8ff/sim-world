import { Point } from "../point";
import { Tile, TileSubType, TileType } from "../tile";
import { Renderable } from "../renderer";
import { TreeSpeciesID } from "./tree/tree-species";
import { Leaf, TreeBranch } from "../manager-trees";
import { AnimatedSprite } from "pixi.js";
import { Animator } from "../components/animator";
import { Brain } from "../brains/brain";
import { Description } from "../components/description";
import { BiomeId } from "../biomes";

export interface WithID {
  id: number;
}

export interface WithName {
  name?: string;
}

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

export interface WithTile {
  tile: number;
  type: TileType;
  subType: TileSubType;
}

export interface WithBrain {
  brain: Brain; // special complex component in charge of AI/planning
}

export interface WithAnimator {
  animator: Animator;
  animatedTile: Tile;
  sprite: AnimatedSprite;
}

export interface WithRenderable {
  renderable?: Renderable;
}

export interface WithGrowth {
  growthStep?: number;
}

export interface WithSpecies {
  species?: TreeSpeciesID;
}

export interface WithTrunk {
  trunk?: TreeBranch;
  curve?: number;
  curveDirection?: number;
  trunkTextureIndex?: number;
  trunkBaseTextureIndex?: number;
}

export interface WithBranches {
  branches?: TreeBranch[];
  branchTextureIndex?: number;
  branchesPerSegment?: number;
  branchChance?: number;
  trunkSegmentWidth?: number;
  trunkSegmentHeight?: number;
  branchSegmentWidth?: number;
  branchSegmentHeight?: number;
  totalSegments?: number;
}

export interface WithLeaves {
  leaves?: Map<number, Leaf[]>; // branch ID -> leaf sprite []
  leafTextureIndex?: number;
  leavesPerSegment?: number;
  leafSize?: number;
  leafDistance?: number;
  leafDensity?: number;
}

export type ActorBase = Partial<
  WithID &
    WithName &
    WithPosition &
    WithPathing &
    WithDescription &
    WithTile &
    WithAnimator &
    WithBrain &
    WithRenderable &
    WithGrowth &
    WithSpecies &
    WithTrunk &
    WithBranches &
    WithLeaves
>;

export enum ComponentType {
  id = "id",
  name = "name",
  position = "position",
  collider = "collider",
  tile = "tile",
  type = "type",
  subType = "subType",
  renderable = "renderable",
  species = "species",
  growthStep = "growthStep",
  trunk = "trunk",
  curve = "curve",
  curveDirection = "curveDirection",
  trunkTextureIndex = "trunkTextureIndex",
  branches = "branches",
  branchTextureIndex = "branchTextureIndex",
  branchesPerSegment = "branchesPerSegment",
  branchChance = "branchChance",
  trunkSegmentWidth = "trunkSegmentWidth",
  trunkSegmentHeight = "trunkSegmentHeight",
  branchSegmentWidth = "branchSegmentWidth",
  branchSegmentHeight = "branchSegmentHeight",
  totalSegments = "totalSegments",
  leaves = "leaves",
  leavesPerSegment = "leavesPerSegment",
  leafSize = "leafSize",
  leafDistance = "leafDistance",
  leafDensity = "leafDensity",
  animator = "animator",
  animatedTile = "animatedTile",
  sprite = "sprite",
  brain = "brain",
  path = "path",
  range = "range",
  validBiomes = "validBiomes",
  // action = "action",
  // goal = "goal",
  // updateFacing = "updateFacing",
  // plan = "plan",
  // act = "act",
}

export function isActor(object: any): object is ActorBase {
  return object && "id" in object && "position" in object;
}
