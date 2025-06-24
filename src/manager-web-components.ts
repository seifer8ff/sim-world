import { Game } from "./game";
import { TimeControl } from "./web-components/time-control";
import {
  GameSettingsToggleOption,
  TitleMenu,
} from "./web-components/title-menu";
import { MenuItem, SideMenu, TopLevelMenu } from "./web-components/side-menu";
import { SideMenuContent } from "./web-components/side-menu-content";
import { TileInfo } from "./web-components/tile-info";
import { SkyMask } from "./web-components/sky-mask";
import { Overlay } from "./web-components/overlay";
import { UtilityActions } from "./web-components/utility-actions";
import { IndicatorSun } from "./web-components/indicator-sun";
import { IndicatorTileSelection } from "./web-components/indicator-tile-selection";
import { UserInterface } from "./user-interface";
import { getTextureURL } from "./assets";
import OverlayIcon from "./shoelace/assets/icons/layers-half.svg";
import { Texture } from "pixi.js";
import { BaseTileKey, Tile } from "./tile";
import { BiomeId, Biomes } from "./biomes";
import { Stages } from "./game-state";
import { GameSettings } from "./game-settings";
import { serialize } from "@shoelace-style/shoelace";
import { ActorBase } from "./actor";
import { SystemStatic } from "./system-static";
import { SystemTime } from "./system-time";
import { SystemMoisture } from "./system-moisture";
import { SystemTemperature } from "./system-temperature";
import { SystemPoles } from "./system-poles";
import { SystemShadows } from "./system-shadows";
import { SystemClouds } from "./system-clouds";

export class ManagerWebComponents {
  public timeControl: TimeControl;
  public titleMenu: TitleMenu;
  public sideMenu: SideMenu;
  public tileInfo: TileInfo;
  public skyMask: SkyMask;
  public overlay: Overlay;
  public tileSelectionIndicator: IndicatorTileSelection;
  public utilityActions: UtilityActions;

  constructor(private game: Game, private ui: UserInterface) {
    this.registerWebComponents();
    this.initComponents();
  }

  public refreshComponents() {
    // for components that display data that changes dynamically, like light or temps
    if (this.overlay && this.overlay.isVisible) {
      this.overlay.refresh(this.game.map);
    }
    if (this.game.gameState.stage === Stages.Play) {
      if (this.game.camera.pointerTarget) {
        // refresh the target info data obj
        this.game.camera.refreshPointerTargetInfo();
        // refresh the tile info UI with the new data
        this.tileInfo.setContent(this.game.camera.pointerTarget);
      }
    }
  }

  public init(): void {
    this.initSecondaryControls();
  }

  private registerWebComponents() {
    customElements.define("title-menu", TitleMenu);
    customElements.define("time-control", TimeControl);
    customElements.define("side-menu-content", SideMenuContent);
    customElements.define("side-menu", SideMenu);
    customElements.define("tile-info", TileInfo);
    customElements.define("sky-mask", SkyMask);
    customElements.define("screen-overlay", Overlay);
    customElements.define("utility-actions", UtilityActions);
    customElements.define("indicator-sun", IndicatorSun);
    customElements.define("indicator-tile-selection", IndicatorTileSelection);
  }

