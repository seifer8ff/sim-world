import { Game } from "./game";
import { Point } from "./point";
import * as PIXI from "pixi.js";
import { Tile } from "./tile";
import { UserInterface } from "./user-interface";
import { KEYS, DIRS, Util } from "rot-js";
import { InputUtility } from "./input-utility";
import TinyGesture from "tinygesture";
import { Layer } from "./renderer";
import {
  indexToPosition,
  lerp,
  lerpEaseInOut,
  positionToIndex,
} from "./misc-utility";
import { HeightLayer, MapWorld } from "./map-world";
import { TileStats } from "./web-components/tile-info";
import { Stages } from "./game-state";
import { GameSettings } from "./game-settings";
import { ActorBase, isActor } from "./entities/actor";

export interface Viewport {
  width: number;
  height: number;
  center: Point;
}

export interface PointerTarget {
  position: Point;
  target: Tile | ActorBase;
  info?: TileStats;
}

export class Camera {
  public viewportPadded: Viewport;
  public viewportUnpadded: Viewport;
  public viewportTilesPadded: number[];
  public viewportTilesUnpadded: number[];
  public viewportTarget: Point | ActorBase;
  public pointerTarget: PointerTarget;
  private currentZoom: number;
  private defaultZoom: number;
  private minZoom: number;
  private maxZoom: number;
  private moveSpeed: number;
  private showSidebarDelayMs: number; // this shouldn't be in this class
  private maxMomentumTimeMs: number; // maximum amount of time momemtum can last
  private keyMap: { [key: number]: number };
  private momentum: {
    x: number;
    y: number;
    handlerRef: number;
    decay: number;
  };
  private lastZoom: number;
  private lastPivot: Point;
  private panning: boolean;
  private map: MapWorld; // reference to the map generator, for info about the terrain

  private showSidebarTimer: number; // how many ms until sidebar is unhidden

  constructor(private game: Game, private ui: UserInterface) {
    this.map = this.game.map;
    this.defaultZoom = 1.4;
    this.currentZoom = this.defaultZoom;
    this.minZoom = 0.15;
    this.maxZoom = 7;
    this.moveSpeed = 0.3;
    this.showSidebarDelayMs = 100;
    this.maxMomentumTimeMs = 1000;
    this.showSidebarTimer = 0;
    this.keyMap = {};
    this.keyMap[KEYS.VK_W] = 0; // up
    this.keyMap[KEYS.VK_D] = 2; // right
    this.keyMap[KEYS.VK_S] = 4; // down
    this.keyMap[KEYS.VK_A] = 6; // left
    this.lastPivot = new Point(0, 0);
    this.lastZoom = this.currentZoom;
    this.viewportTilesPadded = [];
    this.viewportTilesUnpadded = [];

    this.momentum = {
      x: 0,
      y: 0,
      handlerRef: null,
      decay: 0.89,
    };

    this.centerViewport(
      this.ui.application.stage,
      this.ui.gameCanvasContainer.clientWidth,
      this.ui.gameCanvasContainer.clientHeight
    );
    this.initEventListeners();
  }

  public centerViewport(
    stage: PIXI.Container,
    screenWidth: number,
    screenHeight: number
  ): void {
    const gameWidthPixels = GameSettings.options.gameSize.width * Tile.size;
    const gameHeightPixels = GameSettings.options.gameSize.height * Tile.size;
    const screenCenterX = screenWidth / 2;
    const screenCenterY = screenHeight / 2;
    const pivotX = gameWidthPixels / 2;
    const pivotY = gameHeightPixels / 2;

    stage.setTransform(
      screenCenterX,
      screenCenterY,
      this.defaultZoom,
      this.defaultZoom,
      0,
      0,
      0,
      pivotX,
      pivotY
    );
  }

  public inViewport(x: number, y: number, unpadded: boolean = true): boolean {
    let viewport = unpadded ? this.viewportUnpadded : this.viewportPadded;
    return (
      x >= 0 &&
      y >= 0 &&
      x > viewport.center.x - viewport.width / 2 &&
      x < viewport.center.x + viewport.width / 2 &&
      y > viewport.center.y - viewport.height / 2 &&
      y < viewport.center.y + viewport.height / 2
    );
  }

  centerOn(x: number, y: number) {
    this.viewportTarget = this.TileToScreenCoords(x, y);
  }

