import { Game } from "./game";
import { Layer } from "./renderer";
import { positionToIndex } from "./misc-utility";
import { MapWorld } from "./map-world";
import { GameSettings } from "./game-settings";
import { Tile } from "./tile";

export class ManagerCollision {
  public actorCollisionGrid: Int32Array;
  private map: MapWorld;
  private layers: Layer[];

  constructor(private game: Game) {
    this.map = this.game.map;
    this.initGrid();
  }

  private initGrid() {
    this.layers = [Layer.ACTOR, Layer.SMALLACTOR];
    const layerCount = Layer.UI + 1;
    let gridSize =
      GameSettings.options.gameSize.width *
      Tile.tileDensityRatio *
      GameSettings.options.gameSize.height *
      Tile.tileDensityRatio; // account for dense grid, like for plants
    gridSize *= layerCount; // account for each layer
    this.actorCollisionGrid = new Int32Array(gridSize);
  }

  public occupyTile(x: number, y: number, layer: Layer, id: number) {
    if (this.layers.includes(layer)) {
      const index = positionToIndex(x, y, layer);
      this.actorCollisionGrid[index] = id;
    } else {
      console.warn("Tried to occupy tile on non-actor layer", layer);
    }
  }

  public clearEntityTile(x: number, y: number, layer: Layer) {
    const index = positionToIndex(x, y, layer);
    this.actorCollisionGrid[index] = 0;
  }

  public isBlockedOnLayer(x: number, y: number, layer: Layer): boolean {
    const index = positionToIndex(x, y, layer);
    return this.actorCollisionGrid[index] !== 0;
  }

  public isBlocked(
    x: number,
    y: number,
    originLayer: Layer = Layer.TERRAIN
  ): boolean {
    if (this.isMapBlocked(x, y, originLayer)) {
      return true;
    }

    const denseRatio = Tile.tileDensityRatio;
    let layerX: number;
    let layerY: number;

    for (const layer of this.layers) {
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

  public isMapBlocked(
    x: number,
    y: number,
    originLayer: Layer = Layer.TERRAIN
  ): boolean {
    const terrainX = Tile.translate(x, originLayer, Layer.TERRAIN);
    const terrainY = Tile.translate(y, originLayer, Layer.TERRAIN);
    return !this.map.isPassable(terrainX, terrainY);
  }

  public isOccupiedByActor(x: number, y: number, actorId: number): boolean {
    const index = positionToIndex(x, y, Layer.ACTOR);
    return this.actorCollisionGrid[index] === actorId;
  }

  public isOccupiedBySelf(x: number, y: number, actorId: number): boolean {
    return this.isOccupiedByActor(x, y, actorId);
  }
}
