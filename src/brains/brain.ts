import { Action } from "../actions/action";

export interface Brain {
  action: Action | null;
  goal: Action | null;
  plan(): void;
  act(): Promise<any>;
  updateFacing?(moveVector: [number, number]): void;
}
