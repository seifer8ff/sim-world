import { ActorBase, ActorTypeId, WithAnimation } from "./actor";
import { Query } from "miniplex";
import { Renderer } from "./renderer";
import { Camera, Viewport } from "./camera";
import { LightManager, RGBAColor } from "./light-manager";
import { Color as ColorType } from "rot-js/lib/color";
import { AnimatedSprite, DisplayObject, Texture } from "pixi.js";
import { GameSettings } from "./game-settings";
import { BaseAnimationKey } from "./components/animation-map";
import { Tile } from "./tile";

export type AnimId = "test";

// handle animating sprites
export class SystemAnimated {
  public static textures: {
    [key in ActorTypeId]?: {
      [key in BaseAnimationKey]?: Texture[];
    };
  } = {};

  constructor() {}

  public static getFramesForAnimation(
    animId: ActorTypeId,
    currentAnimation: BaseAnimationKey
  ): Texture[] {
    return SystemAnimated.textures[animId][currentAnimation];
  }

  public static renderAnimated(
    actors: Query<ActorBase>,
    renderer: Renderer,
    lightManager: LightManager,
    viewport: Viewport
  ) {
    let tint: ColorType | RGBAColor | undefined = undefined;
    for (const { sprite, position, layer } of actors) {
      if (!Camera.inViewport(position.x, position.y, layer, viewport)) {
        continue;
      }
      tint = lightManager.getLightFor(position.x, position.y, false, true);
      renderer.renderDisplayObject(
        sprite as DisplayObject,
        layer,
        tint as ColorType
      );
    }
  }

  public static setAnimationSpeed(
    actors: Query<ActorBase>,
    timeScale: number
  ): void {
    for (const { sprite, baseAnimSpeed } of actors) {
      if (!sprite) {
        return;
      }
      (sprite as AnimatedSprite).animationSpeed =
        SystemAnimated.calculateAnimSpeed(baseAnimSpeed, timeScale);
    }
  }

  public static calculateAnimSpeed(
    baseAnimSpeed: number,
    timeScale: number
  ): number {
    return baseAnimSpeed * GameSettings.options.animationSpeed * timeScale;
  }

  public static updateFacing(
    actor: WithAnimation,
    moveVector: [number, number]
  ): void {
    if (moveVector) {
      // the action involves movement, so update sprite facing
      switch (moveVector[0]) {
        case 1:
          SystemAnimated.setAnimation(actor, "walk_right");
          break;
        case -1:
          SystemAnimated.setAnimation(actor, "walk_left");
          break;
        case 0:
          switch (moveVector[1]) {
            case 1:
              SystemAnimated.setAnimation(actor, "walk_down");
              break;
            case -1:
              SystemAnimated.setAnimation(actor, "walk_up");
              break;
          }
          break;
      }
    }
  }

  public static setAnimation(
    actor: WithAnimation,
    nextAnimation: BaseAnimationKey
  ): void {
    if (actor.currentAnimation === nextAnimation) return;

    actor.currentAnimation = nextAnimation;
    let animatedSprite: AnimatedSprite = actor.sprite as AnimatedSprite;
    if (animatedSprite) {
      animatedSprite.textures = SystemAnimated.getFramesForAnimation(
        actor.animId,
        actor.currentAnimation
      );
    } else {
      actor.sprite = new AnimatedSprite(
        SystemAnimated.getFramesForAnimation(
          actor.animId,
          actor.currentAnimation
        )
      );
      animatedSprite = actor.sprite as AnimatedSprite;
      actor.sprite.anchor.set(0.5);
      actor.sprite.position.x = actor.position?.x * Tile.size;
      actor.sprite.position.y = actor.position?.y * Tile.size;
    }
    if (GameSettings.options.toggles.enableAnimations) {
      animatedSprite.loop = true;
      if (!animatedSprite.playing) {
        animatedSprite.play();
      }
    }
  }
}
