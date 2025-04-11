import "@shoelace-style/shoelace/dist/components/icon/icon.js";
import "@shoelace-style/shoelace/dist/components/button/button.js";
import SlButton from "@shoelace-style/shoelace/dist/components/button/button.js";
import "@shoelace-style/shoelace/dist/components/menu/menu.js";
import "@shoelace-style/shoelace/dist/components/menu-item/menu-item.js";
import "@shoelace-style/shoelace/dist/components/dropdown/dropdown.js";
import "@shoelace-style/shoelace/dist/components/menu-label/menu-label.js";
import "@shoelace-style/shoelace/dist/components/divider/divider.js";
import { SideMenuContent } from "./side-menu-content";
import SlMenu from "@shoelace-style/shoelace/dist/components/menu/menu.js";
import SlDropdown from "@shoelace-style/shoelace/dist/components/dropdown/dropdown.js";
import SlMenuItem from "@shoelace-style/shoelace/dist/components/menu-item/menu-item.js";
import WrenchIcon from "../shoelace/assets/icons/wrench.svg";
import HouseIcon from "../shoelace/assets/icons/house-door.svg";
import BackpackIcon from "../shoelace/assets/icons/backpack4.svg";
import PersonIcon from "../shoelace/assets/icons/person.svg";
import HandleIcon from "../shoelace/assets/icons/grip-vertical.svg";
import { SlIconButton } from "@shoelace-style/shoelace";
import { CachedTexture } from "../assets";
import { ActorBase, WithID } from "../actor";

export interface MenuTab {
  name: TopLevelMenu;
  icon: string;
  content: MenuItem[];
}

export type TopLevelMenu = "Entities" | "Cities" | "Resources" | "Build";

export interface MenuItem {
  id: string;
  icon: CachedTexture;
  clickHandler?: () => void;
  label?: string;
  tooltip?: string;
}

