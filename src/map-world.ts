import { Color, RNG } from "rot-js";
import { Game } from "./game";
import { BaseTileKey, Tile } from "./tile";
import { Point } from "./point";
import { Layer } from "./renderer";
import { Autotile } from "./autotile";
import { LightManager } from "./light-manager";
import {
  getMapStats,
  getScaledNoise,
  lerp,
  positionToIndex,
} from "./misc-utility";
import { SystemTemperature } from "./system-temperature";
import { SystemMoisture } from "./system-moisture";
import { Season, SystemTime } from "./system-time";
import {
  BaseTerrainBiomeId,
  Biome,
  BiomeId,
  Biomes,
  ImpassibleBorder,
} from "./biomes";
import { Color as ColorType } from "rot-js/lib/color";
import { SystemShadows } from "./system-shadows";
import { SystemPoles } from "./system-poles";
import { SystemClouds } from "./system-clouds";
import Noise from "rot-js/lib/noise/noise";
import { GameSettings } from "./game-settings";
import { TileStats } from "./web-components/tile-info";
import { SystemCollision } from "./system-collision";
import { SystemOcclusion } from "./system-occlusion";
import { Viewport } from "./camera";

// Interface for detailed tile information returned by getTileDetails method
export interface TileDetails {
  position: Point;
  height: number;
  temperature: number;
  moisture: number;
  magnetism: number;
  sunlight: number;
  biome?: Biome;
}

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
  public seaLevel: number;
  public ready: boolean; // whether the map is ready to be used

  public heightAdjacencyD1Map: number[][]; // adjacency map with distance of 1 tile
  public heightAdjacencyD2Map: number[][];
  public heightLayerAdjacencyD1Map: HeightLayer[][];
  public heightLayerAdjacencyD2Map: HeightLayer[][];

  //
  public terrainAdjacencyD1Map: BiomeId[][]; // adjacency map with distance of 1 tile
  public terrainAdjacencyD2Map: BiomeId[][];

  public biomeAdjacencyD1Map: BiomeId[][]; // adjacency map with distance of 1 tile
  public biomeAdjacencyD2Map: BiomeId[][];
  private landAmountModifier: number;
  private valleyScaleFactor: number;
  private heightMaskStrength: number;
  private heightMaskStartDistance: number;

  constructor(private game: Game) {
    this.ready = false;
    this.tileMap = [];
    this.biomeMap = new Map();
    this.autotileMap = new Map();
    this.heightMap = new Map();
    this.heightLayerMap = new Map();
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
    this.landAmountModifier =
      GameSettings.options.generation.landAmountModifier;
    this.valleyScaleFactor = 2;
    this.heightMaskStrength =
      GameSettings.options.generation.heightMaskStrength;
    this.heightMaskStartDistance =
      GameSettings.options.generation.heightMaskStartDistance;
  }

  public static biomeHeightToLayer(height: number): HeightLayer {
    // TODO: overhaul how valley/holes work. They probably should be below sealevel, but idk

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
    console.log(`generating map of size ${width}x${height}`);
    this.tileMap = [];
    this.biomeMap = new Map();
    this.heightMap = new Map();
    this.terrainMap = new Map();
    let index = -1;

    // first pass, generate base height and assign terrain
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        index = positionToIndex(x, y, Layer.TERRAIN);
        SystemPoles.generate(x, y, width, height, this.game.noise);
        this.heightMap.set(
          index,
          this.getHeight(x, y, width, height, this.game.noise)
        );
        this.heightLayerMap.set(
          index,
          MapWorld.biomeHeightToLayer(this.heightMap.get(index))
        );
        this.terrainMap.set(index, this.assignBaseTerrain(x, y));
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
        SystemMoisture.generate(x, y, width, height, this.game.noise, this);
        SystemTemperature.generate(x, y, width, height, this.game.noise, this);
      }
    }

    const stats = getMapStats(Array.from(SystemTemperature.all.values()), [
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
    console.log("Base Temperature range:", stats);
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

    // finally, generate the tile map
    if (GameSettings.options.toggles.enableAutotile) {
      this.generateAutotileMap(this.biomeMap);
    } else {
      this.generateBasetileMap(this.biomeMap);
    }
    this.ready = true;
  }

  public getHeightLayer(x: number, y: number): HeightLayer {
    const index = positionToIndex(x, y, Layer.TERRAIN);
    return MapWorld.biomeHeightToLayer(this.heightMap.get(index));
  }

  private generateBasetileMap(rawMap: Map<number, BiomeId>) {
    let tileId: number;
    for (const [index, biomeId] of rawMap) {
      tileId = Tile.generateTileId(biomeId, SystemTime.season, BaseTileKey);

      if (!tileId) {
        console.log(`BASETILE ERROR: ${biomeId} - ${SystemTime.season}`);
      }
      this.tileMap[index] = tileId;
    }
  }

  /**
   *
   * @param x x coordinate
   * @param y y coordinate
   * @param mapWidth width of overall map
   * @param mapHeight height of overall map
   * @param noise the noise object to use for generating height
   * @returns height value between 0 and 1
   */
  private getHeight(
    x: number,
    y: number,
    mapWidth: number,
    mapHeight: number,
    noise: Noise
  ): number {
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

    // Apply land amount modifier by adjusting the effective sea level
    if (this.landAmountModifier !== 1) {
      // Calculate an adjusted sea level based on the modifier
      // When modifier is > 1, sea level is effectively lower
      // When modifier is < 1, sea level is effectively higher
      const adjustmentFactor = 2 * (1 - this.landAmountModifier);

      // Shift the height distribution relative to sea level
      // This effectively changes how much land is above sea level
      height = height - adjustmentFactor * this.seaLevel;

      // Re-normalize to 0-1 range
      height = Math.max(0, Math.min(1, height));
    }

    const dx = (2 * x) / mapWidth - 1;
    const dy = (2 * y) / mapHeight - 1;
    // height = height * this.landAmountModifier;
    height = this.applyHeightMask(height, dx, dy);
    // height = MapWorld.biomeHeightToLayer(height);
    // height = this.applyHeightTerracing(height);

    return height;
  }

  /**
   * Apply a height mask to the height value based on the distance from the edge of the map.
   * The mask is stronger near the edges and weaker as we move inward.
   *
   * @param originalHeight The initial height value.
   * @param dx The x coordinate normalized to -1 to 1, where 0 is the center.
   * @param dy The y coordinate normalized to -1 to 1.
   * @return The masked height value.
   */
  private applyHeightMask(
    originalHeight: number,
    dx: number,
    dy: number
  ): number {
    let height: number = originalHeight;
    // only mask within x tiles of the edge of the map
    const edgeDistance = 1 - this.heightMaskStartDistance; // percent from the edge to mask

    // Calculate distance from edge (0 = at edge, 1 = at edgeDistance or beyond)
    const distFromEdge = Math.min(
      Math.abs(Math.abs(dx) - 1) / edgeDistance,
      Math.abs(Math.abs(dy) - 1) / edgeDistance,
      1
    );

    if (distFromEdge < 1) {
      // Apply stronger mask near edges, weakening as we move inward
      const maskFactor = distFromEdge; // 0 at edge, 1 at edgeDistance
      // set the height to the masked value, modified by the overall strength of the mask
      height = lerp(this.heightMaskStrength, height, height * maskFactor);
    }

    return height;
  }

  assignBaseTerrain(x: number, y: number): BaseTerrainBiomeId {
    // assign the high level terrain types
    // features will be placed within these terrain types for tiling transition purposes
    const heightVal = this.heightMap.get(positionToIndex(x, y, Layer.TERRAIN));
    if (
      Biomes.inRangeOf(heightVal, Biomes.Biomes.ocean.generationOptions.height)
    ) {
      return Biomes.Biomes.ocean.id as BaseTerrainBiomeId;
    }

    if (
      Biomes.inRangeOf(
        heightVal,
        Biomes.Biomes.moistdirt.generationOptions.height
      )
    ) {
      return Biomes.Biomes.moistdirt.id as BaseTerrainBiomeId;
    }

    if (
      Biomes.inRangeOf(
        heightVal,
        Biomes.Biomes.sandydirt.generationOptions.height
      )
    ) {
      return Biomes.Biomes.sandydirt.id as BaseTerrainBiomeId;
    }
  }

  private processTerrain(x: number, y: number): BiomeId {
    const index = positionToIndex(x, y, Layer.TERRAIN);
    const terrain = this.terrainMap.get(index);
    // const adjacentTerrain = this.terrainAdjacencyD2Map[index];
    // const moistureVal = this.moistureMap.getMoistureByKey(key);

    // add a single tile thick border of sandydirt around moistdirt coasts to improve autotiling
    if (terrain === Biomes.Biomes.moistdirt.id) {
      if (
        this.isAdjacentToBiome(x, y, this.terrainAdjacencyD2Map, [
          Biomes.Biomes.ocean.id,
        ])
      ) {
        this.shiftHeight(x, y, Biomes.Biomes.sandydirt.id);
        this.shiftMoisture(x, y, Biomes.Biomes.sandydirt.id);
        this.shiftTemperature(x, y, Biomes.Biomes.sandydirt.id);
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
        this.shiftTemperature(x, y, Biomes.Biomes.sandydirt.id);
        this.shiftMoisture(x, y, Biomes.Biomes.sandydirt.id);
        return Biomes.Biomes.sandydirt.id;
      }
    }

    return biomeId;
  }

  /***
   * Shift the terrain height into the new biome height range.
   * Updates the height map and the height layer map
   * @param x x coordinate
   * @param y y coordinate
   * @param newBiomeId the biome id to shift to
   */
  private shiftHeight(x: number, y: number, newBiomeId: BiomeId): void {
    const index = positionToIndex(x, y, Layer.TERRAIN);
    const height = this.heightMap.get(index);
    const newBiome = Biomes.Biomes[newBiomeId];
    if (!newBiome) {
      console.error("Biome not found", newBiomeId);
      return;
    }
    this.heightMap.set(
      index,
      Biomes.shiftToBiome(height, newBiome.generationOptions.height)
    );
    this.heightLayerMap.set(
      index,
      MapWorld.biomeHeightToLayer(this.heightMap.get(index))
    );
  }

  private shiftTemperature(x: number, y: number, newBiomeId: BiomeId) {
    const newBiome = Biomes.Biomes[newBiomeId];
    const temp = SystemTemperature.at(x, y);
    SystemTemperature.setAt(
      x,
      y,
      Biomes.shiftToBiome(temp, newBiome.generationOptions.temperature)
    );
  }

  private shiftMoisture(x: number, y: number, newBiomeId: BiomeId) {
    const newBiome = Biomes.Biomes[newBiomeId];
    const moisture = SystemMoisture.at(x, y);
    SystemMoisture.setAt(
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
      temperature: SystemTemperature.all,
      moisture: SystemMoisture.baseMoistureMap,
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
    const temp = SystemTemperature.atIndex(index);
    const moisture = SystemMoisture.at(x, y);
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
    if (isMidHeight && biomeId) {
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
    if (isUpperHeight && biomeId) {
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

    if (isLowerHeight && biomeId) {
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

  isWater(x: number, y: number): boolean {
    const index = positionToIndex(x, y, Layer.TERRAIN);
    const terrain = this.terrainMap.get(index);
    return (
      terrain === Biomes.Biomes.ocean.id ||
      terrain === Biomes.Biomes.oceandeep.id
    );
  }

  static getAdjacent(x: number, y: number, adjacencyMap: any[][]): any[] {
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
      temperature: SystemTemperature.all,
      moisture: SystemMoisture.baseMoistureMap,
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
    let tileId: number;
    season = SystemTime.season;

    for (const [index, autotileIndex] of this.autotileMap) {
      biomeId = rawMap.get(index);
      biome = Biomes.Biomes[biomeId];
      if (!biome?.autotilePrefix) {
        // use the base tile rather than autotiling
        tileId = Tile.generateTileId(biomeId, season, BaseTileKey);
      } else {
        tileId = Tile.generateTileId(biomeId, season, autotileIndex);
      }

      if (!tileId) {
        console.log(
          `AUTOTILE ERROR: ${biomeId} - ${season} - ${autotileIndex}`
        );
      }
      this.tileMap[index] = tileId;
    }
  }

  setTile(x: number, y: number, tileId: number): void {
    const index = positionToIndex(x, y, Layer.TERRAIN);
    this.tileMap[index] = tileId;
  }

  getRandomTilePositions(
    biomeTypes: BiomeId[],
    quantity: number = 1,
    unblockedOnly = true,
    isDenseLayer: boolean = false,
    maxAttempts: number = 5000
  ): Point[] {
    let result: Point[] = [];
    let randPos: Point;
    const desiredBiomesSet = new Set(biomeTypes);
    let attempts = 0;

    // loop until we have enough results, or we've tried too many times
    while (result.length < quantity && attempts < maxAttempts) {
      // get a random dense tile point
      randPos = new Point(
        Math.floor(
          Math.random() *
            GameSettings.options.gameSize.width *
            Tile.tileDensityRatio
        ),
        Math.floor(
          Math.random() *
            GameSettings.options.gameSize.height *
            Tile.tileDensityRatio
        )
      );

      // used for biome checks
      const nonDensePos = Tile.translatePoint(
        randPos,
        Layer.SMALLACTOR,
        Layer.TERRAIN
      );

      // check if the position is valid
      if (
        desiredBiomesSet.has(this.getBiome(nonDensePos.x, nonDensePos.y)?.id)
      ) {
        if (
          unblockedOnly &&
          !SystemCollision.isBlocked(
            randPos.x,
            randPos.y,
            this,
            Layer.SMALLACTOR
          )
        ) {
          result.push(isDenseLayer ? randPos : nonDensePos);
        } else if (!unblockedOnly) {
          result.push(isDenseLayer ? randPos : nonDensePos);
        }
      }
      attempts++;
    }
    return RNG.shuffle(result).slice(0, quantity);
  }

  getTile(x: number, y: number): number {
    const tileId = this.tileMap[positionToIndex(x, y, Layer.TERRAIN)];
    return tileId;
  }

  getTileIdByPosition(x: number, y: number): number {
    return this.tileMap[positionToIndex(x, y, Layer.TERRAIN)];
  }

  getTileIdByIndex(index: number): number {
    return this.tileMap[index];
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

  getInfoAt(x: number, y: number): TileStats {
    const index = positionToIndex(x, y, Layer.TERRAIN);
    return {
      height: this.heightMap.get(index),
      magnetism: SystemPoles.atIndex(index),
      temperaturePercent: SystemTemperature.atIndex(index),
      moisture: SystemMoisture.atIndex(index),
      sunlight: this.lightManager.getTotalLight(x, y),
      biome: Biomes.Biomes[this.biomeMap.get(index)],
    };
  }

  isTileInMap(tileX: number, tileY: number): boolean {
    return (
      tileX >= 0 &&
      tileX < GameSettings.options.gameSize.width &&
      tileY >= 0 &&
      tileY < GameSettings.options.gameSize.height
    );
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
