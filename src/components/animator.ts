import { Game } from "../game";
import { AnimatedSprite, Assets, Texture } from "pixi.js";
import { GameSettings } from "../game-settings";
import { ActorBase, WithAnimator, WithSprite } from "../actor";
import { Tile } from "../tile";

// map of animation types to a list of animation names
export interface AnimationMap {
  idle: string[]; // every actor should have at least one idle animation
  walk_up?: string[];
  walk_down?: string[];
  walk_left?: string[];
  walk_right?: string[];
}

export type BaseAnimationKey =
  | "idle"
  | "walk_up"
  | "walk_down"
  | "walk_left"
  | "walk_right";

export const defaultAnimationMap: AnimationMap = {
  idle: ["right"],
  walk_up: ["up"],
  walk_down: ["down"],
  walk_left: ["left"],
  walk_right: ["right"],
};

export const mushroomAnimationMap: AnimationMap = {
  idle: ["idle"],
  walk_up: ["idle"],
  walk_down: ["idle"],
  walk_left: ["idle"],
  walk_right: ["idle"],
};

export const cowAnimationMap: AnimationMap = {
  idle: ["right"],
  walk_up: ["walk_up"],
  walk_down: ["walk_down"],
  walk_left: ["walk_left"],
  walk_right: ["walk_right"],
};

export class Animator {
  private currentAnimation: BaseAnimationKey | null;
  private animationFrames: Record<BaseAnimationKey, string[]>; // frames by key name

  constructor(
    private game: Game,
    private actor: WithAnimator & WithSprite,
    private animSpeed: number = 1 // the initial modifier for the anim speed. Set during init and not changed
  ) {
    this.currentAnimation = null;
    this.animationFrames = {
      idle: [],
      walk_up: [],
      walk_down: [],
      walk_left: [],
      walk_right: [],
    };

    if (this.actor.animationPath) {
      const frames: { [key: string]: any } = Assets.cache.get(
        this.actor.animationPath
      ).data.frames;

      const animationMap: AnimationMap = this.actor.animationMap;
      for (const [animationKey, keys] of Object.entries(animationMap)) {
        this.animationFrames[animationKey] = [];
        for (const key of keys) {
          for (const frameKey in frames) {
            if (frameKey.includes(key)) {
              this.animationFrames[animationKey].push(frameKey);
            }
          }
        }
        this.animationFrames[animationKey].sort();
      }

      // Set the initial animation to "idle" if it exists
      if (animationMap.idle && animationMap.idle.length > 0) {
        this.setAnimation("idle");
      }
    }
  }

  public setAnimation(animation: BaseAnimationKey): void {
    if (this.currentAnimation === animation) return;

    this.currentAnimation = animation;
    let animatedSprite: AnimatedSprite = this.actor.sprite as AnimatedSprite;
    if (this.actor.sprite) {
      animatedSprite.textures = this.animationFrames[this.currentAnimation].map(
        (frame) => Texture.from(frame)
      );
    } else {
      this.actor.sprite = AnimatedSprite.fromFrames(
        this.animationFrames[this.currentAnimation]
      );
      this.actor.sprite.anchor.set(0.5);
      this.actor.sprite.position.x = this.actor.position?.x * Tile.size;
      this.actor.sprite.position.y = this.actor.position?.y * Tile.size;
      animatedSprite = this.actor.sprite as AnimatedSprite;
    }
    if (GameSettings.options.toggles.enableAnimations) {
      this.scaleAnimSpeed(this.game.timeManager.timeScale);
      animatedSprite.loop = true;
      animatedSprite.play();
    }
  }

  public scaleAnimSpeed(timeScale: number) {
    if (!this.actor.sprite) {
      return;
    }
    (this.actor.sprite as AnimatedSprite).animationSpeed =
      this.animSpeed * GameSettings.options.animationSpeed * timeScale;
  }

  public static updateFacing(
    moveVector: [number, number],
    animator: Animator
  ): void {
    if (moveVector) {
      // the action involves movement, so update sprite facing
      switch (moveVector[0]) {
        case 1:
          animator.setAnimation("walk_right");
          break;
        case -1:
          animator.setAnimation("walk_left");
          break;
        case 0:
          switch (moveVector[1]) {
            case 1:
              animator.setAnimation("walk_down");
              break;
            case -1:
              animator.setAnimation("walk_up");
              break;
          }
          break;
      }
    }
  }
}