  public followActor(actor: ActorBase) {
    this.viewportTarget = actor;
  }

  public refreshPointerTargetInfo() {
    if (this.pointerTarget) {
      if (!isActor(this.pointerTarget.target)) {
        this.pointerTarget.info = this.map.getInfoAt(
          this.pointerTarget.position.x,
          this.pointerTarget.position.y
        );
      }
    }
  }

  public setPointerTarget(
    pos: Point,
    target: Tile | ActorBase,
    viewportTarget = false
  ) {
    if (this.game.gameState.stage !== Stages.Play) {
      return;
    }
    if (isActor(target)) {
      this.pointerTarget = {
        position: target.position,
        target: target,
      };
      this.ui.components.sideMenu.setActorTarget(target);
      if (viewportTarget) {
        this.viewportTarget = target;
      }
    } else {
      this.pointerTarget = {
        position: pos,
        target: target,
        info: this.map.getInfoAt(pos.x, pos.y),
      };
      this.ui.components.sideMenu.setActorTarget(null);
      if (viewportTarget) {
        this.viewportTarget = pos;
      }
    }
    this.ui.components.tileInfo.setContent(this.pointerTarget);
  }

  public clearPointerTarget() {
    this.ui.components.sideMenu.setActorTarget(null);
    this.ui.components.tileInfo.setContent(null);
    this.game.renderer.removeFromCache(this.pointerTarget.position, Layer.UI);
    this.pointerTarget = null;
    this.viewportTarget = null;
  }

  public selectTileAt(
    x: number,
    y: number,
    viewportTarget = false
  ): PointerTarget {
    // check if entity at tile position
    // check if plant at tile pos
    // if so, select it
    let tile: Tile;
    let actors: ActorBase[];
    let actor: ActorBase;

    actors = this.game.actorManager.getActorsAt(x, y);
    if (actors?.length) {
      actor = actors[0];
      this.setPointerTarget(actor.position, actor, viewportTarget);
      return this.pointerTarget;
    }

    // otherwise, select terrain tile at point
    tile = this.map.getTile(x, y);
    this.setPointerTarget(new Point(x, y), tile, viewportTarget);

    return this.pointerTarget;
  }

  public TileToScreenCoords(
    x: number,
    y: number,
    layer: Layer = Layer.TERRAIN
  ): Point {
    let tileSize = Tile.size;
    if (Tile.isDenseLayer(layer)) {
      tileSize = Tile.denseSize;
    }
    return new Point(x * tileSize, y * tileSize);
  }

  public setViewportZoom(stage: PIXI.Container, newZoom: number) {
    this.currentZoom = newZoom;
    stage.scale.set(newZoom);
  }

  private initEventListeners() {
    window.onresize = () =>
      this.centerViewport(
        this.ui.application.stage,
        this.ui.gameCanvasContainer.clientWidth,
        this.ui.gameCanvasContainer.clientHeight
      );

    const gesture = new TinyGesture(this.ui.gameCanvasContainer);

    gesture.on("pinch", (event) => {
      event.preventDefault();
      if (this.game.gameState.stage !== Stages.Play) {
        return;
      }
      this.handlePinchZoom(gesture);
    });
    gesture.on("panstart", (event) => {
      if (this.game.gameState.stage !== Stages.Play) {
        return;
      }
      this.handlePanStart(gesture);
    });
    gesture.on("panmove", (event) => {
      if (this.game.gameState.stage !== Stages.Play) {
        return;
      }
      this.handlePointerDrag(gesture);
    });
    gesture.on("longpress", (gesture) => {
      if (this.game.gameState.stage !== Stages.Play) {
        return;
      }
      this.handleLongPress();
    });
    gesture.on("panend", (event) => {
      if (this.game.gameState.stage !== Stages.Play) {
        return;
      }
      this.handlePanEnd(gesture);
    });
    gesture.on("tap", (event) => {
      if (this.game.gameState.stage !== Stages.Play) {
        return;
      }
      this.handleClick(gesture, event);
    });
    gesture.on("doubletap", (event) => {
      // The gesture was a double tap. The 'tap' event will also have been fired on
      // the first tap.
      if (this.game.gameState.stage !== Stages.Play) {
        return;
      }
      this.handleDoubleTap(gesture);
    });

    this.ui.gameCanvasContainer.addEventListener("wheel", (e: WheelEvent) => {
      if (this.game.gameState.stage !== Stages.Play) {
        return;
      }
      this.handleMouseZoom(e),
        {
          passive: false,
        };
    });
    window.addEventListener("keydown", (e: KeyboardEvent) => {
      if (this.game.gameState.stage !== Stages.Play) {
        return;
      }
      this.handleInput(e),
        {
          passive: false,
        };
    });
  }

