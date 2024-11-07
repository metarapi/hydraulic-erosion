import "flowbite";
import "./styles.css";

// Define global variables
window.g_inputTerrainUint = null; // Uint8Array for visualization
window.g_inputTerrainFloat = null; // Float32Array for computation

window.g_maskUint = null; // Uint8Array for visualization
window.g_maskFloat = null; // Float32Array for computation (normalized)

window.g_blurredMaskedTerrain = null; // Blurred masked terrain data in Float32Array
window.g_maskedInputTerrain = null; // Masked terrain data in Float32Array

window.g_maskedInputTerrainFixedPoint = null; // Masked terrain data in Int32 (fixed-point)

window.g_erodedTerrain = null; // Eroded terrain data in Float32Array

// Declare scene-related variables globally
window.scene = null;
window.mesh = null;
window.renderer = null;
window.camera = null;

// Declare Three.js scene initialization status
window.isSceneInitialized = false;

// Import the HTML partials
import navbar from "./partials/navbar.html";
import maskingInputs from "./partials/masking-inputs.html";
import generationInputs from "./partials/generation-inputs.html";
import erosionInputs from "./partials/erosion-inputs.html";
import carouselItem0 from "./partials/carousel-item-0.html";
import carouselItem1 from "./partials/carousel-item-1.html";
import carouselItem2 from "./partials/carousel-item-2.html";
import alerts from "./partials/alerts.html";
import topbar from "./partials/topbar.html";
import webgpuModalPartial from "./partials/webgpu-modal-partial.html";

document.getElementById("carousel-item-0").innerHTML = carouselItem0;
document.getElementById("carousel-item-1").innerHTML = carouselItem1;
document.getElementById("carousel-item-2").innerHTML = carouselItem2;
document.getElementById("generation-inputs").innerHTML = generationInputs;
document.getElementById("masking-inputs").innerHTML = maskingInputs;
document.getElementById("erosion-inputs").innerHTML = erosionInputs;
document.getElementById("navbar").innerHTML = navbar;
document.getElementById("topbar").innerHTML = topbar;
document.getElementById("alerts").innerHTML = alerts;
document.getElementById("webgpu-modal-partial").innerHTML = webgpuModalPartial;

import { setupNavbarCarousel, navbarFormating } from "./js/navbar.js";
import { updateGrayscaleSlider } from "./js/grayscaleSlider.js";
import { updateSlider } from "./js/generationSliders.js";
import { drawMask, initalizeCanvas, adjustCanvasSize, clearCanvas, fillCanvas, resetCanvas, downloadMask, handleImageUpload } from "./js/maskUtil.js";
import { bindSliderWithInput } from "./js/erosionInputs.js"; 
import { displayWebGPUModal } from "./js/webgpuHelper.js";
import { handleGenerateTerrain } from "./js/generateTerrain.js";
import { handleMasking } from "./js/prepareErosionInput.js";
import { handleErodeTerrain } from "./js/erosion.js";
import { sidebarUtil } from "./js/sidebarUtil.js";

// Initialize the navbar and carousel behavior
document.addEventListener("DOMContentLoaded", () => {
  displayWebGPUModal();
  setupNavbarCarousel();
  navbarFormating();
  updateGrayscaleSlider("grayscale-range");
  updateSlider("levels-range", "current-level");
  updateSlider("exponent-range", "current-exponent");
  updateSlider("brush-range", "current-brush");

  adjustCanvasSize('maskingCanvas');
  adjustCanvasSize('inputTerrainCanvas');
  initalizeCanvas();
  drawMask();
  sidebarUtil();

  // Event listeners for the buttons
  document.getElementById("clearCanvasButton").addEventListener("click", () => {
    clearCanvas();
  });

  document.getElementById("fillCanvasButton").addEventListener("click", () => {
    fillCanvas();
  });

  document.getElementById("resetCanvasButton").addEventListener("click", () => {
    resetCanvas();
  });

  document.getElementById("downloadMaskButton").addEventListener("click", () => {
    downloadMask();
  });

  document.getElementById('uploadMaskButton').addEventListener('click', () => {
    document.getElementById('uploadMaskInput').click(); // Simulate a click on the hidden input
  });

  document.getElementById('uploadMaskInput').addEventListener('change', handleImageUpload);

  // Erosion input slider binding
  bindSliderWithInput('droplets-range', 'droplets-input');
  bindSliderWithInput('cycles-range', 'cycles-input');
  bindSliderWithInput('fixed-point-range', 'fixed-point-input');
  bindSliderWithInput('erosion-rate-range', 'erosion-rate-input');
  bindSliderWithInput('deposition-rate-range', 'deposition-rate-input');
  bindSliderWithInput('barrier-interval-range', 'barrier-interval-input');
  bindSliderWithInput('draw-interval-range', 'draw-interval-input');

  // Listen for window resize events to dynamically adjust the canvas size
  window.addEventListener("resize", () => {
    adjustCanvasSize('inputTerrainCanvas');
    adjustCanvasSize('maskingCanvas');
    //adjustCanvasSize('erodedTerrainCanvas');
  });

  // Initialize Generate Terrain Functionality
  handleGenerateTerrain();

  // Initialize Masking Functionality
  handleMasking();

  // Initialize Erosion Functionality
  handleErodeTerrain();
});
