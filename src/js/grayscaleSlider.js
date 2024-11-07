export function updateGrayscaleSlider(rangeInputId) {
  const rangeInput = document.getElementById(rangeInputId);
  const currentColorElement = document.getElementById('current-color');

  if (!rangeInput) {
    console.error(`Element with id "${rangeInputId}" not found`);
    return;
  }

  // Set the initial thumb color based on the starting value
  updateThumbColor(rangeInput, currentColorElement);

  // Add event listener to update thumb color dynamically
  rangeInput.addEventListener('input', function () {
    updateThumbColor(rangeInput, currentColorElement);
  });
}

function updateThumbColor(rangeInput, currentColorElement) {
  const value = rangeInput.value; // Get the current value of the slider (0 to 255)
  
  // Create a grayscale color based on the value
  const gray = `rgb(${value}, ${value}, ${value})`;
  
  // Set a CSS variable for the thumb color
  rangeInput.style.setProperty('--thumb-color', gray);
  currentColorElement.style.backgroundColor = gray;
}