# WebGPU Hydraulic Erosion

## Overview

This project demonstrates hydraulic erosion simulation using WebGPU for GPU computing and Three.js for 3D rendering. The application allows users to generate terrain, apply masks, and simulate erosion processes.

## Features

- Terrain generation using simplex noise
- Mask application with Gaussian blur
- Hydraulic erosion simulation
- 3D visualization of terrain using Three.js
- Responsive UI with Flowbite and Tailwind CSS

## Project Structure

```
. 
├── .gitignore 
├── dockerfile 
├── package.json 
├── postcss.config.js 
├── README.md 
├── server.js 
├── src/ 
│   ├── assets/ 
│   │   ├── fonts/ 
│   │   └── heightmap.csv 
│   ├── index.html 
│   ├── index.js 
│   ├── js/ 
│   │   ├── alertUtil.js 
│   │   ├── erosion.js 
│   │   ├── erosionInputs.js 
│   │   ├── gaussianBlur.js 
│   │   ├── generateTerrain.js 
│   │   ├── gradientCalculation.js 
│   │   ├── maskUtil.js 
│   │   ├── noise.js 
│   │   ├── orbitControlsWebGPU.js 
│   │   ├── prepareErosionInput.js 
│   │   ├── scene.js 
│   │   ├── threejsScene.js 
│   │   └── webgpuHelper.js 
│   ├── partials/ 
│   ├── shaders/ 
│   └── styles.css 
├── tailwind.config.js 
├── testing/ 
│   ├── displayH.py 
│   ├── eroded_terrain.csv 
│   ├── gradientAndDisplay.py 
│   ├── heightmap.csv 
│   ├── input_terrain.csv 
│   ├── LUT2d.ipynb 
│   └── lutTesting.py 
└── webpack.config.js
```

## Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/metarapi/hydraulic-erosion.git
    cd webgpu-hydraulic-erosion
    ```

2. Install dependencies:
    ```sh
    npm install
    ```

3. Build the application:
    ```sh
    npm run build
    ```

4. Start the server:
    ```sh
    npm start
    ```

### Docker

To run the application using Docker:

1. Build the Docker image:
    ```sh
    docker build -t webgpu-hydraulic-erosion .
    ```

2. Run the Docker container:
    ```sh
    docker run -p 3004:3004 webgpu-hydraulic-erosion
    ```

## Dependencies

### NPM Packages

- `autoprefixer`: Adds vendor prefixes to CSS rules.
- `bootstrap-icons`: Includes Bootstrap icons.
- `css-loader`: Loads CSS files in Webpack.
- `express`: Sets up a web server.
- `file-loader`: Handles file imports in Webpack.
- `flowbite`: Provides UI components and utilities.
- `glsl-module-loader`: Loads GLSL shader modules.
- `html-loader`: Loads HTML files in Webpack.
- `html-webpack-plugin`: Generates HTML files in Webpack.
- `jimp`: Processes images.
- `postcss`: Transforms CSS with JavaScript plugins.
- `postcss-loader`: Loads PostCSS in Webpack.
- `raw-loader`: Imports raw files as strings in Webpack.
- `simplex-noise`: Generates simplex noise.
- `style-loader`: Injects CSS into the DOM.
- `tailwindcss`: Utility-first CSS framework.
- `tailwindcss-textshadow`: Adds text shadow utilities to Tailwind CSS.
- `three`: 3D rendering.
- `webpack`: Module bundling.
- `webpack-cli`: Runs Webpack from the command line.
- `webpack-wgsl-loader`: Loads WGSL shader modules.

### JavaScript Libraries

- `Three.js`: Used for 3D rendering in `src/index.js` and `src/js/orbitControlsWebGPU.js`.
- `Flowbite`: Used for UI components in `src/index.js` and partials.
- `Bootstrap Icons`: Used for icons in partials.

### Other Tools and Libraries

- `Tailwind CSS`: Utility-first CSS framework used in `src/styles.css` and `src/index.js`.
- `PostCSS`: Tool for transforming CSS with JavaScript plugins, configured in `postcss.config.js`.
- `WebGPU`: For GPU computing, used in `src/js/gaussianBlur.js` and `src/js/orbitControlsWebGPU.js`.
- `Jimp`: For image processing, used in `src/js/maskUtil.js`.

### Fonts

- `Proxima Nova`: Custom font used in `src/styles.css`.

### HTML Partials

- Various HTML partials for modular HTML structure, used in `src/index.js`.

### Webpack

- Used for module bundling, configured in `webpack.config.js`.

### Node.js

- Used for running the server, configured in `server.js`.

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Acknowledgements

- [`WebGPU`](https://gpuweb.github.io/gpuweb/)
- [`Three.js`](https://threejs.org/)
- [`Tailwind CSS`](https://tailwindcss.com/)
- [`Flowbite`](https://flowbite.com/)