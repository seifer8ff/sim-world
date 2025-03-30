import { Game } from "./game";
// import "./shoelace/themes/dark.styles";
import "./shoelace/themes/dark.css";
import "./style.css";
import { setBasePath } from "@shoelace-style/shoelace/dist/utilities/base-path.js";
import "scheduler-polyfill";
import "./scripts/console-extras.min.js";

declare global {
  export interface Console {
    times: (n: number) => Console;
    throttle: (n: number) => Console;
    collate: (...args) => Console;
    summary: () => string;
  }
}

// Set shoelace base path
// this path works on both prod and dev
// during build process, assets are copied from node module into root and dist folder
// setBasePath("shoelace");

document.body.onload = async () => {
  // creating a new game instance creates the Application
  // and the dom elements needed to hold the game
  var game = new Game();
  await game.Init();
  game.start();
};
