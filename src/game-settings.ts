export class GameSettings {
  static options = {
    toggles: {
      enableAutotile: true,
      enableRendering: true,
      enableGlobalLights: false,
      enableCloudLayer: false,
      enableShadows: false,
      enableAnimations: true,
      dayStart: true,
    },
    plants: {
      treeCount: 50,
      shrubCount: 250,
    },
    entities: {
      mushroomCount: 10,
      cowCount: 20,
      seagullCount: 25,
      sharkCount: 15,
      entityCount: 50,
    },
    gameSize: {
      width: 200,
      height: 200,
    },
    // gameSeed: 1234,
    // gameSeed: 610239,
    gameSeed: 594628,
    // gameSeed: null,
    turnAnimDelay: 500, // two turns per second (1 second / 500ms anim phase = 2)
    mainLoopRate: 1000 / 60, // run main loop at 60 fps (all other loops are lower than this)
    refreshRate: 1000 / 60, // 60 fps
    gameLoopRate: 1000 / 10, // how many times to run the game loop (still limited by turnAnimDelay)
    uiLoopRate: 1000 / 10,
    maxTickRate: 1000 / 60, // 60 game updates per second max
    minTickRate: 1000 / 4, // 2 game updates per second min
    animationSpeed: 0.55, // speed at which pixijs animates AnimatedSprites
  };
  static worldSizeOptions = [
    {
      value: {
        width: 1000,
        height: 1000,
      },
      label: "1000x1000",
    },
    {
      value: {
        width: 500,
        height: 500,
      },
      label: "500x500",
    },
    {
      value: {
        width: 300,
        height: 300,
      },
      label: "300x300",
    },
    {
      value: {
        width: 200,
        height: 200,
      },
      label: "200x200",
    },
    {
      value: {
        width: 100,
        height: 100,
      },
      label: "100x100",
    },
    {
      value: {
        width: 50,
        height: 50,
      },
      label: "50x50",
    },
  ];

  constructor() {}
}