  private initSecondaryControls(): void {
    this.timeControl = document.querySelector("time-control");
    if (this.timeControl) {
      this.timeControl.init();
      // this.timeControl.toggleTooltip();
      this.timeControl.updateTime(SystemTime.getCurrentTimeForDisplay());
      this.timeControl.pauseBtn.addEventListener("click", () => {
        SystemTime.togglePause();
      });
      this.timeControl.timeSlider.addEventListener("sl-input", (e: any) => {
        SystemTime.setTimescale(e.target.value);
        console.log("time scale: ", SystemTime.timeScale);
      });
    }

    this.sideMenu = document.querySelector("side-menu");
    if (this.sideMenu) {
      this.sideMenu.dropdownMenu.addEventListener(
        "sl-select",
        (e: CustomEvent) => {
          console.log(e.detail);
          this.sideMenu.setSelectedTab(this.sideMenu.getTab(e.detail.item.id));
        }
      );

      this.sideMenu.handle.addEventListener("click", () => {
        this.sideMenu.setCollapsed(!this.sideMenu.isCollapsed);
      });
    }
    this.tileInfo = document.querySelector("tile-info");
    this.tileInfo.game = this.game;
    this.skyMask = document.querySelector("sky-mask");
    this.overlay = document.querySelector("screen-overlay");
    if (this.overlay) {
      this.overlay.closeBtn.addEventListener("click", () => {
        this.overlay.setVisible(false);
        this.setUIVisible(true, true);
      });
      this.registerOverlays();
    }
    this.tileSelectionIndicator = document.querySelector(
      "indicator-tile-selection"
    );
    if (this.tileSelectionIndicator) {
      this.tileSelectionIndicator.init(this.game);
      this.tileSelectionIndicator.closeBtn.addEventListener("click", () => {
        this.tileSelectionIndicator.setVisible(false);
        this.setUIVisible(true, true);
      });
    }
    this.ui.initializeBuildTools();
    if (this.timeControl) {
      this.utilityActions = this.timeControl.utilityActions;
      this.setUtilityActionsOptions();
    }
  }

  private initComponents() {
    this.titleMenu = document.querySelector("title-menu");
    if (this.titleMenu) {
      this.titleMenu.handle.addEventListener("click", () => {
        this.titleMenu.setCollapsed(!this.titleMenu.isCollapsed);
      });

      let optionToggles: GameSettingsToggleOption[] = [];
      for (let toggle in GameSettings.options.toggles) {
        optionToggles.push({
          key: toggle,
          label: toggle,
          defaultValue: GameSettings.options.toggles[toggle],
        });
      }
      this.titleMenu.generateGameOptions(optionToggles);
      let optionInputs: GameSettingsToggleOption[] = [];
      for (let input in GameSettings.options.spawn.inputs) {
        optionInputs.push({
          key: input,
          label: `${input.replace("Count", "")} spawn count: `,
          defaultValue: GameSettings.options.spawn.inputs[input],
        });
      }
      this.titleMenu.generateGameInputs(optionInputs);
      this.titleMenu.worldSizeInput.addEventListener(
        "sl-change",
        (e: CustomEvent) => {
          let updatedSize;
          try {
            updatedSize = JSON.parse(
              this.titleMenu.worldSizeInput.value as string
            );
            GameSettings.options.gameSize.width = updatedSize.width;
            GameSettings.options.gameSize.height = updatedSize.height;
          } catch (error) {
            console.log("Error: parsing world size. Invalid input?", e, error);
          }
        }
      );
      this.titleMenu.form.addEventListener("submit", (e: CustomEvent) => {
        e.preventDefault();
        this.titleMenu.setVisible(false, true);
        setTimeout(() => {
          try {
            const serializedData: Record<string, string> = serialize(
              this.titleMenu.form
            ) as Record<string, string>;
            this.game.settings.loadSettings(serializedData);
            this.game.gameState.changeStage(Stages.Play);
          } catch (error) {
            console.log("error on form submit", e, error);
          }
        }, 100);
        return false;
      });
    }
  }

  public updateTimeControl(): void {
    if (this.timeControl) {
      this.timeControl.updateTime(SystemTime.getCurrentTimeForDisplay());
      this.timeControl.updatePauseBtn(SystemTime.isPaused);
    }
  }

  public updateSideBarContent(tabName: TopLevelMenu, content: any[]): void {
    if (tabName === "Entities") {
      const actorMenuItems = content.map((actor) => {
        return this.mapEntityToMenuItem(actor);
      });
      this.sideMenu.setTabContent(tabName, actorMenuItems);
    } else if (tabName === "Build") {
      const buildMenuItems = content.map(
        (buildOption: { name: string; iconTexture: Texture; id: BiomeId }) => {
          return this.mapBuildMenuItem(buildOption);
        }
      );
      this.sideMenu.setTabContent(tabName, buildMenuItems);
    }
  }

