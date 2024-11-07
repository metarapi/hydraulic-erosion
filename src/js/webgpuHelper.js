export async function initWebGPU() {
    if (!navigator.gpu) {
      throw new Error('WebGPU is not supported in this browser.');
    }
  
    // Request a GPU adapter and device
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error('Failed to get GPU adapter.');
    }
  
    const device = await adapter.requestDevice();
    return device;
  }
  
export async function displayWebGPUModal () {
  if (!navigator.gpu) {
    const modal = document.getElementById('webgpu-modal');
        modal.classList.remove('hidden'); // Make the modal visible
        modal.classList.add('flex'); // Ensure modal displays in the center

        // Prevent interaction with the background
        document.body.style.overflow = 'hidden';
  }
}