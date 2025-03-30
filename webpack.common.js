const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const FileManagerPlugin = require('filemanager-webpack-plugin');
const path = require('path');
const webpack = require('webpack');

module.exports = {
    entry: './src/app.ts',
    module: {
        rules: [
            // {
            //     test: /\.(png|jpg|gif)$/i,
            //     use: [
            //       {
            //         loader: 'url-loader',
            //         options: {
            //           limit: 8192,
            //         }
            //       },
            //     ],
            //    type: 'javascript/auto'
            //   },
            // {
            //   test: /\.png/,
            //   type: 'asset/resource'
            // },
            // {
            //   test: /\.json/,
            //   type: 'asset/resource'
            // },
            {
                test: /\.(png|svg|jpg|jpeg|gif)$/i,
                type: 'asset/resource',
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            },
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js'],
        fallback: {
            buffer: require.resolve('buffer/')
        }
    },
    output: {
        filename: 'app.js',
        clean: true,
        path: path.resolve(__dirname, 'dist')
    },
    plugins: [
        new HtmlWebpackPlugin({
            title: "Sim World",
            templateContent: `
        <html class="sl-theme-dark">
            <head>
                <title>Sim World</title>
                <meta name="description" content="Test project using rotjs and pixijs to build a simulated world to settle.">
                <meta charset="utf-8">
                <meta http-equiv="X-UA-Compatible" content="IE=edge">
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                <meta name="description" content="Your game description goes here.">     
            </head>
            <body>
                <div id="uiContainer">
                    <sky-mask></sky-mask>
                    <title-menu></title-menu>
                    <time-control></time-control>
                    <side-menu></side-menu>
                    <tile-info></tile-info>
                    <indicator-tile-selection></indicator-tile-selection>
                </div>
                <div id="gameContainer">
                    <div id="canvasContainer"></div>
                    <div id="textContainer"></div>
                </div>
            </body>
        </html>
        `
        }),
        new CopyWebpackPlugin(
            {

                patterns: [
                    { from: "./public", to: "public" }]
            }
        ),
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
        })]
};