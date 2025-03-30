import * as PIXI from "pixi.js";
import { Game } from "./game";
import { Point } from "./point";
import { Tile } from "./tile";
import { Color } from "rot-js";
import { Color as ColorType } from "rot-js/lib/color";
import { MapWorld } from "./map-world";
export enum Layer {
  TERRAIN = 1,
  GROUNDFX,
  ENTITY,
  PLANT,
  TREE,
  UI,
}
import { CompositeTilemap } from "@pixi/tilemap";
import { settings } from "@pixi/tilemap";
import { GameSettings } from "./game-settings";
import { inverseLerp, lerp, positionToIndex } from "./misc-utility";
import { RGBAColor } from "./light-manager";
import { clamp } from "rot-js/lib/util";

export type Renderable =
  | PIXI.Sprite
  | PIXI.AnimatedSprite
  | PIXI.ParticleContainer
  | CompositeTilemap;

export class Renderer {
  public chunkCountPerSide = 3; // must be ODD number
  // 3x3 grid of tilemaps to render the terrain
  public terrainLayer = Array.from(
    { length: this.chunkCountPerSide * this.chunkCountPerSide },
    () => new CompositeTilemap()
  );
  public groundFXLayer = new PIXI.Container();
  public plantLayer = Array.from(
    { length: this.chunkCountPerSide * this.chunkCountPerSide },
    () => new CompositeTilemap()
  );
  public treeLayer = new PIXI.Container();
  public entityLayer = new PIXI.Container();
  public uiLayer = new PIXI.Container();
  private spriteCache: Map<number, Renderable> = new Map();
  private spriteIndexCache: Int32Array = new Int32Array(0);

  constructor(private game: Game) {
    PIXI.settings.ROUND_PIXELS = true;
    PIXI.settings.RENDER_OPTIONS.antialias = false;
    settings.use32bitIndex = true;
    settings.TEXTILE_SCALE_MODE = PIXI.SCALE_MODES.NEAREST;

    this.terrainLayer.forEach((layer) => {
      layer.zIndex = 5;
      const tileScale = Math.ceil(Tile.size / Tile.terrainTilePixelSize);
      layer.scale.set(tileScale); // scale up from 16px to Tile.size (32px)
    });
    this.groundFXLayer.zIndex = 20;
    this.plantLayer.forEach((layer) => {
      layer.zIndex = 35;
    });
    this.treeLayer.zIndex = 55;
    this.treeLayer.sortableChildren = true;
    this.entityLayer.zIndex = 45;
    this.uiLayer.zIndex = 10;
  }

  public init(): void {
    this.clearScene();
    this.clearCache();
    const layerCount = Layer.UI + 1;
    let layerSize =
      GameSettings.options.gameSize.width *
      Tile.tileDensityRatio *
      GameSettings.options.gameSize.height *
      Tile.tileDensityRatio; // account for dense grid, like for plants
    layerSize *= layerCount; // account for each layer
    this.spriteIndexCache = new Int32Array(layerSize).fill(-1);
  }

  addLayersToStage(stage: PIXI.Container): void {
    this.terrainLayer.forEach((layer, index) => {
      stage.addChild(layer as PIXI.DisplayObject);
    });
    stage.addChild(this.groundFXLayer as PIXI.DisplayObject);
    this.plantLayer.forEach((layer, index) => {
      stage.addChild(layer as PIXI.DisplayObject);
    });
    stage.addChild(this.treeLayer as PIXI.DisplayObject);
    stage.addChild(this.entityLayer as PIXI.DisplayObject);
    stage.addChild(this.uiLayer as PIXI.DisplayObject);
  }

  renderChunkedLayers(
    layers: Layer[],
    width: number,
    height: number,
    viewportCenterTile: Point
  ) {
    const chunkWidthTiles = Math.ceil(width / this.chunkCountPerSide);
    const chunkHeightTiles = Math.ceil(height / this.chunkCountPerSide);
    let clearTerrainLayer = false;
    let clearPlantLayer = false;

    for (let layer of layers) {
      switch (layer) {
        case Layer.TERRAIN:
          clearTerrainLayer = true;
          break;
        case Layer.PLANT:
          clearPlantLayer = true;
          break;
        case Layer.TREE:
          break;
        default:
          this.clearSceneLayer(layer);
          break;
      }
    }

    const centerChunk = Math.floor(this.chunkCountPerSide / 2);
    for (let i = -centerChunk; i <= centerChunk; i++) {
      for (let j = -centerChunk; j <= centerChunk; j++) {
        // calculate chunkIndex where [-1,-1] is 0 and [2,2] is 9
        const chunkIndex =
          (i + centerChunk) * this.chunkCountPerSide + (j + centerChunk);

        // clear just this chunk of terrain layer (BUT NO OTHER LAYERS)
        if (clearTerrainLayer) {
          this.clearSceneLayer(Layer.TERRAIN, chunkIndex);
        }

        if (clearPlantLayer) {
          this.clearSceneLayer(Layer.PLANT, chunkIndex);
        }

        this.renderLayers(
          layers,
          chunkWidthTiles,
          chunkHeightTiles,
          viewportCenterTile.x + i * chunkWidthTiles,
          viewportCenterTile.y + j * chunkHeightTiles,
          chunkIndex
        );
      }
    }
  }

