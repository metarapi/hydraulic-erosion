import { initWebGPU } from "./webgpuHelper";
import shaderCode from '../shaders/gradient.wgsl';

export async function calculateGradient(device, heightmapData, width, height, scale) {
    const SIZE = width; // Assuming width and height are the same
    const SCALE = scale;
    const WORKGROUP_SIZE = 16;

    // Create Heightmap Buffer
    const heightmapBuffer = device.createBuffer({
        size: heightmapData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
    });
    new Int32Array(heightmapBuffer.getMappedRange()).set(heightmapData);
    heightmapBuffer.unmap();

    // Create Output Buffers
    const gradientMagnitudeBuffer = device.createBuffer({
        size: SIZE * SIZE * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    const gradientDirectionBuffer = device.createBuffer({
        size: SIZE * SIZE * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    // Create Uniform Buffers
    const sizeUniformBuffer = device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(sizeUniformBuffer, 0, new Uint32Array([SIZE]));

    const scaleUniformBuffer = device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(scaleUniformBuffer, 0, new Uint32Array([SCALE]));

    // Create Shader Module
    const shaderModule = device.createShaderModule({
        code: shaderCode.code,
    });

    // Create Compute Pipeline
    const computePipeline = device.createComputePipeline({
        layout: 'auto',
        compute: {
            module: shaderModule,
            entryPoint: 'main',
        },
    });

    // Create Bind Group
    const bindGroup = device.createBindGroup({
        layout: computePipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: sizeUniformBuffer } },
            { binding: 1, resource: { buffer: scaleUniformBuffer } },
            { binding: 2, resource: { buffer: heightmapBuffer } },
            { binding: 3, resource: { buffer: gradientMagnitudeBuffer } },
            { binding: 4, resource: { buffer: gradientDirectionBuffer } },
        ],
    });

    // Create Command Encoder
    const commandEncoder = device.createCommandEncoder();

    // Begin Compute Pass
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(computePipeline);
    computePass.setBindGroup(0, bindGroup);

    // Calculate Dispatch Counts
    const dispatchCountX = Math.ceil(SIZE / WORKGROUP_SIZE);
    const dispatchCountY = Math.ceil(SIZE / WORKGROUP_SIZE);

    // Dispatch Compute Shader
    computePass.dispatchWorkgroups(dispatchCountX, dispatchCountY, 1);
    computePass.end();

    // Submit Commands
    device.queue.submit([commandEncoder.finish()]);

    // Create Staging Buffers for Reading Data
    const stagingBufferMagnitude = device.createBuffer({
        size: SIZE * SIZE * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const stagingBufferDirection = device.createBuffer({
        size: SIZE * SIZE * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    // Encode Copy Commands
    const copyEncoder = device.createCommandEncoder();
    copyEncoder.copyBufferToBuffer(
        gradientMagnitudeBuffer,
        0,
        stagingBufferMagnitude,
        0,
        gradientMagnitudeBuffer.size
    );
    copyEncoder.copyBufferToBuffer(
        gradientDirectionBuffer,
        0,
        stagingBufferDirection,
        0,
        gradientDirectionBuffer.size
    );

    // Submit Copy Commands
    device.queue.submit([copyEncoder.finish()]);

    // Function to Read Buffer Data
    async function readBuffer(buffer) {
        await buffer.mapAsync(GPUMapMode.READ);
        const arrayBuffer = buffer.getMappedRange();
        const data = new Float32Array(arrayBuffer.slice());
        buffer.unmap();
        return data;
    }

    // Retrieve Gradient Data
    const gradientMagnitudeData = await readBuffer(stagingBufferMagnitude);
    const gradientDirectionData = await readBuffer(stagingBufferDirection);

    // Post-Processing (Optional)
    // Example: Normalize Gradient Directions for Visualization
    const normalizedDirection = new Float32Array(gradientDirectionData.length);
    for (let i = 0; i < gradientDirectionData.length; i++) {
        normalizedDirection[i] = (gradientDirectionData[i] + Math.PI) / (2 * Math.PI); // [0, 1]
    }

    return {
        gradientMagnitude: gradientMagnitudeData,
        gradientDirection: normalizedDirection,
    };
}