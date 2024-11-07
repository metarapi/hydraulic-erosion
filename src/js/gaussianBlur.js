import { initWebGPU } from "./webgpuHelper";
import blur from '../shaders/blur.wgsl';
let device;
export const MAX_RADIUS = 32;

function computeGaussianWeights(radius) {
    const sigma = radius / 2;
    const twoSigmaSq = 2 * sigma * sigma;
    const kernelSize = 2 * radius + 1;
    const weights = new Float32Array(kernelSize);
    let weightSum = 0;

    for (let i = -radius; i <= radius; i++) {
        const distance = i * i;
        const weight = Math.exp(-distance / twoSigmaSq);
        weights[i + radius] = weight;
        weightSum += weight;
    }

    for (let i = 0; i < kernelSize; i++) {
        weights[i] /= weightSum;
    }

    return weights;
}

function createBuffers(device, imageDataArray, imgWidth, imgHeight) {
    const imageSize = imageDataArray.byteLength;

    const originalBuffer = device.createBuffer({
        size: imageSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(originalBuffer, 0, imageDataArray);

    const intermediateBuffer = device.createBuffer({
        size: imageSize,
        usage: GPUBufferUsage.STORAGE,
    });

    const resultBuffer = device.createBuffer({
        size: imageSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    const readBuffer = device.createBuffer({
        size: imageSize,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    return { originalBuffer, intermediateBuffer, resultBuffer, readBuffer };
}

function createIntUniformBuffer(device, radius, imgWidth, imgHeight) {
    const uniformData = new Uint32Array(4); // radius, imgWidth, imgHeight, padding
    uniformData[0] = radius;
    uniformData[1] = imgWidth;
    uniformData[2] = imgHeight;
    uniformData[3] = 0;

    const intUniformBuffer = device.createBuffer({
        size: uniformData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
    });

    new Uint32Array(intUniformBuffer.getMappedRange()).set(uniformData);
    intUniformBuffer.unmap();
    return intUniformBuffer;
}

function createWeightsStorageBuffer(device, weights) {
    const weightsBuffer = device.createBuffer({
        size: weights.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(weightsBuffer, 0, weights.buffer, weights.byteOffset, weights.byteLength);
    return weightsBuffer;
}

function createBindGroups(device, bindGroupLayout, buffers, intUniformBuffer, weightsBuffer) {
    const horizontalBindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: buffers.originalBuffer } },
            { binding: 1, resource: { buffer: buffers.intermediateBuffer } },
            { binding: 2, resource: { buffer: intUniformBuffer } },
            { binding: 3, resource: { buffer: weightsBuffer } },
        ],
    });

    const verticalBindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: buffers.intermediateBuffer } },
            { binding: 1, resource: { buffer: buffers.resultBuffer } },
            { binding: 2, resource: { buffer: intUniformBuffer } },
            { binding: 3, resource: { buffer: weightsBuffer } },
        ],
    });

    return { horizontalBindGroup, verticalBindGroup };
}

async function createPipelines(device, bindGroupLayout) {
    const blurShader = blur;

    const shaderModule = device.createShaderModule({ code: blurShader.code });

    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

    const horizontalPipeline = device.createComputePipeline({
        layout: pipelineLayout,
        compute: {
            module: shaderModule,
            entryPoint: 'horizontalPass',
        },
    });

    const verticalPipeline = device.createComputePipeline({
        layout: pipelineLayout,
        compute: {
            module: shaderModule,
            entryPoint: 'verticalPass',
        },
    });

    return { horizontalPipeline, verticalPipeline };
}

/**
 * Applies a Gaussian blur to an image using WebGPU.
 *
 * @param {Float32Array} imageDataArray - The input image data as a flat array of pixel values.
 * @param {number} imgWidth - The width of the image.
 * @param {number} imgHeight - The height of the image.
 * @param {number} radius - The radius of the Gaussian blur.
 * @returns {Promise<Float32Array>} - A promise that resolves to the blurred image data.
 */
export async function gaussianBlur(imageDataArray, imgWidth, imgHeight, radius) {
    // Ensure `imageDataArray` is `Float32Array`
    if (!(imageDataArray instanceof Float32Array)) {
        throw new Error("Input data must be a Float32Array.");
    }
    
    // Initialize WebGPU
    device = await initWebGPU();
    if (!device) {
        throw new Error("Failed to initialize WebGPU.");
    }

    const bindGroupLayout = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
            { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
            { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
            { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        ],
    });

    const buffers = createBuffers(device, imageDataArray, imgWidth, imgHeight);

    const weights = computeGaussianWeights(radius);
    const intUniformBuffer = createIntUniformBuffer(device, radius, imgWidth, imgHeight);
    const weightsBuffer = createWeightsStorageBuffer(device, weights);

    const { horizontalBindGroup, verticalBindGroup } = createBindGroups(device, bindGroupLayout, buffers, intUniformBuffer, weightsBuffer);

    const { horizontalPipeline, verticalPipeline } = await createPipelines(device, bindGroupLayout);

    // Encode commands
    const commandEncoder = device.createCommandEncoder();

    // Horizontal pass
    {
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(horizontalPipeline);
        passEncoder.setBindGroup(0, horizontalBindGroup);
        passEncoder.dispatchWorkgroups(Math.ceil(imgWidth / 16), Math.ceil(imgHeight / 16), 1);
        passEncoder.end();
    }

    // Vertical pass
    {
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(verticalPipeline);
        passEncoder.setBindGroup(0, verticalBindGroup);
        passEncoder.dispatchWorkgroups(Math.ceil(imgWidth / 16), Math.ceil(imgHeight / 16), 1);
        passEncoder.end();
    }

    // Copy result to read buffer
    commandEncoder.copyBufferToBuffer(buffers.resultBuffer, 0, buffers.readBuffer, 0, imageDataArray.byteLength);

    // Submit commands
    device.queue.submit([commandEncoder.finish()]);

    // Read back data
    await buffers.readBuffer.mapAsync(GPUMapMode.READ);
    const arrayBuffer = buffers.readBuffer.getMappedRange();
    const resultArray = new Float32Array(arrayBuffer.slice(0));
    buffers.readBuffer.unmap();

    return resultArray;
}