import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createTextureFromLUT } from './generateTexture.js';
import { initWebGPU } from './webgpuHelper.js';
import { adjustCanvasSize } from './maskUtil.js';
import { gaussianBlur } from './gaussianBlur.js';
import testTexture from "../assets/lut.png";

function createHeightmapMesh(heightmap, mapSize, texture = null, drawScale = 1000) {
    const geometry = new THREE.PlaneGeometry(mapSize, mapSize, mapSize - 1, mapSize - 1);
    const vertices = geometry.attributes.position.array;

    for (let i = 0, j = 0; i < vertices.length; i += 3, j++) {
        vertices[i + 2] = heightmap[j] * drawScale; // Set the Z coordinate to the height value
    }

    const materialConfig = {
        roughness: 1.0,
        color: 0xffffff,
        map: texture
    };

    const material = new THREE.MeshStandardMaterial(materialConfig);
    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
}

function setupCamera(width, height) {
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 10000);
    camera.position.set(-5.7, -763.5, 719.2);
    camera.rotation.set(0.82, -0.0054, 0.0058);
    return camera;
}

function setupRenderer(canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    return renderer;
}

// function setupRenderer(canvas) {
//     const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
//     renderer.setPixelRatio(window.devicePixelRatio);
//     renderer.setSize(canvas.clientWidth, canvas.clientHeight);
//     renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
//     return renderer;
// }

function setupLight(scene) {
    const ambientLight = new THREE.AmbientLight( 0xffffff, 0.7);
    const light = new THREE.DirectionalLight(0xfdfbd3, 0.7);
    light.position.set(0, 0, 1000);
    light.target.position.set(0, 0, 0);
    //const lightHelper = new THREE.DirectionalLightHelper(light, 100);
    scene.add(ambientLight);
    scene.add(light);
    //scene.add(lightHelper);
}

async function loadTexture(device, heightmap, mapSize) {
    const textureData = await createTextureFromLUT(device, heightmap, mapSize);
    const threeTexture = new THREE.DataTexture(
        textureData,
        mapSize,
        mapSize,
        THREE.RGBAFormat,
        THREE.UnsignedByteType
    );
    threeTexture.needsUpdate = true;
    threeTexture.flipY = true;
    //threeTexture.encoding = THREE.sRGBEncoding;
    return threeTexture;
}

export async function initializeScene(heightmap, mapSize, drawScale = 1000) {
    const canvas = document.getElementById('erodedTerrainCanvas');
    //adjustCanvasSize('erodedTerrainCanvas');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x999999);
    const camera = setupCamera(canvas.clientWidth, canvas.clientHeight);
    const renderer = setupRenderer(canvas);

    const device = await initWebGPU(renderer);
    const texture = await loadTexture(device, heightmap, mapSize);

    const mesh = createHeightmapMesh(heightmap, mapSize, texture, drawScale);
    scene.add(mesh);

    setupLight(scene);

    // Set up OrbitControls for camera movement
    const controls = new OrbitControls(camera, renderer.domElement);
   
    function resizeCanvas(renderer, camera, canvas) {
        // const width = canvas.clientWidth;
        // const height = canvas.clientHeight;
        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }

    // Handle window resizing
    window.addEventListener('resize', resizeCanvas);

    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
    animate();

    return { scene, mesh, renderer, camera };
}

// Function for updating the heightmap mesh after it has been created
export async function updateHeightmapMesh(scene, oldMesh, heightmap, mapSize, drawScale) {
    // Remove the old mesh from the scene
    scene.remove(oldMesh);

    const device = await initWebGPU(renderer);

    // Load the texture using the existing loadTexture function
    const texture = await loadTexture(device, heightmap, mapSize);

    // Use createHeightmapMesh to create the updated mesh
    const newMesh = createHeightmapMesh(heightmap, mapSize, texture, drawScale);

    // Add the new mesh to the scene
    scene.add(newMesh);

    // Update global reference to the current mesh
    //window.mesh = newMesh;

    return newMesh;
}

export async function updateCycleHeightmapMesh(device, heightmapBuffer, mapSize, scene, mesh, scale, drawScale=1000) {
    // Step 1: Read back the heightmap data from the GPU
    const heightmapIntData = await readbackData(device, heightmapBuffer, mapSize);

    // Step 2: Convert Int32 data to Float32 by dividing by the scale
    const heightmapData = new Float32Array(heightmapIntData.length);
    for (let i = 0; i < heightmapIntData.length; i++) {
        heightmapData[i] = heightmapIntData[i] / scale;
    }

    //const smoothedHeightmap = await gaussianBlur(heightmapData, mapSize, mapSize, 5);

    // Step 3: Update vertices of the existing geometry
    updateHeightmapVertices(mesh, heightmapData, mapSize, drawScale);

    // Step 4: Update the texture
    const texture = await loadTexture(device, heightmapData, mapSize);
    mesh.material.map = texture;
    mesh.material.needsUpdate = true;

    return mesh;
}

// Function to update vertices based on heightmap data
function updateHeightmapVertices(mesh, heightmapData, mapSize, drawScale) {
    const vertices = mesh.geometry.attributes.position.array;

    for (let i = 0, j = 0; i < vertices.length; i += 3, j++) {
        vertices[i + 2] = heightmapData[j] * drawScale;
    }

    // Mark position attribute as needing an update and recompute normals
    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
}

