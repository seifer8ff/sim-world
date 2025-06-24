import * as PIXI from "pixi.js";
import { Game } from "./game";
import { Tile } from "./tile";
import { Color } from "rot-js";
import { Color as ColorType } from "rot-js/lib/color";
import { CompositeTilemap, settings } from "./libs/pixi-tilemap.es";
import { GameSettings } from "./game-settings";

export enum Layer {
  TERRAIN = 1,
  GROUNDCOVER, // small ground cover plants, small rocks/decorations, weather, puddles, paths, etc
  ACTOR, // anything that has a brain and a position, including animals, humanoids, plants, etc
  SMALLACTOR, // small actors, like trees, rats, etc
  UI,
}
export type Renderable = PIXI.Sprite | PIXI.AnimatedSprite;

export class Renderer {
  public terrainLayer = Array.from(
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
  public smallActorLayer = new PIXI.Container();
  public actorLayer = new PIXI.Container();
  public uiLayer = new PIXI.Container();

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
    this.groundCoverLayer.forEach((layer) => {
      layer.zIndex = 35;
    });
    this.smallActorLayer.zIndex = 85;
    this.smallActorLayer.sortableChildren = true;
    this.actorLayer.zIndex = 65;
    this.actorLayer.sortableChildren = true;
    this.uiLayer.zIndex = 10;
  }

  public init(): void {
    this.clearScene();
    const layerCount = Layer.UI;
    let layerSize =
      GameSettings.options.gameSize.width *
      GameSettings.options.gameSize.height *
      Tile.tileDensityRatio; // account for dense grid, like for plants
    let totalSize = layerSize * layerCount; // account for each layer
    console.log(
      `Renderer initialized with ${layerCount} layers, each with size ${layerSize}, total size: ${totalSize}`
    );
  }

  addLayersToStage(stage: PIXI.Container): void {
    this.terrainLayer.forEach((layer, index) => {
      stage.addChild(layer as PIXI.DisplayObject);
    });
    this.groundCoverLayer.forEach((layer, index) => {
      stage.addChild(layer as PIXI.DisplayObject);
    });
    stage.addChild(this.smallActorLayer as PIXI.DisplayObject);
    stage.addChild(this.actorLayer as PIXI.DisplayObject);
    stage.addChild(this.uiLayer as PIXI.DisplayObject);
  }

  public renderDisplayObject(
    displayObj: PIXI.DisplayObject,
    layer: Layer,
    tint?: ColorType
  ) {
    if (tint) {
      this.tintObjectWithChildren(displayObj as Renderable, tint);
    }
    switch (layer) {
      case Layer.SMALLACTOR:
        this.smallActorLayer.addChild(displayObj);
        break;
      case Layer.ACTOR:
        this.actorLayer.addChild(displayObj);
        break;
      case Layer.UI:
        this.uiLayer.addChild(displayObj);
        break;
      default:
        console.warn("Invalid layer for rendering display object:", layer);
    }
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

  // remove the sprite from the scene, immediately
  removeFromScene(obj: PIXI.DisplayObject, layer: Layer): void {
    switch (layer) {
      case Layer.GROUNDCOVER:
      case Layer.TERRAIN:
        break;
      case Layer.SMALLACTOR: {
        this.smallActorLayer.removeChild(obj);
      }
      case Layer.ACTOR: {
        this.actorLayer.removeChild(obj);
      }
      case Layer.UI: {
        this.uiLayer.removeChild(obj);
      }
    }
  }

  clearScene(): void {
    this.clearSceneLayer(Layer.TERRAIN);
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
        this.smallActorLayer.removeChildren();
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
}
