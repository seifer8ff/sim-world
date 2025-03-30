import { Color, RNG } from "rot-js";
import { Color as ColorType } from "rot-js/lib/color";
import Noise from "rot-js/lib/noise/noise";
import { Layer } from "./renderer";
import { Tile } from "./tile";
import { GameSettings } from "./game-settings";
import { Point } from "./point";

export function lerp(a: number, x: number, y: number): number {
  return x * (1 - a) + y * a;
}

export function lerpEaseIn(t: number, start: number, end: number) {
  return start + (end - start) * t * t;
}

export function lerpEaseOut(t: number, start: number, end: number) {
  return start + (end - start) * (1 - (1 - t) * (1 - t));
}

export function lerpEaseInOut(t: number, start: number, end: number) {
  return start + (end - start) * (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
}

export function inverseLerp(a: number, x: number, y: number): number {
  return (a - x) / (y - x);
}

export function multiColorLerp(colors: ColorType[], t: number): ColorType {
  t = Math.max(0, Math.min(1, t));
  const delta = 1 / (colors.length - 1);
  const startIndex = Math.floor(t / delta);
  if (startIndex === colors.length - 1) {
    return colors[colors.length - 1];
  }
  const localT = (t % delta) / delta;
  return [
    lerp(localT, colors[startIndex][0], colors[startIndex + 1][0]),
    lerp(localT, colors[startIndex][1], colors[startIndex + 1][1]),
    lerp(localT, colors[startIndex][2], colors[startIndex + 1][2]),
  ];
}

export function adjustRgbSaturation(
  color: ColorType,
  amount: number
): ColorType {
  // console.log("convert color", color);

  const hsl = Color.rgb2hsl(color);
  // console.log("hsl[1] before", hsl[1]);
  hsl[1] = 0;
  hsl[2] = 0.3;
  // console.log("after", hsl[1]);
  // hsl[2] = amount;
  return Color.hsl2rgb(hsl);
}

export function rgbToGrayscale(color: ColorType): ColorType {
  /* remember: if you multiply a number by a decimal between 0
  and 1, it will make the number smaller. That's why we don't
  need to divide the result by three - unlike the previous
  example - because it's already balanced. */

  const r = color[0] * 0.3; // ------> Red is low
  const g = color[1] * 0.59; // ---> Green is high
  const b = color[2] * 0.11; // ----> Blue is very low

  const gray = r + g + b;

  return Color.fromString("rgb(" + gray + "," + gray + "," + gray + ")");
}

// return noise value between 0 and 1
export function normalizeNoise(value: number): number {
  let noise = Math.min(1, Math.max(-1, value));
  noise = (noise + 1) / 2;
  return noise;
}

// export function adjustRgbSaturation(
//   color: ColorType,
//   amount: number
// ): ColorType {
//   // console.log("convert color", color);
//   const grey = Color.fromString("rgb(38, 38, 38)");
//   return Color.interpolate(color, grey, amount);
// }

export function getMapStats(
  values: number[],
  statistics: { label: string; threshold: number; isNegative?: boolean }[]
): { label: string; threshold: number; value: number }[] {
  const count = values.length;

  let stats = statistics.map((stat) => {
    return { ...stat, bucket: [], value: null };
  });

  for (const val of values) {
    for (const stat of stats) {
      if (stat.isNegative) {
        if (val <= stat.threshold) {
          stat.bucket.push(val);
        }
      } else {
        if (val >= stat.threshold) {
          stat.bucket.push(val);
        }
      }
    }
  }

  for (const stat of stats) {
    stat.value = Math.round((stat.bucket.length / count) * 100) / 100;
    delete stat.bucket;
  }
  return stats;
}

export function getScaledNoise(noise: Noise, x: number, y: number): number {
  return (noise.get(x, y) + 1) / 2;
}

export function generateId(): number {
  // TODO: ensure uniqueness
  const maxInt32 = 2_147_483_647;

  // Ensure the result is always within the Int32 range
  const id = Date.now() + RNG.getUniformInt(0, 1000);

  // If the generated ID exceeds the maxInt32, wrap it around
  return id > maxInt32 ? id % maxInt32 : id;
}

export function getNumberFromRange(min: number, range: number): number {
  return min + RNG.getUniform() * range;
}

export function getItemFromRange<T>(
  arr: T[],
  minIndex = 0,
  maxIndex = arr.length - 1
): T {
  if (arr.length === 0) {
    throw new Error("Array is empty");
  }
  if (minIndex < 0 || maxIndex >= arr.length || minIndex > maxIndex) {
    throw new Error(`Invalid index range, ${minIndex}, ${maxIndex}, ${arr}`);
  }
  const index =
    Math.floor(Math.random() * (maxIndex - minIndex + 1)) + minIndex;
  return arr[index];
}

export function keyToIndex(key: string, layer: Layer): number {
  const [x, y] = key.split(",");
  return positionToIndex(parseInt(x), parseInt(y), layer);
}

export function positionToIndex(
  x: number,
  y: number,
  layer: Layer,
  width: number = GameSettings.options.gameSize.width,
  height: number = GameSettings.options.gameSize.height
  // optional width and height params for web workers that can't access GameSettings
): number {
  const widthInTiles = width;
  const heightInTiles = height;
  const denseWidthInTiles = widthInTiles * Tile.tileDensityRatio;
  const denseHeightInTiles = heightInTiles * Tile.tileDensityRatio;
  // Calculate the total number of tiles for each layer
  const totalLayerTiles = widthInTiles * heightInTiles;
  const totalDenseLayerTiles = denseWidthInTiles * denseHeightInTiles;

  // Define base offsets for each layer
  const layerOffset = (layer - 1) * totalDenseLayerTiles;
  //
  return layerOffset + (y * denseWidthInTiles + x);
}

export function indexToPosition(
  index: number,
  layer: Layer,
  width: number = GameSettings.options.gameSize.width,
  height: number = GameSettings.options.gameSize.height
): Point {
  const widthInTiles = width;
  const heightInTiles = height;
  const denseWidthInTiles = widthInTiles * Tile.tileDensityRatio;
  const denseHeightInTiles = heightInTiles * Tile.tileDensityRatio;
  // Calculate the total number of tiles for each layer
  const totalLayerTiles = widthInTiles * heightInTiles;
  const totalDenseLayerTiles = denseWidthInTiles * denseHeightInTiles;
  const layerOffset = (layer - 1) * totalDenseLayerTiles;

  index -= layerOffset;
  const x = index % denseWidthInTiles;
  const y = Math.floor(index / denseWidthInTiles);
  return new Point(x, y);
}

export function indexToXY(
  index: number,
  layer: Layer,
  width: number = GameSettings.options.gameSize.width,
  height: number = GameSettings.options.gameSize.height
): [number, number] {
  const widthInTiles = width;
  const heightInTiles = height;
  const denseWidthInTiles = widthInTiles * Tile.tileDensityRatio;
  const denseHeightInTiles = heightInTiles * Tile.tileDensityRatio;
  // Calculate the total number of tiles for each layer
  const totalLayerTiles = widthInTiles * heightInTiles;
  const totalDenseLayerTiles = denseWidthInTiles * denseHeightInTiles;

  // Define base offsets for each layer
  const layerOffset = (layer - 1) * totalDenseLayerTiles;

  index -= layerOffset;
  const x = index % denseWidthInTiles;
  const y = Math.floor(index / denseWidthInTiles);
  return [x, y];
}
