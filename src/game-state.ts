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
  loading: boolean;
  loadingPercent: number;
  worldSetupComplete: boolean;

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
