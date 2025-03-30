import { Game } from "./game";
import { LightManager } from "./light-manager";
import { indexToXY, lerp, positionToIndex } from "./misc-utility";
import { HeightLayer, MapWorld } from "./map-world";
import { Point } from "./point";
import { GameSettings } from "./game-settings";
import { Layer } from "./renderer";

export enum LightPhase {
  "rising" = 0,
  "peak" = 1,
  "setting" = 2,
}

export enum SunLevels {
  Bright = "Bright",
  Sunny = "Sunny",
  Clear = "Clear",
  Overcast = "Overcast",
  Dark = "Dark",
}

export enum SunDirection {
  Sunup,
  Sundown,
  Topdown,
}

// export const TempMap = {
//   [SunLevels.Bright]: {
//     min: 0.85,
//     max: 1,
//   },
//   [SunLevels.Sunny]: {
//     min: 0.65,
//     max: 0.85,
//   },
//   [SunLevels.Clear]: {
//     min: 0.4,
//     max: 0.65,
//   },
//   [SunLevels.Overcast]: {
//     min: 0.2,
//     max: 0.4,
//   },
//   [SunLevels.Dark]: {
//     min: 0,
//     max: 0.2,
//   },
// };

export const HeightDropoff = {
  Hole: 0.25,
  Valley: 0.5,
  SeaLevel: 0.7,
  LowHill: 0.8,
  MidHill: 0.9,
  HighHill: 1,
};

// export const HeightDropoff = {
//   Hole: 0.01,
//   Valley: 0.15,
//   SeaLevel: 0.3,
//   LowHill: 0.8,
//   MidHill: 1.2,
//   HighHill: 1.5,
// };

// TODO: ENTIRE CLASS NEEDS TO BE REWORKED
// CALCULATE SHADOWS REGULARLY, RATHER THAN THE ENTIRE MAP AT ONCE
export class MapShadows {
  public lightManager: LightManager;
  public shadowMap: number[];
  public targetShadowMap: number[];
  public occlusionMap: number[];
  public minShadowLength: number;
  public maxShadowLength: number;
  public shadowLength: number;
  public shadowStrength: number;
  public ambientOcclusionShadowStrength: number;
  public ambientLightStrength: number;
  public sundownOffsetMap: [number, number][][];
  public sunupOffsetMap: [number, number][][];
  public sundownDropoffMap: Map<number, Map<number, number>>;
  public sunupDropoffMap: Map<number, Map<number, number>>;
  public topdownDropoffMap: Map<number, Map<number, number>>;
  private oldShadowLength: number;
  private oldPhase: LightPhase;

  constructor(private game: Game, private map: MapWorld) {
    this.shadowMap = [];
    this.targetShadowMap = [];
    this.occlusionMap = [];

    this.shadowStrength = 1;
    this.ambientOcclusionShadowStrength = 1;
    this.minShadowLength = 0;
    this.maxShadowLength = 5;
    this.ambientLightStrength = 0.8;
    this.shadowLength = this.maxShadowLength;
    this.oldShadowLength = this.shadowLength;
    this.oldPhase = this.game.timeManager.lightPhase;
    this.sunupOffsetMap = [];
    this.sundownOffsetMap = [];
    this.sundownDropoffMap = new Map();
    this.sunupDropoffMap = new Map();
    this.topdownDropoffMap = new Map();
    for (let i = 0; i < this.maxShadowLength + 1; i++) {
      // start with 0 instead of minShadowLength to account for special case shadow maps, like the topdown map
      this.sundownDropoffMap.set(i, new Map());
      this.sunupDropoffMap.set(i, new Map());
      this.topdownDropoffMap.set(i, new Map());
    }
  }

  public init() {
    this.shadowMap = [];
    this.targetShadowMap = [];
    this.occlusionMap = [];
    // only update the shadow map for the viewport tiles
    for (let posIndex of this.game.userInterface.camera.viewportTilesPadded) {
      this.targetShadowMap[posIndex] = 1;
      this.occlusionMap[posIndex] = 1;
    }
  }

  public generateShadowMaps() {
    // at each step/update
    // orient the tiles according to angle * time of day
    // as time of day goes on, angle decreases I think
    // leading to a sun-like curve...hopefully
    // calculate sunlight for each tile
    // when moving from higher elevation to lower, decrease sunlight
    // check adjacent-by-angle tiles, and if higher height, reduce brightness by step
    // const sortedCoordMap = this.sortByHeight(this.map.biomeMap);

    // this.sortedCoordMap = this.orientMapReverse(); // working properly
    const tileIndexes = this.game.userInterface.camera.viewportTilesPadded;
    this.sunupOffsetMap = this.calcSunupMap();
    this.sundownOffsetMap = this.calcSundownMap();
    this.generateDropoffMaps();
    this.updateOcclusionShadowMap(tileIndexes);
    this.updateShadowMap(false, SunDirection.Sunup);
    this.updateShadowMap(true, SunDirection.Sunup);
    this.interpolateShadowState(
      this.game.userInterface.camera.viewportTilesUnpadded
    );
  }

