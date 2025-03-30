import { ActorBase } from "./entities/actor";
import { TreeSpecies } from "./entities/tree/tree-species";
import { getItemFromRange, getNumberFromRange } from "./misc-utility";
import { RNG } from "rot-js";
import { Sprite } from "pixi.js";
import { Leaf, Segment, TreeBranch } from "./manager-trees";
import { SystemBranches } from "./system-branches";
import { Point } from "./point";
import { SystemTreeRenderer } from "./system-tree-renderer";

// handle spawning, updating, and rendering of tree leaves
export class SystemLeaves {
  constructor() {}

  public init(): void {}

  public static add(species: TreeSpecies): ActorBase {
    let added: ActorBase = {
      leaves: new Map<number, Leaf[]>(),
      leafTextureIndex: SystemTreeRenderer.getRandomLeafTexture(species),
      leafDistance: species.leafDistance,
      leafSize: getNumberFromRange(species.leafMinSize, species.leafSizeRange),
      leavesPerSegment: getNumberFromRange(
        species.leavesPerSegmentMin,
        species.leavesPerSegmentRange
      ),
      leafDensity: 1,
    };
    return added;
  }

  public static growLeaves(growthStep: number, tree: ActorBase): void {
    let currentLeaves: Leaf[] = [];
    let newLeaves: Leaf[] = [];
    let branch: TreeBranch;
    let species: TreeSpecies = TreeSpecies.treeSpecies[tree.species];
    let maxBranchLeafCount: number;
    for (let i = 0; i < tree.branches.length; i++) {
      branch = tree.branches[i];
      currentLeaves = [];
      maxBranchLeafCount =
        branch.segments.length * tree.leavesPerSegment * tree.leafDensity;

      if (tree.leaves.has(branch.id)) {
        currentLeaves = tree.leaves.get(branch.id);
      }

      if (currentLeaves.length < maxBranchLeafCount) {
        newLeaves = SystemLeaves.addLeavesToBranch(
          branch,
          tree.leavesPerSegment,
          tree.leafSize,
          tree.leafDensity,
          species
        );
        currentLeaves.push(...newLeaves);
        tree.leaves.set(branch.id, currentLeaves);
      }
      // console.log("total leaves", tree.leaves);
    }
  }

  public static addLeavesToBranch(
    branch: TreeBranch,
    leavesPerSegment: number,
    leafSize: number,
    leafDensity: number,
    species: TreeSpecies
  ): Leaf[] {
    let segment: Segment;
    let newLeaves: Leaf[] = [];
    for (let i = 0; i < branch.segments.length; i++) {
      segment = branch.segments[i];
      if (segment.leafCount < leavesPerSegment) {
        newLeaves.push(
          ...SystemLeaves.addLeaves(
            branch,
            segment,
            leavesPerSegment,
            leafSize,
            leafDensity,
            species
          )
        );
      }
    }
    return newLeaves;
  }

  public static addLeaves(
    branch: TreeBranch,
    segment: Segment,
    leavesPerSegment: number,
    leafSize: number,
    leafDensity: number,
    species: TreeSpecies
  ): Leaf[] {
    let leaves: Leaf[] = [];
    let leaf: Leaf;
    let angle: number;
    let distance: number;
    let rotation: number;
    let leafCount: number = Math.round(leavesPerSegment * leafDensity);
    leafCount -= segment.leafCount || 0;
    const initialRotation = RNG.getUniform() * 360;

    for (let i: number = 0; i < leafCount; i++) {
      angle = RNG.getUniform() * species.leafCoverageAngle;
      // increase the distance by the number of branches
      distance =
        RNG.getUniform() * species.branchSegmentCount * species.leafDistance;
      rotation =
        angle + RNG.getUniform() * 2 * initialRotation - initialRotation;
      leaf = {
        branchId: branch.id,
        position: new Point(
          segment.position.x + SystemBranches.lengthdir_x(distance, angle),
          segment.position.y - SystemBranches.lengthdir_y(distance, angle)
        ),
        rotation: rotation,
        alpha: RNG.getUniform() > 0.4 ? 1 : 0.3,
        underCanopy: RNG.getUniform() > 0.12,
      };
      // leaf.width = leafSize;
      // leaf.height = leafSize;

      leaves.push(leaf);
    }
    segment.leafCount = leaves.length;
    // segment.leavesRendered = true;
    return leaves;
  }
}
