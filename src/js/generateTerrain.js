import { initWebGPU } from "./webgpuHelper.js";
import { generateBaseTerrain } from "./noise.js";
import { createAlert } from "./alertUtil.js";

/**
 * Visualizes the heightmap data on a canvas.
 * @param {Float32Array} heightMap - The generated heightmap data.
 * @param {number} size - The width and height of the heightmap.
 */
export function visualizeHeightMap(heightMap, size) {
    const canvas = document.getElementById("inputTerrainCanvas");
    if (!canvas) {
      console.warn("Canvas element for heightmap visualization not found.");
      return;
    }
  
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.warn("Failed to get canvas context.");
      return;
    }
  
    // Create a Uint8ClampedArray for visualisation
    const imageData = ctx.createImageData(size, size);
    window.g_inputTerrainUint = new Uint8ClampedArray(size * size * 4); // RGBA format

    // Convert the heightmap data to grayscale pixels
    for (let i = 0; i < heightMap.length; i++) {
      const value = heightMap[i];
      // Normalize the value to [0, 1] assuming heightMap ranges from -1 to 1
      const normalized = Math.min(Math.max((value + 1) / 2, 0), 1);
      const color = Math.floor(normalized * 255);
      imageData.data[i * 4] = color;     // Red
      imageData.data[i * 4 + 1] = color; // Green
      imageData.data[i * 4 + 2] = color; // Blue
      imageData.data[i * 4 + 3] = 255;   // Alpha
    }
  
    ctx.putImageData(imageData, 0, 0);
  }
  
  /**
   * Handles the Generate Terrain button click event.
   */
  export async function handleGenerateTerrain() {
    const generateButton = document.getElementById("generateTerrainButton");
    const generateButtonText = document.getElementById("generateTerrainButtonText");
    const applyMaskButton = document.getElementById("applyMaskButton");
    const levelsRange = document.getElementById("levels-range");
    const exponentRange = document.getElementById("exponent-range");

    // Generate terrain and move to the next carousel item
    generateButton.addEventListener("click", async () => {
      disableButton(generateButton, generateButtonText);                                       // Disable the button to prevent multiple clicks
      const { heightMap, size } = await dispatchTerrainGeneration(levelsRange, exponentRange); // Dispatch the terrain generation
      visualizeHeightMap(heightMap, size);                                                     // Visualize the heightmap
      enableButton(generateButton, generateButtonText, applyMaskButton);                       // Re-enable the button
      document.getElementById("btn-masking").click();                                          // Programatically click the carousel button to show the masking tab
    });

    // Generate terrain and don't move to the next carousel item
    levelsRange.addEventListener("input", async () => {
      disableButton(generateButton, generateButtonText);                                       // Disable the button to prevent multiple clicks
      const { heightMap, size } = await dispatchTerrainGeneration(levelsRange, exponentRange); // Dispatch the terrain generation
      visualizeHeightMap(heightMap, size);                                                     // Visualize the heightmap
      enableButton(generateButton, generateButtonText, applyMaskButton);                       // Re-enable the button
    });

    // Generate terrain and don't move to the next carousel item
    exponentRange.addEventListener("input", async () => {
      disableButton(generateButton, generateButtonText);                                       // Disable the button to prevent multiple clicks
      const { heightMap, size } = await dispatchTerrainGeneration(levelsRange, exponentRange); // Dispatch the terrain generation
      visualizeHeightMap(heightMap, size);                                                     // Visualize the heightmap
      enableButton(generateButton, generateButtonText, applyMaskButton);                       // Re-enable the button
    });

  }

function disableButton(generateButton, generateButtonText) {
  generateButton.disabled = true;
  generateButtonText.textContent = "Generating...";
}

function enableButton(generateButton, generateButtonText, applyMaskButton) {
  generateButton.disabled = false;
  generateButtonText.textContent = "Generate";
  applyMaskButton.disabled = false;
  applyMaskButton.classList.remove("disabled:opacity-65","disabled:group-hover:bg-transparent","disabled:group-active:scale-100","disabled:text-vivid_sky_blue-500","disabled:group-hover:text-vivid_sky_blue-500");
}

async function dispatchTerrainGeneration(levelsRange, exponentRange) {
  // Retrieve Levels
  const levels = parseInt(levelsRange.value, 10);

  // Retrieve Exponent Factor
  const exponentFactor = parseFloat(exponentRange.value);

  // Retrieve Heightmap Size
  let size;
  const size512 = document.getElementById("size512");
  const size1024 = document.getElementById("size1024");
  const size2048 = document.getElementById("size2048");

  if (size512.checked) {
    size = 512;
  } else if (size1024.checked) {
    size = 1024;
  } else if (size2048.checked) {
    size = 2048;
  } else {
    // Default size if none is selected
    size = 1024;
  }

  // Initialize WebGPU Device
  const device = await initWebGPU(); // Ensure this function returns a GPUDevice

  // Call the generateBaseTerrain function
  const heightMap = await generateBaseTerrain(device, size, size, levels, exponentFactor);

  // Terrain generation
  console.log("Generating terrain with the following parameters:");
  console.log("Levels:", levels);
  console.log("Exponent Factor:", exponentFactor);
  console.log("Heightmap Size:", size);

  // Assign generated heightMap to the global variable (g_inputTerrain is initialized in index.js)
  window.g_inputTerrainFloat = heightMap; // Float32Array

  // Create an alert with the generated heightMap
  createAlert("alert-generation-complete", "alert-container");

  return { heightMap, size };
}