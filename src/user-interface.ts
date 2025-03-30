import { KEYS } from "rot-js/lib/index";
import { Game } from "./game";
import { MessageLog } from "./message-log";
import * as PIXI from "pixi.js";
import { Layer } from "./renderer";
import { Camera } from "./camera";

import { ManagerWebComponents } from "./manager-web-components";
import { BiomeId } from "./biomes";
import { isActor } from "./entities/actor";

export class UserInterface {
  public application: PIXI.Application<PIXI.ICanvas>;
  public camera: Camera;
  public messageLog: MessageLog;
  public gameCanvasContainer: HTMLElement;

  public gameContainer: HTMLElement;
  private gameDisplayOptions: Partial<PIXI.IApplicationOptions>;
  private keyMap: { [key: number]: number };

  public components: ManagerWebComponents;
  private sprites: { [key: string]: string };

  constructor(private game: Game) {
    this.sprites = {
      selectionBox: "ui_tile_select",
    };
    this.components = new ManagerWebComponents(game, this);

    this.gameContainer = document.getElementById("gameContainer");
    this.gameCanvasContainer = document.getElementById("canvasContainer");

    this.gameDisplayOptions = {
      resizeTo: window,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: false,
    };

    this.application = new PIXI.Application(this.gameDisplayOptions);
    this.application.stage.sortableChildren = true;

    // let colorMatrix = new PIXI.ColorMatrixFilter();
    // colorMatrix.night(0.2, false);
    // this.application.stage.filters = [colorMatrix];

    this.gameCanvasContainer.appendChild(
      this.application.view as HTMLCanvasElement
    );
    this.messageLog = new MessageLog(this.game);
    this.camera = new Camera(this.game, this);
    this.initEventListeners();
  }

  private initEventListeners() {
    document.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });
    window.addEventListener("keydown", this.handleInput.bind(this), {
      passive: false,
    });
  }

  private handleInput(event: KeyboardEvent): void {
    if (event.keyCode === KEYS.VK_SPACE) {
      this.game.timeManager.togglePause();
    }
  }

  public async init() {
    this.game.renderer.addLayersToStage(this.application.stage);
    await this.initializeBuildTools();
  }

  public async initializeBuildTools(): Promise<boolean> {
    const options: { name: string; iconPath: string; id: BiomeId }[] = [
      {
        name: "Moist Dirt",
        iconPath: "moistdirt_spring_sandydirt_00",
        id: "moistdirt",
      },
      {
        name: "Ocean",
        iconPath: "ocean_spring_moistdirt_00",
        id: "ocean",
      },
      { name: "Snow", iconPath: "snow_base", id: "snowmoistdirt" },
    ];
    this.components.updateSideBarContent("Build", options);
    return true;
  }

  private writeHelpMessage(): void {
    let helpMessage = [
      `Find the pineapple in one of the boxes.`,
      `Move with numpad, search box with 'spacebar' or 'return'.`,
      // `Watch out for %c{${Person.glyphColor.foregroundColor}}Pedro%c{}!`,
    ];

    for (let index = helpMessage.length - 1; index >= 0; --index) {
      this.messageLog.appendText(helpMessage[index]);
    }
  }

  HandleInputConfirm(event: KeyboardEvent): boolean {
    let code = event.keyCode;
    return code === KEYS.VK_SPACE || code === KEYS.VK_RETURN;
  }

  handleRightArrow(event: KeyboardEvent): boolean {
    let code = event.keyCode;
    return code === KEYS.VK_RIGHT;
  }

  updateSelectionBox(): void {
    // TODO: refactor to selection box to lerp follow the target
    if (this.camera.pointerTarget) {
      if (isActor(this.camera.pointerTarget.target)) {
        this.game.renderer.addToScene(
          this.camera.pointerTarget.target.position,
          Layer.UI,
          PIXI.Sprite.from(this.sprites.selectionBox)
        );
      } else {
        this.game.renderer.addToScene(
          this.camera.pointerTarget.position,
          Layer.UI,
          PIXI.Sprite.from(this.sprites.selectionBox)
        );
      }
    }
  }

  renderUpdate(): void {
    this.components.updateTimeControl();
    this.updateSelectionBox();
  }
}
