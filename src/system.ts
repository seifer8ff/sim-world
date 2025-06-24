import Noise from "rot-js/lib/noise/noise";

export interface GenerationSettings {
  [key: string]: number; // Generic settings for noise generation
}

export interface GenerationModifiers {
  [key: string]: number; // Generic modifiers for noise generation
}

export interface SystemSettings {
  generationModifiers?: GenerationModifiers;
  generationSettings?: GenerationSettings;
  [key: string]: any; // Additional settings can be added as needed
}

// export interface ISystem {
//   init(
//     settings?: GenerationSettings,
//     modifiers?: GenerationModifiers,
//     mapWidth?: number,
//     mapHeight?: number
//   ): void;
//   generate?(
//     x: number,
//     y: number,
//     width: number,
//     height: number,
//     noise: Noise
//   ): number;
//   at?(x: number, y: number): number;
//   atIndex?(index: number): number;
//   getMap(): Map<number, number>;
//   setAt?(x: number, y: number, value: number): void;
//   setAtIndex?(index: number, value: number): void;
//   turnUpdate?(): void; // Method to update the system, if needed
//   generationSettings?: GenerationSettings;
//   generationModifiers?: GenerationModifiers;
// }
