import {
  lerp,
  normalize,
  normalizeNoise,
  positionToIndex,
} from "./misc-utility";
import { Point } from "./point";
import Noise from "rot-js/lib/noise/noise";
import { Layer } from "./renderer";
import {
  GenerationModifiers,
  GenerationSettings,
  SystemSettings,
} from "./system";
import { GameSettings } from "./game-settings";

export interface PolesSettings extends SystemSettings {
  generationModifiers: PolesGenerationModifiers;
  generationSettings: PolesGenerationSettings;
}

export interface PolesGenerationSettings extends GenerationSettings {
  baseWeight: number;
  baseScale: number;
}

export interface PolesGenerationModifiers extends GenerationModifiers {
  baseMagnetism: number; // Base magnetism level to start from
  contrastModifier: number; // Multiplier to increase contrast of the noise value
  northPoleXModifier: number; // Multiplier for the X position of the north pole
  northPoleYModifier: number; // Multiplier for the Y position of the north pole
  SouthPoleXModifier: number; // Multiplier for the X position of the south pole
  southPoleYModifier: number; // Multiplier for the Y position of the south pole
  poleXRadiusModifier: number; // Multiplier for the X radius of the poles
  poleYRadiusModifier: number; // Multiplier for the Y radius of the poles
}

export class SystemPolesImplementation {
  private map: Map<number, number>;
  private poleXRadius: number;
  private poleYRadius: number;
  private northPole: Point;
  private southPole: Point;

  public generationSettings: PolesGenerationSettings;
  public generationModifiers: PolesGenerationModifiers;

  public init(
    settings: PolesGenerationSettings,
    modifiers: PolesGenerationModifiers,
    mapWidth: number,
    mapHeight: number
  ): void {
    this.map = new Map();
    this.generationSettings = settings;
    this.generationModifiers = modifiers;
    this.poleYRadius =
      (mapHeight / 3) * this.generationModifiers.poleYRadiusModifier;
    this.poleXRadius =
      (mapWidth / 1.5) * this.generationModifiers.poleXRadiusModifier;

    this.northPole = new Point(
      Math.floor((mapWidth / 2) * this.generationModifiers.northPoleXModifier),
      (mapHeight / 10) * this.generationModifiers.northPoleYModifier
    );
    this.southPole = new Point(
      Math.floor((mapWidth / 2) * this.generationModifiers.SouthPoleXModifier),
      mapHeight - (mapHeight / 10) * this.generationModifiers.southPoleYModifier
    );
    console.log(
      `North Pole: ${this.northPole.x}, ${this.northPole.y}, South Pole: ${this.southPole.x}, ${this.southPole.y}.
      Pole X Radius: ${this.poleXRadius}, Pole Y Radius: ${this.poleYRadius}.`
    );
  }

  /**
   * Generates a base magnetism value for a given position based on noise and distance from poles.
   * @param x - The x coordinate of the position.
   * @param y - The y coordinate of the position.
   * @param width - The width of the game area.
   * @param height - The height of the game area.
   * @param noise - An instance of Noise for generating noise values.
   * @returns The generated magnetism value.
   */
  public generate(
    x: number,
    y: number,
    width: number,
    height: number,
    noise: Noise
  ): number {
    const index = positionToIndex(x, y, Layer.TERRAIN);

    const noiseX = x / width;
    const noiseY = y / height;
    let noiseValue = this.generationModifiers.baseMagnetism; // start with a base temperature modifier, positive or negative

    // Calculate base noise with multiple octaves
    noiseValue +=
      noise.get(
        noiseX * this.generationSettings.baseScale,
        noiseY * this.generationSettings.baseScale
      ) * this.generationSettings.baseWeight;

    noiseValue = normalizeNoise(noiseValue);

    // reduce noise value away from poles
    const xDistanceFromNorthPole = Math.abs(this.northPole.x - x);
    const yDistanceFromNorthPole = Math.abs(this.northPole.y - y);
    const xDistanceFromSouthPole = Math.abs(this.southPole.x - x);
    const yDistanceFromSouthPole = Math.abs(this.southPole.y - y);
    const xDistanceFromPole = Math.min(
      xDistanceFromNorthPole,
      xDistanceFromSouthPole
    );
    const yDistanceFromPole = Math.min(
      yDistanceFromNorthPole,
      yDistanceFromSouthPole
    );

    noiseValue = Math.pow(
      noiseValue,
      this.generationModifiers.contrastModifier
    ); // increase contrast of noise value
    noiseValue *= 1 - xDistanceFromPole / this.poleXRadius;
    noiseValue *= 1 - yDistanceFromPole / this.poleYRadius;

    noiseValue = normalize(noiseValue);
    this.map.set(index, noiseValue);

    return noiseValue;
  }

  public at(x: number, y: number): number {
    const index = positionToIndex(x, y, Layer.TERRAIN);
    return this.map.get(index);
  }

  public atIndex(index: number): number {
    return this.map.get(index);
  }

  public getMap(): Map<number, number> {
    return this.map;
  }
}

// SystemPoles class provides a singleton interface for managing the poles system.
export class SystemPoles {
  private static instance = new SystemPolesImplementation();

  static init() {
    return this.instance.init(
      GameSettings.options.poles.generationSettings,
      GameSettings.options.poles.generationModifiers,
      GameSettings.options.gameSize.width,
      GameSettings.options.gameSize.height
    );
  }

  static generate(
    x: number,
    y: number,
    width: number,
    height: number,
    noise: Noise
  ) {
    return this.instance.generate(x, y, width, height, noise);
  }

  static at(x: number, y: number): number {
    return this.instance.at(x, y);
  }

  static atIndex(index: number): number {
    return this.instance.atIndex(index);
  }

  /**
   * Get all values from the poles map
   */
  static get all(): Map<number, number> {
    return this.instance.getMap();
  }
}
