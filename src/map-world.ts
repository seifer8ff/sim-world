import { Color, RNG } from "rot-js";
import { Game } from "./game";
import { BaseTileKey, Tile } from "./tile";
import { Point } from "./point";
import { Layer } from "./renderer";
import { Autotile } from "./autotile";
import Simplex from "rot-js/lib/noise/simplex";
import { LightManager } from "./light-manager";
import {
  getMapStats,
  getScaledNoise,
  indexToPosition,
  lerp,
  positionToIndex,
} from "./misc-utility";
import { MapTemperature } from "./map-temperature";
import { MapMoisture } from "./map-moisture";
import { Season } from "./time-manager";
import { Biome, BiomeId, Biomes, ImpassibleBorder } from "./biomes";
import { Color as ColorType } from "rot-js/lib/color";
import { MapShadows } from "./map-shadows";
import { MapPoles } from "./map-poles";
import { MapClouds } from "./map-clouds";
import Noise from "rot-js/lib/noise/noise";
import { clamp } from "rot-js/lib/util";
import { Assets, Sprite, Texture } from "pixi.js";
import { GameSettings } from "./game-settings";
import { shuffle } from "lodash";

export type MapType = ValueMap | BiomeMap | TileMap;
export type ValueMap = Map<number, number>;
export type BiomeMap = Map<number, BiomeId>;
export type TileMap = number[]; // map of tile Ids. Retrieve actual Tile from Tile.tiles

export enum HeightLayer {
  Hole = "Hole",
  Valley = "Valley",
  SeaLevel = "SeaLevel",
  LowHill = "LowHill",
  MidHill = "MidHill",
  HighHill = "HighHill",
}

export const HeightColor = {
  [HeightLayer.LowHill]: Color.fromString("rgb(15, 15, 15)"),
  [HeightLayer.MidHill]: Color.fromString("rgb(30, 30, 30)"),
  [HeightLayer.HighHill]: Color.fromString("rgb(45, 45, 45)"),
};

export class MapWorld {
  public lightManager: LightManager;
  public terrainMap: BiomeMap; // the base terrain of the map (sandydirt, moistdirt, ocean)
  public biomeMap: BiomeMap; // the final map of biomes
  public autotileMap: ValueMap; // the final map of autotile indices
  public tileMap: TileMap; // the final map of tiles to be drawn (may or may not be autotiled)
  public heightMap: ValueMap; // number between 0 and 1 representing height
  public heightLayerMap: Map<number, HeightLayer>;
  public tempMap: MapTemperature;
  public moistureMap: MapMoisture;
  public shadowMap: MapShadows;
  public polesMap: MapPoles;
  public cloudMap: MapClouds;
  public seaLevel: number;

  public heightAdjacencyD1Map: number[][]; // adjacency map with distance of 1 tile
  public heightAdjacencyD2Map: number[][];
  public heightLayerAdjacencyD1Map: HeightLayer[][];
  public heightLayerAdjacencyD2Map: HeightLayer[][];

  //
  public terrainAdjacencyD1Map: BiomeId[][]; // adjacency map with distance of 1 tile
  public terrainAdjacencyD2Map: BiomeId[][];

  public biomeAdjacencyD1Map: BiomeId[][]; // adjacency map with distance of 1 tile
  public biomeAdjacencyD2Map: BiomeId[][];
  private dirtyTiles: number[];
  private landHeight: number;
  private valleyScaleFactor: number;
  private edgePadding: number;
  private islandMask: number;

  constructor(private game: Game) {
    this.tileMap = [];
    this.biomeMap = new Map();
    this.autotileMap = new Map();
    this.heightMap = new Map();
    this.heightLayerMap = new Map();
    this.moistureMap = new MapMoisture(this.game, this);
    this.tempMap = new MapTemperature(this.game, this);
    this.shadowMap = new MapShadows(this.game, this);
    this.polesMap = new MapPoles(this.game, this);
    this.cloudMap = new MapClouds(this.game, this);
    this.lightManager = new LightManager(this.game, this);
    this.terrainMap = new Map();
    this.seaLevel = Biomes.Biomes.ocean.generationOptions.height.max;
    this.heightAdjacencyD1Map = [];
    this.heightAdjacencyD2Map = [];
    this.heightLayerAdjacencyD1Map = [];
    this.heightLayerAdjacencyD2Map = [];
    this.terrainAdjacencyD1Map = [];
    this.terrainAdjacencyD2Map = [];
    this.biomeAdjacencyD1Map = [];
    this.biomeAdjacencyD2Map = [];
    this.dirtyTiles = [];
    this.landHeight = 0.5;
    this.valleyScaleFactor = 2;
    this.edgePadding = 0;
    this.islandMask = 0.38;
  }

