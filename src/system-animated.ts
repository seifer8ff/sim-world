import { ActorBase } from "./entities/actor";
import { Query } from "miniplex";
import { Layer, Renderer } from "./renderer";

// handle animating sprites
export class SystemAnimated {
  constructor() {}

  public static drawAnimated(
    actors: Query<ActorBase>,
    renderer: Renderer
  ): void {
    for (const { sprite, position } of actors) {
      renderer.addToScene(position, Layer.ENTITY, sprite);
    }
  }

  public static setAnimatorSpeed(
    actors: Query<ActorBase>,
    timeScale: number
  ): void {
    for (const { animator } of actors) {
      animator.scaleAnimSpeed(timeScale);
    }
  }
}
