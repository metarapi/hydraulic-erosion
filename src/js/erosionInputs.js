// Function to bind slider and input together
export function bindSliderWithInput(sliderId, inputId) {
    const slider = document.getElementById(sliderId);
    const input = document.getElementById(inputId);

    // Update input when slider is changed
    slider.addEventListener('input', function () {
        input.value = slider.value;
    });

    // Update slider when input is changed (on 'change' event)
    input.addEventListener('change', function () {
        // Ensure input stays within min/max bounds and steps
        const min = parseFloat(slider.min);
        const max = parseFloat(slider.max);
        const step = parseFloat(slider.step) || 1;

        let value = parseFloat(input.value);

        if (isNaN(value)) {
            // If input is not a number, reset to min
            value = min;
        } else {
            if (value < min) value = min;
            if (value > max) value = max;
        }

        // Calculate the number of decimal places in step
        const stepDecimalPlaces = (step.toString().split('.')[1] || '').length;

        // Round to the nearest step with correct decimal places
        const roundedValue = Math.round(value / step) * step;
        const roundedValueFixed = roundedValue.toFixed(stepDecimalPlaces);

        // Update both slider and input with the rounded value
        slider.value = roundedValueFixed;
        input.value = roundedValueFixed;
    });
}