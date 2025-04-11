import { ActorBase, WithID, WithPosition } from "./actor";
import { PlantSpecies, PlantSpeciesEnum } from "./plant-species";
import { generateId, inverseLerp } from "./misc-utility";
import { Color, RNG } from "rot-js";
import { Sprite, Texture } from "pixi.js";
import { Point } from "./point";
import { Layer, Renderer } from "./renderer";
import { Tile } from "./tile";
import { Color as ColorType } from "rot-js/lib/color";
import { clamp } from "lodash";
import { LightManager, RGBAColor } from "./light-manager";
import { Query } from "miniplex";
import { Camera, Viewport } from "./camera";
import { BiomeId, Biomes } from "./biomes";
import { MapWorld } from "./map-world";
import { ManagerActor } from "./manager-actors";

// handle spawning, updating, and rendering of trees
export class SystemTrees {
  constructor() {}

  public static spawnSpeciesAt(
    species: PlantSpecies,
    pos: Point,
    actorManager: ManagerActor
  ): ActorBase {
    if (pos) {
      let actorBase: ActorBase & WithPosition & WithID = {
        id: generateId(),
        layer: Layer.SMALLACTOR,
        name: "Tree",
        position: pos,
        // position: new Point(0, 0),
        collider: true,
        species: species.id,
      };
      actorBase.sprite = Sprite.from(
        PlantSpecies.getTextureFor(species, Layer.SMALLACTOR)
      );
      actorBase.sprite.anchor.set(0.5, 1);
      actorBase.sprite.position.x =
        pos.x * Tile.denseSize - Tile.denseSize - Tile.denseSize / 2;
      actorBase.sprite.position.y = pos.y * Tile.denseSize - Tile.denseSize - 0;

      if (species.id === PlantSpeciesEnum.PINE) {
        actorBase.fruitCount = 1;
      }

      const trunkActorBase: ActorBase & WithPosition & WithID = {
        id: generateId(),
        layer: Layer.GROUNDCOVER,
        name: "trunk-base",
        position: pos,
        species: species.id,
      };
      actorManager.spawnActor(trunkActorBase, false);
      return actorManager.spawnActor(actorBase, false);
    }
    return null;
  }

  public static spawnSpeciesAtRand(
    species: PlantSpecies,
    map: MapWorld,
    actorManager: ManagerActor
  ): ActorBase {
    let pos: Point;
    let biomes: BiomeId[];
    switch (species.id) {
      case PlantSpeciesEnum.PINE:
        biomes = [Biomes.Biomes.moistdirt.id];
        break;
      case PlantSpeciesEnum.BIRCH:
        biomes = [Biomes.Biomes.hillsmid.id, Biomes.Biomes.hillshigh.id];
        break;
      case PlantSpeciesEnum.COTTONCANDY:
        biomes = [Biomes.Biomes.valley.id];
        break;
      case PlantSpeciesEnum.MAPLE:
        biomes = [Biomes.Biomes.snowhillshillsmid.id];
        break;
      default:
        biomes = [Biomes.Biomes.moistdirt.id];
        break;
    }
    pos = map.getRandomTilePositions(biomes, 1, true, true)[0];
    return SystemTrees.spawnSpeciesAt(species, pos, actorManager);
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

  public static adjustTint(tint: ColorType, yPos: number): RGBAColor {
    let darkenAmount = inverseLerp(yPos, -45, 5);
    darkenAmount = clamp(darkenAmount, 0, 0.16);
    let newTint = Color.interpolate(
      tint,
      LightManager.lightDefaults.shadow,
      darkenAmount
    );
    newTint.push(1);
    return newTint as any as RGBAColor;
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
