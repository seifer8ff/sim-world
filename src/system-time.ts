import Action from "rot-js/lib/scheduler/action";
import { GameSettings } from "./game-settings";
import { ActorBase } from "./actor";

export enum DayPhase {
  "morning" = 0,
  "mid" = 1,
  "evening" = 2,
}

export enum Season {
  Spring = "spring",
  Summer = "summer",
  Fall = "fall",
  Winter = "winter",
}

export class SystemTime {
  private static scheduler: Action = new Action();
  public static timeScale: number = 1;
  public static isPaused: boolean = true;
  public static turnAnimTimePercent: number = 0;

  // time values are in turns
  public static maxTimeScale: number = 10;
  public static daysPerYear: number = 10;
  public static dayLength: number = 70;
  public static nightLength: number = 50;
  public static lightTransitionPercent: number = 0.38;
  public static season: Season = Season.Spring;
  public static isDayTime: boolean = true;
  public static isNighttime: boolean = false;
  public static lightPhase: DayPhase = DayPhase.morning;
  public static currentYear: number = 1;
  public static currentDay: number = 1;
  public static currentTime: number = 0;
  public static currentTurn: number = 0;
  public static remainingCyclePercent: number = 0;
  public static remainingPhasePercent: number = 0;

  public static init(): void {
    // Add single turn placeholder actor to ensure no turns are skipped
    this.scheduler.add({}, true, 1);

    this.calculateCurrentTime();
    this.isPaused = true;
  }

  public static addToSchedule(
    actor: ActorBase,
    repeat: boolean,
    initialTimeDelay?: number
  ): Action {
    return this.scheduler.add(actor, repeat, initialTimeDelay);
  }

  public static removeFromSchedule(actor: ActorBase): void {
    this.scheduler.remove(actor);
  }

  public static renderUpdate(remainingAnimDelay: number): void {
    this.calculateTurnPercent(remainingAnimDelay);
  }

  public static nextOnSchedule(): ActorBase {
    this.calculateCurrentTime();
    return this.scheduler.next();
  }

  public static calculateTurnPercent(remainingAnimDelay: number): void {
    if (!this.isPaused) {
      const timeTotal = GameSettings.options.turnAnimDelay;
      this.turnAnimTimePercent = (timeTotal - remainingAnimDelay) / timeTotal;
    }
  }

  public static calculateCurrentTime(): void {
    this.currentTurn = this.scheduler.getTime();
    const totalDayLength = this.dayLength + this.nightLength;
    this.currentYear =
      Math.floor(this.currentTurn / totalDayLength / this.daysPerYear) + 1;
    this.currentDay =
      (Math.floor(this.currentTurn / totalDayLength) % this.daysPerYear) + 1;
    this.currentTime = this.currentTurn % totalDayLength;
    this.isNighttime = this.currentTime >= this.dayLength;
    this.isDayTime = !this.isNighttime;

    this.remainingCyclePercent = this.isDayTime
      ? 1 - this.currentTime / this.dayLength
      : 1 - (this.currentTime - this.dayLength) / this.nightLength;

    this.calculateLightPhase();
  }

  public static calculateLightPhase(): void {
    if (this.remainingCyclePercent >= 1 - this.lightTransitionPercent) {
      this.lightPhase = DayPhase.morning;
    } else if (this.remainingCyclePercent < this.lightTransitionPercent) {
      this.lightPhase = DayPhase.evening;
    } else {
      this.lightPhase = DayPhase.mid;
    }

    if (this.lightPhase === DayPhase.morning) {
      this.remainingPhasePercent =
        (1 - this.remainingCyclePercent) / this.lightTransitionPercent;
    } else if (this.lightPhase === DayPhase.evening) {
      this.remainingPhasePercent =
        this.remainingCyclePercent / this.lightTransitionPercent;
    } else {
      this.remainingPhasePercent = 1;
    }
  }

  public static getCurrentTimeForDisplay(): string {
    return `Year: ${this.currentYear}  -  ${
      this.isDayTime ? "Day" : "Night"
    }: ${this.currentDay}  -  Hour: ${this.currentTime}`;
  }

  public static setDuration(time: number): Action {
    return this.scheduler.setDuration(time);
  }

  public static togglePause(): void {
    this.setIsPaused(!this.isPaused);
  }

  public static setIsPaused(isPaused: boolean): void {
    this.isPaused = isPaused;
    console.log("isPaused: ", this.isPaused);
  }

  public static setTimescale(scale: number): void {
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

  public static resetTurnAnimTime(): void {
    this.turnAnimTimePercent = 0;
  }

  public static forceNextTurn(): void {
    const temp = this.scheduler.add(null, false, 1);
    this.scheduler.next();
    this.scheduler.remove(temp);
  }
}
