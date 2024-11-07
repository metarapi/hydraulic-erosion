import computeShader from '../shaders/erosion.wgsl';
import { createAlert } from "./alertUtil.js";
import { updateCycleHeightmapMesh } from './threejsScene.js';


export function handleErodeTerrain() {
    const startErosionButton = document.getElementById("startErosionButton");
    const startErosionButtonText = document.getElementById("startErosionButtonText");
    startErosionButton.addEventListener("click", async () => {
        try {
            console.log("Starting erosion simulation...");
            // Disable the button to prevent multiple clicks
            startErosionButton.disabled = true;
            startErosionButton.classList.add("bg-vivid_sky_blue-500", "text-black");
            startErosionButton.classList.remove("group-active:bg-vivid_sky_blue-500", "group-active:scale-105")
            startErosionButtonText.classList.remove("text-vivid_sky_blue-500");
            startErosionButtonText.classList.add("text-black");
            startErosionButtonText.textContent = "Eroding...";

            // Retrieve erosion parameters
            const droplets = parseInt(document.getElementById("droplets-input").value, 10);
            const cycles = parseInt(document.getElementById("cycles-input").value, 10);
            const scale = parseInt(document.getElementById("fixed-point-input").value, 10);
            const erosionRate = parseFloat(document.getElementById("erosion-rate-input").value);
            const depositionRate = parseFloat(document.getElementById("deposition-rate-input").value);
            const barrierInterval = parseInt(document.getElementById("barrier-interval-input").value, 10);

            console.log("Scale:" + scale);

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

            // Start the erosion simulation
            const simulationData = await startSimulation(droplets, cycles, scale, erosionRate, depositionRate, barrierInterval, size);
            g_erodedTerrain = simulationData.heightmap2D; // 2D Array of mapSize x mapSize
        

        } catch (error) {
            console.error("Error starting erosion simulation:", error);
        } finally {
            // Re-enable the button after simulation completes or fails
            startErosionButton.disabled = false;
            startErosionButton.classList.remove("bg-vivid_sky_blue-500");
            startErosionButton.classList.add("group-active:bg-vivid_sky_blue-500", "group-active:scale-105")
            startErosionButtonText.classList.add("text-vivid_sky_blue-500");
            startErosionButtonText.classList.remove("text-black");
            startErosionButtonText.textContent = "Start Erosion";
        }        
    });
}

function computeShaderCode(computeShader, workgroupSize) {
    return computeShader.code.replace(/\${workgroupSize}/g, workgroupSize); // Use regex to replace all instances
}

function createBuffer(device, dataArray, usage) {
    const buffer = device.createBuffer({
        label: "Data Buffer",
        size: dataArray.byteLength,
        usage: usage,
    });
    device.queue.writeBuffer(buffer, 0, dataArray);
    return buffer;
}