  public Act(): Promise<any> {
    return InputUtility.waitForInput(this.handleInput.bind(this));
  }

  public moveCamera(stage: PIXI.Container, direction: number[]): boolean {
    stage.pivot.x +=
      (direction[0] * Tile.size * this.moveSpeed) / this.currentZoom;
    stage.pivot.y +=
      (direction[1] * Tile.size * this.moveSpeed) / this.currentZoom;
    stage.pivot.x = Math.ceil(stage.pivot.x / Tile.size) * Tile.size;
    stage.pivot.y = Math.ceil(stage.pivot.y / Tile.size) * Tile.size;
    return true;
  }

  private getViewportTiles(pad: boolean = false): number[] {
    const { width, height, center } = pad
      ? this.viewportPadded
      : this.viewportUnpadded;
    const tiles: number[] = [];
    const halfWidth = Math.ceil(width / 2); // include any partial tiles
    const halfHeight = Math.ceil(height / 2);
    for (let x = center.x - halfWidth; x < center.x + halfWidth; x++) {
      for (let y = center.y - halfHeight; y < center.y + halfHeight; y++) {
        tiles.push(positionToIndex(x, y, Layer.TERRAIN));
      }
    }
    return tiles;
  }

  public getViewport(): {
    unpadded: Viewport;
    padded: Viewport;
  } {
    const center = this.getViewportCenterTile();

    const unpaddedWidthTiles =
      this.ui.gameCanvasContainer.clientWidth /
      (Tile.size * this.ui.application.stage.scale.x);
    const unpaddedHeightTiles =
      this.ui.gameCanvasContainer.clientHeight /
      (Tile.size * this.ui.application.stage.scale.x);
    const paddedWidthTiles = unpaddedWidthTiles + 15;
    const paddedHeightTiles = unpaddedHeightTiles + 15;
    return {
      unpadded: {
        width: Math.ceil(unpaddedWidthTiles) + 1,
        height: Math.ceil(unpaddedHeightTiles) + 1,
        center,
      },
      padded: {
        width: Math.ceil(paddedWidthTiles),
        height: Math.ceil(paddedHeightTiles),
        center,
      },
    };
  }

  private getViewportCenterTile(): Point {
    const halfTileSize = Tile.size / 2;
    const pivotXTile =
      (this.game.userInterface.application.stage.pivot.x + halfTileSize) /
      Tile.size;
    const pivotYTile =
      (this.game.userInterface.application.stage.pivot.y + halfTileSize) /
      Tile.size;
    let tilesOffsetX =
      pivotXTile * this.game.userInterface.application.stage.scale.x;
    tilesOffsetX = Math.ceil(pivotXTile) - 1; // Adjusting for centering
    const xPoint = tilesOffsetX;
    let tilesOffsetY =
      (pivotYTile / Tile.size) *
      this.game.userInterface.application.stage.scale.y;
    tilesOffsetY = Math.ceil(pivotYTile) - 1; // Adjusting for centering
    const yPoint = tilesOffsetY;

    return new Point(xPoint, yPoint);
  }

  // private getViewportCenterTile(): Point {
  //   const pivotXTile =
  //     this.game.userInterface.gameDisplay.stage.pivot.x / Tile.size;
  //   const pivotYTile =
  //     this.game.userInterface.gameDisplay.stage.pivot.y / Tile.size;
  //   let tilesOffsetX =
  //     pivotXTile * this.game.userInterface.gameDisplay.stage.scale.x;
  //   tilesOffsetX = Math.ceil(pivotXTile);
  //   const xPoint = tilesOffsetX;
  //   let tilesOffsetY =
  //     (pivotYTile / Tile.size) *
  //     this.game.userInterface.gameDisplay.stage.scale.y;
  //   tilesOffsetY = Math.ceil(pivotYTile);
  //   const yPoint = tilesOffsetY;

