import "@shoelace-style/shoelace/dist/components/button/button.js";
import SlButton from "@shoelace-style/shoelace/dist/components/button/button.js";
import "@shoelace-style/shoelace/dist/components/select/select";
import "@shoelace-style/shoelace/dist/components/option/option";
import "@shoelace-style/shoelace/dist/components/switch/switch";
import SlOption from "@shoelace-style/shoelace/dist/components/option/option.js";
import SlSelect from "@shoelace-style/shoelace/dist/components/select/select.js";
import SlSwitch from "@shoelace-style/shoelace/dist/components/switch/switch.js";
import HandleIcon from "../shoelace/assets/icons/grip-vertical.svg";
import { SlIconButton, SlInput } from "@shoelace-style/shoelace";
import { GameSettings } from "../game-settings";

export interface GameSettingsToggleOption {
  key: string;
  label: string;
  defaultValue: boolean;
  desc?: string;
}

export interface GameSettingsNumericInputOption {
  key: string;
  label: string;
  defaultValue: boolean;
  desc?: string;
}

export class TitleMenu extends HTMLElement {
  public titleContainer: HTMLDivElement;
  public titleText: HTMLHeadingElement;
  public sideContainer: HTMLDivElement;
  public settingsContainer: HTMLDivElement;
  public handle: SlIconButton;
  public startBtn: SlButton;
  public form: HTMLFormElement;
  public worldSizeInput: SlSelect;
  private settingsLbl: HTMLHeadingElement;
  public isVisible: boolean;
  public isCollapsed: boolean;
  private formId: string = "game-settings-form";
  private mediaQuery: MediaQueryList = window.matchMedia("(max-width: 1080px)");

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: "open" });
    this.isVisible = true;

    this.titleContainer = document.createElement("div");
    this.titleContainer.style.pointerEvents = "auto";
    this.titleContainer.style.position = "fixed";
    this.titleContainer.style.display = "flex";
    this.titleContainer.style.justifyContent = "center";
    this.titleContainer.style.alignItems = "center";
    this.titleContainer.style.backgroundColor = "rgba(45, 45, 45, .8)";
    this.titleContainer.style.boxShadow = "0 0 10px 1px rgba(0, 0, 0, 0.25)";
    this.titleContainer.style["backdropFilter"] = "blur(15px)";
    this.titleContainer.style.transform = "translateX(-50%)";

    this.titleText = document.createElement("h1");
    this.titleText.textContent = "Sim World";
    this.titleText.style.color = "var(--sl-color-neutral-700)";
    this.titleText.style.fontSize = "var(--sl-font-size-2x-large)";
    this.titleText.style.fontWeight = "var(--sl-font-weight-light)";
    this.titleText.style.letterSpacing = "var(--sl-letter-spacing-normal)";
    this.titleText.style.textTransform = "uppercase";
    this.titleContainer.appendChild(this.titleText);

    shadow.appendChild(this.titleContainer);

    this.sideContainer = document.createElement("div");
    this.sideContainer.style.pointerEvents = "auto";
    this.sideContainer.style.position = "absolute";
    this.sideContainer.style.top = "120px";
    this.sideContainer.style.left = "0";
    this.sideContainer.style.bottom = "20px";
    this.sideContainer.style.width = "300px";
    this.sideContainer.style.padding = "10px 20px";
    this.sideContainer.style.display = "flex";
    this.sideContainer.style.flexDirection = "column";
    this.sideContainer.style.overflow = "hidden";
    // this.container.style.backgroundColor = "rgba(0, 0, 0, .8)";
    this.sideContainer.style.backgroundColor = "rgba(45, 45, 45, .8)";
    this.sideContainer.style.boxShadow = "0 0 10px 1px rgba(0, 0, 0, 0.25)";
    this.sideContainer.style["backdropFilter"] = "blur(15px)";
    this.sideContainer.style.borderBottomRightRadius = "10px";
    this.sideContainer.style.transition = "transform 0.3s ease-in-out";

    this.handle = document.createElement("sl-icon-button");
    this.handle.setAttribute("src", HandleIcon);
    this.handle.style.fontSize = "28px";
    // this.handle.style.backgroundColor = "rgba(0, 0, 0, .8)";
    this.handle.style.backgroundColor = "rgba(45, 45, 45, .8)";
    // this.handle.style.boxShadow = "0 0 10px 1px rgba(0, 0, 0, 0.25)";
    this.handle.style["backdropFilter"] = "blur(15px)";
    this.handle.style.padding = "0";
    this.handle.style.borderTopRightRadius = "10px";
    this.handle.style.borderBottomRightRadius = "10px";
    this.handle.style.position = "absolute";
    this.handle.style.top = "0";
    this.handle.style.right = "-44px";
    this.handle.style.cursor = "pointer";
    this.sideContainer.appendChild(this.handle);

    this.startBtn = document.createElement("sl-button");
    this.startBtn.setAttribute("form", this.formId);
    this.startBtn.setAttribute("type", "submit"); // updates GameSettings with form data, and starts game
    this.startBtn.setAttribute("variant", "primary");
    this.startBtn.style.fontSize = "20px";
    this.startBtn.style.width = "100%";
    this.startBtn.textContent = "START GAME";
    this.sideContainer.appendChild(this.startBtn);
    const info = document.createElement("p");
    info.style.color = "var(--sl-color-neutral-600)";
    info.style.marginTop = "var(--sl-spacing-medium)";
    info.style.marginLeft = "var(--sl-spacing-2x-small)";
    info.style.fontSize = "var(--sl-font-size-small)";
    info.textContent =
      "Generate a new world with the settings specified below:";
    const info2 = document.createElement("p");
    info2.style.color = "var(--sl-color-neutral-500)";
    info2.style.marginTop = "var(--sl-spacing-2x-small)";
    info2.style.marginLeft = "var(--sl-spacing-2x-small)";
    info2.style.fontSize = "var(--sl-font-size-small)";
    info2.textContent = "Warning: may take some time to generate.";
    this.sideContainer.appendChild(info2);
    this.sideContainer.appendChild(info);

    this.settingsLbl = document.createElement("h1");
    this.settingsLbl.style.width = "100%";
    this.settingsLbl.textContent = "Settings";
    this.settingsLbl.style.color = "var(--sl-color-neutral-700)";
    this.settingsLbl.style.marginTop = "var(--sl-spacing-2x-small)";
    this.settingsLbl.style.marginLeft = "var(--sl-spacing-2x-small)";
    this.settingsLbl.style.fontSize = "var(--sl-font-size-large)";
    this.settingsLbl.style.fontWeight = "var(--sl-font-weight-light)";
    this.settingsLbl.style.letterSpacing = "var(--sl-letter-spacing-normal)";
    this.sideContainer.appendChild(this.settingsLbl);

    this.settingsContainer = document.createElement("div");
    this.settingsContainer.style.overflowX = "hidden";
    this.settingsContainer.style.overflowY = "auto";
    this.settingsContainer.style.height = "100%";
    this.settingsContainer.style.display = "flex";
    this.settingsContainer.style.flexDirection = "column";
    this.sideContainer.appendChild(this.settingsContainer);

    this.initForm();

    this.mediaQuery.addEventListener("change", this.handleResize);
    this.handleResize(this.mediaQuery);

    shadow.appendChild(this.sideContainer);
  }

  private handleResize = (e: MediaQueryListEvent | MediaQueryList) => {
    if (e.matches) {
      this.titleContainer.style.top = "0";
      this.titleContainer.style.left = "50%";
      this.titleContainer.style.width = "90%";
      this.titleContainer.style.minWidth = "300px";
      this.titleContainer.style.maxWidth = "500px";
      this.titleContainer.style.height = "120px";
      this.titleContainer.style.borderTopRightRadius = "0";
      this.titleContainer.style.borderTopLeftRadius = "0";
      this.titleContainer.style.borderBottomRightRadius = "10px";
      this.titleContainer.style.borderBottomLeftRadius = "10px";
      this.sideContainer.style.top = "25%";
      this.sideContainer.style.width = "260px";
    } else {
      this.titleContainer.style.top = "5%";
      this.titleContainer.style.left = "60%";
      this.titleContainer.style.width = "475px";
      this.titleContainer.style.height = "150px";
      this.titleContainer.style.borderRadius = "10px";
      this.sideContainer.style.top = "120px";
      this.sideContainer.style.width = "300px";
    }
    this.titleContainer.style.transition = "transform 0.3s ease-in-out";
  };

  private initForm(): void {
    this.form = document.createElement("form");
    this.form.setAttribute("id", this.formId);
    this.form.style.marginTop = "var(--sl-spacing-2x-small)";
    this.form.style.marginLeft = "var(--sl-spacing-2x-small)";
    this.form.style.width = "100%";
    this.form.style.display = "flex";
    this.form.style.flexDirection = "column";
    this.form.style.gap = "var(--sl-spacing-medium)";
    this.settingsContainer.appendChild(this.form);

    this.worldSizeInput = document.createElement("sl-select");
    this.worldSizeInput.setAttribute("label", "World Size");
    this.worldSizeInput.setAttribute("placeholder", "Select world size");
    this.worldSizeInput.setAttribute(
      "value",
      JSON.stringify(GameSettings.options.gameSize)
    );
    this.worldSizeInput.style.width = "100%";
    this.worldSizeInput.style.maxWidth = "100%";

    GameSettings.worldSizeOptions.forEach((option) => {
      const newOption = document.createElement("sl-option");
      newOption.setAttribute("value", JSON.stringify(option.value));
      newOption.textContent = option.label;
      this.worldSizeInput.appendChild(newOption);
    });
    this.form.appendChild(this.worldSizeInput);
  }

  public setVisible(visible: boolean, includeToggle = false): void {
    console.log("set visible start menu");
    if (includeToggle) {
      this.handle.style.display = visible ? "block" : "none";
    }
    if (this.isCollapsed) {
      if (!visible) {
        this.sideContainer.style.transform = "translateX(-100%)";
        this.titleContainer.style.transform = "translate(-50%, -150%)";
        this.isVisible = false;
      }
      return;
    }
    this.isVisible = visible;
    this.sideContainer.style.transform = this.isVisible
      ? "translateX(0)"
      : "translateX(-100%)";
    this.titleContainer.style.transform = this.isVisible
      ? "translate(-50%, 0)"
      : "translate(-50%, -150%)";
  }

  public setCollapsed(collapsed: boolean): void {
    this.isCollapsed = collapsed;
    this.setVisible(!this.isCollapsed);
  }

  public generateGameOptions(options: GameSettingsToggleOption[]): void {
    const toggles = options.map((option) => {
      const toggle: SlSwitch = document.createElement("sl-switch");
      toggle.setAttribute("name", option.key);
      toggle.textContent = option.label;
      if (option.defaultValue) {
        toggle.setAttribute("checked", "true");
        toggle.value = "true";
      } else {
        toggle.value = "false";
      }
      if (option.desc) {
        toggle.setAttribute("help-text", option.desc);
      }
      toggle.addEventListener("sl-change", (e) => {
        toggle.value = e.target["checked"];
      });

      return toggle;
    });
    toggles.forEach((toggle) => {
      this.form.appendChild(toggle);
    });
  }

  public generateGameInputs(inputs: GameSettingsNumericInputOption[]): void {
    const inputEls = inputs.map((input) => {
      const inputEl: SlInput = document.createElement("sl-input");
      inputEl.setAttribute("type", "number");
      inputEl.setAttribute("size", "small");
      inputEl.setAttribute("name", input.key);
      inputEl.setAttribute("placeholder", input.label);
      inputEl.setAttribute("value", input.defaultValue.toString());
      inputEl.setAttribute("label", input.label);
      inputEl.setAttribute("min", "0");
      inputEl.style.textTransform = "capitalize";
      if (input.desc) {
        inputEl.setAttribute("help-text", input.desc);
      }
      inputEl.addEventListener("input", (e) => {
        inputEl.value = e.target["value"];
      });

      return inputEl;
    });
    inputEls.forEach((input) => {
      this.form.appendChild(input);
    });
  }
}