  public generateDropoffMaps() {
    // const sorted = this.calcSunupMap();
    // const reverseSorted = this.calcSundownMap();
    const heightLayerAdjacencyMap = this.map.heightLayerAdjacencyD1Map;
    for (let i = 0; i < this.sunupOffsetMap.length; i++) {
      for (let j = 0; j < this.sunupOffsetMap[i].length; j++) {
        const coords = this.sunupOffsetMap[i][j];
        this.calcDropoff(
          coords[0],
          coords[1],
          i,
          j,
          this.sunupOffsetMap,
          SunDirection.Sunup
        );
      }
    }

    for (let i = 0; i < this.sundownOffsetMap.length; i++) {
      for (let j = 0; j < this.sundownOffsetMap[i].length; j++) {
        const coords = this.sundownOffsetMap[i][j];
        this.calcDropoff(
          coords[0],
          coords[1],
          i,
          j,
          this.sundownOffsetMap,
          SunDirection.Sundown
        );
      }
    }

    for (let i = 0; i < GameSettings.options.gameSize.width; i++) {
      for (let j = 0; j < GameSettings.options.gameSize.height; j++) {
        const adjacent = this.map.getAdjacent(i, j, heightLayerAdjacencyMap);
        if (adjacent) {
          this.calcTopDownDropoff(i, j, adjacent);
        }
      }
    }
  }

  public updateOcclusionShadowMap(tileIndexes: number[]) {
    let posIndex: number;
    let posXY: [number, number];
    for (let i = 0; i < tileIndexes.length; i++) {
      posIndex = tileIndexes[i];
      posXY = indexToXY(posIndex, Layer.TERRAIN);
      this.occlusionMap[posIndex] = this.getCastShadowFor(
        posXY[0],
        posXY[1],
        SunDirection.Topdown
      );
    }
  }

  public updateShadowMap(calculateTarget = true, dir: SunDirection) {
    let mapToUpdate = [];
    if (calculateTarget) {
      mapToUpdate = this.targetShadowMap;
    } else {
      mapToUpdate = this.shadowMap;
    }
    const offsetMap =
      dir === SunDirection.Sunup ? this.sunupOffsetMap : this.sundownOffsetMap; // only sunup and sundown maps need to be updated, as theyre dynamic
    for (let i = 0; i < offsetMap.length; i++) {
      for (let j = 0; j < offsetMap[i].length; j++) {
        const coords = offsetMap[i][j];
        const x = coords[0];
        const y = coords[1];
        if (this.game.userInterface.camera.inViewport(x, y)) {
          mapToUpdate[positionToIndex(x, y, Layer.TERRAIN)] =
            this.getCastShadowFor(x, y, dir);
        }
      }
    }
    // for (let i = 0; i < offsetMap.length; i++) {
    //   for (let j = 0; j < offsetMap[i].length; j++) {
    //     const coords = offsetMap[i][j];
    //     const x = coords[0];
    //     const y = coords[1];
    //     mapToUpdate[positionToIndex(x, y, Layer.TERRAIN)] =
    //       this.getCastShadowFor(x, y, dir);
    //   }
    // }
  }

  public turnUpdate() {
    if (!GameSettings.options.toggles.enableShadows) return;
    // shadow strength only changes when the time of day changes,
    // which only changes after a turn is taken
    this.interpolateStrength();
    // shadow direction and length are discrete values, only update on turn change
    this.updateShadowDirection();
    this.updateShadowLength();
  }

  public renderUpdate(interpPercent: number) {
    if (!GameSettings.options.toggles.enableShadows) return;
    // move towards targetShadowMap from shadowMap every frame
    this.interpolateShadowState(
      this.game.userInterface.camera.viewportTilesPadded
    );
  }

  private updateShadowDirection() {
    if (this.oldPhase !== this.game.timeManager.lightPhase) {
      // switch direction of shadows on phase changes
      this.oldPhase = this.game.timeManager.lightPhase;
      this.updateShadowMap(true, this.getShadowDir());
    }
  }

  private updateShadowLength() {
    if (this.oldShadowLength !== this.shadowLength) {
      this.oldShadowLength = this.shadowLength;
      // change length of shadow map when shadowLength changes
      this.updateShadowMap(true, this.getShadowDir());
    }
  }

  private getShadowDir(): SunDirection {
    return this.game.timeManager.lightPhase === LightPhase.rising ||
      this.game.timeManager.lightPhase === LightPhase.peak
      ? SunDirection.Sunup
      : SunDirection.Sundown;
  }