export class SideMenu extends HTMLElement {
  public container: HTMLDivElement;
  public handle: SlIconButton;
  private dropdownBtn: SlButton;
  private dropdown: SlDropdown;
  public dropdownMenu: SlMenu;
  public selectedTab: MenuTab;
  public menuContent: SideMenuContent;
  private topControls: HTMLDivElement;
  private midControls: HTMLDivElement;
  private dropdownMenuOptions: SlMenuItem[];
  public isVisible: boolean;
  public isCollapsed: boolean;
  public tabs: MenuTab[];

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: "open" });
    this.tabs = [
      { name: "Entities", icon: PersonIcon, content: [] },
      { name: "Cities", icon: HouseIcon, content: [] },
      { name: "Resources", icon: BackpackIcon, content: [] },
      { name: "Build", icon: WrenchIcon, content: [] },
    ];
    this.isVisible = false;

    this.container = document.createElement("div");
    this.container.style.pointerEvents = "auto";
    this.container.style.position = "absolute";
    this.container.style.top = "120px";
    this.container.style.left = "0";
    this.container.style.bottom = "20px";
    this.container.style.width = "120px";
    this.container.style.padding = "10px";
    this.container.style.paddingRight = "0px";
    this.container.style.paddingLeft = "0px";
    this.container.style.backgroundColor = "rgba(0, 0, 0, .8)";
    this.container.style.boxShadow = "0 0 10px 1px rgba(0, 0, 0, 0.25)";
    this.container.style["backdropFilter"] = "blur(15px)";
    this.container.style.borderBottomRightRadius = "10px";
    this.container.style.transition = "transform 0.3s ease-in-out";

    this.handle = document.createElement("sl-icon-button");
    this.handle.setAttribute("src", HandleIcon);
    this.handle.style.fontSize = "28px";
    this.handle.style.backgroundColor = "rgba(0, 0, 0, .8)";
    this.handle.style.boxShadow = "0 0 10px 1px rgba(0, 0, 0, 0.25)";
    this.handle.style["backdropFilter"] = "blur(15px)";
    this.handle.style.padding = "0";
    this.handle.style.borderTopRightRadius = "10px";
    this.handle.style.borderBottomRightRadius = "10px";
    this.handle.style.position = "absolute";
    this.handle.style.top = "0";
    this.handle.style.right = "-44px";
    this.handle.style.cursor = "pointer";
    this.container.appendChild(this.handle);

    this.topControls = document.createElement("div");
    this.topControls.style.height = "90px";
    this.dropdown = document.createElement("sl-dropdown");
    this.dropdown.setAttribute("hoist", "true");
    this.dropdown.setAttribute("placement", "bottom-end");
    this.dropdown.style.pointerEvents = "auto";
    this.dropdown.style.marginTop = "5px";

    this.dropdownMenu = document.createElement("sl-menu");
    this.dropdownMenu.style.pointerEvents = "auto";
    this.dropdown.appendChild(this.dropdownMenu);

    const divider = document.createElement("sl-divider");
    this.topControls.appendChild(this.dropdown);
    this.topControls.appendChild(divider);

    this.midControls = document.createElement("div");
    this.midControls.style.position = "absolute";
    this.midControls.style.top = "90px";
    this.midControls.style.left = "0";
    this.midControls.style.right = "0";
    this.midControls.style.bottom = "10px";
    this.midControls.style.overflowY = "auto";

    this.setSelectedTab(this.tabs[0]);

    this.container.appendChild(this.topControls);
    this.container.appendChild(this.midControls);

    shadow.appendChild(this.container);
    this.setVisible(false, true);
  }

  public getTab(tabName: string): MenuTab {
    return this.tabs.find((tab) => tab.name === tabName);
  }

  public setSelectedTab(tab: MenuTab): void {
    this.selectedTab = tab;
    this.buildTabDropdown();
    this.buildTabContent();
  }

  private buildTabDropdown(): void {
    if (this.dropdownBtn) {
      this.dropdown.removeChild(this.dropdownBtn);
    }
    this.dropdownBtn = document.createElement("sl-button");
    this.dropdownBtn.setAttribute("variant", "text");
    this.dropdownBtn.setAttribute("slot", "trigger");
    this.dropdownBtn.setAttribute("caret", "");
    const dropdownIcon = document.createElement("sl-icon");
    dropdownIcon.setAttribute("src", this.selectedTab.icon);
    dropdownIcon.style.fontSize = "20px";
    this.dropdownBtn.appendChild(dropdownIcon);
    this.dropdown.appendChild(this.dropdownBtn);

    if (this.dropdownMenuOptions) {
      for (let option of this.dropdownMenuOptions) {
        this.dropdownMenu.removeChild(option);
      }
    }
    this.dropdownMenuOptions = [];

    for (let tab of this.tabs) {
      if (tab === this.selectedTab) {
        continue;
      }

      const dropdownItem = document.createElement("sl-menu-item");
      const dropdownIcon = document.createElement("sl-icon");
      dropdownIcon.style.marginRight = "15px";
      dropdownItem.textContent = tab.name;
      dropdownItem.id = tab.name;
      dropdownItem.style.paddingTop = "15px";
      dropdownItem.style.paddingBottom = "15px";
      dropdownIcon.setAttribute("slot", "prefix");
      dropdownIcon.setAttribute("src", tab.icon);
      dropdownItem.appendChild(dropdownIcon);
      this.dropdownMenu.appendChild(dropdownItem);
      this.dropdownMenuOptions.push(dropdownItem);
    }
  }

  private buildTabContent(): void {
    // switch (this.selectedTab.name) {
    //   case "Entities":
    //     break;
    //   case "Cities":
    //     placeholderResources = [
    //       { name: "Boom Town", icon: HouseWithGearIcon },
    //       { name: "Declining City", icon: HouseDownIcon },
    //       { name: "Potential Site", icon: GeoIcon },
    //       { name: "Commercial District", icon: ShopWindowIcon },
    //     ];
    //     break;
    //   case "Resources":
    //     placeholderResources = [
    //       { name: "Currency", icon: CurrencyIcon },
    //       { name: "Animals", icon: PiggyBankIcon },
    //       { name: "Medicine", icon: CapsuleIcon },
    //       { name: "Plant Material", icon: FlowerIcon },
    //     ];
    //     break;
    //   case "Build":
    //     placeholderResources = [
    //       { name: "Planning", icon: PencilIcon },
    //       { name: "Housing", icon: HouseIcon },
    //     ];
    //     break;
    // }
    if (this.menuContent) {
      this.midControls.removeChild(this.menuContent);
    }

    this.menuContent = new SideMenuContent(
      this.selectedTab,
      this.selectedTab.content
    );
    this.midControls.appendChild(this.menuContent);
  }

  public setVisible(visible: boolean, includeToggle = false): void {
    if (includeToggle) {
      this.handle.style.display = visible ? "block" : "none";
    }
    if (this.isCollapsed) {
      if (!visible) {
        this.container.style.transform = "translateX(-100%)";
        this.isVisible = false;
      }
      return;
    }
    this.isVisible = visible;
    this.container.style.transform = this.isVisible
      ? "translateX(0)"
      : "translateX(-100%)";
  }

  public setCollapsed(collapsed: boolean): void {
    this.isCollapsed = collapsed;
    this.setVisible(!this.isCollapsed);
  }

  public setTabContent(tabName: string, content: MenuItem[]): void {
    const tab = this.getTab(tabName);
    tab.content = content;
    this.buildTabContent();
  }

  public setActorTarget(target: ActorBase) {
    this.menuContent.setOptionSelected(target?.id);
  }
}
