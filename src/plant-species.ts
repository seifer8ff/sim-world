import {
  Application,
  ColorSource,
  Renderer,
  RenderTexture,
  Sprite,
  Texture,
} from "pixi.js";
import dataActors from "./data-actors";
import { Layer } from "./renderer";
import { RNG } from "rot-js";

// export interface PlantSpriteSet {
//   // base: string[]; // set of plant base TILES (will be rendered at base of plant, no opacity)
//   // main: string[]; // set of main plant SPRITES, will be rendered in front of other actors, with opacity
//   [keyof Layer]: string[];
//   // sprites on each layer will get rendered in layer order
// }

// sprite paths, including variations, for each plant species
// sprite paths are organized by layer
// these get processed into textures and stored in PlantSpecies.textures[layer]
export type PlantSpriteSet = {
  [key in SpriteLayer]: string[];
};

enum IconLayer {
  ICON = -1, // icons don't have a layer in the renderer, but are used in various UI locations
}
export type SpriteLayer = Layer & IconLayer;

export interface PlantSpeciesDef {
  id: PlantSpeciesId; // unique identifier, used to lookup the species
  name: string;
  baseTint?: ColorSource; // used to create a tinted version of the base sprite
  color: ColorSource; // used when rendering a simplified map
  spriteSet: PlantSpriteSet; // sprites for the plant species, organized by layer
  needs: PlantNeeds;
}

export interface PlantNeeds {
  temperature: {
    min: number;
    max: number;
  };
  moisture: {
    min: number;
    max: number;
  };
  height: {
    min: number;
    max: number;
  };
  light: {
    min: number;
    max: number;
  };
}

export type PlantSpeciesId =
  | "pine"
  | "birch"
  | "maple"
  | "cottoncandy"
  | "shrub";

export enum PlantSpeciesEnum {
  PINE = "pine",
  BIRCH = "birch",
  MAPLE = "maple",
  COTTONCANDY = "cottoncandy",
  SHRUB = "shrub",
}

export class PlantSpecies {
  static plantSpecies: {
    [key in PlantSpeciesId as string]: PlantSpecies;
  } = {};
  public id: PlantSpeciesId;
  public name: string;
  public spriteSet: PlantSpriteSet;
  public baseTint: ColorSource;
  public needs: {
    temperature: {
      min: number;
      max: number;
    };
    moisture: {
      min: number;
      max: number;
    };
    height: {
      min: number;
      max: number;
    };
    light: {
      min: number;
      max: number;
    };
  };
  // textures by layer (if applicable) after generating from base[] + applying baseTint
  public textures: { [key in Layer]?: Texture[] };

  constructor(options: PlantSpeciesDef) {
    this.id = options.id; // id of the plant species
    this.name = options.name; // name of the plant species
    this.needs = options.needs; // growth needs for the plant species
    this.spriteSet = options.spriteSet; // sprite set for the plant species
    this.baseTint = options.baseTint; // base tint color for the plant species
    this.textures = {};

    console.log("new tree species", this);
  }

  public static getTextureFor(
    species: PlantSpecies,
    layer: Layer,
    index?: number
  ): Texture {
    if (!species.spriteSet[layer]) return null;
    if (index === undefined) {
      index = RNG.getUniformInt(0, species.spriteSet[layer].length - 1);
    }
    return PlantSpecies.plantSpecies[species.id].textures[layer][index];
  }

  public static generateSpeciesTextures(
    paths: string[],
    baseTint: ColorSource,
    renderer: Renderer
  ): Texture[] {
    return paths
      .map((path) => {
        if (baseTint) {
          const sprite = Sprite.from(path);
          if (!sprite) return null;
          sprite.tint = baseTint;
          // Create a RenderTexture to apply the tint
          const renderTexture = RenderTexture.create({
            width: sprite.width,
            height: sprite.height,
          });

          // Render the sprite and tint onto the RenderTexture
          renderer.render(sprite, {
            renderTexture,
          });
          sprite.destroy(); // Clean up the sprite

          return renderTexture;
        }
        const texture = Texture.from(path);
        return texture;
      })
      .filter((texture): texture is Texture => texture !== null); // Filter out null values
  }

  // ingest plant species for later use/reference
  public static processSpecies(app: Application) {
    if (PlantSpecies.plantSpecies.length) return;
    const speciesDefs: PlantSpeciesDef[] =
      dataActors.plants as PlantSpeciesDef[];
    speciesDefs.forEach((speciesDef) => {
      PlantSpecies.plantSpecies[speciesDef.id] = new PlantSpecies(speciesDef);
      // loop through all of the sprites for each species, adding them to the Texture cache
      for (const layer in speciesDef.spriteSet) {
        PlantSpecies.plantSpecies[speciesDef.id].textures[layer] =
          PlantSpecies.generateSpeciesTextures(
            speciesDef.spriteSet[layer],
            speciesDef.baseTint,
            app.renderer as Renderer
          );
      }
    });
  }
}