  //   return new Point(xPoint, yPoint);
  // }

  private handleInput(event: KeyboardEvent): boolean {
    let validInput = false;
    let code = event.keyCode;
    if (code in this.keyMap) {
      let diff = DIRS[8][this.keyMap[code]];
      if (this.moveCamera(this.ui.application.stage, diff)) {
        this.viewportTarget = null;
        validInput = true;
      }
      // this.moveCamera(this.ui.gameDisplay.stage, diff);
    } else if (code === KEYS.VK_HOME) {
      this.viewportTarget = null;
      this.centerViewport(
        this.ui.application.stage,
        this.ui.gameCanvasContainer.clientWidth,
        this.ui.gameCanvasContainer.clientHeight
      );
      validInput = true;
    }
    return validInput;
  }

  private handlePointerDrag = (g: TinyGesture) => {
    this.panning = true;
    this.setSideMenuVisible(false);
    this.ui.application.stage.pivot.x -=
      g.velocityX / this.ui.application.stage.scale.x;
    this.ui.application.stage.pivot.y -=
      g.velocityY / this.ui.application.stage.scale.x;
    this.resetMomentum();
  };

  private handleLongPress = () => {
    this.setSideMenuVisible(false);
    this.panning = true;
  };

  private resetMomentum() {
    this.momentum.x = 0;
    this.momentum.y = 0;
  }

  private handleClick = (g: TinyGesture, e: MouseEvent | TouchEvent) => {
    let x, y;
    if (e instanceof MouseEvent) {
      // this is more accurate than g.touchStartX for some reason
      x = e.clientX;
      y = e.clientY;
    } else {
      x = g.touchStartX;
      y = g.touchStartY;
    }
    const tilePos = this.screenToTilePos(x, y);
    if (this.game.map.isPointInMap(tilePos)) {
      // if (tilePos) {
      this.selectTileAt(tilePos.x, tilePos.y);
    } else {
      this.clearPointerTarget();
    }
  };

  public screenToTilePos(x: number, y: number): Point {
    let stageScale = this.ui.application.stage.scale.x;
    let centerTile = this.viewportPadded.center;
    let pivotPoint = this.ui.application.stage.pivot;
    let screenCenterX = this.ui.gameCanvasContainer.clientWidth / 2;
    let screenCenterY = this.ui.gameCanvasContainer.clientHeight / 2;
    // offset from click to center of screen, represented in tiles.
    // this will be the offset from the center of the tile
    // so an offset of 0.5, means that the click was at the left edge of the tile one to the right from the center
    const clickOffsetFromScreenCenterX =
      (x - screenCenterX) / (Tile.size * stageScale); // in tiles
    const clickOffsetFromScreenCenterY =
      (y - screenCenterY) / (Tile.size * stageScale);
    // offset from pivot point to center of centerTile, in tiles
    // this exists because the camera isn't perfectly centered in a tile
    const pivotOffsetFromTileCenterX =
      (pivotPoint.x - centerTile.x * Tile.size) / Tile.size;
    const pivotOffsetFromTileCenterY =
      (pivotPoint.y - centerTile.y * Tile.size) / Tile.size;

    return new Point(
      Math.round(
        centerTile.x + clickOffsetFromScreenCenterX + pivotOffsetFromTileCenterX
      ),
      Math.round(
        centerTile.y + clickOffsetFromScreenCenterY + pivotOffsetFromTileCenterY
      )
    );
  }

  private handlePanStart = (g: TinyGesture) => {
    this.viewportTarget = null;
  };

  private setSideMenuVisible(visible: boolean) {
    // only hide/show if not collapsed
    if (!this.ui.components.sideMenu.isCollapsed) {
      this.ui.components.sideMenu.setVisible(visible);
    }
  }

  private handleMomentum() {
    this.momentum.x *= this.momentum.decay;
    this.momentum.y *= this.momentum.decay;
    if (Math.abs(this.momentum.x) < 0.2 && Math.abs(this.momentum.y) < 0.2) {
      this.resetMomentum();
      if (!this.panning && this.showSidebarTimer === 0) {
        // start time for showing sidebar again
        this.showSidebarTimer = this.showSidebarDelayMs;
      }
    }

    this.ui.application.stage.pivot.x -= this.momentum.x;
    this.ui.application.stage.pivot.y -= this.momentum.y;
  }

