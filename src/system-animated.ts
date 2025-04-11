import { ActorBase } from "./actor";
import { Query } from "miniplex";
import { Renderer } from "./renderer";
import { Camera, Viewport } from "./camera";
import { LightManager, RGBAColor } from "./light-manager";
import { Color as ColorType } from "rot-js/lib/color";

// handle animating sprites
export class SystemAnimated {
  constructor() {}

  public static renderAnimated(
    actors: Query<ActorBase>,
    renderer: Renderer,
    lightManager: LightManager,
    viewport: Viewport
  ) {
    let tint: ColorType | RGBAColor | undefined = undefined;
    for (const { sprite, position, layer } of actors) {
      let { x, y } = position;
      tint = lightManager.getLightFor(x, y, false, true);

      if (Camera.inViewport(x, y, layer, viewport)) {
        renderer.renderDisplayObject(sprite, layer, tint as ColorType);
      }
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
