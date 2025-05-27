import "@shoelace-style/shoelace/dist/components/icon/icon.js";
import "@shoelace-style/shoelace/dist/components/button/button.js";
import "@shoelace-style/shoelace/dist/components/icon-button/icon-button.js";
import "@shoelace-style/shoelace/dist/components/range/range.js";
import "@shoelace-style/shoelace/dist/components/avatar/avatar.js";
import "@shoelace-style/shoelace/dist/components/card/card.js";
import CloseIcon from "../shoelace/assets/icons/x.svg";
import { PointerTarget } from "../camera";
import { Tile } from "../tile";
import { getTextureURL } from "../assets";
import { Biome, Biomes } from "../biomes";
import { Game } from "../game";
import { Description, DescriptionBlock } from "../components/description";
import { isActor } from "../actor";
import { Species } from "../species";
import { IconLayer } from "../data-actors";
import { Texture } from "pixi.js";
import { SystemStatic } from "../system-static";

export interface TileStats {
  height: number;
  magnetism: number;
  temperaturePercent: number;
  moisture: number;
  sunlight: number;
  biome: Biome;
}

export class TileInfo extends HTMLElement {
  private container: HTMLDivElement;
  private label: HTMLSpanElement;
  private avatar: HTMLDivElement;
  private body: HTMLDivElement;
  private target: PointerTarget;

  // holds the html elements and the underlying data blocks
  // used to update the text content of the elements
  private dElements: {
    element: HTMLDivElement;
    dBlock: DescriptionBlock;
  }[];

  private _game: Game;
  get game(): Game {
    return this._game;
  }
  set game(value: Game) {
    this._game = value;
  }

