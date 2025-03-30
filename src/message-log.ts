import { Game } from "./game";

export class MessageLog {
  private lines: string[];
  private maxLines: number;

  constructor(private game: Game) {
    this.maxLines = 100;
    this.lines = [];
  }

  clear(): void {
    this.lines = [];
  }

  appendText(text: string): void {
    this.lines.splice(0, 0, text);
    if (this.lines.length > this.maxLines) {
      this.lines.splice(this.maxLines, this.lines.length - this.maxLines);
    }
  }

  draw(): void {
    // this.game.application.stage.removeChildren();
    // const text = this.lines.join("\n");
    // const message = new PIXI.Text(text, {
    //   fontFamily: "Arial",
    //   fontSize: 18,
    //   fill: 0xffffff,
    //   align: "left",
    // });
    // message.x = 10;
    // message.y = 10;
    // this.game.application.stage.addChild(message);
  }
}
