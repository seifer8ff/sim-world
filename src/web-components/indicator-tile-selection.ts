import "@shoelace-style/shoelace/dist/components/icon/icon.js";
import "@shoelace-style/shoelace/dist/components/button/button.js";
import "@shoelace-style/shoelace/dist/components/icon-button/icon-button.js";
import "@shoelace-style/shoelace/dist/components/range/range.js";
import { SlIconButton, SlRange } from "@shoelace-style/shoelace";
import PauseIcon from "../shoelace/assets/icons/pause-fill.svg";
import PlayIcon from "../shoelace/assets/icons/play-fill.svg";
import { UtilityActions } from "./utility-actions";
import { Camera } from "../camera";
import { Point } from "../point";
import { Tile } from "../tile";
import { UserInterface } from "../user-interface";
import { Game } from "../game";
import CloseIcon from "../shoelace/assets/icons/x.svg";

export class IndicatorTileSelection extends HTMLElement {
  public container: HTMLDivElement;
  public canvas: HTMLCanvasElement;
  public closeBtn: SlIconButton;

  private isVisible: boolean;
  private updateRef: number;
  private lastRefreshTime: number;
  private msPerRefresh: number = 1000 / 10; // desired interval is 1000 ms / runs per second
  private game: Game;

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: "open" });

    this.isVisible = false;

    this.container = document.createElement("div");
    this.container.style.position = "absolute";
    this.container.style.top = "0";
    this.container.style.left = "0";
    this.container.style.bottom = "0";
    this.container.style.right = "0";
    this.container.style.border = "1px solid red";
    this.container.style.fontFamily = "Arial";
    this.container.style.fontSize = "18px";
    this.container.style.borderRadius = "10px";
    this.container.style.pointerEvents = "none";

    this.closeBtn = document.createElement("sl-icon-button");
    this.closeBtn.setAttribute("size", "large");
    this.closeBtn.setAttribute("src", CloseIcon);
    this.closeBtn.style.position = "absolute";
    this.closeBtn.style.top = "15px";
    this.closeBtn.style.right = "15px";
    this.closeBtn.style.zIndex = "100";
    this.closeBtn.style.pointerEvents = "auto";
    this.closeBtn.style.fontSize = "40px";
    this.closeBtn.style.zIndex = "110";

    this.container.appendChild(this.closeBtn);

    shadow.appendChild(this.container);
    this.setVisible(this.isVisible);
  }

  public init(game: Game) {
    this.game = game;
  }

  private createCanvas() {
    if (this.game.userInterface.gameContainer) {
      this.canvas = document.createElement("canvas");
      this.canvas.width = this.game.userInterface.gameContainer.clientWidth;
      this.canvas.height = this.game.userInterface.gameContainer.clientHeight;
      this.canvas.style.position = "absolute";
      this.canvas.style.top = "0";
      this.canvas.style.left = "0";
      this.canvas.style.pointerEvents = "none";
      this.canvas.style.zIndex = "100";
      this.container.appendChild(this.canvas);
    }
  }

  private drawGrid() {
    if (this.canvas) {
      const ctx = this.canvas.getContext("2d");
      // fill the grid with 16x16 tiles with a 1px border
      const borderSize = 1;
      const scale = this.game.userInterface.application.stage.scale.x;
      const tileSize = Tile.size * scale;
      const innerTileSize = tileSize - borderSize * 2; // Subtract border on both sides
      const width = this.canvas.width;
      const height = this.canvas.height;
      const rows = Math.floor(width / tileSize);
      const cols = Math.floor(height / tileSize);
      const xOffset = (width % tileSize) / 2;
      const yOffset = (height % tileSize) / 2;

      const pivot = this.game.userInterface.application.stage.pivot;
      const pivotOffsetX = (pivot.x % Tile.size) * scale;
      const pivotOffsetY = (pivot.y % Tile.size) * scale;

      ctx.clearRect(0, 0, width, height); // Clear the canvas
      ctx.fillStyle = "rgba(255, 16, 240, 1)"; // Set the color to hot pink
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          if (i === 47 && j === 26) {
            // console.log(`draw tile at ${i}, ${j}, ${tileSize}`);
            ctx.fillStyle = "rgba(30, 200, 240, 1)"; // Set the color to something else
          } else {
            ctx.fillStyle = "rgba(255, 16, 240, 1)"; // Set the color to hot pink
          }
          ctx.fillRect(
            i * tileSize + xOffset - pivotOffsetX,
            j * tileSize + yOffset - pivotOffsetY,
            tileSize,
            tileSize
          ); // Draw the outer tile (border)
        }
      }

      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          ctx.clearRect(
            i * tileSize + xOffset - pivotOffsetX + borderSize,
            j * tileSize + yOffset - pivotOffsetY + borderSize,
            innerTileSize,
            innerTileSize
          ); // Clear the inner tile
        }
      }
    }
  }

  public renderUpdate() {
    if (!this.canvas) {
      this.createCanvas();
    }
    if (this.canvas && this.isVisible) {
      this.drawGrid();
    }
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.style.display = visible ? "block" : "none";
  }
}
