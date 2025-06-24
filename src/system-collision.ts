import { Game } from "./game";
import { Layer } from "./renderer";
import { positionToIndex } from "./misc-utility";
import { MapWorld } from "./map-world";
import { GameSettings } from "./game-settings";
import { Tile } from "./tile";

export class SystemCollision {
  public static actorCollisionGrid: Int32Array;
  private static blockingLayers: Layer[];

  constructor() {}

  public static init() {
    this.blockingLayers = [Layer.ACTOR, Layer.SMALLACTOR];
    const layerCount = Layer.UI + 1; // must match renderer to have matching indexes
    let gridSize =
      GameSettings.options.gameSize.width *
      GameSettings.options.gameSize.height *
      Tile.tileDensityRatio; // account for dense grid, like for plants
    gridSize *= layerCount; // account for each layer
    this.actorCollisionGrid = new Int32Array(gridSize);
  }

  public static occupyTile(x: number, y: number, layer: Layer, id: number) {
    if (this.blockingLayers.includes(layer)) {
      const index = positionToIndex(x, y, layer);
      this.actorCollisionGrid[index] = id;
    } else {
      console.warn("Tried to occupy tile on non-actor layer", layer);
    }
  }

  public static clearEntityTile(x: number, y: number, layer: Layer) {
    const index = positionToIndex(x, y, layer);
    SystemCollision.actorCollisionGrid[index] = 0;
  }

  public static isBlockedOnLayer(x: number, y: number, layer: Layer): boolean {
    const index = positionToIndex(x, y, layer);
    return SystemCollision.actorCollisionGrid[index] !== 0;
  }

  // is blocked:
  // - is the tile occupied by another actor?
  // - is the map tile passable? (walkable biome, no tile borders, water, etc.)
  public static isBlocked(
    x: number,
    y: number,
    map: MapWorld,
    originLayer: Layer = Layer.TERRAIN
  ): boolean {
    if (SystemCollision.isMapBlocked(x, y, map, originLayer)) {
      return true;
    }

    const denseRatio = Tile.tileDensityRatio;
    let layerX: number;
    let layerY: number;

    for (const layer of this.blockingLayers) {
      layerX = Tile.translate(x, originLayer, layer);
      layerY = Tile.translate(y, originLayer, layer);
      if (originLayer === Layer.TERRAIN && Tile.isDenseLayer(layer)) {
        // Check all dense points within the non-dense point
        for (let dx = 0; dx < denseRatio; dx++) {
          for (let dy = 0; dy < denseRatio; dy++) {
            if (this.isBlockedOnLayer(layerX + dx, layerY + dy, layer)) {
              return true;
            }
          }
        }
      } else {
        // For non-dense layers, check the single point
        if (this.isBlockedOnLayer(layerX, layerY, layer)) {
          return true;
        }
      }
    }
    return false;
  }

  public static isMapBlocked(
    x: number,
    y: number,
    map: MapWorld,
    originLayer: Layer = Layer.TERRAIN
  ): boolean {
    const terrainX = Tile.translate(x, originLayer, Layer.TERRAIN);
    const terrainY = Tile.translate(y, originLayer, Layer.TERRAIN);
    return !map.isPassable(terrainX, terrainY);
  }

  public static isOccupiedByActor(
    x: number,
    y: number,
    actorId: number
  ): boolean {
    const index = positionToIndex(x, y, Layer.ACTOR);
    return SystemCollision.actorCollisionGrid[index] === actorId;
  }

  public static isOccupiedBySelf(
    x: number,
    y: number,
    actorId: number
  ): boolean {
    return SystemCollision.isOccupiedByActor(x, y, actorId);
  }
}