  private interpolateStrength() {
    // shadows change length and strength by time to light transition rather than deltaTime
    const lightTransitionPercent = this.game.timeManager.lightTransitionPercent;
    const remainingCyclePercent = this.game.timeManager.remainingCyclePercent;
    const phase = this.game.timeManager.lightPhase;

    let remainingLightTransitionPercent;
    let shadowStrength = this.shadowStrength;
    let ambientShadowStrength = this.ambientOcclusionShadowStrength;
    if (phase === LightPhase.rising) {
      remainingLightTransitionPercent =
        (1 - remainingCyclePercent) / lightTransitionPercent;
      this.shadowLength = Math.round(
        lerp(
          remainingLightTransitionPercent,
          this.maxShadowLength,
          this.minShadowLength
        )
      );
      shadowStrength = lerp(remainingLightTransitionPercent, 0, 0.8);
      ambientShadowStrength = lerp(remainingLightTransitionPercent, 1, 0.3);
    } else if (phase === LightPhase.setting) {
      remainingLightTransitionPercent =
        remainingCyclePercent / lightTransitionPercent;
      this.shadowLength = Math.round(
        lerp(
          remainingLightTransitionPercent,
          this.maxShadowLength,
          this.minShadowLength
        )
      );
      shadowStrength = lerp(remainingLightTransitionPercent, 0, 0.8);
      ambientShadowStrength = lerp(remainingLightTransitionPercent, 1, 0.3);
    }
    this.ambientOcclusionShadowStrength =
      Math.round(ambientShadowStrength * 1000) / 1000;
    this.shadowStrength = Math.round(shadowStrength * 1000) / 1000;
  }

  public interpolateShadowState(tileIndexes: number[]) {
    // smoothly transition between shadowMap and targetShadowMap over time
    let val: number;
    const progress = this.game.timeManager.turnAnimTimePercent;
    let index: number;
    for (let i = 0; i < tileIndexes.length; i++) {
      index = tileIndexes[i];
      val = lerp(progress, this.shadowMap[index], this.targetShadowMap[index]);
      this.shadowMap[index] = val;
    }
  }

  // private sortMap(
  //   map: { [key: string]: Biome },
  //   vector: Point = new Point(1, 1)
  // ): string[] {
  //   const rows = GameSettings.options.gameSize.height;
  //   const columns = GameSettings.options.gameSize.width;
  //   const total = columns + rows - 1;
  //   const result = [];

  //   // sort by scalar product of vector
  //   const sorted = Object.keys(map).sort((a, b) => {
  //     const pointA = MapWorld.keyToPoint(a);
  //     const pointB = MapWorld.keyToPoint(b);
  //     const scalarA = pointA.x * vector.x + pointA.y * vector.y;
  //     const scalarB = pointB.x * vector.x + pointB.y * vector.y;
  //     return scalarA - scalarB;
  //   });
  //   return sorted;
  // }

