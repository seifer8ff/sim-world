import { Game } from "../game";
import { AnimatedSprite, Assets, Texture } from "pixi.js";
import { GameSettings } from "../game-settings";
import { ActorBase, WithAnimator } from "../entities/actor";
import { Tile } from "../tile";

export class Animator {
  // public animSpeed: number = 1; // set during gameplay to adjust speed (like when time is scaled)
  private currentAnimation: string;
  private animationFrames: { [key: string]: string[] }; // frames by key name

  constructor(
    private game: Game,
    private actor: WithAnimator,
    private animSpeed: number = 1 // the initial modifier for the anim speed. Set during init and not changed
  ) {
    this.currentAnimation = "";
    this.animationFrames = {};
    const tile = Tile;
    if (this.actor.animatedTile.animationKeys) {
      const frames: { [key: string]: any } = Assets.cache.get(
        this.actor.animatedTile.spritePath
      ).data.frames;

      this.animationFrames = {};

      for (let animationKey of this.actor.animatedTile.animationKeys) {
        this.animationFrames[animationKey] = [];
        for (let key in frames) {
          if (key.includes(animationKey)) {
            this.animationFrames[animationKey].push(key);
          }
        }
        this.animationFrames[animationKey].sort();
      }
      this.setAnimation(this.actor.animatedTile.animationKeys[0]);
    }
  }

  public setAnimation(animation: string): void {
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
      animatedSprite = this.actor.sprite as AnimatedSprite;
    }
    if (GameSettings.options.toggles.enableAnimations) {
      this.scaleAnimSpeed(this.game.timeManager.timeScale);
      animatedSprite.loop = true;
      animatedSprite.play();
    }
  }

  public scaleAnimSpeed(timeScale: number) {
    this.actor.sprite.animationSpeed =
      this.animSpeed * GameSettings.options.animationSpeed * timeScale;
  }
}
