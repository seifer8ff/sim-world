import TypeIcon from "../shoelace/assets/icons/person-vcard.svg";
import GoalIcon from "../shoelace/assets/icons/geo-alt.svg";
import ActionIcon from "../shoelace/assets/icons/sign-turn-slight-right.svg";
import PinIcon from "../shoelace/assets/icons/pin-map.svg";
import TextIcon from "../shoelace/assets/icons/card-text.svg";
import TempIcon from "../shoelace/assets/icons/thermometer-half.svg";
import MoistureIcon from "../shoelace/assets/icons/droplet.svg";
import SunIcon from "../shoelace/assets/icons/brightness-high.svg";
import MagnetIcon from "../shoelace/assets/icons/magnet.svg";
import HeightIcon from "../shoelace/assets/icons/arrow-up-short.svg";

import { ActorBase } from "../actor";
import { Tile } from "../tile";
import { PointerTarget } from "../camera";

export interface DescriptionBlock {
  icon: string;
  content: string;
}

export class Description {
  constructor(public actor: ActorBase) {}

  public generate(): DescriptionBlock[] {
    const descriptionBlocks: DescriptionBlock[] = [];
    descriptionBlocks.push({
      icon: PinIcon,
      content: `${this.actor.position.x}, ${this.actor.position.y}`,
    });
    // descriptionBlocks.push({
    //   icon: TypeIcon,
    //   content: this.actor.subType,
    // });
    descriptionBlocks.push({
      icon: GoalIcon,
      content: this.actor.brain?.goal?.name || "-",
    });
    descriptionBlocks.push({
      icon: ActionIcon,
      content: this.actor.brain?.action?.name || "-",
    });
    return descriptionBlocks;
  }

  public static generateTileDescription(
    target: PointerTarget
  ): DescriptionBlock[] {
    const descriptionBlocks: DescriptionBlock[] = [];
    if (!target) return descriptionBlocks;

    descriptionBlocks.push({
      icon: PinIcon,
      content: `${target.position.x}, ${target.position.y}`,
    });
    if (target?.info) {
      descriptionBlocks.push({
        icon: TextIcon,
        content: `${target?.info?.biome?.description || "Unknown Biome"}`,
      });
      descriptionBlocks.push({
        icon: TempIcon,
        content: `${Math.round(target?.info?.temperaturePercent * 100)}°F`,
      });
      descriptionBlocks.push({
        icon: HeightIcon,
        content: `${Math.round(target?.info?.height * 100)} height`,
      });
      descriptionBlocks.push({
        icon: MoistureIcon,
        content: `${Math.round(target?.info?.moisture * 100)}% moisture`,
      });
      descriptionBlocks.push({
        icon: MagnetIcon,
        content: `${Math.round(target?.info?.magnetism * 100)} magnetism`,
      });
      descriptionBlocks.push({
        icon: SunIcon,
        content: `${Math.round(target?.info?.sunlight * 100) || "??"}% light`,
      });
    }

    return descriptionBlocks;
  }
}