  private calcSundownMap(): [number, number][][] {
    const rows = GameSettings.options.gameSize.height;
    const columns = GameSettings.options.gameSize.width;
    const result = [];

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < columns; j++) {
        const el = [j, i];
        const pos = j + rows - i - 1;

        if (!result[pos]) {
          result[pos] = [];
        }

        result[pos].unshift(el);
      }
    }

    return result;
  }

  private calcSunupMap(): [number, number][][] {
    const rows = GameSettings.options.gameSize.height;
    const columns = GameSettings.options.gameSize.width;
    const result = [];

    for (let i = rows; i >= 0; i--) {
      for (let j = 0; j < columns; j++) {
        const el = [i, j];
        const pos = i + j;

        if (!result[pos]) {
          result[pos] = [];
        }

        result[pos].unshift(el);
      }
    }

    return result;
  }

  private getHeightDropoff(
    currentHeight: HeightLayer,
    previousHeight: HeightLayer
  ): number {
    let dropoff = HeightDropoff[previousHeight] - HeightDropoff[currentHeight];
    if (dropoff > 0) {
      dropoff = 1 - dropoff;
      // since this is used to represent light later, we want to measure the drop between ambient light and 0 light
      dropoff = lerp(this.ambientLightStrength, 0, dropoff);
      return Math.round(dropoff * 1000) / 1000;
    }
    return 0;
  }

  private getOcclusionHeightDropoff(
    currentHeight: HeightLayer,
    previousHeight: HeightLayer
  ): number {
    // occlusion dropoff doesn't care about the ambient light strength limit.
    // will be used to lerp between two colors later
    let dropoff = HeightDropoff[previousHeight] - HeightDropoff[currentHeight];
    if (dropoff > 0) {
      dropoff = 1 - dropoff;
      return Math.round(dropoff * 1000) / 1000;
    }
    return 1;
  }

  public calcDropoff(
    x: number,
    y: number,
    row: number,
    index: number,
    coordMap: [number, number][][],
    mapKey: SunDirection
  ): number {
    const posIndex = positionToIndex(x, y, Layer.TERRAIN);
    const heightLevel = this.map.heightLayerMap.get(posIndex);

    let lastPosIndex = -1;
    let lastPos = [];
    let lastRow: [number, number][];
    let lastHeightLevel: HeightLayer;
    let dropoff = 0;

    for (let i = this.minShadowLength; i < this.maxShadowLength + 1; i++) {
      lastRow = coordMap[row - i];
      const lastIndex = index - i;
      if (!lastRow || lastIndex < 0) {
        lastHeightLevel = heightLevel;
      } else {
        lastPos = lastRow[lastIndex];
        lastPosIndex = positionToIndex(lastPos[0], lastPos[1], Layer.TERRAIN);
        lastHeightLevel = lastRow
          ? this.map.heightLayerMap.get(lastPosIndex)
          : heightLevel;
      }

      dropoff = this.getHeightDropoff(heightLevel, lastHeightLevel);
      switch (mapKey) {
        case SunDirection.Sunup:
          if (this.sunupDropoffMap.get(i) === undefined) {
            this.sunupDropoffMap.set(i, new Map());
          }
          this.sunupDropoffMap.get(i).set(posIndex, dropoff);
          break;
        case SunDirection.Sundown:
          if (this.sundownDropoffMap.get(i) === undefined) {
            this.sundownDropoffMap.set(i, new Map());
          }
          this.sundownDropoffMap.get(i).set(posIndex, dropoff);
          break;
        case SunDirection.Topdown:
          if (this.topdownDropoffMap.get(i) === undefined) {
            this.topdownDropoffMap.set(i, new Map());
          }
          this.topdownDropoffMap.get(i).set(posIndex, dropoff);
          break;
      }
    }

    return dropoff;
  }

  public calcTopDownDropoff(
    x: number,
    y: number,
    adjacent: HeightLayer[]
  ): number {
    const posIndex = positionToIndex(x, y, Layer.TERRAIN);
    const heightLevel = this.map.heightLayerMap.get(posIndex);
    let dropoff = 0;
    for (let i = 0; i < adjacent.length; i++) {
      const adjacentHeightLayer = adjacent[i];
      const currentDropoff = this.getOcclusionHeightDropoff(
        heightLevel,
        adjacentHeightLayer
      );
      if (currentDropoff > 0) {
        if (dropoff === 0) {
          dropoff = currentDropoff;
        } else {
          dropoff *= currentDropoff;
        }
      }
    }
    dropoff = Math.round(dropoff * 1000) / 1000;
    this.topdownDropoffMap.get(1).set(posIndex, dropoff);

    return dropoff;
  }

  private getCastShadowFor(x: number, y: number, dir: SunDirection): number {
    const posIndex = positionToIndex(x, y, Layer.TERRAIN);
    // if dir is topdown (sun overhead), use the topdown shadow map, aka shadowLength of 1
    let map;
    switch (dir) {
      case SunDirection.Sunup:
        map = this.sunupDropoffMap.get(this.shadowLength);
        break;
      case SunDirection.Sundown:
        map = this.sundownDropoffMap.get(this.shadowLength);
        break;
      case SunDirection.Topdown:
        map = this.topdownDropoffMap.get(1);
        break;
    }
    if (!map) {
      console.log("no map", this.shadowLength, dir, x, y, posIndex);
      return 0;
    }
    // if there is no dropoff, this tile gets full sun
    const sunlight = map.get(posIndex) || this.ambientLightStrength;

    return sunlight;
  }

  get(x: number, y: number): number {
    return this.shadowMap[positionToIndex(x, y, Layer.TERRAIN)];
  }

  set(x: number, y: number, sunlightAmount: number): void {
    this.shadowMap[positionToIndex(x, y, Layer.TERRAIN)] = sunlightAmount;
  }

  public onEnter(indexes: number[]): void {
    if (!GameSettings.options.toggles.enableShadows) {
      return;
    }
    // occlusion maps are static, so just update it on enter
    this.updateOcclusionShadowMap(indexes);
    // immediately update the shadow map when a tile enters the viewport
    const dir = this.getShadowDir();
    let xy: [number, number];
    for (let index of indexes) {
      xy = indexToXY(index, Layer.TERRAIN);
      const lvl = this.getCastShadowFor(xy[0], xy[1], dir);
      this.targetShadowMap[index] = lvl;
      this.shadowMap[index] = lvl;
    }
  }
}
