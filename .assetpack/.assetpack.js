import { compressJpg, compressPng } from "@assetpack/plugin-compress";
import { audio } from "@assetpack/plugin-ffmpeg";
import { json } from "@assetpack/plugin-json";
import { pixiManifest } from "@assetpack/plugin-manifest";
import { pixiTexturePacker } from "@assetpack/plugin-texture-packer";
import { webfont } from "@assetpack/plugin-webfont";

/**
 *
 * This script must live with the dummy package.json file to allow imports.
 * This is required for the automated build process to work
 *
 */

export default {
  entry: "./raw-assets",
  output: "./public",
  cache: false,
  plugins: {
    webfont: webfont(),
    compressJpg: compressJpg(),
    compressPng: compressPng(),
    audio: audio(),
    json: json(),
    texture: pixiTexturePacker({
      texturePacker: {
        removeFileExtension: true,
        extrude: 2,
      },
    }),
    manifest: pixiManifest({
      output: "public/assets-manifest.json",
    }),
  },
};
