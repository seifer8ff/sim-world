import { KEYS } from "rot-js/lib/index";
import { Game } from "./game";
import { MessageLog } from "./message-log";
import * as PIXI from "pixi.js";
import { ManagerWebComponents } from "./manager-web-components";
import { BiomeId } from "./biomes";
import { SystemTime } from "./system-time";
import { Stages } from "./game-state";

export class UserInterface {
  public messageLog: MessageLog;
  public gameCanvasContainer: HTMLElement;
  public gameContainer: HTMLElement;
  public components: ManagerWebComponents;

  constructor(private game: Game) {
    this.components = new ManagerWebComponents(game, this);

    this.gameContainer = document.getElementById("gameContainer");
    this.gameCanvasContainer = document.getElementById("canvasContainer");
    this.messageLog = new MessageLog(this.game);

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
      SystemTime.togglePause();
    }
  }

  public initializeBuildTools(): void {
    // TODO: better way of loading icon
    const options: { name: string; iconPath: PIXI.Texture; id: BiomeId }[] = [
      {
        name: "Moist Dirt",
        iconPath: PIXI.Cache.get("moistdirt_spring_sandydirt_00"),
        id: "moistdirt",
      },
      {
        name: "Ocean",
        iconPath: PIXI.Cache.get("ocean_spring_moistdirt_00"),
        id: "ocean",
      },
      {
        name: "Snow",
        iconPath: PIXI.Cache.get("snow_base"),
        id: "snowmoistdirt",
      },
    ];
    this.components.updateSideBarContent("Build", options);
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

  renderUpdate(): void {
    if (this.game.gameState.isLoading()) {
      if (this.game.gameState.stage === Stages.Title) {
        this.components.titleMenu.setCollapsed(false);
        this.components.sideMenu?.setVisible(false, true);
        this.components.timeControl?.setVisible(false);
      } else if (this.game.gameState.stage === Stages.Play) {
        this.components.titleMenu?.setCollapsed(true);
        this.components.sideMenu.setVisible(true, true);
        this.components.timeControl.setVisible(true);
      }
      this.game.gameState.loading = false;
    }
    if (this.game.gameState.stage === Stages.Title) {
      if (this.components.tileSelectionIndicator) {
        this.components.tileSelectionIndicator.renderUpdate();
      }
    }
    if (this.game.gameState.stage === Stages.Play) {
      this.components.updateTimeControl();
    }
  }
}
