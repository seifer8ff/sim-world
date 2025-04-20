import { Game } from "./game";
import { Layer } from "./renderer";
import {
  generateId,
  lerp,
  lerpEaseIn,
  lerpEaseInOut,
  lerpEaseOut,
} from "./misc-utility";
import { Point } from "./point";
import { ActorBase } from "./actor";
import { TimeManager } from "./time-manager";

export interface Animation {
  id: number;
  actor?: ActorBase; // UI lerps don't have actors
  tileKey: string;
  action: "move";
  turnDuration: number;
  endTurn: number;
  callback?: () => void;
}

export interface AnimationOptions {
  lerpStyle: "linear" | "easeIn" | "easeOut" | "easeInOut";
}

export interface MoveAnimation extends Animation {
  oldPos: Point;
  newPos: Point;
}

export class ManagerAnimation {
  public options = {
    lerpStyle: "easeInOut",
  };
  private animations: Animation[] = [];
  private boundRunAnimation: (animation: Animation) => void =
    this.runAnimation.bind(this);

  constructor(private game: Game) {}

  public start() {}

  public animUpdate() {
    for (let i = this.animations.length - 1; i >= 0; i--) {
      const anim = this.animations[i];
      if (anim.endTurn <= TimeManager.currentTurn) {
        if (anim.callback) {
          anim.callback();
        }
        // Swap the element to remove with the last element and pop it from the array
        if (i !== this.animations.length - 1) {
          this.animations[i] = this.animations[this.animations.length - 1];
        }
        this.animations.pop();
      } else {
        this.runAnimation(anim);
      }
    }
  }

  private runAnimation(animation: Animation) {
    if (animation.action === "move") {
      this.animateMove(animation as MoveAnimation);
    }
  }

  public addMoveAnimation(
    tileKey: string, // the tile position in the renderer's cache
    oldPos: Point,
    newPos: Point,
    callback: () => void,
    actor?: ActorBase
  ) {
    const animation: MoveAnimation = {
      id: generateId(),
      tileKey: tileKey,
      oldPos: oldPos,
      newPos: newPos,
      action: "move",
      turnDuration: 1,
      endTurn: TimeManager.currentTurn + 1,
      callback: callback,
    };
    if (actor) {
      animation.actor = actor;
    }
    this.animations.push(animation);
  }

  private animateMove(animation: MoveAnimation) {
    const newPos = animation.newPos;
    const oldPos = animation.oldPos;
    if (oldPos && newPos) {
      let percent = this.game.timeManager.turnAnimTimePercent;
      let animDone = percent >= 0.99; // reduce for snappier feel
      if (animDone) percent = 1;

      let x, y;
      if (this.options.lerpStyle === "linear") {
        x = lerp(percent, oldPos.x, newPos.x);
        y = lerp(percent, oldPos.y, newPos.y);
      } else if (this.options.lerpStyle === "easeIn") {
        x = lerpEaseIn(percent, oldPos.x, newPos.x);
        y = lerpEaseIn(percent, oldPos.y, newPos.y);
      } else if (this.options.lerpStyle === "easeOut") {
        x = lerpEaseOut(percent, oldPos.x, newPos.x);
        y = lerpEaseOut(percent, oldPos.y, newPos.y);
      } else if (this.options.lerpStyle === "easeInOut") {
        x = lerpEaseInOut(percent, oldPos.x, newPos.x);
        y = lerpEaseInOut(percent, oldPos.y, newPos.y);
      }

      // update sprite position as the lerp runs
      animation.actor.sprite.position.set(x, y);
    }
  }
}