  renderLayer(
    layer: Layer,
    tileX: number,
    tileY: number,
    chunkIndex: number = -1,
    tint: RGBAColor | string | undefined = undefined
  ) {
    // need to convert tileX, tileY to the correct index for the layer
    let index = positionToIndex(tileX, tileY, layer);

    if (index < 0) {
      // invalid index returned
      return;
    }
    // if (layer === Layer.PLANT && tileX % 2 !== 0) {
    //   console.throttle(20).log(tileX, tileY, index);
    // }
    let tileID: number;
    let tile: Tile;
    let displayObj: Renderable;

    switch (layer) {
      case Layer.TERRAIN: {
        tileID = this.spriteIndexCache[index];
        tile = Tile.tiles[tileID];

        this.terrainLayer[chunkIndex].tile(
          tile.spritePath,
          Math.floor(
            tileX * (Tile.size / this.terrainLayer[chunkIndex].scale.x) -
              Tile.size / this.terrainLayer[chunkIndex].scale.x / 2
          ), // half size as layer is scaled up by 2
          Math.floor(
            tileY * (Tile.size / this.terrainLayer[chunkIndex].scale.y) -
              Tile.size / this.terrainLayer[chunkIndex].scale.x / 2
          ),
          { alpha: 1, tint: tint as RGBAColor }
        );
        break;
      }
      case Layer.GROUNDFX: {
        displayObj = this.spriteCache.get(index);
        if (!displayObj) {
          return;
        }
        // this.tintObjectWithChildren(displayObj, new Point(x, y));
        this.groundFXLayer.addChild(displayObj as PIXI.DisplayObject);
        break;
      }
      case Layer.PLANT: {
        tileID = this.spriteIndexCache[index];

        if (tileID === -1) {
          return;
        }
        tile = Tile.tiles[tileID];
        // if (tileX % 2 !== 0) {
        //   console.throttle(20).log(tileID, index, tile);
        // }

        if (!tile) {
          return;
        }
        // if (tileX > 500) {
        //   console.log("!!!! ---- should render", tileX);
        // }
        this.plantLayer[chunkIndex].tile(
          tile.spritePath,
          Math.floor(tileX * Tile.denseSize - Tile.size / 2), // half size as layer is scaled up by 2
          Math.floor(tileY * Tile.denseSize - Tile.size / 2),
          {
            alpha: 1,
            tint: tint as RGBAColor,
          }
        );
        break;
      }
      case Layer.TREE: {
        displayObj = this.spriteCache.get(index);
        if (!displayObj) {
          return;
        }
        // console.log("tree displayObj", displayObj);

        // displayObj.zIndex = GameSettings.options.gameSize.height * ratio - y;
        this.treeLayer.addChild(displayObj as PIXI.DisplayObject);
        break;
      }
      case Layer.ENTITY: {
        displayObj = this.spriteCache.get(index);
        if (!displayObj) {
          return;
        }
        this.entityLayer.addChild(displayObj as PIXI.DisplayObject);
        break;
      }
      case Layer.UI: {
        displayObj = this.spriteCache.get(index);
        if (!displayObj) {
          return;
        }
        this.uiLayer.addChild(displayObj as PIXI.DisplayObject);
        break;
      }
    }
  }

