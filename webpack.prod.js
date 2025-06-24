const { merge } = require("webpack-merge");
const path = require("path");
const common = require("./webpack.common.js");

const FileManagerPlugin = require("filemanager-webpack-plugin");

module.exports = merge(common, {
  mode: "production",
  devtool: "source-map",
  plugins: [
    new FileManagerPlugin({
      events: {
        onStart: {
          copy: [
            {
              source: path.resolve(
                __dirname,
                "node_modules/@shoelace-style/shoelace/dist/assets"
              ),
              destination: path.resolve(__dirname, "src/shoelace/assets"),
            },
            {
              source: path.resolve(
                __dirname,
                "node_modules/@shoelace-style/shoelace/dist/themes"
              ),
              destination: path.resolve(__dirname, "src/shoelace/themes"),
            },
          ],
        },
      },
    }),
  ],
});