// Helper function for GPU readback
async function readbackData(device, buffer, mapSize) {
    const stagingBuffer = device.createBuffer({
        size: buffer.size,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const commandEncoder = device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(buffer, 0, stagingBuffer, 0, buffer.size);
    device.queue.submit([commandEncoder.finish()]);

    await stagingBuffer.mapAsync(GPUMapMode.READ);
    const arrayBuffer = stagingBuffer.getMappedRange();
    const data = new Int32Array(arrayBuffer.slice());
    stagingBuffer.unmap();

    return data;
}

///////////////////////////////////////////////////////////////////
////////////////////// WebGPU Implementation //////////////////////
///////////////////////////////////////////////////////////////////

// import * as THREE from 'three/webgpu';
// import { OrbitControls } from './orbitControlsWebGPU.js';
// import { createTextureFromLUT } from './generateTexture.js';
// import { initWebGPU } from './webgpuHelper.js';
// import testTexture from "./assets/lut.png";

// function createHeightmapMesh(heightmap, mapSize) {
//     const geometry = new THREE.PlaneGeometry(mapSize, mapSize, mapSize - 1, mapSize - 1);
//     const vertices = geometry.attributes.position.array;

//     for (let i = 0, j = 0; i < vertices.length; i += 3, j++) {
//         vertices[i + 2] = heightmap[j]; // Set the Z coordinate to the height value
//     }

//     const material = new THREE.MeshStandardNodeMaterial();
//     material.colorNode = THREE.color(0x009999); // Set the color to green

//     // Set other properties like roughness and metalness if desired
//     material.roughnessNode = THREE.float(0.8);
//     material.metalnessNode = THREE.float(0.2);

//     const mesh = new THREE.Mesh(geometry, material);
//     return mesh;
// }

// export async function initializeScene(heightmap, mapSize) {
//     // Get the canvas element from the HTML document
//     const canvas = document.getElementById('erodedTerrainCanvas');

//     // Get the canvas size from the canvas element
//     let width = canvas.clientWidth;
//     let height = canvas.clientHeight;

//     const scene = new THREE.Scene();
//     const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 10000);
//     // Set up WebGPURenderer
//     const renderer = new THREE.WebGPURenderer({ canvas: canvas });
//     renderer.setPixelRatio(window.devicePixelRatio);
//     renderer.setSize(width, height);

//     const device = await initWebGPU(renderer);
//     const textureData = await createTextureFromLUT(device, heightmap, mapSize);
//     const threeTexture = new THREE.DataTexture(
//         textureData,          // The array buffer
//         mapSize,             // width
//         mapSize,             // height
//         THREE.RGBAFormat,    // format
//         THREE.UnsignedByteType
//     );
//     threeTexture.flipY = true;  // Important: WebGL expects textures flipped
//     threeTexture.needsUpdate = true;

//     const textureNode = THREE.texture(threeTexture);

//     // Apply the texture to the material
//     const material = new THREE.MeshStandardNodeMaterial();
//     material.colorNode = THREE.color(0xffffff); // Set the color to white
//     material.colorNode = textureNode;
//     material.roughnessNode = THREE.float(0.8);
//     material.metalnessNode = THREE.float(0.2);

//     const geometry = new THREE.PlaneGeometry(mapSize, mapSize, mapSize - 1, mapSize - 1);
//     const vertices = geometry.attributes.position.array;

//     for (let i = 0, j = 0; i < vertices.length; i += 3, j++) {
//         vertices[i + 2] = heightmap[j]; // Set the Z coordinate to the height value
//     }

//     const mesh = new THREE.Mesh(geometry, material);
//     scene.add(mesh);

//         // Create a new light
//     const light = new THREE.DirectionalLight(0xffffff, 5);
//     light.position.set(-500, -500, 500);
//     light.target.position.set(0, 100, 0);
//     scene.add(light);

//     // const lightHelper = new THREE.DirectionalLightHelper(light, 100); // The second parameter adjusts the helper's size
//     // scene.add(lightHelper);

//     camera.position.x = -5.692542272962235;
//     camera.position.y = -763.5223081392652;
//     camera.position.z = 719.1823558960125;
//     camera.rotation.x = 0.8152940305450057;
//     camera.rotation.y = -0.0054271051688061225;
//     camera.rotation.z = 0.005761611972559292;


//     // Set up OrbitControls for camera movement
//     const controls = new OrbitControls(camera, renderer.domElement);

//     // Function to log the current camera position and rotation
//     function logCameraPositionAndRotation() {
//         console.log(`Camera Position: x=${camera.position.x}, y=${camera.position.y}, z=${camera.position.z}`);
//         console.log(`Camera Rotation: x=${camera.rotation.x}, y=${camera.rotation.y}, z=${camera.rotation.z}`);
//     }

//     // Handle window resizing
//     function onWindowResize() {
//         width = canvas.clientWidth;
//         height = canvas.clientHeight;

//         // Update camera aspect ratio and projection matrix
//         camera.aspect = width / height;
//         camera.updateProjectionMatrix();

//         // Update renderer size
//         renderer.setSize(width, height);
//     }

//     // Listen for window resize events
//     window.addEventListener('resize', onWindowResize);

//     function animate() {
//         requestAnimationFrame(animate);
//         renderer.renderAsync(scene, camera);
//         //logCameraPositionAndRotation();
//     }
//     animate();

//     console.log("Mesh:", mesh);
//     return { scene, mesh, renderer, camera };
// }

// export function updateHeightmapMesh(scene, oldMesh, heightmap, mapSize) {
//     // Remove the old mesh from the scene
//     scene.remove(oldMesh);

//     // Create a new mesh with the updated heightmap
//     const newMesh = createHeightmapMesh(heightmap, mapSize);

//     // Add the new mesh to the scene
//     scene.add(newMesh);

//     // Return the new mesh
//     return newMesh;
// }