  renderLayers(
    layers: Layer[],
    width: number,
    height: number,
    centerX: number,
    centerY: number,
    chunkIndex: number
  ): void {
    const shouldTint = GameSettings.shouldTint();
    let right: number;
    let bottom: number;
    let left: number;
    let top: number;
    let tint: RGBAColor | string | undefined = undefined;
    let gameWidth: number = GameSettings.options.gameSize.width;
    let gameHeight: number = GameSettings.options.gameSize.height;
    let tileX: number;
    let tileY: number;

    right = Math.ceil(centerX + width / 2);
    bottom = Math.ceil(centerY + height / 2);
    left = Math.ceil(centerX - width / 2);
    top = Math.ceil(centerY - height / 2);

    right = Math.max(Math.min(gameWidth, right), 0);
    bottom = Math.max(Math.min(gameHeight, bottom), 0);
    left = Math.min(right, Math.max(0, left));
    top = Math.min(bottom, Math.max(0, top));
    for (let x = left; x < right; x += 1) {
      for (let y = top; y < bottom; y += 1) {
        for (let layer of layers) {
          if (shouldTint) {
            if (layer === Layer.TERRAIN || layer === Layer.PLANT) {
              // other layers are tinted in a separate step during the game loop
              // for perf reasons
              tint = this.game.map.lightManager.getRGBALightFor(x, y, false);
            }
          }

          tileX = x;
          tileY = y;
          if (layer === Layer.PLANT || layer === Layer.TREE) {
            tileX = Tile.translate(x, Layer.TERRAIN, Layer.PLANT);
            tileY = Tile.translate(y, Layer.TERRAIN, Layer.PLANT);
            for (let i = 0; i < Tile.tileDensityRatio; i++) {
              for (let j = 0; j < Tile.tileDensityRatio; j++) {
                this.renderLayer(layer, tileX + i, tileY + j, chunkIndex, tint);
              }
            }
          } else {
            this.renderLayer(layer, tileX, tileY, chunkIndex, tint);
          }
        }
      }
    }
  }

  // add the sprite/particle container, etc to the cache, to be rendered on the next render pass
  addToScene(
    position: Point,
    layer: Layer,
    displayObj: Renderable,
    initialTint?: string
  ): void {
    let isSprite = false;

    if (!displayObj) {
      // throw (new Error("No sprite provided"), position, layer, sprite, tint);
      console
        .throttle(250)
        .log(
          "Error: addToScene: no displayObj provided",
          position,
          layer,
          displayObj,
          initialTint
        );
      return;
    }
    isSprite =
      displayObj instanceof PIXI.Sprite ||
      displayObj instanceof PIXI.AnimatedSprite;

    switch (layer) {
      case Layer.TREE:
      case Layer.PLANT:
      case Layer.TERRAIN:
        break;
      case Layer.GROUNDFX: {
        if (isSprite) {
          (displayObj as PIXI.Sprite).anchor.set(0.5);
        }
        (displayObj as PIXI.Sprite).position.x = position.x * Tile.denseSize;
        (displayObj as PIXI.Sprite).position.y = position.y * Tile.denseSize;
        break;
      }
      case Layer.UI: {
        if (isSprite) {
          (displayObj as PIXI.Sprite).anchor.set(0.5);
          (displayObj as PIXI.Sprite).scale.set(2);
        }
        (displayObj as PIXI.Sprite).position.x = position.x * Tile.size;
        (displayObj as PIXI.Sprite).position.y = position.y * Tile.size;
        break;
      }
      case Layer.ENTITY: {
        if (isSprite) {
          (displayObj as PIXI.Sprite).anchor.set(0.5);
        }
        (displayObj as PIXI.Sprite).position.x = position.x * Tile.size;
        (displayObj as PIXI.Sprite).position.y = position.y * Tile.size;
        break;
      }
    }

    if (initialTint && isSprite) {
      (displayObj as PIXI.Sprite).tint = initialTint || "0xFFFFFF";
    }

    switch (layer) {
      case Layer.TREE:
        this.treeLayer.addChild(displayObj as PIXI.DisplayObject);
        break;
      default:
        let index = positionToIndex(position.x, position.y, layer);
        this.spriteCache.set(index, displayObj);
        break;
    }
  }

  addTileIdToScene(position: Point, layer: Layer, tileId: number): void {
    let index = positionToIndex(position.x, position.y, layer);
    this.spriteIndexCache[index] = tileId;
  }

  public tintObjectWithChildren(obj: Renderable, tint: ColorType) {
    if (!tint?.length) return;
    if (!("tint" in obj)) return;
    if (obj["tint"] === tint) return;

    if ("children" in obj) {
      (obj["children"] as Renderable[]).forEach((child) => {
        this.tintObjectWithChildren(child, tint);
      });
    }

    if (obj instanceof PIXI.ParticleContainer) return;
    // try {
    //   obj["tint"] = Color.toHex(tint);
    // } catch (error) {
    //   console.log("Error tinting object", obj, error);
    //   console.log("tint", tint);
    // }
    obj["tint"] = Color.toHex(tint);
  }

  // update a sprites position in the cache, to be rendered on the next render pass
  updateSpriteCachePosition(oldPos: Point, newPos: Point, layer: Layer): void {
    const newIndex = positionToIndex(newPos.x, newPos.y, layer);
    const oldIndex = positionToIndex(oldPos.x, oldPos.y, layer);
    this.spriteCache.set(newIndex, this.spriteCache.get(oldIndex));
    this.spriteCache.delete(oldIndex);
  }

