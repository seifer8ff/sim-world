import * as PIXI from "pixi.js";
import { Game } from "./game";
import { Point } from "./point";
import { Tile } from "./tile";
import { Color } from "rot-js";
import { Color as ColorType } from "rot-js/lib/color";
import { MapWorld } from "./map-world";
export enum Layer {
  TERRAIN = 1,
  GROUNDCOVER, // small ground cover plants, small rocks/decorations, weather, puddles, paths, etc
  ACTOR, // anything that has a brain and a position, including animals, humanoids, plants, etc
  SMALLACTOR, // small actors, like trees, rats, etc
  CANOPY, // upper layer, tree canopy, roofs, etc
  UI,
}
import { CompositeTilemap, settings } from "./libs/pixi-tilemap.es";
import { GameSettings } from "./game-settings";
import { positionToIndex } from "./misc-utility";
import { RGBAColor } from "./light-manager";

export type Renderable =
  | PIXI.Sprite
  | PIXI.AnimatedSprite
  | PIXI.ParticleContainer
  | CompositeTilemap;

export class Renderer {
  public terrainLayer = Array.from(
    {
      length:
        GameSettings.options.renderChunkCount *
        GameSettings.options.renderChunkCount,
    },
    () => new CompositeTilemap(null)
  );
  public canopyLayer = Array.from(
    {
      length:
        GameSettings.options.renderChunkCount *
        GameSettings.options.renderChunkCount,
    },
    () => new CompositeTilemap(null)
  );
  public groundCoverLayer = Array.from(
    {
      length:
        GameSettings.options.renderChunkCount *
        GameSettings.options.renderChunkCount,
    },
    () => new CompositeTilemap(null)
  );
  public smallActorLayer = Array.from(
    {
      length:
        GameSettings.options.renderChunkCount *
        GameSettings.options.renderChunkCount,
    },
    () => new CompositeTilemap(null)
  );
  // public smallActorLayer = new PIXI.Container();
  public actorLayer = new PIXI.Container();
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
    this.canopyLayer.forEach((layer) => {
      layer.zIndex = 125;
      // layer.alpha = 0.1;
    });
    this.groundCoverLayer.forEach((layer) => {
      layer.zIndex = 35;
    });
    this.smallActorLayer.forEach((layer) => {
      layer.zIndex = 55;
    });
    this.actorLayer.zIndex = 90;
    this.uiLayer.zIndex = 10;
  }

  public init(): void {
    this.clearScene();
    this.clearCache();
    const layerCount = Layer.UI;
    let layerSize =
      GameSettings.options.gameSize.width *
      Tile.tileDensityRatio *
      GameSettings.options.gameSize.height *
      Tile.tileDensityRatio; // account for dense grid, like for plants
    let totalSize = layerSize * layerCount; // account for each layer
    console.log(
      "total tile size across all layers, single",
      totalSize,
      layerSize
    );
    this.spriteIndexCache = new Int32Array(totalSize).fill(-1);
  }

  addLayersToStage(stage: PIXI.Container): void {
    this.terrainLayer.forEach((layer, index) => {
      stage.addChild(layer as PIXI.DisplayObject);
    });
    this.canopyLayer.forEach((layer, index) => {
      stage.addChild(layer as PIXI.DisplayObject);
    });
    this.groundCoverLayer.forEach((layer, index) => {
      stage.addChild(layer as PIXI.DisplayObject);
    });
    this.smallActorLayer.forEach((layer, index) => {
      stage.addChild(layer as PIXI.DisplayObject);
    });
    stage.addChild(this.actorLayer as PIXI.DisplayObject);
    stage.addChild(this.uiLayer as PIXI.DisplayObject);
  }

  renderChunkedLayers(
    layers: Layer[],
    width: number,
    height: number,
    viewportCenterTile: Point
  ) {
    const chunkWidthTiles = Math.ceil(
      width / GameSettings.options.renderChunkCount
    );
    const chunkHeightTiles = Math.ceil(
      height / GameSettings.options.renderChunkCount
    );
    // let clearTerrainLayer = false;
    // let clearGroundCoverLayer = false;
    // let clearSmallActorLayer = false;
    // let clearCanopyLayer = false;

    for (let layer of layers) {
      this.clearSceneLayer(layer);
      // switch (layer) {
      //   case Layer.TERRAIN:
      //     clearTerrainLayer = true;
      //     break;
      //   case Layer.GROUNDCOVER:
      //     clearGroundCoverLayer = true;
      //     break;
      //   case Layer.SMALLACTOR:
      //     clearSmallActorLayer = true;
      //     break;
      //   case Layer.CANOPY:
      //     clearCanopyLayer = true;
      //     break;
      //   default:
      //     this.clearSceneLayer(layer);
      //     break;
      // }
    }

    const centerChunk = Math.floor(GameSettings.options.renderChunkCount / 2);
    let chunkIndex = 0;
    for (let i = -centerChunk; i <= centerChunk; i++) {
      for (let j = -centerChunk; j <= centerChunk; j++) {
        // calculate chunkIndex where [-1,-1] is 0 and [2,2] is 9
        chunkIndex =
          (i + centerChunk) * GameSettings.options.renderChunkCount +
          (j + centerChunk);

        // // clear just this chunk of terrain layer (BUT NO OTHER LAYERS)
        // if (clearTerrainLayer) {
        //   this.clearSceneLayer(Layer.TERRAIN, 1);
        // }

        // if (clearGroundCoverLayer) {
        //   this.clearSceneLayer(Layer.GROUNDCOVER, 1);
        // }

        // if (clearSmallActorLayer) {
        //   this.clearSceneLayer(Layer.SMALLACTOR, 1);
        // }

        // if (clearCanopyLayer) {
        //   this.clearSceneLayer(Layer.CANOPY, 1);
        // }

        // const centerLayerTypes = [
        //   Layer.ACTOR,
        //   Layer.SMALLACTOR,
        //   Layer.CANOPY,
        //   Layer.GROUNDCOVER,
        // ];

        // const centerLayers = layers.filter((layer) =>
        //   centerLayerTypes.includes(layer)
        // );
        // const outerLayers = layers.filter(
        //   (layer) => !centerLayerTypes.includes(layer)
        // );

        // if (i === 0 && j === 0) {
        //   this.renderLayers(
        //     layers,
        //     chunkWidthTiles,
        //     chunkHeightTiles,
        //     viewportCenterTile.x + i * chunkWidthTiles,
        //     viewportCenterTile.y + j * chunkHeightTiles,
        //     chunkIndex
        //   );
        // } else {
        //   this.renderLayers(
        //     outerLayers,
        //     chunkWidthTiles,
        //     chunkHeightTiles,
        //     viewportCenterTile.x + i * chunkWidthTiles,
        //     viewportCenterTile.y + j * chunkHeightTiles,
        //     chunkIndex
        //   );
        // }

        this.renderLayers(
          layers,
          chunkWidthTiles,
          chunkHeightTiles,
          viewportCenterTile.x + i * chunkWidthTiles,
          viewportCenterTile.y + j * chunkHeightTiles,
          chunkIndex
        );

        // this.renderLayers(
        //   layers,
        //   chunkWidthTiles,
        //   chunkHeightTiles,
        //   viewportCenterTile.x + i * chunkWidthTiles,
        //   viewportCenterTile.y + j * chunkHeightTiles,
        //   chunkIndex
        // );
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
    // Convert tileX, tileY to the correct index for the layer
    const index = positionToIndex(tileX, tileY, layer);

    let tileTexture: PIXI.Texture | undefined = undefined;
    let displayObj: Renderable | undefined;

    switch (layer) {
      case Layer.ACTOR: {
        displayObj = this.spriteCache.get(index);
        if (!displayObj) return;

        this.actorLayer.addChild(displayObj as PIXI.DisplayObject);
        break;
      }

      case Layer.UI: {
        displayObj = this.spriteCache.get(index);
        if (!displayObj) return;

        this.uiLayer.addChild(displayObj as PIXI.DisplayObject);
        break;
      }
    }

    // Pre-calculate common values to avoid redundant calculations
    const tileSize = Tile.size;
    const denseSize = Tile.denseSize;
    const halfTileSize = Tile.size / 2;
    const tileID = this.spriteIndexCache[index];

    if (tileID === -1) {
      return;
    }

    switch (layer) {
      case Layer.TERRAIN: {
        tileTexture = Tile.textures[tileID];
        if (!tileTexture) return;

        const terrainLayer = this.terrainLayer[chunkIndex];
        const scaleX = terrainLayer.scale.x;
        const scaleY = terrainLayer.scale.y;

        terrainLayer.tile(
          tileTexture,
          Math.floor(tileX * (tileSize / scaleX) - halfTileSize / scaleX),
          Math.floor(tileY * (tileSize / scaleY) - halfTileSize / scaleY),
          { alpha: 1, tint: tint as RGBAColor }
        );
        break;
      }

      case Layer.GROUNDCOVER: {
        tileTexture = Tile.textures[tileID];
        if (!tileTexture) return;

        this.groundCoverLayer[chunkIndex].tile(
          tileTexture,
          Math.floor(tileX * denseSize - halfTileSize),
          Math.floor(tileY * denseSize - halfTileSize),
          { alpha: 1, tint: tint as RGBAColor }
        );
        break;
      }

      case Layer.SMALLACTOR: {
        tileTexture = Tile.textures[tileID];
        if (!tileTexture) return;

        this.smallActorLayer[chunkIndex].tile(
          tileTexture,
          Math.floor(tileX * denseSize - halfTileSize),
          Math.floor(tileY * denseSize - halfTileSize),
          { alpha: 1, tint: tint as RGBAColor }
        );
        break;
      }

      case Layer.CANOPY: {
        tileTexture = Tile.textures[tileID];
        if (!tileTexture) return;

        this.canopyLayer[chunkIndex].tile(
          tileTexture,
          Math.floor(tileX * denseSize - halfTileSize) - 13,
          Math.floor(tileY * denseSize - halfTileSize) - 64,
          { alpha: 0.9, tint: tint as RGBAColor }
        );
        break;
      }
    }
  }

  // renderLayers(
  //   layers: Layer[],
  //   width: number,
  //   height: number,
  //   centerX: number,
  //   centerY: number,
  //   chunkIndex: number
  // ): void {
  //   const shouldTint = GameSettings.shouldTint();
  //   let right: number;
  //   let bottom: number;
  //   let left: number;
  //   let top: number;
  //   let tint: RGBAColor | string | undefined = undefined;
  //   let gameWidth: number = GameSettings.options.gameSize.width;
  //   let gameHeight: number = GameSettings.options.gameSize.height;
  //   let tileX: number;
  //   let tileY: number;

  //   right = Math.ceil(centerX + width / 2);
  //   bottom = Math.ceil(centerY + height / 2);
  //   left = Math.ceil(centerX - width / 2);
  //   top = Math.ceil(centerY - height / 2);

  //   right = Math.max(Math.min(gameWidth, right), 0);
  //   bottom = Math.max(Math.min(gameHeight, bottom), 0);
  //   left = Math.min(right, Math.max(0, left));
  //   top = Math.min(bottom, Math.max(0, top));
  //   for (let x = left; x < right; x += 1) {
  //     for (let y = top; y < bottom; y += 1) {
  //       for (let layer of layers) {
  //         if (shouldTint) {
  //           if (layer === Layer.TERRAIN || layer === Layer.GROUNDCOVER) {
  //             // other layers are tinted in a separate step during the game loop
  //             // for perf reasons
  //             tint = this.game.map.lightManager.getRGBALightFor(x, y, false);
  //           }
  //           if (layer === Layer.SMALLACTOR || layer === Layer.CANOPY) {
  //             tint = this.game.map.lightManager.getRGBALightFor(x, y, true);
  //           }
  //         }

  //         tileX = x;
  //         tileY = y;
  //         if (
  //           layer === Layer.GROUNDCOVER ||
  //           layer === Layer.SMALLACTOR ||
  //           layer === Layer.CANOPY
  //         ) {
  //           tileX = Tile.translate(x, Layer.TERRAIN, Layer.GROUNDCOVER);
  //           tileY = Tile.translate(y, Layer.TERRAIN, Layer.GROUNDCOVER);
  //           for (let i = 0; i < Tile.tileDensityRatio; i++) {
  //             for (let j = 0; j < Tile.tileDensityRatio; j++) {
  //               this.renderLayer(layer, tileX + i, tileY + j, chunkIndex, tint);
  //             }
  //           }
  //         } else {
  //           this.renderLayer(layer, tileX, tileY, chunkIndex, tint);
  //         }
  //       }
  //     }
  //   }
  // }

  renderLayers(
    layers: Layer[],
    width: number,
    height: number,
    centerX: number,
    centerY: number,
    chunkIndex: number
  ): void {
    const shouldTint = GameSettings.shouldTint();
    const gameWidth = GameSettings.options.gameSize.width;
    const gameHeight = GameSettings.options.gameSize.height;

    let right = Math.ceil(centerX + width / 2);
    let bottom = Math.ceil(centerY + height / 2);
    let left = Math.ceil(centerX - width / 2);
    let top = Math.ceil(centerY - height / 2);

    right = Math.max(Math.min(gameWidth, right), 0);
    bottom = Math.max(Math.min(gameHeight, bottom), 0);
    left = Math.min(right, Math.max(0, left));
    top = Math.min(bottom, Math.max(0, top));

    let x: number, y: number, layer: Layer, tileX: number, tileY: number;
    let tint: RGBAColor | undefined = undefined;

    for (x = left; x < right; x++) {
      for (y = top; y < bottom; y++) {
        for (layer of layers) {
          if (shouldTint) {
            if (layer === Layer.TERRAIN || layer === Layer.GROUNDCOVER) {
              tint = this.game.map.lightManager.getLightFor(
                x,
                y,
                false,
                true
              ) as RGBAColor;
            } else if (layer === Layer.SMALLACTOR || layer === Layer.CANOPY) {
              tint = this.game.map.lightManager.getLightFor(
                x,
                y,
                true,
                true
              ) as RGBAColor;
            }
          }

          tileX = x;
          tileY = y;

          if (
            layer === Layer.GROUNDCOVER ||
            layer === Layer.SMALLACTOR ||
            layer === Layer.CANOPY
          ) {
            tileX = Tile.translate(x, Layer.TERRAIN, Layer.GROUNDCOVER);
            tileY = Tile.translate(y, Layer.TERRAIN, Layer.GROUNDCOVER);
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
      case Layer.SMALLACTOR:
        if (isSprite) {
          (displayObj as PIXI.Sprite).anchor.set(0.5);
        }
        (displayObj as PIXI.Sprite).position.x = position.x * Tile.denseSize;
        (displayObj as PIXI.Sprite).position.y = position.y * Tile.denseSize;
      case Layer.GROUNDCOVER:
        if (isSprite) {
          (displayObj as PIXI.Sprite).anchor.set(0.5);
        }
        (displayObj as PIXI.Sprite).position.x = position.x * Tile.denseSize;
        (displayObj as PIXI.Sprite).position.y = position.y * Tile.denseSize;
      case Layer.TERRAIN:
        break;
      case Layer.CANOPY: {
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
      case Layer.ACTOR: {
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
      // case Layer.SMALLACTOR:
      //   this.smallActorLayer.addChild(displayObj as PIXI.DisplayObject);
      //   break;
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
      case Layer.GROUNDCOVER:
      case Layer.TERRAIN:
        break;
      case Layer.CANOPY: {
        // this.canopyLayer.removeChild(cachedObj as PIXI.DisplayObject);
        break;
      }
      case Layer.ACTOR: {
        this.actorLayer.removeChild(cachedObj as PIXI.DisplayObject);
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
      if (
        layer === Layer.TERRAIN ||
        layer === Layer.GROUNDCOVER ||
        layer === Layer.SMALLACTOR ||
        layer === Layer.CANOPY
      ) {
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
      this.clearCache(Layer.GROUNDCOVER);
      this.clearCache(Layer.SMALLACTOR);
      this.clearCache(Layer.UI);
    }
  }

  clearScene(): void {
    this.clearSceneLayer(Layer.TERRAIN);
    this.clearSceneLayer(Layer.CANOPY);
    this.clearSceneLayer(Layer.GROUNDCOVER);
    this.clearSceneLayer(Layer.SMALLACTOR);
    this.clearSceneLayer(Layer.ACTOR);
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
      case Layer.CANOPY: {
        if (chunkIndex >= 0) {
          this.canopyLayer[chunkIndex].clear();
        } else {
          this.canopyLayer.forEach((layer) => {
            layer.clear();
          });
        }
        break;
      }
      case Layer.GROUNDCOVER: {
        if (chunkIndex >= 0) {
          this.groundCoverLayer[chunkIndex].clear();
        } else {
          this.groundCoverLayer.forEach((layer) => {
            layer.clear();
          });
        }
        break;
      }
      case Layer.SMALLACTOR: {
        if (chunkIndex >= 0) {
          this.smallActorLayer[chunkIndex].clear();
        } else {
          this.smallActorLayer.forEach((layer) => {
            layer.clear();
          });
        }
        break;
      }
      case Layer.ACTOR: {
        this.actorLayer.removeChildren();
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