  private handlePanEnd = (g: TinyGesture) => {
    // decrease sensitivity of momentum before thresholding
    g.touchMoveX *= 1.4;
    g.touchMoveY *= 1.4;
    // check if user actually panned/moved the pointer
    const overThreshold =
      Math.abs(g.touchMoveX) > 5 || Math.abs(g.touchMoveY) > 5;
    if (overThreshold) {
      this.momentum.x = g.velocityX * 1.4;
      this.momentum.y = g.velocityY * 1.4;
    } else {
      this.showSidebarTimer = this.showSidebarDelayMs;
    }
    this.panning = false;
  };

  private handlePinchZoom = (g: TinyGesture) => {
    const scaleSpeed = 0.6;

    let scale = this.ui.application.stage.scale.x;
    let scaleDelta = scale - g.scale;
    // modify the maps scale based on how much the user pinched
    scale += -1 * scaleDelta * scaleSpeed * scale;
    // clamp to reasonable values
    scale = Math.max(this.minZoom, Math.min(this.maxZoom, scale));
    this.currentZoom = scale;
    this.ui.application.stage.scale.set(scale);
    if (GameSettings.options.toggles.enableCloudMask) {
      this.ui.components.skyMask.setSkyMaskVisibility(this.getNormalizedZoom());
    }
  };

  private handleDoubleTap = (g: TinyGesture) => {
    const zoomInAmount = 1.75;
    let scale = this.ui.application.stage.scale.x * zoomInAmount;

    scale = Math.max(this.minZoom, Math.min(this.maxZoom, scale));

    this.ui.application.stage.scale.set(scale);
    if (GameSettings.options.toggles.enableCloudMask) {
      this.ui.components.skyMask.setSkyMaskVisibility(this.getNormalizedZoom());
    }
  };

  private handleMouseZoom = (e: WheelEvent) => {
    e.preventDefault();
    const scaleSpeed = 0.1;
    const maxScaleSpeed = 0.35;

    let pivotX = this.ui.application.stage.pivot.x;
    let pivotY = this.ui.application.stage.pivot.y;
    let scale = this.ui.application.stage.scale.x;

    let scrollDelta = Math.max(-1, Math.min(1, e.deltaY));
    scrollDelta = Math.max(
      -maxScaleSpeed,
      Math.min(maxScaleSpeed, scrollDelta)
    );
    // modify the scale based on the scroll delta
    scale += -1 * scrollDelta * scaleSpeed * scale;
    // clamp to reasonable values
    scale = Math.max(this.minZoom, Math.min(this.maxZoom, scale));

    // scale = this.roundStagevalue(scale);

    this.currentZoom = scale;
    // console.log("-------- current scale", scale);

    // const roundedPivot = this.roundToNearestTile(pivotX, pivotY);

    // pivotX = Math.ceil(pivotX / Tile.size) * Tile.size;
    // pivotY = Math.ceil(pivotY / Tile.size) * Tile.size;
    // console.log("pivotX, pivotY", pivotX, pivotY);

    // update the scale and position of the stage
    this.ui.application.stage.scale.set(scale);
    // this.ui.gameDisplay.stage.setTransform(
    //   this.game.userInterface.gameDisplay.stage.position.x,
    //   this.game.userInterface.gameDisplay.stage.position.y,
    //   scale, // scale
    //   scale,
    //   null, // rotation
    //   null, // skew
    //   null,
    //   pivotX,
    //   pivotY
    // );
    if (GameSettings.options.toggles.enableCloudMask) {
      this.ui.components.skyMask.setSkyMaskVisibility(this.getNormalizedZoom());
    }
  };

  private updateViewport() {
    // OLD VIEWPORT AND NEW VIEWPORT MUST MATCH (PADDED VS UNPADDED)
    const oldTiles = new Set(this.viewportTilesUnpadded);
    const viewport = this.getViewport();
    this.viewportPadded = viewport.padded;
    this.viewportUnpadded = viewport.unpadded;
    this.viewportTilesPadded = this.getViewportTiles(true);
    this.viewportTilesUnpadded = this.getViewportTiles(false);

    // const enteredTiles: Point[] = [];
    const enteredTiles: number[] = [];
    let point: Point;
    // OLD VIEWPORT AND NEW VIEWPORT MUST MATCH (PADDED VS UNPADDED)
    for (const tileIndex of this.viewportTilesUnpadded) {
      if (!oldTiles.has(tileIndex)) {
        point = indexToPosition(tileIndex, Layer.TERRAIN);
        if (this.game.map.isPointInMap(point)) {
          // enteredTiles.push(point);
          enteredTiles.push(tileIndex);
        }
      }
    }

    this.game.map.onTileEnterViewport(enteredTiles);
  }

