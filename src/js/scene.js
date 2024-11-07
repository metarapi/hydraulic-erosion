import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

let scene, camera, renderer, controls;

export function initScene(heightMap, xSize, ySize) {
  // Get the canvas element
  const canvas = document.getElementById('threejs-canvas');
  const canvasWidth = canvas.clientWidth;
  const canvasHeight = canvas.clientHeight;

  // Create the scene
  scene = new THREE.Scene();

  // Set up the camera with a field of view, aspect ratio, near, and far clipping planes
  camera = new THREE.PerspectiveCamera(
    75,
    canvasWidth / canvasHeight,
    0.1,
    1000
  );

  // Set up the WebGL renderer
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
  });
  renderer.setSize(canvasWidth, canvasHeight);
  renderer.shadowMap.enabled = true; // Enable shadow maps if using shadows

  // Add directional light
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(10, 20, 10).normalize();
  light.castShadow = true; // Enable shadows if needed
  scene.add(light);

  // Add ambient light
  const ambientLight = new THREE.AmbientLight(0x404040); // Soft white light
  scene.add(ambientLight);

  // Add grid and axes helpers
  const gridHelper = new THREE.GridHelper(10, 10);
  scene.add(gridHelper);

  const axesHelper = new THREE.AxesHelper(5);
  scene.add(axesHelper);

  // Create geometry based on the noise map
  const geometry = new THREE.PlaneGeometry(10, 10, xSize - 1, ySize - 1);

  // Add color attribute based on height
  const colors = [];
  for (let i = 0; i < heightMap.length; i++) {
    const height = heightMap[i];
    // Example: Color gradient from blue to red
    colors.push(height, 0.0, 1.0 - height); // RGB
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  // Set the vertices from the height map with scaling for better visibility
  const positions = geometry.attributes.position.array;
  const heightScale = 10; // Scale factor to exaggerate heights
  for (let i = 0; i < heightMap.length; i++) {
    positions[i * 3 + 2] = heightMap[i] * heightScale; // Set and scale the Z value
  }
  geometry.computeVertexNormals();

  // Create the material with vertex colors
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true });
  const plane = new THREE.Mesh(geometry, material);
  plane.rotation.x = -Math.PI / 2; // Rotate plane to lay flat
  plane.receiveShadow = true; // Enable shadow receiving if needed
  scene.add(plane);

  // Position the camera above and at an angle to see the terrain's height
  camera.position.set(20, 30, 20);
  camera.lookAt(new THREE.Vector3(0, 0, 0));

  // Set up orbit controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.screenSpacePanning = false;
  controls.minDistance = 10;
  controls.maxDistance = 100;
  controls.maxPolarAngle = Math.PI / 2; // Prevent camera from going below the terrain

  // Adjust the scene on window resize
  window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
  // Maintain the aspect ratio and adjust the renderer size
  const canvas = document.getElementById('threejs-canvas');
  const aspect = canvas.clientWidth / canvas.clientHeight;

  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
}

export function animateScene() {
  requestAnimationFrame(animateScene);

  // Update controls for damping
  controls.update();

  // Render the scene
  renderer.render(scene, camera);
}
