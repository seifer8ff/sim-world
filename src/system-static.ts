import { ActorBase } from "./entities/actor";
import { Query } from "miniplex";
import { Layer, Renderer } from "./renderer";

// handle drawing not animated sprites
export class SystemStatic {
  constructor() {}

  public static drawTile(actors: Query<ActorBase>, renderer: Renderer): void {
    for (const { tile, position, layer } of actors) {
      renderer.addTileIdToScene(position, layer, tile);
    }
  }
}
