import { createAlert } from './alertUtil.js';

export function drawMask() {
  // Brush colour and size
  //const colour = "#3d34a5";
  const strokeWidth = 25;

  // Drawing state
  let latestPoint;
  let drawing = false;

  // Set up our drawing context
  const canvas = document.getElementById("maskingCanvas");
  const context = canvas.getContext("2d");

  // Keep the canvas size fixed at 1024x1024 for the buffer
  const bufferWidth = 1024;
  const bufferHeight = 1024;

  // Function to get scaling factors between the visual size and the buffer size
  const getScaleFactors = () => {
    const scaleX = bufferWidth / canvas.offsetWidth;
    const scaleY = bufferHeight / canvas.offsetHeight;
    return { scaleX, scaleY };
  };

  // Get the color slider element
  const rangeInput = document.getElementById("grayscale-range");

  // Get the brush slider element
  const brushInput = document.getElementById("brush-range");

  // Function to get the current color from the slider
  const getCurrentColor = () => {
    const value = rangeInput.value;
    return `rgb(${value}, ${value}, ${value})`;
  };

  // Function to get the current brush size from the slider
  const getCurrentBrushSize = () => {
    const value = brushInput.value;
    return value;
  };

  // Helper function to scale the coordinates based on canvas size
  const scalePoint = (point) => {
    const { scaleX, scaleY } = getScaleFactors();
    return [point[0] * scaleX, point[1] * scaleY];
  };

  // Drawing functions

  const continueStroke = (newPoint) => {
    const scaledPoint = scalePoint(newPoint);
    context.beginPath();
    context.moveTo(latestPoint[0], latestPoint[1]);
    context.strokeStyle = getCurrentColor();
    context.lineWidth = getCurrentBrushSize();
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineTo(scaledPoint[0], scaledPoint[1]);
    context.stroke();

    latestPoint = scaledPoint;
  };

  // Event helpers

  const startStroke = (point) => {
    drawing = true;
    latestPoint = scalePoint(point);
  };

  const BUTTON = 0b01;
  const mouseButtonIsDown = (buttons) => (BUTTON & buttons) === BUTTON;

  // Event handlers

  const mouseMove = (evt) => {
    if (!drawing) {
      return;
    }
    continueStroke([evt.offsetX, evt.offsetY]);
  };

  const mouseDown = (evt) => {
    if (drawing) {
      return;
    }
    evt.preventDefault();
    canvas.addEventListener("mousemove", mouseMove, false);
    startStroke([evt.offsetX, evt.offsetY]);
  };

  const mouseEnter = (evt) => {
    if (!mouseButtonIsDown(evt.buttons) || drawing) {
      return;
    }
    mouseDown(evt);
  };

  const endStroke = (evt) => {
    if (!drawing) {
      return;
    }
    drawing = false;
    evt.currentTarget.removeEventListener("mousemove", mouseMove, false);
  };

  // Register event handlers

  canvas.addEventListener("mousedown", mouseDown, false);
  canvas.addEventListener("mouseup", endStroke, false);
  canvas.addEventListener("mouseout", endStroke, false);
  canvas.addEventListener("mouseenter", mouseEnter, false);

  const getTouchPoint = (evt) => {
    if (!evt.currentTarget) {
      return [0, 0];
    }
    const rect = evt.currentTarget.getBoundingClientRect();
    const touch = evt.targetTouches[0];
    return [touch.clientX - rect.left, touch.clientY - rect.top];
  };

  const touchStart = (evt) => {
    if (drawing) {
      return;
    }
    evt.preventDefault();
    startStroke(getTouchPoint(evt));
  };

  const touchMove = (evt) => {
    if (!drawing) {
      return;
    }
    continueStroke(getTouchPoint(evt));
  };

  const touchEnd = (evt) => {
    drawing = false;
  };

  canvas.addEventListener("touchstart", touchStart, false);
  canvas.addEventListener("touchend", touchEnd, false);
  canvas.addEventListener("touchcancel", touchEnd, false);
  canvas.addEventListener("touchmove", touchMove, false);

  // Color picker passthrough
  // rangeInput.addEventListener("input", () => {
  //   console.log(rangeInput.value);
  // });

  // Brush size passthrough
  // brushInput.addEventListener("input", () => {
  //   console.log(brushInput.value);
  // });
}

export function initalizeCanvas() {
  const canvas = document.getElementById("maskingCanvas");
  const context = canvas.getContext("2d");

  // Generate a 2D gaussian center in the middle of the canvas
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const sigma = 100; // Increased sigma to spread the Gaussian over a larger area
  const amplitude = 255; // Maximum brightness (white)
  const kernel = [];

  for (let x = 0; x < canvas.width; x++) {
    for (let y = 0; y < canvas.height; y++) {
      const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      const value = amplitude * Math.exp(-(distance ** 2) / (2 * sigma ** 2)); // Fixed the Gaussian function
      kernel.push(value);
    }
  }

  // Draw the kernel to the canvas
  const imageData = context.createImageData(canvas.width, canvas.height);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const value = kernel[i / 4];
    imageData.data[i] = value; // Red
    imageData.data[i + 1] = value; // Green
    imageData.data[i + 2] = value; // Blue
    imageData.data[i + 3] = 255; // Alpha (fully opaque)
  }

  context.putImageData(imageData, 0, 0);
}