  private _isVisible: boolean;
  public get isVisible(): boolean {
    return this._isVisible;
  }
  private set isVisible(value: boolean) {
    this._isVisible = value;
  }

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: "open" });

    this.isVisible = false;
    this.target = null;

    this.container = document.createElement("div");
    this.container.style.position = "absolute";
    this.container.style.bottom = "0";
    this.container.style.right = "0";
    this.container.style.display = "flex";
    this.container.style.flexDirection = "column";
    this.container.style.alignItems = "center";
    this.container.style.backgroundColor = "rgba(0, 0, 0, .8)";
    this.container.style.boxShadow = "0 0 10px 1px rgba(0, 0, 0, 0.25)";
    this.container.style["backdropFilter"] = "blur(15px)";
    this.container.style.paddingTop = "var(--sl-spacing-x-small)";
    this.container.style.paddingLeft = "var(--sl-spacing-x-small)";
    this.container.style.borderTopLeftRadius = "10px";
    this.container.style.borderTopRightRadius = "10px";
    this.container.style.pointerEvents = "auto";
    this.container.style.height = "120px";
    this.container.style.width = "200px";
    this.container.style.transition = "transform 0.3s ease-in-out";

    const header = document.createElement("div");
    header.style.width = "100%";
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.justifyContent = "start";
    header.style.paddingBottom = "var(--sl-spacing-small)";
    header.style.fontSize = "var(--sl-font-size-small)";
    this.avatar = document.createElement("div");
    this.avatar.style.height = "32px";
    this.avatar.style.width = "32px";
    this.avatar.style.borderRadius = "10%";

    header.appendChild(this.avatar);
    this.label = document.createElement("span");
    this.label.textContent = "Tile Info";
    this.label.style.fontWeight = "var(--sl-font-weight-semibold)";
    this.label.style.fontSize = "var(--sl-font-size-small)";
    this.label.style.marginLeft = "var(--sl-spacing-small)";
    this.label.style.whiteSpace = "nowrap";
    this.label.style.overflow = "hidden";
    this.label.style.textOverflow = "ellipsis";
    this.label.style.width = "70%";
    header.appendChild(this.label);

    const buttonGroup = document.createElement("div");
    buttonGroup.style.position = "absolute";
    buttonGroup.style.right = "var(--sl-spacing-3x-small)";
    buttonGroup.style.top = "var(--sl-spacing-3x-small)";
    buttonGroup.style.display = "flex";
    buttonGroup.style.alignItems = "start";
    buttonGroup.style.justifyContent = "flex-end";

    const closeBtn = document.createElement("sl-icon-button");
    closeBtn.setAttribute("size", "small");
    closeBtn.setAttribute("src", CloseIcon);
    closeBtn.style.fontSize = "12px";
    closeBtn.style.transform = "scale(1.75)";
    closeBtn.style.cursor = "pointer";

    closeBtn.addEventListener("click", () => {
      this.game.userInterface.camera.clearPointerTarget();
      this.setContent(null);
    });

    buttonGroup.appendChild(closeBtn);
    header.appendChild(buttonGroup);
    this.container.appendChild(header);

    this.body = document.createElement("div");
    this.body.style.overflow = "auto";
    this.body.style.paddingLeft = "var(--sl-spacing-2x-small)";
    this.body.style.paddingRight = "var(--sl-spacing-2x-small)";
    this.body.style.fontSize = "var(--sl-font-size-x-small)";
    this.body.style.width = "100%";
    this.body.textContent = `No tile selected.`;

    this.container.appendChild(this.body);
    this.setVisible(false);

    shadow.appendChild(this.container);
  }

  // used for hiding the entire game UI, like for the main menu
  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.container.style.transform = this.isVisible
      ? "translateY(0)"
      : "translateY(100%)";
  }

  public setContent(target: PointerTarget): void {
    // console.log("set tile info content to", target);
    this.target = target;
    if (target == null) {
      // hide the tile info as a simplistic way to clear it
      // it gets unhidden when the target changes
      this.setVisible(false);
      return;
    }

    let iconTexture: Texture;

    if (isActor(target.target)) {
      // tile is an actor, and each actor has an icon texture
      this.label.textContent = `${target.target.name}`;
      this.avatar.style.transform =
        "translateX(25%) translateY(25%) scale(1.5)";
      iconTexture = SystemStatic.getTextureFor(
        Species.allSpecies[target.target.animId],
        IconLayer.ICON
      );
    } else if (target.target != null) {
      // target is a tile
      const biome = this.game.map.getBiome(
        target.position.x,
        target.position.y
      );
      this.label.textContent = `${biome.name}`;
      iconTexture = Tile.textures[target.target];
      this.avatar.style.transform = "translateX(0%) translateY(0%) scale(1)";
    }

    this.container.style.display = "flex";
    this.avatar.style.width = "16px";
    this.avatar.style.height = "16px";
    this.avatar.style.backgroundRepeat = "no-repeat";
    this.avatar.style.imageRendering = "pixelated";

    const textureURL = getTextureURL(iconTexture);

    if (textureURL) {
      this.avatar.style.backgroundImage = `url(${textureURL.url})`;
      this.avatar.style.backgroundPositionX = `-${textureURL.xOffset}px`;
      this.avatar.style.backgroundPositionY = `-${textureURL.yOffset}px`;
    }

    this.setBodyContent(target);
    this.setVisible(true);
  }

  // only called when changing targets
  public setBodyContent(target: PointerTarget) {
    let oldBody = this.body.firstChild;
    if (oldBody) {
      this.body.removeChild(oldBody);
    }
    this.body.textContent = "";
    const bodyContainer = document.createElement("div");
    bodyContainer.style.display = "flex";
    bodyContainer.style.flexDirection = "column";
    bodyContainer.style.alignItems = "start";
    bodyContainer.style.justifyContent = "start";
    bodyContainer.style.padding = "0 0 0 0";
    bodyContainer.style.margin = "0 0 0 0";
    bodyContainer.style.width = "100%";
    let dBlocks: DescriptionBlock[] = [];

    if (isActor(target.target)) {
      dBlocks = target.target.description?.generate() || [];
    } else if (target.target != null) {
      dBlocks = Description.generateTileDescription(target);
    } else {
      // nothing to display
      this.isVisible = false;
      return;
    }

    this.dElements = dBlocks.map((block) => {
      const blockContainer = this.generateDescriptionBlock(
        block.icon,
        block.content
      );
      bodyContainer.appendChild(blockContainer);
      return { element: blockContainer, dBlock: block };
    });

    this.body.appendChild(bodyContainer);
  }

  private generateDescriptionBlock(icon: string, text: string): HTMLDivElement {
    const block = document.createElement("div");
    block.style.display = "flex";
    block.style.justifyContent = "start";
    block.style.padding = "0 0 0 0";
    block.style.margin = "2px 0 0 0";
    block.style.width = "100%";
    const iconEl = document.createElement("sl-icon");
    iconEl.src = icon;
    iconEl.style.flexShrink = "0";
    const textEl = document.createElement("span");
    textEl.textContent = text;
    textEl.style.marginLeft = "var(--sl-spacing-x-small)";
    textEl.style.overflow = "hidden";
    textEl.style.textOverflow = "ellipsis";
    textEl.style.whiteSpace = "nowrap";

    block.appendChild(iconEl);
    block.appendChild(textEl);
    return block;
  }
}
