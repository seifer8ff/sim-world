import { Game } from "../game";
import { Point } from "../point";
import { Action } from "./action";
import { Layer } from "../renderer";
import { MapWorld } from "../map-world";
import { generateId } from "../misc-utility";
import { GameSettings } from "../game-settings";
import { ActorBase } from "../entities/actor";

export class MoveAction implements Action {
  readonly id: number;
  readonly name: string;
  durationInTurns: number; // how long the action lasts

  constructor(
    private game: Game,
    private actor: ActorBase,
    public targetPos: Point
  ) {
    this.id = generateId();
    this.name = "Move To Point";
    this.durationInTurns = 1;
  }

  run(): Promise<{ movementVector: [number, number] }> {
    // Animated based on the sprites screen position
    const oldPos = this.game.userInterface.camera.TileToScreenCoords(
      this.actor.position.x,
      this.actor.position.y,
      Layer.ACTOR
    );
    // get the direction of movement
    const movementVector = this.targetPos.movementVector(this.actor.position);
    const shouldLerp =
      GameSettings.options.toggles.enableAnimations &&
      (movementVector[0] !== 0 || movementVector[1] !== 0);
    if (oldPos) {
      // calculate the tile position of the movement vector
      // and get the screen position of that tile
      const nextTilePos = this.actor.position.add(
        new Point(movementVector[0], movementVector[1])
      );
      const newPos = this.game.userInterface.camera.TileToScreenCoords(
        nextTilePos.x,
        nextTilePos.y
      );
      if (shouldLerp) {
        // add the animation to the managers queue
        this.game.animManager.addMoveAnimation(
          MapWorld.coordsToKey(this.actor.position.x, this.actor.position.y), // pos doesn't update until after anim
          oldPos,
          newPos,
          () => {
            // clear the old position in the collision manager
            this.game.collisionManager.clearEntityTile(
              this.actor.position.x,
              this.actor.position.y,
              Layer.ACTOR
            );
            // update the position of the sprite in the renderer's cache
            // keeps the renderer's representation of the map in sync with the game
            // otherwise, renderer will think sprite is still at old position
            this.game.renderer.updateSpriteCachePosition(
              this.actor.position,
              this.targetPos,
              Layer.ACTOR
            );
            // keep actor's position in sync with target position
            this.actor.position = new Point(this.targetPos.x, this.targetPos.y);
            // update collision
            this.game.collisionManager.occupyTile(
              this.targetPos.x,
              this.targetPos.y,
              Layer.ACTOR,
              this.actor.id
            );
          },
          this.actor
        );
      } else {
        // update collision
        this.game.collisionManager.clearEntityTile(
          this.actor.position.x,
          this.actor.position.y,
          Layer.ACTOR
        );
        // if no lerp, just update the sprite cache position
        this.game.renderer.updateSpriteCachePosition(
          this.actor.position,
          this.targetPos,
          Layer.ACTOR
        );
        // keep actor's position in sync with target position
        this.actor.position = new Point(this.targetPos.x, this.targetPos.y);
      }
    }

    return Promise.resolve({
      movementVector: movementVector,
    });
  }
}
