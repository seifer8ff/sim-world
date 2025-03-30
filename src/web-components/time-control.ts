import "@shoelace-style/shoelace/dist/components/icon/icon.js";
import "@shoelace-style/shoelace/dist/components/button/button.js";
import "@shoelace-style/shoelace/dist/components/icon-button/icon-button.js";
import "@shoelace-style/shoelace/dist/components/range/range.js";
import { SlIconButton, SlRange } from "@shoelace-style/shoelace";
import PauseIcon from "../shoelace/assets/icons/pause-fill.svg";
import PlayIcon from "../shoelace/assets/icons/play-fill.svg";
import { UtilityActions } from "./utility-actions";

export class TimeControl extends HTMLElement {
  public timeDisplay: HTMLDivElement;
  public timeText: HTMLSpanElement;
  public timeSlider: SlRange;
  public pauseBtn: SlIconButton;
  public utilityActions: UtilityActions;

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: "open" });

    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.top = "0";
    container.style.left = "0";
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.backgroundColor = "rgba(0, 0, 0, .8)";
    container.style.boxShadow = "0 0 10px 1px rgba(0, 0, 0, 0.25)";
    container.style["backdropFilter"] = "blur(15px)";
    container.style.padding = "0 20px 0 20px";
    container.style.fontFamily = "Arial";
    container.style.fontSize = "18px";
    container.style.borderBottomRightRadius = "10px";
    container.style.pointerEvents = "auto";

    this.pauseBtn = document.createElement("sl-icon-button");
    this.pauseBtn.setAttribute("size", "large");
    this.pauseBtn.setAttribute("src", PauseIcon);
    this.pauseBtn.style.fontSize = "32px";

    container.appendChild(this.pauseBtn);

    this.timeText = document.createElement("span");
    this.timeText.style.fontWeight = " var(--sl-font-weight-semibold)";
    this.timeText.style.minWidth = "275px";
    this.timeText.style.letterSpacing = " var(--sl-letter-spacing-loose)";
    this.timeText.textContent = "CURRENT TIME";

    container.appendChild(this.timeText);

    this.timeSlider = document.createElement("sl-range");
    this.timeSlider.setAttribute("min", "0");
    this.timeSlider.setAttribute("max", "3");
    this.timeSlider.setAttribute("step", "0.25");
    this.timeSlider.setAttribute("value", "1");
    this.timeSlider.setAttribute("tooltip", "bottom");

    this.timeSlider.style.position = "absolute";
    this.timeSlider.style.top = "65px";
    this.timeSlider.style.left = "10px";
    this.timeSlider.style.right = "10px";

    container.appendChild(this.timeSlider);

    this.utilityActions = document.createElement(
      "utility-actions"
    ) as UtilityActions;
    this.utilityActions.style.position = "absolute";
    this.utilityActions.style.right = "-40px";
    this.utilityActions.style.top = "10px";
    container.appendChild(this.utilityActions);

    shadow.appendChild(container);
    this.setVisible(false);
  }

  public updateTime(timeForDisplay: string): void {
    this.timeText.textContent = timeForDisplay;
  }

  public updatePauseBtn(pause: boolean): void {
    this.pauseBtn.setAttribute("src", pause ? PlayIcon : PauseIcon);
  }

  public toggleTooltip(): void {
    // this.timeSlider.shadowRoot.querySelector("div[part=base]").setAttribute("open", "true");
    const tooltip = this.timeSlider.shadowRoot.querySelector("sl-tooltip");
    console.log("-------- got tooltip?: ", tooltip);
    // if (tooltip) {
    //   tooltip.setAttribute("open", "true");
    // }
  }

  public setVisible(visible: boolean): void {
    this.style.display = visible ? "block" : "none";
  }
}
