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

export type SpriteLayer = Layer & IconLayer;

export type SpeciesType = "shrub" | "tree" | "creature"; // type of species (shrub, tree, creature)

export interface SpeciesDef {
  id: SpeciesId; // unique identifier, used to lookup the species
  name: string;
  type: SpeciesType; // type of species (shrub, tree, creature)
  color: ColorSource; // used when rendering a simplified map
  palette?: SpeciesPalette;
  spriteSet: SpeciesSpriteSet; // sprites for the plant species, organized by layer
  animationMap?: AnimationMap; // required for animated sprites
  needs: ActorNeeds;
  growsInto?: SpeciesId[]; // species that this actor can grow into, if applicable
}

export interface SpeciesPalette {
  base: string; // PURPLE
  secondary?: string; // BLUE
  accent1?: string; // GREEN
  accent2?: string; // RED
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
  | "shrub-highland"
  | "mushroom"
  | "cow"
  | "seagull"
  | "sharkblue";

import { Filter } from "pixi.js";
import { Point } from "./point";
import { Game } from "./game";
import { calculateMidpointScore, positionToIndex } from "./misc-utility";
import { MapWorld } from "./map-world";
import { Tile } from "./tile";

const recolorShader = `
  precision mediump float;
  varying vec2 vTextureCoord;
  uniform sampler2D uSampler;
  
  uniform vec3 baseColor;
  uniform vec3 secondaryColor;
  uniform vec3 accentColor1;
  uniform vec3 accentColor2;
  
  void main() {
      vec4 color = texture2D(uSampler, vTextureCoord);
  
      if (color.rgb == vec3(1.0, 0.0, 1.0)) {
          gl_FragColor = vec4(baseColor, color.a);
      } else if (color.rgb == vec3(0.0, 0.0, 1.0)) {
          gl_FragColor = vec4(secondaryColor, color.a);
      } else if (color.rgb == vec3(0.0, 1.0, 0.0)) {
          gl_FragColor = vec4(accentColor1, color.a);
      } else if (color.rgb == vec3(1.0, 0.0, 0.0)) { 
       gl_FragColor = vec4(accentColor2, color.a);
      }else {
          gl_FragColor = color;
      }
  }
  `;

function hexToRGBVec3(hex: string): Float32Array {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  return new Float32Array([r, g, b]);
}

function createPaletteFilter(palette: SpeciesPalette): Filter {
  return new Filter(undefined, recolorShader, {
    baseColor: hexToRGBVec3(palette.base),
    secondaryColor: hexToRGBVec3(palette.secondary),
    accentColor1: hexToRGBVec3(palette.accent1),
    accentColor2: hexToRGBVec3(palette.accent2),
  });
}

function recolorTextureWithFilter(
  texture: Texture,
  filter: Filter,
  renderer: Renderer
): Texture {
  const sprite = new Sprite(texture);
  sprite.filters = [filter];

  const rt = RenderTexture.create({
    width: sprite.width,
    height: sprite.height,
  });

  renderer.render(sprite, { renderTexture: rt });
  return rt;
}

export class Species {
  // easy lookup for species by ID
  // holds textures and animated textures for each species
  static allSpecies: {
    [key in SpeciesId as string]: Species;
  } = {};
  public id: SpeciesId;
  public type: SpeciesType;
  public name: string;
  public spriteSet: SpeciesSpriteSet;
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
  public growsInto?: SpeciesId[]; // species that this actor can grow into, if applicable

  constructor(options: SpeciesDef) {
    this.id = options.id; // id of the  species
    this.type = options.type; // type of the  species (shrub, tree, creature)
    this.name = options.name; // name of the species
    this.needs = options.needs; // growth needs for the species
    this.spriteSet = options.spriteSet; // sprite set for the species
    if (options.growsInto) {
      this.growsInto = options.growsInto; // species that this actor can grow into, if applicable
    }
    console.log(`Add Species: ${this.name}`, this);
  }

