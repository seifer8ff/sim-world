import { ActorBase, WithID, WithPosition } from "./actor";
import { Species } from "./species";
import { generateId } from "./misc-utility";
import { RNG } from "rot-js";
import { Sprite } from "pixi.js";
import { Point } from "./point";
import { Layer, Renderer } from "./renderer";
import { Tile } from "./tile";
import { Color as ColorType } from "rot-js/lib/color";
import { clamp } from "lodash";
import { LightManager } from "./light-manager";
import { Query } from "miniplex";
import { Camera, Viewport } from "./camera";
import { MapWorld } from "./map-world";
import { SystemActors } from "./system-actors";
import { SystemStatic } from "./system-static";

// handle spawning, updating, and rendering of trees
export class SystemTrees {
  constructor() {}

  // spawns an appropriate species of tree at the given position
  public static spawnAt(
    pos: Point,
    actorManager: SystemActors,
    map: MapWorld
  ): ActorBase {
    // check the needs of the species against the position
    let species: Species[] = Species.getSpeciesForPosition(
      pos,
      Layer.SMALLACTOR,
      "tree",
      map
    );
    if (species.length) {
      const selectedSpecies = RNG.getItem(species);
      return SystemTrees.spawnSpeciesAt(selectedSpecies, pos, actorManager);
    }
  }

  public static spawnSpeciesAt(
    species: Species,
    pos: Point,
    actorManager: SystemActors
  ): ActorBase {
    if (pos) {
      let actorBase: ActorBase & WithPosition & WithID = {
        id: generateId(),
        speciesType: "tree",
        layer: Layer.SMALLACTOR,
        name: "Tree",
        position: pos,
        // position: new Point(0, 0),
        collider: true,
        species: species.id,
      };
      actorBase.sprite = Sprite.from(
        SystemStatic.getTextureFor(species, Layer.SMALLACTOR)
      );
      actorBase.sprite.anchor.set(0.5, 1);
      actorBase.sprite.position.x =
        pos.x * Tile.denseSize - Tile.denseSize - Tile.denseSize / 2;
      actorBase.sprite.position.y = pos.y * Tile.denseSize - Tile.denseSize + 1;

      if (species.id === "pine") {
        actorBase.fruitCount = 1;
      }

      const trunkActorBase: ActorBase & WithPosition & WithID = {
        id: generateId(),
        layer: Layer.GROUNDCOVER,
        name: "trunk-base",
        position: pos,
        species: species.id,
      };
      actorManager.spawn(trunkActorBase, false);
      return actorManager.spawn(actorBase, false);
    }
    return null;
  }

  public static renderTrees(
    actors: Query<ActorBase>,
    renderer: Renderer,
    lightManager: LightManager,
    viewport: Viewport
  ) {
    let tint: ColorType;

    for (const { id, name, sprite, position, layer } of actors) {
      let { x, y } = position;
      tint = lightManager.getLightFor(
        Tile.translate(x, layer, Layer.TERRAIN), // light is calculated on terrain layer
        Tile.translate(y, layer, Layer.TERRAIN),
        false,
        true
      ) as ColorType;

      if (Camera.inViewport(x, y, layer, viewport)) {
        renderer.renderDisplayObject(sprite, layer, tint as ColorType);
      }
    }
  }

  public static grow(tree: ActorBase): boolean {
    // console.log("-- curve in growth func: ", tree.curve);
    let growSuccess = false;
    // growSuccess = SystemBranches.growTrunk(tree);
    if (growSuccess) {
      // only sort on trunk growth- otherwise buggy for leaves
      // tree.renderable?.sortChildren();
    }
    // if (!growSuccess) {
    //   growSuccess = SystemBranches.growBranches(0, tree);
    // }
    // if (tree.trunk.segments.length) {
    //   SystemLeaves.growLeaves(0, tree);
    // }
    return growSuccess;
  }
}
