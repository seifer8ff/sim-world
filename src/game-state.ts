export enum Stages {
  Loading,
  Title,
  Settings,
  Play,
  End,
}

export class GameState {
  stage: Stages;
  // loading is set to true whenever stage is changed.
  // once loading is complete, it's set to false.
  loading: boolean; // indicates if scene is fully loaded, including systems/map and UI
  loadingPercent: number;
  worldSetupComplete: boolean; // indicates if map and entity generation is complete

  constructor() {
    this.reset();
  }

  reset(): void {
    this.changeStage(Stages.Title);
  }

  isLoading(): boolean {
    return this.loading;
  }

  changeStage(stage: Stages): void {
    this.stage = stage;
    this.loading = true;
    this.loadingPercent = 0;
  }
}
