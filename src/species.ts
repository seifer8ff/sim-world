import {
  Application,
  Assets,
  ColorSource,
  Renderer,
  RenderTexture,
  SCALE_MODES,
  Sprite,
  Texture,
} from "pixi.js";
import dataActors, { IconLayer } from "./data-actors";
import { Layer } from "./renderer";
import { RNG } from "rot-js";
import { AnimationMap, BaseAnimationKey } from "./components/animation-map";
import { SystemStatic } from "./system-static";
import { SystemAnimated } from "./system-animated";

// sprite paths, including variations, for each plant species
// sprite paths are organized by layer
// these get processed into textures and stored in PlantSpecies.textures[layer]
// also support animations
export type SpeciesSpriteSet = {
  [key in SpriteLayer]: string[];
};

// example PlantSpriteSet:
// {
//   [IconLayer.ICON]: ["idle_000"], // sprite used in menus, etc
//   [Layer.ACTOR]: "sprites/mushroom_00/mushroom_00.json", // animation
// }

// export enum IconLayer {
//   ICON = 10, // icons don't have a layer in the renderer, but are used in various UI locations
// }
export type SpriteLayer = Layer & IconLayer;

export interface SpeciesDef {
  id: SpeciesId; // unique identifier, used to lookup the species
  name: string;
  baseTint?: ColorSource; // used to create a tinted version of the base sprite
  color: ColorSource; // used when rendering a simplified map
  spriteSet: SpeciesSpriteSet; // sprites for the plant species, organized by layer
  animationMap?: AnimationMap; // required for animated sprites
  needs: ActorNeeds;
}

export interface ActorNeeds {
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

// list of every species ID in the game. Includes plants, animals, etc
export type SpeciesId =
  | "pine"
  | "birch"
  | "maple"
  | "cottoncandy"
  | "shrub"
  | "mushroom"
  | "cow"
  | "seagull"
  | "sharkblue";

export class Species {
  // easy lookup for species by ID
  // holds textures and animated textures for each species
  static allSpecies: {
    [key in SpeciesId as string]: Species;
  } = {};
  public id: SpeciesId;
  public name: string;
  public spriteSet: SpeciesSpriteSet;
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

  constructor(options: SpeciesDef) {
    this.id = options.id; // id of the plant species
    this.name = options.name; // name of the plant species
    this.needs = options.needs; // growth needs for the plant species
    this.spriteSet = options.spriteSet; // sprite set for the plant species
    this.baseTint = options.baseTint; // base tint color for the plant species
    console.log(`Add Species: ${this.name}`, this);
  }

  // generate the textures for each species from the spriteSet
  // adding tint if needed
  public static generateSpeciesTextures(
    paths: string[],
    baseTint: ColorSource,
    animationMap: AnimationMap,
    renderer: Renderer
  ): Texture[] {
    return paths
      .map((path) => {
        if (animationMap) {
          return Texture.from(path);
        }
        if (baseTint) {
          const sprite = Sprite.from(path);
          if (!sprite) return null;
          sprite.tint = baseTint;
          // Create a RenderTexture to apply the tint
          const renderTexture = RenderTexture.create({
            width: sprite.width,
            height: sprite.height,
            scaleMode: SCALE_MODES.NEAREST,
            anisotropicLevel: 0,
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

  public static generateSpeciesAnimationFrames(
    paths: string[],
    animationMap: AnimationMap
  ): { [key in BaseAnimationKey]?: Texture[] } {
    const animFrameTextures: { [key in BaseAnimationKey]?: Texture[] } = {};
    let frameKeys: string[] = [];
    let frames: { [key: string]: any } = {};
    for (const path of paths) {
      frames = Assets.cache.get(path)?.data?.frames;

      if (!frames) {
        console.warn("No frames found for path:", path);
        continue;
      }

      for (const [animationKey, keys] of Object.entries(animationMap)) {
        animFrameTextures[animationKey] = [];
        for (const key of keys) {
          // sort the frames first
          frameKeys = Object.keys(frames);
          frameKeys.sort();
          frameKeys.forEach((frameKey) => {
            // check if the animation frame name includes the animation name.
            // i.e. walk_down_004 includes walk_down
            if (frameKey.includes(key)) {
              animFrameTextures[animationKey].push(Texture.from(frameKey));
            }
          });
        }
      }
    }
    return animFrameTextures;
  }

  // process species from data into textures and animatedTextures
  public static processSpecies(app: Application) {
    if (Species.allSpecies.length) return;
    dataActors.forEach((speciesDef) => {
      // init the texture structure for this species
      SystemStatic.textures[speciesDef.id] = {};
      SystemAnimated.textures[speciesDef.id] = {};
      Species.allSpecies[speciesDef.id] = new Species(speciesDef);

      // generate the textures for each layer
      // store generated textures on the appropriate System
      for (const layer in speciesDef.spriteSet) {
        if (speciesDef.animationMap && Number(layer) !== IconLayer.ICON) {
          SystemAnimated.textures[speciesDef.id] =
            Species.generateSpeciesAnimationFrames(
              speciesDef.spriteSet[layer],
              speciesDef.animationMap
            );
        } else {
          SystemStatic.textures[speciesDef.id][layer] =
            Species.generateSpeciesTextures(
              speciesDef.spriteSet[layer],
              speciesDef.baseTint,
              speciesDef.animationMap,
              app.renderer as Renderer
            );
        }
      }
    });
  }
}
