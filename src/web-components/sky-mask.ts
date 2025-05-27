import CloudsSmall from "../assets/clouds-small.png";
import CloudsMedium from "../assets/clouds-medium.png";
import CloudsMedium2 from "../assets/clouds-medium-2.png";
import CloudsLarge from "../assets/clouds-large.png";
import { inverseLerp } from "../misc-utility";

export class SkyMask extends HTMLElement {
  public container: HTMLDivElement;
  public cloudLayers: HTMLDivElement[];

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: "open" });

    this.container = document.createElement("div");
    this.container.style.position = "absolute";
    this.container.style.top = "0";
    this.container.style.bottom = "0";
    this.container.style.left = "0";
    this.container.style.right = "0";
    this.container.style.pointerEvents = "none";

    // this.generateCloudCanvas(this.container);
    this.cloudLayers = [];
    this.generateCloudLayers(this.container);

    shadow.appendChild(this.container);
  }

  private generateCloudLayers(container: HTMLDivElement) {
    this.generateCloudLayer(container, CloudsLarge);
    this.generateCloudLayer(container, CloudsMedium2);
    this.generateCloudLayer(container, CloudsMedium);
    this.generateCloudLayer(container, CloudsSmall);
  }

  private generateCloudLayer(container: HTMLDivElement, cloudImage: string) {
    const cloudLayer = document.createElement("div");
    cloudLayer.style.position = "absolute";
    cloudLayer.style.top = "0";
    cloudLayer.style.bottom = "0";
    cloudLayer.style.left = "0";
    cloudLayer.style.right = "0";
    cloudLayer.style.backgroundImage = `url(${cloudImage})`;
    cloudLayer.style.backgroundSize = "cover";
    cloudLayer.style.backgroundPosition = "center";
    cloudLayer.style.backgroundRepeat = "no-repeat";
    cloudLayer.style.backgroundAttachment = "fixed";
    cloudLayer.style.backgroundSize = "100% 100%";
    cloudLayer.style.imageRendering = "pixelated";
    cloudLayer.style.opacity = "0";
    cloudLayer.style.pointerEvents = "none";
    container.appendChild(cloudLayer);
    this.cloudLayers.push(cloudLayer);
  }

  private setCloudLayerOpacity(cloudLayer: HTMLDivElement, opacity: number) {
    cloudLayer.style.opacity = `${opacity}`;
  }

  private setAllCloudLayersOpacity(opacity: number) {
    for (const cloudLayer of this.cloudLayers) {
      cloudLayer.style.opacity = `${opacity}`;
    }
  }

  public setSkyMaskVisibility(zoomLevel: number) {
    let scaledZoom = zoomLevel;
    let opacity = 0;
    if (zoomLevel >= 0.2) {
      scaledZoom = 1;
      this.setAllCloudLayersOpacity(0);
    }
    if (zoomLevel < 0.13) {
      scaledZoom = inverseLerp(zoomLevel, 0.08, 0.13);
      opacity = 1 - scaledZoom;
      this.setCloudLayerOpacity(this.cloudLayers[0], opacity * 1);
    } else if (zoomLevel > 0.1) {
      this.setCloudLayerOpacity(this.cloudLayers[0], 0);
    }
    if (zoomLevel < 0.14) {
      scaledZoom = inverseLerp(zoomLevel, 0.07, 0.14);
      opacity = 1 - scaledZoom;
      this.setCloudLayerOpacity(this.cloudLayers[1], opacity * 0.8);
    } else if (zoomLevel > 0.11) {
      this.setCloudLayerOpacity(this.cloudLayers[1], 0);
    }
    if (zoomLevel < 0.15) {
      scaledZoom = inverseLerp(zoomLevel, 0.08, 0.15);
      opacity = 1 - scaledZoom;
      this.setCloudLayerOpacity(this.cloudLayers[2], opacity * 0.5);
    } else if (zoomLevel > 0.13) {
      this.setCloudLayerOpacity(this.cloudLayers[2], 0);
    }
    if (zoomLevel < 0.2) {
      scaledZoom = inverseLerp(zoomLevel, 0.05, 0.2);
      opacity = 1 - scaledZoom;
      this.setCloudLayerOpacity(this.cloudLayers[3], opacity * 0.3);
    } else if (zoomLevel > 0.17) {
      this.setCloudLayerOpacity(this.cloudLayers[3], 0);
    }
  }

  // private generateCloudCanvas(container: HTMLDivElement) {
  //   const canvas = document.createElement("canvas");
  //   canvas.width = window.innerWidth;
  //   canvas.height = window.innerHeight;
  //   container.appendChild(canvas);

  //   const ctx = canvas.getContext("2d", { willReadFrequently: true });
  //   const cloudColor = "rgba(255, 255, 255, 0.2)";
  //   const cloudRadius = 100;
  //   const cloudCount = 10;

  //   for (let i = 0; i < cloudCount; i++) {
  //     const x = Math.random() * canvas.width;
  //     const y = Math.random() * canvas.height;
  //     const radius = Math.random() * cloudRadius;

  //     ctx.beginPath();
  //     ctx.arc(x, y, radius, 0, Math.PI * 2);
  //     ctx.fillStyle = cloudColor;
  //     ctx.fill();
  //   }
  // }
}
