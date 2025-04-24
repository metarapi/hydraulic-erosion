// Function to bind slider and input together
export function bindSliderWithInput(sliderId, inputId) {
    const slider = document.getElementById(sliderId);
    const input = document.getElementById(inputId);

    // Update input when slider is changed
    slider.addEventListener('input', function () {
        input.value = slider.value;
    });

    // Update slider when input is changed (on 'input' event)
    input.addEventListener('input', function () {
        const value = parseFloat(input.value);
        if (!isNaN(value)) {
            slider.value = value; // Update slider only if the input is a valid number
        }
    });
}