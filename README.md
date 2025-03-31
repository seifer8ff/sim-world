# Sim World

A prototype of a colony management game, in which the environment (plants, climate, weather) is deeply simulated. The entities living in this world will be powered by the latest LLM AI, and will populate, build, and maintain the environment over many generations.

## How to run

After cloning the repository:

- ensure you're using npm v18.20.7

- Install necessary packages

  ```powershell
  npm ci
  ```

- To build the assets, ensure you're using node v18.20.7 (can be managed easily using NVM) and then run:

  ```powershell
  npm run build:assets
  ```

- To build the application, run:

  ```powershell
  npm run build
  ```

  - To run the application using the dev server, run:

  ```powershell
  npm run dev
  ```

- To run multiple npm scripts cross platform in parallel run the following command:

  ```powershell
  # if globally installed
  concurrently npm:watch npm:serve

  # if locally installed
  npx concurrently npm:watch npm:serve
  ```

## Development Guide

This project uses rot.js as the game framework, and pixijs for rendering and handling sprites.

- sprite sheets are generated using pixijs AssetPack.
- Add new sprites to the appropriate sub-folder within raw-assets, then run

```powershell
    npm run build:assets
```

# Generating an autotile set of sprites from an RPGMaker style sprite sheet

- Navigate to https://wareya.github.io/webtyler/
- Upload an RPGMaker style sprite sheet
- Download the 47 count set of sprites (labeled for GameMaker Studio 2)
- Open Piskel app or navigate to https://www.piskelapp.com/
- Import the sprite sheet as a sprite sheet, with frame size 16x16
- Export as a zip, with a prefix ending in \_ (numbers will be appended to the prefix by the export process)
- Copy \_00 (the base tile) and name the copy <prefix>\_47
- Copy the set of sprites to the appropriate directory within raw-assets
- run npm run build:assets to process the sprites into a sprite sheet

For sprite manipulation:

- https://wareya.github.io/webtyler/

- https://www.piskelapp.com/

# Regenerating shader code

- Should you need to update the shader code, take the following steps:
  Clone the modified tilemap shader:
  https://github.com/seifer8ff/tilemap-with-tint/tree/v4.x
  After clone, switch to feat-tint branch and install dependencies:

  ```powershell
  cd tilemap-with-tint
  git checkout feat-tint
  npm ci
  ```

  Installing the depencencies also builds the project, readying it for copy into the sim-world/src/libs/tilemap-with-tint folder.

  Copy all of the files from the dist folder into sim-world/src/libs/tilemap-with-tint

  Repeat the above steps on each update to the shader code.
