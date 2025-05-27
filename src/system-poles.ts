import { lerp, normalizeNoise, positionToIndex } from "./misc-utility";
import { Point } from "./point";
import Noise from "rot-js/lib/noise/noise";
import { GameSettings } from "./game-settings";
import { Layer } from "./renderer";

export class SystemPoles {
  public static magnetismMap: Map<number, number>;
  public static noiseScale: number;
  public static poleXRadius: number;
  public static poleYRadius: number;
  public static northPole: Point;
  public static southPole: Point;

  public static init() {
    this.magnetismMap = new Map();
    this.noiseScale = GameSettings.options.magnetism.noiseScale;
    this.poleYRadius = GameSettings.options.gameSize.height / 3;
    this.poleXRadius = GameSettings.options.gameSize.width / 1.5;
    const poleYOffset = GameSettings.options.gameSize.width / 10;
    this.northPole = new Point(
      Math.floor(GameSettings.options.gameSize.width / 2),
      poleYOffset
    );
    this.southPole = new Point(
      Math.floor(GameSettings.options.gameSize.width / 2),
      GameSettings.options.gameSize.height - poleYOffset
    );
  }

  public static generateMagnetism(
    x: number,
    y: number,
    width: number,
    height: number,
    noise: Noise
  ): number {
    const index = positionToIndex(x, y, Layer.TERRAIN);

    let noiseX = x / width - 0.5;
    let noiseY = y / height - 0.5;
    noiseX = x / 3;
    noiseY = y / 3;
    let noiseValue = noise.get(noiseX, noiseY);
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

    if (
      xDistanceFromPole > this.poleXRadius ||
      yDistanceFromPole > this.poleYRadius
    ) {
      noiseValue = 0;
    } else {
      noiseValue = Math.pow(noiseValue, 0.1); // scale and smooth values
      noiseValue = normalizeNoise(noiseValue);
      noiseValue *= 1 - xDistanceFromPole / this.poleXRadius;
      noiseValue *= 1 - yDistanceFromPole / this.poleYRadius;
    }

    this.magnetismMap.set(index, lerp(noiseValue * this.noiseScale, 0, 1));

    return this.magnetismMap.get(index);
  }

  public static get(x: number, y: number): number {
    const index = positionToIndex(x, y, Layer.TERRAIN);
    return this.magnetismMap.get(index);
  }
}