  public mapEntityToMenuItem(actor: ActorBase): MenuItem {
    // use regex to select "mushroom_00_walk_14x18",
    // out of "sprites/mushroom_00_walk_14x18/mushroom_00_walk_14x18.json",
    const iconTexture: Texture = SystemStatic.getIconForSpecies(actor.species);
    return {
      id: `${actor.id}`,
      icon: getTextureURL(iconTexture),
      clickHandler: () => {
        console.log(`clicked on ${actor.id}`);
        this.game.camera.setPointerTarget(actor.position, actor, true);
      },
      label: actor.name,
      tooltip: `Entity: ${actor.id}`,
    };
  }

  public mapBuildMenuItem(option: {
    name: string;
    // iconPath: string;
    iconTexture: Texture;
    id: string;
  }): MenuItem {
    return {
      id: `${option.name}`,
      icon: getTextureURL(option.iconTexture),
      clickHandler: () => {
        const tile = Tile.getTileId(
          option.id as BiomeId,
          SystemTime.season,
          BaseTileKey
        );

        this.game.map.setTile(
          this.game.camera.pointerTarget.position.x,
          this.game.camera.pointerTarget.position.y,
          tile
        );
      },
      label: option.name,
      tooltip: `Set: ${option.name} Tile`,
    };
  }

  public setUtilityActionsOptions(): void {
    this.utilityActions.setOptions([
      {
        label: "Overlays",
        icon: OverlayIcon,
        handler: () => {
          console.log("overlays selected");
          this.setUIVisible(false, true);
          // TimeManager.setIsPaused(true);
          this.overlay.setVisible(true);
        },
      },
      {
        label: "Grid Indicator",
        icon: OverlayIcon,
        handler: () => {
          console.log("Grid Indicator selected");
          this.setUIVisible(false, true);
          this.tileSelectionIndicator.setVisible(true);
        },
      },
    ]);
  }

  public setSideMenuVisible(
    visible: boolean,
    includeToggle: boolean = false
  ): void {
    if (this.sideMenu) {
      this.sideMenu.setVisible(visible, includeToggle);
    }
  }

  public setTimeControlVisible(visible: boolean): void {
    if (this.timeControl) {
      this.timeControl.setVisible(visible);
    }
  }

  public setUIVisible(visible: boolean, hideIndicators: boolean = true): void {
    this.setSideMenuVisible(visible, hideIndicators);
    this.setTimeControlVisible(visible);
    this.tileInfo.setVisible(visible);
  }

  public registerOverlays() {
    this.overlay.generateBiomeOverlay(
      GameSettings.options.gameSize.width,
      GameSettings.options.gameSize.height,
      "Terrain",
      () => this.game.map.terrainMap
    );

    this.overlay.generateOverlay(
      GameSettings.options.gameSize.width,
      GameSettings.options.gameSize.height,
      "Magnetism",
      () => SystemPoles.all
    );

    this.overlay.generateOverlayFromArray(
      GameSettings.options.gameSize.width,
      GameSettings.options.gameSize.height,
      "Temperature",
      () => SystemTemperature.all
    );

    this.overlay.generateGradientOverlayFromArray(
      GameSettings.options.gameSize.width,
      GameSettings.options.gameSize.height,
      "Temperature (blue <---> red)",
      { min: "blue", max: "red" },
      () => SystemTemperature.all
    );

    this.overlay.generateOverlay(
      GameSettings.options.gameSize.width,
      GameSettings.options.gameSize.height,
      "Moisture",
      () => SystemMoisture.baseMoistureMap
    );

    this.overlay.generateOverlay(
      GameSettings.options.gameSize.width,
      GameSettings.options.gameSize.height,
      "Height",
      () => this.game.map.heightMap
    );

    this.overlay.generateOverlayFromArray(
      GameSettings.options.gameSize.width,
      GameSettings.options.gameSize.height,
      "Shadows",
      () => SystemShadows.all
    );

    this.overlay.generateBiomeOverlay(
      GameSettings.options.gameSize.width,
      GameSettings.options.gameSize.height,
      "Biomes",
      () => this.game.map.biomeMap
    );

    this.overlay.generateOverlayFromArray(
      GameSettings.options.gameSize.width,
      GameSettings.options.gameSize.height,
      "Clouds",
      () => SystemClouds.cloudMap
    );
  }
}
