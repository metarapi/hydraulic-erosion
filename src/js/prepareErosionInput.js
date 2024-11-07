import { gaussianBlur } from './gaussianBlur.js';
import { initializeScene, updateHeightmapMesh } from './threejsScene.js';
import { initWebGPU } from './webgpuHelper.js';

function upscaleMask(maskCanvasId) {
    const maskCanvas = document.getElementById(maskCanvasId);
    const size = getMapSize();

    // Create an off-screen canvas for the upscaled image
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = size;
    offscreenCanvas.height = size;
    const offscreenContext = offscreenCanvas.getContext('2d');

    // Draw the original canvas onto the off-screen canvas, scaling it up
    offscreenContext.drawImage(
        maskCanvas,
        0,
        0,
        maskCanvas.width,
        maskCanvas.height,
        0,
        0,
        size,
        size
    );

    // Get the image data from the off-screen canvas
    const upscaledImageData = offscreenContext.getImageData(0, 0, size, size);
    const upscaledData = upscaledImageData.data; // Uint8ClampedArray

    // Store the upscaled mask for visualization and calculation
    window.g_maskUint = upscaledData.slice(); // Visualization
    window.g_maskFloat = convertUint8ToFloat32(window.g_maskUint); // Calculation
    console.log("Mask rescaled successfully.");
}

async function blurMask() {
    if (!g_maskFloat) {
        console.error("Mask has not been upscaled yet.");
        return;
    }

    const size = getMapSize();

    try {
        // Apply Gaussian blur to the `Float32Array` mask data
        const blurredFloatMask = await gaussianBlur(g_maskFloat, size, size, 15);

        // Update `g_maskFloat` with the blurred data for calculations
        g_maskFloat = blurredFloatMask.slice();

        // Convert the blurred mask back to `Uint8` for visualization
        g_maskUint = convertFloat32ToUint8(g_maskFloat, size);
        console.log("Gaussian blur applied to mask.");
    } catch (error) {
        console.error("Error during Gaussian blur:", error);
    }
}

function applyMask() {
    if (!g_inputTerrainFloat  || !g_maskFloat) {
        console.error("Input terrain or mask is not initialized.");
        return;
    }

    const size = getMapSize();
    g_maskedInputTerrain = new Float32Array(size * size);

    // Use the calculation data (Float32)
    for (let i = 0; i < size * size; i++) {
        g_maskedInputTerrain[i] = g_inputTerrainFloat[i] * g_maskFloat[i];
    }
}

export function handleMasking() {
    const applyMaskButton = document.getElementById("applyMaskButton");
    const applyMaskButtonText = document.getElementById("applyMaskButtonText");

    applyMaskButton.addEventListener("click", async () => {
        applyMaskButton.disabled = true;
        applyMaskButton.classList.add("bg-vivid_sky_blue-500", "text-black");
        applyMaskButtonText.textContent = "Applying Mask...";

        // Step 1: Upscale the mask
        upscaleMask("maskingCanvas");

        // Step 2: Apply Gaussian blur to the upscaled mask
        await blurMask();

        // Step 3: Apply the smoothed mask to the input terrain
        applyMask();

        const size = getMapSize();

        if (window.isSceneInitialized) {
            // Await the update to ensure the old mesh is fully replaced
            window.mesh = await updateHeightmapMesh(window.scene, window.mesh, g_maskedInputTerrain, size);
        } else {
            // Initialize the Three.js scene with the masked input terrain
            const { scene, mesh, renderer, camera } = await initializeScene(g_maskedInputTerrain, size);
            window.scene = scene;
            window.mesh = mesh;
            window.renderer = renderer;
            window.camera = camera;
        
            window.isSceneInitialized = true;
        }

        applyMaskButton.classList.remove("bg-vivid_sky_blue-500", "text-black");
        applyMaskButtonText.textContent = "Apply Mask";
        applyMaskButton.disabled = false;
        // Programatically click the carousel button to show the masking tab
        document.getElementById("btn-erosion").click();
    });
}

function getMapSize() {
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

    return size;
}

function convertFloat32ToUint8(maskedTerrain, size) {
    const imageDataArray = new Uint8ClampedArray(size * size * 4); // 4 channels for RGBA

    for (let i = 0; i < size * size; i++) {
        const grayValue = Math.min(Math.max(maskedTerrain[i] * 255, 0), 255); // Clamp to [0, 255]
        imageDataArray[i * 4] = grayValue;      // R
        imageDataArray[i * 4 + 1] = grayValue;  // G
        imageDataArray[i * 4 + 2] = grayValue;  // B
        imageDataArray[i * 4 + 3] = 255;        // A (fully opaque)
    }

    return imageDataArray;
}

function convertUint8ToFloat32(uint8Array) {
    const length = uint8Array.length / 4; // `Uint8ClampedArray` is in RGBA format, so divide by 4
    const float32Array = new Float32Array(length);

    for (let i = 0; i < length; i++) {
        float32Array[i] = uint8Array[i * 4] / 255; // Extract the red channel
    }

    return float32Array;
}