export function clearCanvas() {
  const canvas = document.getElementById("maskingCanvas");
  const context = canvas.getContext("2d");

  // Clear the canvas by filling it with black
  context.fillStyle = `rgb(${0}, ${0}, ${0})`;
  context.clearRect(0, 0, canvas.width, canvas.height);
}

export function fillCanvas() {
  const canvas = document.getElementById("maskingCanvas");
  const context = canvas.getContext("2d");
  
  // Get the current grayscale value from the slider
  const grayscaleValue = document.getElementById('grayscale-range').value;
  const fillColor = `rgb(${grayscaleValue}, ${grayscaleValue}, ${grayscaleValue})`;

  // Set the fill color and fill the canvas
  context.fillStyle = fillColor;
  context.fillRect(0, 0, canvas.width, canvas.height);
}

export function resetCanvas() {
  clearCanvas();
  initalizeCanvas();
}

export function adjustCanvasSize(canvasId) {
  const canvas = document.getElementById(canvasId);
  const width = window.innerWidth;
  const height = window.innerHeight;

  // Clear existing size classes
  canvas.classList.remove("w-full", "h-full");

  // If the screen is wider than tall (desktop), use h-full
  if (width > height) {
    canvas.classList.add("h-full");
    canvas.classList.remove("w-full");
  } else {
    // If the screen is taller than wide (mobile), use w-full
    canvas.classList.add("w-full");
    canvas.classList.remove("h-full");
  }
}

export function downloadMask() {
  const canvas = document.getElementById("maskingCanvas");
  
  // Convert canvas to a data URL (you can use this to upload it)
  const dataUrl = canvas.toDataURL('image/png');
  
  // Here you would upload the dataUrl or trigger a file download
  console.log('Upload functionality triggered. Mask data URL:', dataUrl);

  // Example: Trigger a file download
  const link = document.createElement('a');
  link.download = 'mask.png';
  link.href = dataUrl;
  link.click();
}

export function handleImageUpload(event) {
  console.log("handleImageUpload called");

  const file = event.target.files[0];
  console.log("Selected file:", file);

  if (!file) {
    console.warn("No file selected");
    return;
  }

  // Check if the file type is either PNG or JPG
  const validFileTypes = ['image/png', 'image/jpeg'];
  if (!validFileTypes.includes(file.type)) {
    console.error("Invalid file type:", file.type);
    createAlert('alert-failed-upload', 'alert-container');
    return;
  }

  const reader = new FileReader();

  reader.onload = function (e) {
    console.log("FileReader onload event fired");

    const img = new Image();

    img.onload = function () {
      console.log("Image loaded successfully");
      console.log("Image dimensions:", img.width, img.height);

      const canvas = document.getElementById('maskingCanvas');
      const context = canvas.getContext('2d');

      // Check if the image is square
      if (img.width !== img.height) {
        console.error("Image is not square");
        createAlert('alert-failed-upload', 'alert-container');
        return;
      }

      // Check if the image is larger or smaller than 1024x1024
      if (img.width !== 1024 || img.height !== 1024) {
        console.error("Image is not 1024x1024");
        createAlert('alert-resize', 'alert-container');
      }

      // Resize to 1024x1024 if necessary
      const targetSize = 1024;

      // Create an off-screen canvas to process the image
      const offCanvas = document.createElement('canvas');
      offCanvas.width = targetSize;
      offCanvas.height = targetSize;
      const offContext = offCanvas.getContext('2d');

      // Draw the image onto the off-screen canvas (resize it if needed)
      offContext.drawImage(img, 0, 0, targetSize, targetSize);

      // Convert to grayscale
      const imageData = offContext.getImageData(0, 0, targetSize, targetSize);
      for (let i = 0; i < imageData.data.length; i += 4) {
        const avg = (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;
        imageData.data[i] = avg; // Red
        imageData.data[i + 1] = avg; // Green
        imageData.data[i + 2] = avg; // Blue
      }

      // Put the grayscale image back on the off-screen canvas
      offContext.putImageData(imageData, 0, 0);

      // Now draw the processed image onto the main canvas
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(offCanvas, 0, 0, canvas.width, canvas.height);
      console.log("Image drawn to main canvas");

      // Show a success alert
      createAlert('alert-upload', 'alert-container');
    };

    img.onerror = function () {
      console.error("Error loading image");
      //showAlert('alert-failed-upload', 'Failed to load the image.');
    };

    // Set the source of the image to the uploaded file
    img.src = e.target.result;
    // console.log("Image source set:", img.src);
  };

  reader.onerror = function (e) {
    console.error("Error reading file:", e);
    //showAlert('alert-failed-upload', 'Failed to read the file.');
  };

  // Read the image file
  reader.readAsDataURL(file);
  console.log("FileReader readAsDataURL called");
}