  public static biomeHeightToLayer(
    height: number,
    biomeId?: BiomeId
  ): HeightLayer {
    // TODO: overhaul how valley/holes work. They probably should be below sealevel, but idk

    // if (height < Biomes.Biomes.valley.generationOptions.height.min) {
    //   return HeightLayer.Hole;
    // }
    // if (
    //   height >= Biomes.Biomes.valley.generationOptions.height.min &&
    //   height <= Biomes.Biomes.valley.generationOptions.height.max
    // ) {
    //   if (biome?.id == Biomes.Biomes.valley.id) {
    //     // valley can only exist on moistdirt
    //     // otherwise everything below seaLevel would be valley
    //     return HeightLayer.Valley;
    //   } else {
    //     return HeightLayer.SeaLevel;
    //   }
    // }
    if (height < Biomes.Biomes.hillslow.generationOptions.height.min) {
      return HeightLayer.SeaLevel;
    }
    if (height < Biomes.Biomes.hillsmid.generationOptions.height.min) {
      return HeightLayer.LowHill;
    }
    if (height < Biomes.Biomes.hillshigh.generationOptions.height.min) {
      return HeightLayer.MidHill;
    }
    if (height >= Biomes.Biomes.hillshigh.generationOptions.height.min) {
      return HeightLayer.HighHill;
    }
    return HeightLayer.SeaLevel;
  }

  public static heightToColor(height: number): ColorType {
    const heightLayer = MapWorld.biomeHeightToLayer(height);
    return HeightColor[heightLayer];
  }

  public static coordsToKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  public static keyToPoint(key: string): Point {
    let parts = key.split(",");
    return new Point(parseInt(parts[0]), parseInt(parts[1]));
  }

