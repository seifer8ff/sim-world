import { KEYS, DIRS, Path, RNG } from "rot-js";
import { Game } from "./game";
import { Point } from "./point";
import { InputUtility } from "./input-utility";
import { Tile } from "./tile";
import { WaitAction } from "./actions/waitAction";
import { Action } from "./actions/action";
import TypeIcon from "../shoelace/assets/icons/person-vcard.svg";
import GoalIcon from "../shoelace/assets/icons/geo-alt.svg";
import ActionIcon from "../shoelace/assets/icons/sign-turn-slight-right.svg";
import { Sprite, AnimatedSprite, Graphics, Assets } from "pixi.js";
import { PointerTarget } from "./camera";
import { generateId } from "./misc-utility";
import { Renderable } from "./renderer";
import { GameSettings } from "./game-settings";
import { SystemCollision } from "./system-collision";

export class Player {
  id: number;
  tile: Tile;
  // subType: TileSubType;
  action: Action;
  goal: Action;
  sprite: Renderable;
  private keyMap: { [key: number]: number };

  constructor(private game: Game, public position: Point) {
    this.id = generateId();
    // this.tile = Tile.player;
    // this.type = this.tile.type;
    // this.subType = TileSubType.Human;

    // if (this.tile.animationKeys) {
    //   const animations = Assets.cache.get(this.tile.spritePath).data.frames;
    //   const animKeys = Object.keys(animations).sort();
    //   this.sprite = AnimatedSprite.fromFrames(animKeys);
    //   (this.sprite as AnimatedSprite).animationSpeed =
    //     GameSettings.options.animationSpeed * TimeManager.timeScale;
    //   (this.sprite as AnimatedSprite).loop = true;
    //   (this.sprite as AnimatedSprite).play();
    // } else {
    //   this.sprite = Sprite.from(this.tile.spritePath);
    // }

    this.keyMap = {};
    this.keyMap[KEYS.VK_W] = 0; // up
    this.keyMap[KEYS.VK_NUMPAD9] = 1;
    this.keyMap[KEYS.VK_D] = 2; // right
    this.keyMap[KEYS.VK_NUMPAD3] = 3;
    this.keyMap[KEYS.VK_S] = 4; // down
    this.keyMap[KEYS.VK_NUMPAD1] = 5;
    this.keyMap[KEYS.VK_A] = 6; // left
    this.keyMap[KEYS.VK_NUMPAD7] = 7;
  }

  draw() {
    console.log("render player");
  }

  public plan(): void {
    // this.action = new WaitAction(this.game, this, this.position);
  }

  // act(): Promise<any> {
  //   console.log("person act");
  //   return this.action.run();
  // }

  // private pathTo(target: Point) {
  //   let astar = new Path.AStar(
  //     target.x,
  //     target.y,
  //     this.game.mapIsPassable.bind(this.game),
  //     { topology: 4 }
  //   );

  //   this.path = [];
  //   astar.compute(
  //     this.position.x,
  //     this.position.y,
  //     this.pathCallback.bind(this)
  //   );
  //   this.path.shift(); // remove actor's position
  // }

  act(): Promise<any> {
    return InputUtility.waitForInput(this.handleInput.bind(this));
  }

  private handleInput(event: KeyboardEvent): boolean {
    let validInput = false;
    let code = event.keyCode;
    if (code in this.keyMap) {
      let diff = DIRS[8][this.keyMap[code]];
      let newPoint = new Point(
        this.position.x + diff[0],
        this.position.y + diff[1]
      );
      if (
        !SystemCollision.isMapBlocked(newPoint.x, newPoint.y, this.game.map)
      ) {
        return;
      }
      this.position = newPoint;
      validInput = true;
    } else if (code === KEYS.VK_RETURN || code === KEYS.VK_SPACE) {
      // this.game.checkBox(this.position.x, this.position.y);
      validInput = true;
    } else {
      validInput = code === KEYS.VK_NUMPAD5; // Wait a turn
    }
    this.game.camera.centerOn(this.position.x, this.position.y);
    return validInput;
  }

  // public getDescription(): DescriptionBlock[] {
  //   const descriptionBlocks: DescriptionBlock[] = [];
  //   descriptionBlocks.push({
  //     icon: TypeIcon,
  //     getDescription: () => "Player",
  //   });
  //   if (this.goal) {
  //     descriptionBlocks.push({
  //       icon: GoalIcon,
  //       getDescription: () => this.goal.name,
  //     });
  //   }
  //   if (this.action) {
  //     descriptionBlocks.push({
  //       icon: ActionIcon,
  //       getDescription: () => this.action.name,
  //     });
  //   }
  //   return descriptionBlocks;
  // }
}
