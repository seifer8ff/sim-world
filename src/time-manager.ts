import { Game } from "./game";
import Action from "rot-js/lib/scheduler/action";
import { LightPhase } from "./map-shadows";
import { GameSettings } from "./game-settings";
import { ActorBase } from "./entities/actor";

export enum Season {
  Spring = "spring",
  Summer = "summer",
  Fall = "fall",
  Winter = "winter",
}

export class TimeManager {
  private scheduler: Action;
  public timeScale: number;
  public isPaused: boolean;
  public turnAnimTimePercent: number;

  // time values are in turns
  public maxTimeScale: number;
  public daysPerYear: number;
  public dayLength: number;
  public nightLength: number;
  // what percent of a day is spent on sun/moonlight transitions
  // for instance, 0.33 means 33% of the day is rising sun, 33% noon, 33% setting sun
  // 0.2 means 20% rising sun, 60% noon, 20% setting sun
  public lightTransitionPercent: number;
  // public transitionTime: number;
  public season: Season;
  public isDayTime: boolean;
  public isNighttime: boolean;
  public lightPhase: LightPhase;
  public currentYear: number;
  public currentDay: number;
  public currentTime: number;
  public currentTurn: number;
  public remainingCyclePercent: number; // how much time left before day/night cycles. expressed as decimal
  public remainingPhasePercent: number; // how much time left before light phase changes. expressed as decimal

  constructor(private game: Game) {
    this.turnAnimTimePercent = 0;
    this.scheduler = new Action();
    this.isPaused = false;

    this.maxTimeScale = 10;
    this.dayLength = 70;
    this.nightLength = 50;
    this.daysPerYear = 10;
    this.season = Season.Spring;
    this.lightTransitionPercent = 0.38;

    this.timeScale = 1;
    this.currentYear = 1;
    this.currentDay = 1;
    this.currentTime = 0;
    this.currentTurn = 0;
    this.isDayTime = true;
    this.lightPhase = LightPhase.rising;
    this.isNighttime = !this.isDayTime;

    if (!GameSettings.options.toggles.dayStart) {
      const temp = this.scheduler.add(null, false, this.dayLength);
      for (let i = 0; i < this.dayLength; i++) {
        this.scheduler.next();
      }
      this.scheduler.remove(temp);
    }

    // add single turn placeholder actor to ensure no turns are skipped due to lack of actors/timing edge cases
    this.scheduler.add({}, true, 1);

    this.calculateCurrentTime();
    this.isPaused = true;
  }

  public addToSchedule(
    actor: ActorBase,
    repeat: boolean,
    initialTimeDelay?: number
  ): Action {
    return this.scheduler.add(actor, repeat, initialTimeDelay);
  }

  public renderUpdate(remainingAnimDelay: number) {
    this.calculateTurnPercent(remainingAnimDelay);
  }

  public nextOnSchedule(): ActorBase {
    this.calculateCurrentTime();
    return this.scheduler.next();
  }

  public calculateTurnPercent(remainingAnimDelay: number): void {
    if (!this.isPaused) {
      const timeTotal = GameSettings.options.turnAnimDelay;
      this.turnAnimTimePercent = (timeTotal - remainingAnimDelay) / timeTotal;
    }

    // console.log(this.turnAnimTimePercent);
  }

  public calculateCurrentTime(): void {
    this.currentTurn = this.scheduler.getTime();
    const totalDayLength = this.dayLength + this.nightLength;
    this.currentYear =
      Math.floor(this.currentTurn / totalDayLength / this.daysPerYear) + 1;
    this.currentDay =
      (Math.floor(this.currentTurn / totalDayLength) % this.daysPerYear) + 1;
    this.currentTime = this.currentTurn % totalDayLength;
    this.isNighttime = this.currentTime >= this.dayLength;
    this.isDayTime = !this.isNighttime;

    // how much time is left before the next transition
    // at start: 1, mid: 0.5, end: 0
    this.remainingCyclePercent = this.isDayTime
      ? 1 - this.currentTime / this.dayLength
      : 1 - (this.currentTime - this.dayLength) / this.nightLength;
    // console.log("remainingCyclePercent: ", this.remainingCyclePercent);

    this.calculateLightPhase();
  }

  public calculateLightPhase(): void {
    if (this.remainingCyclePercent >= 1 - this.lightTransitionPercent) {
      this.lightPhase = LightPhase.rising;
    } else if (this.remainingCyclePercent < this.lightTransitionPercent) {
      this.lightPhase = LightPhase.setting;
    } else {
      this.lightPhase = LightPhase.peak;
    }
    if (this.lightPhase === LightPhase.rising) {
      this.remainingPhasePercent =
        (1 - this.remainingCyclePercent) / this.lightTransitionPercent;
    } else if (this.lightPhase === LightPhase.setting) {
      this.remainingPhasePercent =
        this.remainingCyclePercent / this.lightTransitionPercent;
    } else {
      this.remainingPhasePercent = 1;
    }
  }

  public getCurrentTimeForDisplay(): string {
    return `Year: ${this.currentYear}  -  ${
      this.isDayTime ? "Day" : "Night"
    }: ${this.currentDay}  -  Hour: ${this.currentTime}`;
  }

  public setDuration(time: number): Action {
    return this.scheduler.setDuration(time);
  }

  public togglePause(): void {
    this.setIsPaused(!this.isPaused);
  }

  public setIsPaused(isPaused: boolean): void {
    this.isPaused = isPaused;
    console.log("isPaused: ", this.isPaused);
  }

  public setTimescale(scale: number): void {
    this.timeScale = scale;
    if (this.timeScale > this.maxTimeScale) {
      this.timeScale = this.maxTimeScale;
    }
    if (this.timeScale <= 0) {
      this.timeScale = 0;
      this.isPaused = true;
    } else {
      this.isPaused = false;
    }
  }

  public resetTurnAnimTime(): void {
    // reset turn time
    this.turnAnimTimePercent = 0;
  }

  public forceNextTurn() {
    const temp = this.scheduler.add(null, false, 1);
    this.scheduler.next();
    this.scheduler.remove(temp);
  }
}