  public static meetsNeeds(
    pos: Point,
    layer: Layer,
    needs: ActorNeeds,
    map: MapWorld
  ): boolean {
    // get all the needs info for the position
    const terrainPos = Tile.translatePoint(pos, layer, Layer.TERRAIN);
    const terrainIndex = positionToIndex(
      terrainPos.x,
      terrainPos.y,
      Layer.TERRAIN
    );
    const height = map.heightMap.get(terrainIndex) * 100; // height in percent (0-100)
    const light = 50; // not integrated with light manager yet...needs work
    const moisture = map.moistureMap.getMoistureByIndex(terrainIndex) * 100;
    const temperature = map.tempMap.getTempByIndex(terrainIndex) * 100;

    return (
      needs.height.min <= height &&
      needs.height.max >= height &&
      needs.temperature.min <= temperature &&
      needs.temperature.max >= temperature &&
      needs.moisture.min <= moisture &&
      needs.moisture.max >= moisture &&
      needs.light.min <= light &&
      needs.light.max >= light
    );
  }

  public static needsScore(
    pos: Point,
    layer: Layer,
    needs: ActorNeeds,
    map: MapWorld
  ): number {
    // get all the needs info for the position
    const terrainPos = Tile.translatePoint(pos, layer, Layer.TERRAIN);
    const terrainIndex = positionToIndex(
      terrainPos.x,
      terrainPos.y,
      Layer.TERRAIN
    );
    const height = map.heightMap.get(terrainIndex) * 100; // height in percent (0-100)
    const light = 50; // not integrated with light manager yet...needs work
    const moisture = map.moistureMap.getMoistureByIndex(terrainIndex) * 100;
    const temperature = map.tempMap.getTempByIndex(terrainIndex) * 100;
    // return a number between 0 and 1 representing how well the position meets the needs
    const heightScore = calculateMidpointScore(
      height,
      needs.height.min,
      needs.height.max
    );
    const temperatureScore = calculateMidpointScore(
      temperature,
      needs.temperature.min,
      needs.temperature.max
    );
    const moistureScore = calculateMidpointScore(
      moisture,
      needs.moisture.min,
      needs.moisture.max
    );
    const lightScore = calculateMidpointScore(
      light,
      needs.light.min,
      needs.light.max
    );

    // average the scores
    const averageScore =
      (heightScore + temperatureScore + moistureScore + lightScore) / 4;

    return averageScore;
  }

  public static getSpeciesForPosition(
    pos: Point,
    layer: Layer,
    speciesType: SpeciesType,
    map: MapWorld
  ): Species[] {
    // get all the needs info for the position
    const tileIndex = positionToIndex(pos.x, pos.y, layer);
    const terrainPos = Tile.translatePoint(pos, layer, Layer.TERRAIN);
    const terrainIndex = positionToIndex(
      terrainPos.x,
      terrainPos.y,
      Layer.TERRAIN
    );
    const height = map.heightMap.get(terrainIndex) * 100; // height in percent (0-100)
    const light = 50; // not integrated with light manager yet...needs work
    const moisture = map.moistureMap.getMoistureByIndex(terrainIndex) * 100;
    const temperature = map.tempMap.getTempByIndex(terrainIndex) * 100;

    // filter all species by their needs and the position
    return Object.values(Species.allSpecies).filter((species) => {
      // console.log(
      //   `Checking species ${species.name} at position ${pos.x}, ${pos.y} with needs: height=${height}, temperature=${temperature}, moisture=${moisture}, light=${light}`
      // );
      // test each species against the position's needs
      if (species.type !== speciesType) return false; // filter by species type (shrub, tree, creature)
      if (species.needs.height.min > height) return false; // check height needs
      if (species.needs.height.max < height) return false; // check height needs
      if (species.needs.temperature.min > temperature) return false; // check temperature needs
      if (species.needs.temperature.max < temperature) return false; // check temperature needs
      if (species.needs.moisture.min > moisture) return false; // check moisture needs
      if (species.needs.moisture.max < moisture) return false; // check moisture needs
      if (species.needs.light.min > light) return false; // check light needs
      if (species.needs.light.max < light) return false; // check light needs
      return true; // if all checks pass, return true
    });
  }

  // generate the textures for each species from the spriteSet
  // adding tint if needed
  public static generateSpeciesTextures(
    paths: string[],
    palette: SpeciesPalette,
    animationMap: AnimationMap,
    renderer: Renderer
  ): Texture[] {
    return paths
      .map((path) => {
        if (animationMap) {
          return Texture.from(path);
        }
        if (palette) {
          const texture = Texture.from(path);
          if (!texture) return null;
          const filter = createPaletteFilter(palette);
          const recolored = recolorTextureWithFilter(texture, filter, renderer);

          return recolored;
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
              speciesDef.palette,
              speciesDef.animationMap,
              app.renderer as Renderer
            );
        }
      }
    });
  }
}