  public uiUpdate(deltaTime: number) {
    // console.log("deltaTime", deltaTime);
    if (this.game.gameState.stage === Stages.Play) {
      if (this.showSidebarTimer > 0) {
        this.showSidebarTimer -= deltaTime;
      } else if (this.showSidebarTimer < 0) {
        this.showSidebarTimer = 0;
        this.setSideMenuVisible(true);
      }

      if (Math.abs(this.momentum.x) > 0.2 || Math.abs(this.momentum.y) > 0.2) {
        this.handleMomentum();
      }

      this.moveTowardsTarget(deltaTime);
    }
  }

  public renderUpdate(interpPercent: number) {
    // only update viewport if:
    // zoom/scale change
    // pivot change
    if (!this.viewportPadded) {
      this.updateViewport();
    }
    if (
      this.lastZoom !== this.currentZoom ||
      this.lastPivot.x !== this.ui.application.stage.pivot.x ||
      this.lastPivot.y !== this.ui.application.stage.pivot.y
    ) {
      this.lastZoom = this.currentZoom;
      this.lastPivot.x = this.ui.application.stage.pivot.x;
      this.lastPivot.y = this.ui.application.stage.pivot.y;
      this.updateViewport();
    }
  }

  private moveTowardsTarget(deltaTime: number) {
    // move towards target
    // clear target on any touch events
    let targetPos: Point;
    if (this.viewportTarget && isActor(this.viewportTarget)) {
      targetPos = this.TileToScreenCoords(
        this.viewportTarget.position.x,
        this.viewportTarget.position.y
      );
    } else if (this.viewportTarget && this.viewportTarget instanceof Point) {
      targetPos = this.viewportTarget;
    }
    if (targetPos) {
      let newPivotX;
      let newPivotY;
      if (
        Math.abs(this.ui.application.stage.pivot.x - targetPos.x) > 0.1 &&
        Math.abs(this.ui.application.stage.pivot.y - targetPos.y) > 0.1
      ) {
        newPivotX = lerpEaseInOut(
          deltaTime / 75,
          this.ui.application.stage.pivot.x,
          targetPos.x
        );
        newPivotY = lerpEaseInOut(
          deltaTime / 75,
          this.ui.application.stage.pivot.y,
          targetPos.y
        );
        this.ui.application.stage.pivot.set(newPivotX, newPivotY);
      } else {
        this.ui.application.stage.pivot.set(targetPos.x, targetPos.y);
        this.viewportTarget = null;
      }
    }
  }

  public getNormalizedZoom(): number {
    return this.ui.application.stage.scale.x / (this.maxZoom - this.minZoom);
  }

  // private handleZoom = (e: WheelEvent) => {
  //   e.preventDefault();
  //   const scaleSpeed = 0.1;

  //   const pivotX = this.ui.gameDisplay.stage.pivot.x;
  //   const pivotY = this.ui.gameDisplay.stage.pivot.y;
  //   let scale = this.ui.gameDisplay.stage.scale.x;
  //   let scaledX = (e.x - this.ui.gameDisplay.stage.x) / scale;
  //   let scaledY = (e.y - this.ui.gameDisplay.stage.y) / scale;

  //   // modify the scale based on the scroll delta
  //   scale += -1 * Math.max(-1, Math.min(1, e.deltaY)) * scaleSpeed * scale;
  //   // clamp to reasonable values
  //   scale = Math.max(0.4, Math.min(10, scale));

  //   this.currentZoom = scale;

  //   // update the scale and position of the stage
  //   this.ui.gameDisplay.stage.setTransform(
  //     -scaledX * scale + e.x, // position
  //     -scaledY * scale + e.y,
  //     scale, // scale
  //     scale,
  //     null, // rotation
  //     null, // skew
  //     null,
  //     pivotX, // keeep existing pivot
  //     pivotY
  //   );
  // };
}