function createUniformBufferU32(device, droplets, mapSize, scale, barrierInterval = 5) {
    const uniformData = new Uint32Array(9);

    uniformData[0] = droplets;                // droplets
    uniformData[1] = 0;                       // cycle
    uniformData[2] = 1000;                    // max_iterations
    uniformData[3] = 1 * scale;               // start_vol
    uniformData[4] = Math.round(0.001 * scale); // min_vol
    uniformData[5] = mapSize;                 // dim_x
    uniformData[6] = mapSize;                 // dim_z
    uniformData[7] = mapSize * mapSize;       // map_size
    uniformData[8] = barrierInterval;         // barrier_interval

    const buffer = device.createBuffer({
        label: "Uniform Buffer U32",
        size: uniformData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(buffer, 0, uniformData);
    return buffer;
}

function createUniformBufferF32(device, erosionRate, depositionRate) {
    const uniformData = new Float32Array(3);

    uniformData[0] = depositionRate;           // deposition_rate
    uniformData[1] = erosionRate;              // erosion_rate
    uniformData[2] = 0.001;                    // evap_rate

    const buffer = device.createBuffer({
        label: "Uniform Buffer F32",
        size: uniformData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(buffer, 0, uniformData);
    return buffer;
}

function createStartPositionsBuffer(device, droplets, mapSize) {
    // Generate random starting positions (for each droplet in one cycle)
    const totalCells = mapSize * mapSize;
    const startPositions = new Uint32Array(droplets);

    for (let i = 0; i < droplets; i++) {
        startPositions[i] = Math.floor(Math.random() * totalCells);
    }

    // Create a buffer with a size sufficient for a single cycle's droplets
    const startPositionsBuffer = device.createBuffer({
        size: startPositions.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // Write the initial random positions to the buffer
    device.queue.writeBuffer(startPositionsBuffer, 0, startPositions);

    return startPositionsBuffer;
}

// Function to update the start positions for each cycle
function updateStartPositionsBuffer(device, startPositionsBuffer, droplets, mapSize) {
    const totalCells = mapSize * mapSize;
    const startPositions = new Uint32Array(droplets);

    for (let i = 0; i < droplets; i++) {
        startPositions[i] = Math.floor(Math.random() * totalCells);
    }

    // Write the new random positions into the existing buffer
    device.queue.writeBuffer(startPositionsBuffer, 0, startPositions);
}

function createBindGroup(device, bindGroupLayout, uniformBufferU32, uniformBufferF32, heightBuffer1, heightBuffer2, logBuffer, startPositionsBuffer) {
    return device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: uniformBufferU32 } },
            { binding: 1, resource: { buffer: uniformBufferF32 } },
            { binding: 2, resource: { buffer: heightBuffer1 } },
            { binding: 3, resource: { buffer: logBuffer } },
            { binding: 4, resource: { buffer: startPositionsBuffer } },
            { binding: 5, resource: { buffer: heightBuffer2 } },
        ],
    });
}

async function startSimulation(droplets, cycles, scale, erosionRate, depositionRate, barrierInterval, mapSize) {
    const UPDATE_INTERVAL = 1; // Milliseconds between updates

    console.log(`Starting simulation with ${droplets} droplets and ${cycles} cycles.`);

    // Initialize canvases
    // const canvasIds = ["initialHeightmap", "outputHeightmap", "dropletPath"];
    // canvasIds.forEach(id => {
    //     const canvas = document.getElementById(id);
    //     canvas.width = mapSize;
    //     canvas.height = mapSize;
    // });

    const device = await initializeWebGPU();
    if (!device) {
        throw new Error("Failed to initialize WebGPU.");
    }
    logDeviceLimits(device);

    console.log("Map size:", mapSize);
    console.log("Map size squared:", mapSize * mapSize);

    // Take the global g_blurredMaskedTerrain (normalized from 0 to 1) as input
    if (!g_maskedInputTerrain || g_maskedInputTerrain.length !== mapSize * mapSize) {
        throw new Error("g_blurredMaskedTerrain is not defined or has incorrect dimensions.");
    }

    // // Convert the input terrain to fixed-point integers
    g_maskedInputTerrainFixedPoint = convertFloat32ToInt32(g_maskedInputTerrain, scale);
    const heightmap = g_maskedInputTerrainFixedPoint.slice(); // Clone the array

    // const heightmap = g_maskedInputTerrain.slice(); // Clone the array

    // Create buffers
    const heightmapBuffer = createBuffer(device, heightmap, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC);
    const smoothedHeightMapBuffer = createBuffer(device, heightmap, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC);
    const logBuffer = createBuffer(device, new Int32Array(mapSize * mapSize), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC);
    const uniformBufferU32 = createUniformBufferU32(device, droplets, mapSize, scale, barrierInterval);
    const uniformBufferF32 = createUniformBufferF32(device, erosionRate, depositionRate);
    const startPositionsBuffer = createStartPositionsBuffer(device, droplets, mapSize);

    // Determine WORKGROUP_SIZE based on device limits
    const WORKGROUP_SIZE = Math.min(device.limits.maxComputeWorkgroupSizeX, droplets);
    console.log(`Max workgroup size X: ${device.limits.maxComputeWorkgroupSizeX}`);
    console.log(`Using WORKGROUP_SIZE: ${WORKGROUP_SIZE}`);
    console.log('Erosion rate: ' + erosionRate + ' Deposition rate: ' + depositionRate);

    // Create shader module with injected WORKGROUP_SIZE
    const computeShaderModule = device.createShaderModule({
        label: "Erosion Simulation Compute Shader",
        code: computeShaderCode(computeShader, WORKGROUP_SIZE)
    });

    // Create bind group layout and bind group
    const bindGroupLayout = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
            { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
            { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
            { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
            { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
            { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        ],
    });

    const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: uniformBufferU32 } },
            { binding: 1, resource: { buffer: uniformBufferF32 } },
            { binding: 2, resource: { buffer: heightmapBuffer } },
            { binding: 3, resource: { buffer: logBuffer } },
            { binding: 4, resource: { buffer: startPositionsBuffer } },
            { binding: 5, resource: { buffer: smoothedHeightMapBuffer } },
        ],
    });

    // Create compute pipeline
    const erosionPipeline = device.createComputePipeline({
        layout: device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout],
        }),
        compute: {
            module: computeShaderModule,
            entryPoint: "main",
        },
    });

    const smoothingPipeline = device.createComputePipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
        compute: { module: computeShaderModule, entryPoint: "blurHeightMap" },
    });

    // Start the simulation cycles
    let simulationData = await runSimulation(
        device,
        erosionPipeline,
        smoothingPipeline,
        bindGroupLayout,
        droplets,
        cycles,
        UPDATE_INTERVAL,
        uniformBufferU32,
        uniformBufferF32,
        heightmapBuffer,
        smoothedHeightMapBuffer,
        startPositionsBuffer,
        logBuffer,
        mapSize,
        WORKGROUP_SIZE,
        scale,
        window.scene,
        window.mesh,
    );

    createAlert("alert-erosion-complete", "alert-container");

    return simulationData;
}