  // remove the sprite from the cache and from the scene, immediately
  removeFromScene(tileIndex: number, layer: Layer): void {
    let cachedObj: Renderable;
    cachedObj = this.spriteCache.get(tileIndex);
    this.spriteCache.delete(tileIndex);
    if (typeof cachedObj === "string") {
      return;
    }
    switch (layer) {
      case Layer.PLANT:
      case Layer.TERRAIN:
        break;
      case Layer.GROUNDFX: {
        this.groundFXLayer.removeChild(cachedObj as PIXI.DisplayObject);
        break;
      }
      case Layer.ENTITY: {
        this.entityLayer.removeChild(cachedObj as PIXI.DisplayObject);
      }
      case Layer.UI: {
        this.uiLayer.removeChild(cachedObj as PIXI.DisplayObject);
      }
    }
  }

  removeFromCache(tilePos: Point, layer: Layer): void {
    this.spriteCache.delete(positionToIndex(tilePos.x, tilePos.y, layer));
  }

  clearCache(layer?: Layer): void {
    if (layer) {
      const width = GameSettings.options.gameSize.width;
      const height = GameSettings.options.gameSize.height;
      const widthInTiles = width * Tile.tileDensityRatio;
      const heightInTiles = height * Tile.tileDensityRatio;
      const totalTiles = widthInTiles * heightInTiles;
      const start = (layer - 1) * totalTiles;
      const end = layer * totalTiles;
      if (layer === Layer.TERRAIN || layer === Layer.PLANT) {
        // terrain and plant layers are tilemaps and use the spriteIndexCache
        this.spriteIndexCache.fill(-1, start, end);
      } else {
        for (const [key, value] of this.spriteCache) {
          if (key >= start && key < end) {
            this.spriteCache.delete(key);
          }
        }
      }
    } else if (!layer) {
      this.clearCache(Layer.PLANT);
      this.clearCache(Layer.TREE);
      this.clearCache(Layer.UI);
    }
  }

  clearScene(): void {
    this.clearSceneLayer(Layer.TERRAIN);
    this.clearSceneLayer(Layer.GROUNDFX);
    this.clearSceneLayer(Layer.PLANT);
    this.clearSceneLayer(Layer.TREE);
    this.clearSceneLayer(Layer.ENTITY);
    this.clearSceneLayer(Layer.UI);
  }

  clearSceneLayers(layers: Layer[]): void {
    for (let layer of layers) {
      this.clearSceneLayer(layer);
    }
  }

  clearSceneLayer(layer: Layer, chunkIndex?: number): void {
    switch (layer) {
      case Layer.TERRAIN: {
        if (chunkIndex >= 0) {
          this.terrainLayer[chunkIndex].clear();
        } else {
          this.terrainLayer.forEach((layer) => {
            layer.clear();
          });
        }
        break;
      }
      case Layer.GROUNDFX: {
        this.groundFXLayer.removeChildren();
        break;
      }
      case Layer.PLANT: {
        if (chunkIndex >= 0) {
          this.plantLayer[chunkIndex].clear();
        } else {
          this.plantLayer.forEach((layer) => {
            layer.clear();
          });
        }
        break;
      }
      case Layer.TREE: {
        // this.treeLayer.removeChildren();
        this.treeLayer.children.forEach((child) => {
          (child as CompositeTilemap).clear();
        });
        break;
      }
      case Layer.ENTITY: {
        this.entityLayer.removeChildren();
      }
      case Layer.UI: {
        this.uiLayer.removeChildren();
      }
    }
  }

  // move a sprites position on the screen, but leave its tile position unchanged
  moveCachedSpriteTransform(
    tileKey: string,
    layer: Layer,
    x: number,
    y: number
  ): void {
    const tilePos = MapWorld.keyToPoint(tileKey);
    const sprite = this.spriteCache.get(
      positionToIndex(tilePos.x, tilePos.y, layer)
    );
    if (sprite && typeof sprite !== "string") {
      sprite.transform.position.x = x;
      sprite.transform.position.y = y;
    }
  }

  getSpriteTransformPosition(tilePos: Point, layer: Layer): Point {
    const sprite = this.spriteCache.get(
      positionToIndex(tilePos.x, tilePos.y, layer)
    );
    if (sprite && typeof sprite !== "string") {
      return new Point(
        sprite.transform.position.x,
        sprite.transform.position.y
      );
    }
    return null;
  }

  getFromCache(tilePos: Point, layer: Layer): Renderable {
    return this.spriteCache.get(positionToIndex(tilePos.x, tilePos.y, layer));
  }
}
