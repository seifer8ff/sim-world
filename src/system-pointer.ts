import { ActorBase, isActor } from "./actor";
import { Query } from "miniplex";
import { Layer, Renderer } from "./renderer";
import { Tile } from "./tile";
import { Camera, Viewport } from "./camera";
import { DisplayObject, Sprite } from "pixi.js";
import { generateId } from "./misc-utility";
import { Color as ColorType } from "rot-js/lib/color";
import { SystemActors } from "./system-actors";
import { Point } from "./point";

// handle rendering pointer sprite
export class SystemPointer {
  constructor() {}

  public static updatePointerPosition(actors: Query<ActorBase>): void {
    for (const { pointerTarget, sprite } of actors) {
      if (pointerTarget?.sprite) {
        const targetPos = pointerTarget.sprite.position;
        sprite.x = targetPos.x;
        sprite.y = targetPos.y;
      }
    }
  }

  public static spawnPointer(
    position: Point,
    actorManager: SystemActors,
    target: ActorBase | number | null = null
  ): void {
    SystemPointer.clearPointer(SystemActors.queries.withPointer, actorManager);

    const sprite = Sprite.from("ui_tile_select");
    sprite.anchor.set(0.5);
    sprite.scale.set(2);
    sprite.position.x = position.x * Tile.size;
    sprite.position.y = position.y * Tile.size;

    // Create a new pointer actor with the specified position
    actorManager.spawn(
      {
        id: generateId(),
        position: position,
        layer: Layer.UI,
        sprite: sprite,
        isUi: true,
        isPointer: true,
        pointerTarget: isActor(target) ? target : null,
      },
      false
    );
  }

  public static clearPointer(
    actors: Query<ActorBase>,
    actorManager: SystemActors
  ): void {
    for (const actor of actors) {
      actorManager.remove(actor);
    }
  }

  public static renderPointer(
    actors: Query<ActorBase>,
    renderer: Renderer,
    viewport: Viewport
  ) {
    for (const { sprite, position, layer } of actors) {
      let { x, y } = position;

      if (Camera.inViewport(x, y, layer, viewport)) {
        renderer.renderDisplayObject(sprite as DisplayObject, layer);
      }
    }
  }
}