async function runSimulation(device, erosionPipeline, smoothingPipeline, bindGroupLayout, droplets, cycles, updateInterval, uniformBufferU32, uniformBufferF32, heightmapBuffer, smoothedHeightMapBuffer, startPositionsBuffer, logBuffer, mapSize, workgroupSize, scale, scene, mesh) {
    const erosionWorkgroupCount = Math.ceil(droplets / workgroupSize);
    const totalCells = mapSize * mapSize;
    const smoothingWorkgroupCount = Math.ceil(totalCells / workgroupSize);
    let isSwapped = false;
    console.log(`Running simulation with ${erosionWorkgroupCount} workgroups. Each workgroup has ${erosionWorkgroupCount} threads, meaning ${erosionWorkgroupCount * workgroupSize * cycles} droplets.`);
    showProgressBar();

    const drawInterval = parseInt(document.getElementById("draw-interval-input").value, 10);

    for (let i = 0; i < cycles; i++) {
        // Update the start positions for the current cycle
        updateStartPositionsBuffer(device, startPositionsBuffer, droplets, mapSize);

        // Update the current cycle in the uniform buffer
        const cycleCount = new Uint32Array([i]);
        const byteOffset = 4; // cycle is at uniformData[1], which is 4 bytes from the start
        device.queue.writeBuffer(uniformBufferU32, byteOffset, cycleCount);

        const encoder = device.createCommandEncoder();

        // **Erosion Pass** using erosionPipeline
        const erosionPass = encoder.beginComputePass();
        const erosionBindGroup = createBindGroup(
            device,
            bindGroupLayout,
            uniformBufferU32,
            uniformBufferF32,
            isSwapped ? smoothedHeightMapBuffer : heightmapBuffer,
            isSwapped ? heightmapBuffer : smoothedHeightMapBuffer,
            logBuffer,
            startPositionsBuffer
        );

        erosionPass.setPipeline(erosionPipeline);
        erosionPass.setBindGroup(0, erosionBindGroup);
        erosionPass.dispatchWorkgroups(erosionWorkgroupCount, 1, 1);
        erosionPass.end();

        // **Smoothing Pass** using smoothingPipeline
        const smoothingPass = encoder.beginComputePass();
        const smoothingBindGroup = createBindGroup(
            device,
            bindGroupLayout,
            uniformBufferU32,
            uniformBufferF32,
            isSwapped ? smoothedHeightMapBuffer : heightmapBuffer,
            isSwapped ? heightmapBuffer : smoothedHeightMapBuffer,
            logBuffer,
            startPositionsBuffer
        );

        smoothingPass.setPipeline(smoothingPipeline);
        smoothingPass.setBindGroup(0, smoothingBindGroup);
        smoothingPass.dispatchWorkgroups(smoothingWorkgroupCount, 1, 1);
        smoothingPass.end();

        const commandBuffer = encoder.finish();
        device.queue.submit([commandBuffer]);

        isSwapped = !isSwapped;

        //console.log(`Completed cycle ${i + 1}/${cycles}`);
        updateProgressBar(i + 1, cycles);

        // Await GPU to finish
        await device.queue.onSubmittedWorkDone();

        // Update the Three.js scene after drawInterval cycles
        if (i % drawInterval == 0) {    
            window.mesh = await updateCycleHeightmapMesh(device, heightmapBuffer, mapSize, scene, mesh, scale);
        } else if (i == cycles - 1) {
            window.mesh = await updateCycleHeightmapMesh(device, heightmapBuffer, mapSize, scene, mesh, scale);
        };

        // Wait for a small delay if needed
        if (updateInterval > 0) {
            await new Promise(resolve => setTimeout(resolve, updateInterval));
        };
    };

    hideProgressBar();

    // Read back data after all cycles
    const finalBuffer = isSwapped ? smoothedHeightMapBuffer : heightmapBuffer;
    const { heightmapData, logData, heightmap2DArray } = await readbackData(device, finalBuffer, logBuffer, mapSize, scale);

    // Store simulation data for CSV download
    let simulationData = {
        heightmap2D: heightmap2DArray,
        heightmapData: heightmapData,
        logData: logData
    };

    return simulationData;
}