  generateMap(width: number, height: number): void {
    this.tileMap = [];
    this.biomeMap = new Map();
    this.heightMap = new Map();
    this.terrainMap = new Map();
    this.dirtyTiles = [];
    let index = -1;

    // first pass, generate base height and assign terrain
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        index = positionToIndex(x, y, Layer.TERRAIN);
        this.polesMap.generateMagnetism(x, y, width, height, this.game.noise);
        this.heightMap.set(
          index,
          this.getHeight(x, y, width, height, this.game.noise)
        );
        this.terrainMap.set(index, this.assignTerrain(x, y));
      }
    }
    // console.log("poles map", this.polesMap.magnetismMap);
    // generate the adjacency map for future passes
    this.regenerateAdjacencyMap("height");
    this.regenerateAdjacencyMap("heightLayer");
    this.regenerateAdjacencyMap("terrain");
    // second pass, process terrain from first pass to smooth out issues
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        index = positionToIndex(x, y, Layer.TERRAIN);
        this.terrainMap.set(index, this.processTerrain(x, y));
      }
    }
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        index = positionToIndex(x, y, Layer.TERRAIN);
        this.heightLayerMap.set(index, this.getHeightLayer(x, y));
      }
    }
    // update adjacency maps again
    this.regenerateAdjacencyMap("terrain");
    // third pass, generate climate maps
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        this.moistureMap.generateMoistureFor(
          x,
          y,
          width,
          height,
          this.game.noise
        );
        this.tempMap.generateInitialTemp(x, y, width, height, this.game.noise);
      }
    }

    const stats = getMapStats(Array.from(this.tempMap.tempMap.values()), [
      { label: "over90", threshold: 0.9 },
      { label: "over80", threshold: 0.8 },
      { label: "over70", threshold: 0.7 },
      { label: "over55", threshold: 0.55 },
      { label: "over32", threshold: 0.32 },
      {
        label: "under55",
        threshold: 0.55,
        isNegative: true,
      },
      {
        label: "under32",
        threshold: 0.32,
        isNegative: true,
      },
      {
        label: "under15",
        threshold: 0.15,
        isNegative: true,
      },
      {
        label: "under0",
        threshold: 0,
        isNegative: true,
      },
    ]);
    console.log("temp map", stats);
    // assign biome map using climate maps
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        index = positionToIndex(x, y, Layer.TERRAIN);
        this.biomeMap.set(index, this.assignBiome(x, y));
      }
    }
    // update adjacency maps again
    this.regenerateAdjacencyMap("biome");
    // assign biome map using climate maps
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        index = positionToIndex(x, y, Layer.TERRAIN);
        this.biomeMap.set(index, this.addTemperatureTerrain(x, y));
        this.biomeMap.set(index, this.addMidLayers(x, y));
      }
    }
    // update adjacency maps again
    this.regenerateAdjacencyMap("biome");
    this.regenerateAdjacencyMap("height");
    this.regenerateAdjacencyMap("heightLayer");
    // add secondary features
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        index = positionToIndex(x, y, Layer.TERRAIN);
        this.biomeMap.set(index, this.addUpperLayers(x, y));
        this.biomeMap.set(index, this.addLowerLayers(x, y));
      }
    }
    this.regenerateAdjacencyMap("biome");
    this.regenerateAdjacencyMap("height");
    this.regenerateAdjacencyMap("heightLayer");
    // process biomes
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        index = positionToIndex(x, y, Layer.TERRAIN);
        this.biomeMap.set(index, this.smoothBiomeTransitions(x, y));
      }
    }
    // update adjacency maps again
    this.regenerateAdjacencyMap("biome");
    this.regenerateAdjacencyMap("height");
    this.regenerateAdjacencyMap("heightLayer");
    // console.log("cloudMap", this.cloudMap.cloudMap);
    // console.log("moistureMap", this.moistureMap.moistureMap);
    if (GameSettings.options.toggles.enableShadows) {
      this.shadowMap.generateShadowMaps();
    }

    // finally, generate the tile map
    if (GameSettings.options.toggles.enableAutotile) {
      this.generateAutotileMap(this.biomeMap);
    } else {
      this.generateBasetileMap(this.biomeMap);
    }

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        index = positionToIndex(x, y, Layer.TERRAIN);
        this.dirtyTiles.push(index); // all tiles need to be rendered
      }
    }
  }

  public getHeightLayer(x: number, y: number): HeightLayer {
    const index = positionToIndex(x, y, Layer.TERRAIN);
    return MapWorld.biomeHeightToLayer(
      this.heightMap.get(index),
      this.biomeMap.get(index)
    );
  }

  private generateBasetileMap(rawMap: Map<number, BiomeId>) {
    for (const [index, biomeId] of rawMap) {
      const tile =
        Tile.Tilesets[biomeId][this.game.timeManager.season][BaseTileKey];

      if (!tile) {
        console.log(
          `BASETILE ERROR: ${biomeId} - ${this.game.timeManager.season}`
        );
      }
      this.tileMap[index] = tile.id;
    }
  }

  getHeight(
    x: number,
    y: number,
    mapWidth: number,
    mapHeight: number,
    noise: Noise
  ): number {
    // randomize the edge padding to prevent a squared-off look
    const randomizedEdgePadding = this.edgePadding + RNG.getUniformInt(0, 2);

    // if near the edge of the map, return a lower height
    if (
      x < randomizedEdgePadding ||
      x >= mapWidth - randomizedEdgePadding ||
      y < randomizedEdgePadding ||
      y >= mapHeight - randomizedEdgePadding
    ) {
      return this.landHeight / 2;
    }

    let noiseX = x / mapWidth - 0.5;
    let noiseY = y / mapHeight - 0.5;

    // add different octaves of frequency
    // some small hills, some large, etc
    // 1 / octave * this.getScaledNoise(noise, octave * noiseX, octave * noiseY)
    let height = 0.7 * getScaledNoise(noise, 3 * noiseX, 3 * noiseY);
    height += 0.5 * getScaledNoise(noise, 4 * noiseX, 4 * noiseY);
    height += 0.3 * getScaledNoise(noise, 8 * noiseX, 8 * noiseY);
    height += 0.3 * getScaledNoise(noise, 15 * noiseX, 15 * noiseY);
    height = height / (0.4 + 0.5 + 0.3 + 0.2); // scale to between 0 and 1

    height = Math.pow(height, this.valleyScaleFactor); // reshape valleys/mountains

    // reduce height near edges of map
    const dx = (2 * x) / mapWidth - 1;
    const dy = (2 * y) / mapHeight - 1;
    const d = 1 - (1 - Math.pow(dx, 2)) * (1 - Math.pow(dy, 2));
    height = lerp(this.islandMask, height, 1 - d);

    return height;
  }

  assignTerrain(x: number, y: number): BiomeId {
    // assign the high level terrain types
    // features will be placed within these terrain types for tiling transition purposes
    const heightVal = this.heightMap.get(positionToIndex(x, y, Layer.TERRAIN));
    if (
      Biomes.inRangeOf(heightVal, Biomes.Biomes.ocean.generationOptions.height)
    ) {
      return Biomes.Biomes.ocean.id;
    }

    if (
      Biomes.inRangeOf(
        heightVal,
        Biomes.Biomes.moistdirt.generationOptions.height
      )
    ) {
      return Biomes.Biomes.moistdirt.id;
    }

    if (
      Biomes.inRangeOf(
        heightVal,
        Biomes.Biomes.sandydirt.generationOptions.height
      )
    ) {
      return Biomes.Biomes.sandydirt.id;
    }
  }

  private processTerrain(x: number, y: number): BiomeId {
    const key = MapWorld.coordsToKey(x, y);
    const index = positionToIndex(x, y, Layer.TERRAIN);
    const terrain = this.terrainMap.get(index);
    const adjacentTerrain = this.terrainAdjacencyD2Map[index];
    // const moistureVal = this.moistureMap.getMoistureByKey(key);

    // check if any adjacent terrain is null- if so, set to ocean
    if (adjacentTerrain.some((terrain) => terrain == null)) {
      const newHeight = Biomes.Biomes.ocean.generationOptions.height.max - 0.1;
      this.heightMap.set(index, newHeight);
      this.shiftHeight(x, y, Biomes.Biomes.ocean.id);
      this.shiftMoisture(x, y, Biomes.Biomes.ocean);
      this.shiftTemperature(x, y, Biomes.Biomes.ocean);
      return Biomes.Biomes.ocean.id;
    }

    // add a single tile thick border of sandydirt around moistdirt coasts to improve autotiling
    if (terrain === Biomes.Biomes.moistdirt.id) {
      if (
        this.isAdjacentToBiome(x, y, this.terrainAdjacencyD2Map, [
          Biomes.Biomes.ocean.id,
        ])
      ) {
        this.shiftHeight(x, y, Biomes.Biomes.sandydirt.id);
        this.shiftMoisture(x, y, Biomes.Biomes.sandydirt);
        this.shiftTemperature(x, y, Biomes.Biomes.sandydirt);
        return Biomes.Biomes.sandydirt.id;
      }
    }
    return terrain;
  }

  private smoothBiomeTransitions(x: number, y: number): BiomeId {
    const biomeId = this.biomeMap.get(positionToIndex(x, y, Layer.TERRAIN));

    // beach doesn't autotile with moistdirt, so add a layer of sandydirt, which does
    if (biomeId == Biomes.Biomes.beach.id) {
      if (
        this.isAdjacentToBiome(x, y, this.terrainAdjacencyD1Map, [
          Biomes.Biomes.moistdirt.id,
        ])
      ) {
        this.shiftHeight(x, y, Biomes.Biomes.sandydirt.id);
        this.shiftTemperature(x, y, Biomes.Biomes.sandydirt);
        this.shiftMoisture(x, y, Biomes.Biomes.sandydirt);
        return Biomes.Biomes.sandydirt.id;
      }
    }

    return biomeId;
  }

  private shiftHeight(x: number, y: number, newBiomeId: BiomeId) {
    const index = positionToIndex(x, y, Layer.TERRAIN);
    const height = this.heightMap.get(index);
    const newBiome = Biomes.Biomes[newBiomeId];
    this.heightMap.set(
      index,
      Biomes.shiftToBiome(height, newBiome.generationOptions.height)
    );
    this.heightLayerMap.set(
      index,
      MapWorld.biomeHeightToLayer(this.heightMap.get(index), newBiomeId)
    );
  }

  private shiftTemperature(x: number, y: number, newBiome: Biome) {
    const temp = this.tempMap.getTemp(x, y);
    this.tempMap.setTemp(
      x,
      y,
      Biomes.shiftToBiome(temp, newBiome.generationOptions.temperature)
    );
  }

  private shiftMoisture(x: number, y: number, newBiome: Biome) {
    const moisture = this.moistureMap.getMoisture(x, y);
    this.moistureMap.setMoisture(
      x,
      y,
      Biomes.shiftToBiome(moisture, newBiome.generationOptions.moisture)
    );
  }

  private addTemperatureTerrain(x: number, y: number): BiomeId {
    const biomeId = this.biomeMap.get(positionToIndex(x, y, Layer.TERRAIN));
    const validTerrainTypes = [
      Biomes.Biomes.moistdirt.id,
      Biomes.Biomes.snowmoistdirt.id,
    ];
    const maps = {
      height: this.heightMap,
      temperature: this.tempMap.tempMap,
      moisture: this.moistureMap.moistureMap,
    };
    if (biomeId == Biomes.Biomes.hillsmid.id) {
      if (
        Biomes.inRangeOfAll(
          x,
          y,
          maps,
          Biomes.Biomes.hillshigh.generationOptions
        ) &&
        Biomes.inRangeOfAll(
          x,
          y,
          maps,
          Biomes.Biomes.snowhillshillsmid.generationOptions
        ) &&
        this.isSurroundedBy(x, y, this.biomeAdjacencyD1Map, [
          Biomes.Biomes.hillsmid.id,
          Biomes.Biomes.hillshigh.id,
        ])
      ) {
        return Biomes.Biomes.snowhillshillsmid.id;
      }
    }

    if (
      validTerrainTypes.includes(biomeId) &&
      Biomes.inRangeOfAll(
        x,
        y,
        maps,
        Biomes.Biomes.snowmoistdirt.generationOptions
      ) &&
      this.isSurroundedBy(x, y, this.biomeAdjacencyD1Map, validTerrainTypes)
    ) {
      return Biomes.Biomes.snowmoistdirt.id;
    }

    return biomeId;
  }

  private addTemperatureFeatures(x: number, y: number): BiomeId {
    const index = positionToIndex(x, y, Layer.TERRAIN);
    const terrain = this.terrainMap.get(index);
    const height = this.heightMap.get(index);
    const temp = this.tempMap.getTempByIndex(index);
    const moisture = this.moistureMap.getMoisture(x, y);
    const biomeId = this.biomeMap.get(index);
    const adjacentBiomes = this.biomeAdjacencyD2Map[index];

    // if (biome.id == Biomes.Biomes.snowydirt.id) {
    //   if (
    //     Biomes.inRange(height, Biomes.Biomes.snow.generationOptions.height) &&
    //     Biomes.inRange(moisture, Biomes.Biomes.snow.generationOptions.moisture)
    //   ) {
    //     if (
    //       this.isSurroundedBy(x, y, this.biomeAdjacencyD2Map, [
    //         Biomes.Biomes.snowydirt,
    //         Biomes.Biomes.snow,
    //       ])
    //     ) {
    //       return Biomes.Biomes.snow;
    //     }
    //   }
    // }

    return biomeId;
  }

  private addMidLayers(x: number, y: number): BiomeId {
    const index = positionToIndex(x, y, Layer.TERRAIN);
    const height = this.heightMap.get(index);
    const biomeId = this.biomeMap.get(index);
    const isMidHeight = Biomes.inRangeOf(
      height,
      Biomes.Biomes.hillsmid.generationOptions.height
    );
    const isMoistdirtBase = biomeId == Biomes.Biomes.moistdirt.id;
    if (isMidHeight && isMoistdirtBase) {
      if (
        this.isSurroundedBy(x, y, this.biomeAdjacencyD1Map, [
          Biomes.Biomes.moistdirt.id,
          Biomes.Biomes.hillsmid.id,
        ])
      ) {
        return Biomes.Biomes.hillsmid.id;
      }
    }
    if (isMidHeight) {
      this.shiftHeight(x, y, biomeId);
    }
    return biomeId;
  }

  private addUpperLayers(x: number, y: number): BiomeId {
    const index = positionToIndex(x, y, Layer.TERRAIN);
    const height = this.heightMap.get(index);
    const biomeId = this.biomeMap.get(index);
    const isUpperHeight = Biomes.inRangeOf(
      height,
      Biomes.Biomes.hillshigh.generationOptions.height
    );
    const isMidhillsBase = biomeId == Biomes.Biomes.hillsmid.id;

    if (isUpperHeight && isMidhillsBase) {
      // only add high hills if surrounded by mid hills
      if (
        this.isSurroundedBy(x, y, this.biomeAdjacencyD1Map, [
          Biomes.Biomes.hillsmid.id,
          Biomes.Biomes.hillshigh.id,
        ])
      ) {
        this.shiftHeight(x, y, Biomes.Biomes.hillshigh.id);
        return Biomes.Biomes.hillshigh.id;
      }
    }
    if (isUpperHeight) {
      this.shiftHeight(x, y, biomeId);
    }
    return biomeId;
  }

  private addLowerLayers(x: number, y: number): BiomeId {
    const index = positionToIndex(x, y, Layer.TERRAIN);
    const height = this.heightMap.get(index);
    const biomeId = this.biomeMap.get(index);
    const isLowerHeight = Biomes.inRangeOf(
      height,
      Biomes.Biomes.valley.generationOptions.height
    );
    const isMoistDirt = biomeId == Biomes.Biomes.moistdirt.id;
    if (isLowerHeight && isMoistDirt) {
      if (
        this.isSurroundedBy(x, y, this.biomeAdjacencyD1Map, [
          Biomes.Biomes.moistdirt.id,
          Biomes.Biomes.valley.id,
        ])
      ) {
        return Biomes.Biomes.valley.id;
      }
    }

    if (isLowerHeight) {
      this.shiftHeight(x, y, biomeId);
    }

    return biomeId;
  }

  private regenerateAdjacencyMap(
    map: "terrain" | "biome" | "height" | "heightLayer"
  ) {
    for (let x = 0; x < GameSettings.options.gameSize.width; x++) {
      for (let y = 0; y < GameSettings.options.gameSize.height; y++) {
        const index = positionToIndex(x, y, Layer.TERRAIN);
        if (map === "terrain") {
          this.terrainAdjacencyD1Map[index] = this.assignAdjacentBiomes(
            x,
            y,
            this.terrainMap,
            1
          );
          this.terrainAdjacencyD2Map[index] = this.assignAdjacentBiomes(
            x,
            y,
            this.terrainMap,
            2
          );
        } else if (map === "biome") {
          this.biomeAdjacencyD1Map[index] = this.assignAdjacentBiomes(
            x,
            y,
            this.biomeMap,
            2
          );
          this.biomeAdjacencyD2Map[index] = this.assignAdjacentBiomes(
            x,
            y,
            this.biomeMap,
            2
          );
        } else if (map === "height") {
          this.heightAdjacencyD1Map[index] = this.assignAdjacentHeights(
            x,
            y,
            this.heightMap,
            1
          );
          this.heightAdjacencyD2Map[index] = this.assignAdjacentHeights(
            x,
            y,
            this.heightMap,
            2
          );
        } else if (map === "heightLayer") {
          this.heightLayerAdjacencyD1Map[index] =
            this.assignAdjacentHeightLayers(x, y, this.heightLayerMap, 1);
          this.heightLayerAdjacencyD2Map[index] =
            this.assignAdjacentHeightLayers(x, y, this.heightLayerMap, 2);
        }
      }
    }
  }

  assignAdjacentBiomes(
    x: number,
    y: number,
    map: Map<number, BiomeId>,
    distance = 1
  ): BiomeId[] {
    const adjacentBiomes: BiomeId[] = [];
    let index = -1;
    let biomeId: BiomeId;
    for (let xOffset = -distance; xOffset <= distance; xOffset++) {
      for (let yOffset = -distance; yOffset <= distance; yOffset++) {
        if (xOffset === 0 && yOffset === 0) {
          continue;
        }
        index = positionToIndex(x + xOffset, y + yOffset, Layer.TERRAIN);
        biomeId = map.get(index);
        adjacentBiomes.push(biomeId);
      }
    }
    return adjacentBiomes;
  }

  assignAdjacentHeights(
    x: number,
    y: number,
    map: Map<number, number>,
    distance = 1
  ): number[] {
    const adjacentHeights = [];
    let index = -1;
    let height: number;
    for (let xOffset = -distance; xOffset <= distance; xOffset++) {
      for (let yOffset = -distance; yOffset <= distance; yOffset++) {
        if (xOffset === 0 && yOffset === 0) {
          continue;
        }
        index = positionToIndex(x + xOffset, y + yOffset, Layer.TERRAIN);
        height = map.get(index);
        adjacentHeights.push(height);
      }
    }
    return adjacentHeights;
  }

  assignAdjacentHeightLayers(
    x: number,
    y: number,
    map: Map<number, HeightLayer>,
    distance = 1
  ): HeightLayer[] {
    const adjacentHeightLayers = [];
    let index: number;
    let heightLayer: HeightLayer;
    for (let xOffset = -distance; xOffset <= distance; xOffset++) {
      for (let yOffset = -distance; yOffset <= distance; yOffset++) {
        if (xOffset === 0 && yOffset === 0) {
          continue;
        }
        index = positionToIndex(x + xOffset, y + yOffset, Layer.TERRAIN);
        heightLayer = map.get(index);
        adjacentHeightLayers.push(heightLayer);
      }
    }
    return adjacentHeightLayers;
  }

  isAdjacentToBiome(
    x: number,
    y: number,
    adjacencyMap: BiomeId[][],
    terrain: BiomeId[]
  ): boolean {
    const index = positionToIndex(x, y, Layer.TERRAIN);
    const adjacentTerrain = adjacencyMap[index];
    // console
    //   .throttle(100)
    //   .log("adjacentTerrain", adjacentTerrain, terrain, x, y, key, index);
    for (let i = 0; i < adjacentTerrain.length; i++) {
      if (terrain.includes(adjacentTerrain[i])) {
        return true;
      }
    }
    return false;
  }

  getAdjacent(x: number, y: number, adjacencyMap: any[][]): any[] {
    return adjacencyMap[positionToIndex(x, y, Layer.TERRAIN)];
  }

  isSurroundedBy(
    x: number,
    y: number,
    adjacencyMap: BiomeId[][],
    terrain: BiomeId[]
  ): boolean {
    const index = positionToIndex(x, y, Layer.TERRAIN);
    const adjacentTerrain = adjacencyMap[index];
    for (let i = 0; i < adjacentTerrain.length; i++) {
      if (!terrain.includes(adjacentTerrain[i])) {
        return false;
      }
    }
    return true;
  }

  assignBiome(x: number, y: number): BiomeId {
    const terrain = this.terrainMap.get(positionToIndex(x, y, Layer.TERRAIN));
    const maps = {
      height: this.heightMap,
      temperature: this.tempMap.tempMap,
      moisture: this.moistureMap.moistureMap,
    };

    if (terrain === Biomes.Biomes.ocean.id) {
      if (
        Biomes.inRangeOfAll(
          x,
          y,
          maps,
          Biomes.Biomes.oceandeep.generationOptions
        )
      ) {
        return Biomes.Biomes.oceandeep.id;
      }
      return Biomes.Biomes.ocean.id;
    }

    if (terrain === Biomes.Biomes.sandydirt.id) {
      if (
        Biomes.inRangeOfAll(x, y, maps, Biomes.Biomes.beach.generationOptions)
      ) {
        return Biomes.Biomes.beach.id;
      }
      return Biomes.Biomes.sandydirt.id;
    }

    if (terrain === Biomes.Biomes.moistdirt.id) {
      if (
        Biomes.inRangeOfAll(
          x,
          y,
          maps,
          Biomes.Biomes.hillshigh.generationOptions
        )
      ) {
        // later processing could turn this into hillshigh
        return Biomes.Biomes.hillsmid.id;
      }

      if (
        Biomes.inRangeOfAll(
          x,
          y,
          maps,
          Biomes.Biomes.hillsmid.generationOptions
        )
      ) {
        return Biomes.Biomes.hillsmid.id;
      }

      if (
        Biomes.inRangeOfAll(
          x,
          y,
          maps,
          Biomes.Biomes.hillslow.generationOptions
        )
      ) {
        return Biomes.Biomes.hillslow.id;
      }

      if (
        Biomes.inRangeOfAll(x, y, maps, Biomes.Biomes.swamp.generationOptions)
      ) {
        return Biomes.Biomes.swamp.id;
      }

      if (
        Biomes.inRangeOfAll(
          x,
          y,
          maps,
          Biomes.Biomes.hillgrass.generationOptions
        )
      ) {
        return Biomes.Biomes.hillgrass.id;
      }

      if (
        Biomes.inRangeOfAll(
          x,
          y,
          maps,
          Biomes.Biomes.shortgrass.generationOptions
        )
      ) {
        return Biomes.Biomes.shortgrass.id;
      }

      if (
        Biomes.inRangeOfAll(x, y, maps, Biomes.Biomes.grass.generationOptions)
      ) {
        return Biomes.Biomes.grass.id;
      }
      return Biomes.Biomes.moistdirt.id;
    }
  }

  generateAutotileMap(rawMap: Map<number, BiomeId>) {
    // console.log("rawMap to start with: ", rawMap);
    this.autotileMap = Autotile.autotile(rawMap);
    let biome: Biome;
    let biomeId: BiomeId;
    let season: Season;
    let tile: Tile;
    season = this.game.timeManager.season;

    for (const [index, autotileIndex] of this.autotileMap) {
      biomeId = rawMap.get(index);
      biome = Biomes.Biomes[biomeId];
      if (!biome?.autotilePrefix) {
        // use the base tile rather than autotiling
        tile = Tile.Tilesets[biomeId][season][BaseTileKey];
      } else {
        tile = Tile.Tilesets[biomeId][season][autotileIndex];
      }

      if (!tile) {
        console.log(
          `AUTOTILE ERROR: ${biomeId} - ${season} - ${autotileIndex}`
        );
      }
      this.tileMap[index] = tile.id;
    }
  }

  setTile(x: number, y: number, tile: Tile): void {
    const index = positionToIndex(x, y, Layer.TERRAIN);
    this.tileMap[index] = tile.id;
    this.dirtyTiles.push(index);
  }

  getRandomTilePositions(
    biomeTypes: BiomeId[],
    quantity: number = 1,
    onlyPassable = true,
    isPlant: boolean = false,
    maxAttempts: number = 100
  ): Point[] {
    let result: Point[] = [];
    let randPos: Point;
    let randPositions: Point[];
    const desiredBiomesSet = new Set(biomeTypes);
    let attempts = 0;

    while (result.length < quantity && attempts < maxAttempts) {
      randPositions = [];
      randPos = new Point(
        Math.floor(Math.random() * GameSettings.options.gameSize.width),
        Math.floor(Math.random() * GameSettings.options.gameSize.height)
      );

      if (desiredBiomesSet.has(this.getBiome(randPos.x, randPos.y).id)) {
        randPositions.push(randPos);
        for (let pos of randPositions) {
          if (
            !onlyPassable ||
            (onlyPassable && this.isPassable(pos.x, pos.y))
          ) {
            // plants have a dense tile grid, so add all possible dense points
            // TODO: check if all dense points are passable before adding
            if (isPlant) {
              pos = Tile.translatePoint(pos, Layer.TERRAIN, Layer.PLANT);
              for (let x = 0; x < Tile.tileDensityRatio; x++) {
                for (let y = 0; y < Tile.tileDensityRatio; y++) {
                  result.push(new Point(pos.x + x, pos.y + y));
                }
              }
            } else {
              result.push(pos);
            }
          }
        }
      }
      attempts++;
    }

    return shuffle(result);
  }

  getTile(x: number, y: number): Tile {
    const tileId = this.tileMap[positionToIndex(x, y, Layer.TERRAIN)];
    return Tile.tiles[tileId];
  }

  getBiome(x: number, y: number): Biome {
    return Biomes.Biomes[
      this.biomeMap.get(positionToIndex(x, y, Layer.TERRAIN))
    ];
  }

  isPassable(x: number, y: number): boolean {
    const index = positionToIndex(x, y, Layer.TERRAIN);
    const biomeId = this.biomeMap.get(index);
    const autotile = this.autotileMap.get(index);
    const isBorderTile = Autotile.isTileIndexAutoTileBorder(autotile);
    const impassibleBorderBiome = ImpassibleBorder.includes(biomeId);
    let impassible = false;
    if (impassibleBorderBiome && isBorderTile) {
      impassible = true;
    }

    return biomeId && !impassible;
  }

  getTotalLight(x: number, y: number): number {
    const posIndex = positionToIndex(x, y, Layer.TERRAIN);
    const lightFromShadows = this.shadowMap.shadowMap[posIndex];
    const lightFromOcc = this.shadowMap.occlusionMap[posIndex];
    const cloudLevel = this.cloudMap.get(posIndex);
    let lightFromClouds = 1;
    if (cloudLevel > this.cloudMap.cloudMinLevel) {
      // reduce the light by the amount of cloud cover
      lightFromClouds = 1 - (cloudLevel - this.cloudMap.cloudMinLevel);
    } else if (cloudLevel < this.cloudMap.sunbeamMaxLevel) {
      // increase light by how much sunbeam there is
      lightFromClouds = 1 + cloudLevel;
    }
    // console.throttle(250).log("lightFromClouds", lightFromClouds, cloudLevel);
    let ambientLight = 1;
    if (GameSettings.options.toggles.enableGlobalLights) {
      ambientLight = this.game.timeManager.remainingPhasePercent;
    }
    let finalLight =
      lightFromShadows * ambientLight * lightFromOcc * lightFromClouds;
    // can go over 1 due to lightening effect from sunbeams/clouds
    if (finalLight < 0) {
      finalLight = 0;
    }
    if (finalLight > 1) {
      finalLight = 1;
    }
    return finalLight;
  }

  draw(): void {
    let tilePos: Point;
    let tileId: number;
    let tile: Tile;
    for (let tileIndex of this.dirtyTiles) {
      tilePos = indexToPosition(tileIndex, Layer.TERRAIN);
      tileId = this.tileMap[tileIndex];
      tile = Tile.tiles[tileId];
      this.game.renderer.removeFromScene(tileIndex, Layer.TERRAIN);
      this.game.renderer.addTileIdToScene(tilePos, Layer.TERRAIN, tileId);
    }
    // Clear the changed tiles after drawing them
    this.dirtyTiles = [];
  }

  onTileEnterViewport(indexes: number[]): void {
    this.shadowMap.onEnter(indexes);
    this.cloudMap.onEnter(indexes);
    this.lightManager.onEnter(indexes);
    // TODO: add a step to render tile
    // this will fix shadows not updating immediately when panning
  }

  isPointInMap(point: Point): boolean {
    return (
      point.x >= 0 &&
      point.x < GameSettings.options.gameSize.width &&
      point.y >= 0 &&
      point.y < GameSettings.options.gameSize.height
    );
  }
}
