export function updateSlider(sliderInputId, displayElementId) {
    const sliderInput = document.getElementById(sliderInputId);
    const displayElement = document.getElementById(displayElementId);

    if (!sliderInput || !displayElement) {
        console.error(`Element with id "${sliderInputId}" or "${displayElementId}" not found`);
        return;
    }

    // Set the initial value based on the starting value
    updateCurrentValue(sliderInput, displayElement);

    // Add event listener to update value dynamically
    sliderInput.addEventListener('input', function () {
        updateCurrentValue(sliderInput, displayElement);
    });
}

function updateCurrentValue(sliderInput, displayElement) {
    const value = sliderInput.value; // Get the current value of the slider
    // Set the value to the current range value
    displayElement.textContent = value;
}