async function readbackData(device, heightmapBuffer, logBuffer, mapSize, scale) {
    // Create buffers for readback
    const readbackHeightmap = device.createBuffer({
        size: heightmapBuffer.size,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const readbackLog = device.createBuffer({
        size: logBuffer.size,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    // Encode commands to copy GPU buffers to readback buffers
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(heightmapBuffer, 0, readbackHeightmap, 0, heightmapBuffer.size);
    encoder.copyBufferToBuffer(logBuffer, 0, readbackLog, 0, logBuffer.size);
    device.queue.submit([encoder.finish()]);

    // Await mapping of readback buffers
    await readbackHeightmap.mapAsync(GPUMapMode.READ);
    await readbackLog.mapAsync(GPUMapMode.READ);

    // Retrieve data from readback buffers
    //const heightmapData = new Float32Array(readbackHeightmap.getMappedRange());
    const heightmapData = new Int32Array(readbackHeightmap.getMappedRange());
    const logData = new Int32Array(readbackLog.getMappedRange());

    // Copy data to new arrays before unmapping
    const heightmapDataCopy = new Float32Array(heightmapData);
    const heightmapDataFloat = heightmapDataCopy.map(value => value / scale);
    const logDataCopy = new Int32Array(logData);

    // Convert linear heightmap to 2D array for CSV
    const heightmap2DArray = [];
    for (let i = 0; i < mapSize; i++) {
        heightmap2DArray.push(Array.from(heightmapDataFloat.slice(i * mapSize, (i + 1) * mapSize)));
    }

    // Unmap buffers
    readbackHeightmap.unmap();
    readbackLog.unmap();

    return { heightmapData: heightmapDataCopy, logData: logDataCopy, heightmap2DArray };
}

// Define initializeWebGPU and logDeviceLimits functions
async function initializeWebGPU() {
    if (!navigator.gpu) {
        console.error("WebGPU is not supported in this browser.");
        return null;
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        console.error("Failed to get GPU adapter.");
        return null;
    }

    const device = await adapter.requestDevice();
    return device;
}

function logDeviceLimits(device) {
    console.log("Device Limits:", device.limits);
}


function convertFloat32ToInt32(floatArray, scale) {
    const int32Array = new Int32Array(floatArray.length);
    for (let i = 0; i < floatArray.length; i++) {
        int32Array[i] = Math.round(floatArray[i] * scale);
    }
    return int32Array;
}


// Save the eroded terrain to a CSV file
function saveErodedTerrain() {
    const csvData = g_erodedTerrain.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvData], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "eroded_terrain.csv";
    a.click();
    URL.revokeObjectURL(url);
}


// Display the eroded terrain
function displayErodedTerrain(scale) {
    const canvas = document.getElementById("erodedTerrainCanvas");
    const ctx = canvas.getContext("2d");
    const mapSize = g_erodedTerrain.length;
    canvas.width = mapSize;
    canvas.height = mapSize;
    const imageData = ctx.createImageData(mapSize, mapSize);

    for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
            const value = Math.max(0, Math.min(1, g_erodedTerrain[y][x])) * 255;
            const index = (y * mapSize + x) * 4;
            imageData.data[index] = value;      // R
            imageData.data[index + 1] = value;  // G
            imageData.data[index + 2] = value;  // B
            imageData.data[index + 3] = 255;    // A
        }
    }
    ctx.putImageData(imageData, 0, 0);
}

// Function to show the progress bar
function showProgressBar() {
    const progressBar = document.getElementById("erosion-progress-bar");
    progressBar.style.display = "block";
}

// Function to hide the progress bar
function hideProgressBar() {
    const progressBar = document.getElementById("erosion-progress-bar");
    progressBar.style.display = "none";
}

// Function to update the progress bar
function updateProgressBar(currentCycle, totalCycles) {
    const progressBar = document.getElementById("erosion-progress-bar");
    const progressPercentage = (currentCycle / totalCycles) * 100;
    progressBar.style.width = `${progressPercentage}%`;
}

// displayHeightmap(simulationData.heightmapData, "outputHeightmap", parseInt(document.getElementById("scale").value, 10));