import lutImage from "../assets/lut.png";
import shaderCode from "../shaders/applyLUT.wgsl";

async function createTextureFromLUT(device, heightmap, mapSize) {
  try {

    // Load up the texture in the GPU (this can be a storage buffer in principle)
    // Might need to review the "usage" parameter

    // Load the LUT image
    const lut = await loadImage(lutImage);
  
    // Create a texture from the LUT image
    const lutTexture = device.createTexture({
      size: [lut.width, lut.height, 1],
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });

    // Copy the LUT image data to the texture
    device.queue.copyExternalImageToTexture(
      { source: lut },
      { texture: lutTexture },
      [lut.width, lut.height, 1] 
    );

    // Create a storage buffer for the heightmap and immediatly write to it 
    // (map and unmap are required for storage buffers as opposed to textures)

    heightmap = normalizeHeightmap(heightmap);

    // Create buffers
    const heightmapBuffer = device.createBuffer({
      size: heightmap.byteLength,
      usage: 
        GPUBufferUsage.STORAGE | 
        GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(heightmapBuffer.getMappedRange()).set(heightmap);
    heightmapBuffer.unmap();

    // Create the intermediate buffers for gaussian blur.
    const horizontalOutputBuffer = device.createBuffer({
      size: heightmap.byteLength,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_SRC |
        GPUBufferUsage.COPY_DST,
    });

    const verticalOutputBuffer = device.createBuffer({
      size: heightmap.byteLength,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_SRC |
        GPUBufferUsage.COPY_DST,
    });

    // Create a buffer for the integer uniforms and immediately write to it
    const intUniformsBuffer = device.createBuffer({
      size: 6 * 4, // 6 elements, each 4 bytes
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Uint32Array(intUniformsBuffer.getMappedRange()).set([
      5, // radius
      mapSize, // imgWidth
      mapSize, // imgHeight
      lut.width, // lutWidth
      lut.height, // lutHeight
      0, // padding
    ]);
    intUniformsBuffer.unmap();

    // Compute Gaussian weights
    const radius = 5; // Example radius
    const weights = computeGaussianWeights(radius);

    // Create a storage buffer for the weights and immediately write to it
    const weightsBuffer = device.createBuffer({
      size: weights.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(weightsBuffer.getMappedRange()).set(weights);
    weightsBuffer.unmap();

    // Create output texture
    const outputTexture = device.createTexture({
      size: [mapSize, mapSize, 1],
      format: "rgba8unorm",
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING,
    });

    // At this point all of the buffers are set up

    // Create pipelines
    const { computePipelineHorizontal, computePipelineVertical, computePipelineLUTMapping , bindGroupLayout} =
      await createPipelines(device);

    // Bind group for the horizontal pass
    const bindGroupHorizontal = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
          { binding: 0, resource: { buffer: heightmapBuffer } },
          { binding: 1, resource: { buffer: horizontalOutputBuffer } },
          { binding: 2, resource: { buffer: intUniformsBuffer } },
          { binding: 3, resource: { buffer: weightsBuffer } },
          { binding: 4, resource: lutTexture.createView() }, // Placeholder
          { binding: 5, resource: outputTexture.createView() }, // Placeholder
      ],
    });

    // Bind group for the vertical pass
    const bindGroupVertical = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
          { binding: 0, resource: { buffer: horizontalOutputBuffer } },
          { binding: 1, resource: { buffer: verticalOutputBuffer } },
          { binding: 2, resource: { buffer: intUniformsBuffer } },
          { binding: 3, resource: { buffer: weightsBuffer } },
          { binding: 4, resource: lutTexture.createView() }, // Placeholder
          { binding: 5, resource: outputTexture.createView() }, // Placeholder
      ],
    });

    // Bind group for the LUT mapping pass
    const bindGroupLUTMapping = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
          { binding: 0, resource: { buffer: verticalOutputBuffer } },
          { binding: 1, resource: { buffer: horizontalOutputBuffer } },
          { binding: 2, resource: { buffer: intUniformsBuffer } },
          { binding: 3, resource: { buffer: weightsBuffer } },  // Placeholder
          { binding: 4, resource: lutTexture.createView() },
          { binding: 5, resource: outputTexture.createView() },
      ],
    });

    const commandEncoder = device.createCommandEncoder();

    // Horizontal pass
    {
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(computePipelineHorizontal);
        passEncoder.setBindGroup(0, bindGroupHorizontal);
        passEncoder.dispatchWorkgroups(Math.ceil(mapSize / 16), Math.ceil(mapSize / 16));
        passEncoder.end();
    }
    device.queue.submit([commandEncoder.finish()]); // Submit the horizontal pass
    
    // Vertical pass
    {
        const commandEncoder = device.createCommandEncoder(); // New encoder
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(computePipelineVertical);
        passEncoder.setBindGroup(0, bindGroupVertical);
        passEncoder.dispatchWorkgroups(Math.ceil(mapSize / 16), Math.ceil(mapSize / 16));
        passEncoder.end();
        device.queue.submit([commandEncoder.finish()]); // Submit the vertical pass
    }
    
    // LUT mapping pass
    {
        const commandEncoder = device.createCommandEncoder(); // New encoder
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(computePipelineLUTMapping);
        passEncoder.setBindGroup(0, bindGroupLUTMapping);
        passEncoder.dispatchWorkgroups(Math.ceil(mapSize / 16), Math.ceil(mapSize / 16));
        passEncoder.end();
        device.queue.submit([commandEncoder.finish()]); // Submit the LUT mapping pass
    }

    const outputData = await readStorageTextureToCPU(device, outputTexture, mapSize, mapSize);

    // For testing
    // saveTextureAsPNG(outputData, mapSize, mapSize);
    
    return outputData;
  } catch (error) {
    console.error("Failed to create texture from LUT:", error);
    throw error;
  }
}

async function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.crossOrigin = "anonymous"; // If needed
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
}

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

async function createPipelines(device) {
    try {
      const shaderModule = device.createShaderModule({ code: shaderCode.code });
  
      const bindGroupLayout = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
            { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
            { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
            { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
            { binding: 4, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float' } },
            { binding: 5, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba8unorm' } },
        ],
    });


  
      const pipelineLayoutHorizontal = device.createPipelineLayout({
          bindGroupLayouts: [bindGroupLayout],
      });
      
      const pipelineLayoutVertical = device.createPipelineLayout({
          bindGroupLayouts: [bindGroupLayout],
      });
      
      const pipelineLayoutLUTMapping = device.createPipelineLayout({
          bindGroupLayouts: [bindGroupLayout],
      });

      // Horizontal pass pipeline
      const computePipelineHorizontal = device.createComputePipeline({
        layout: pipelineLayoutHorizontal,
        compute: {
            module: shaderModule,
            entryPoint: "horizontalPass",
        },
      });

      // Vertical pass pipeline
      const computePipelineVertical = device.createComputePipeline({
        layout: pipelineLayoutVertical,
        compute: {
            module: shaderModule,
            entryPoint: "verticalPass",
        },
      });

      // LUT mapping and gradient calculation pipeline
      const computePipelineLUTMapping = device.createComputePipeline({
        layout: pipelineLayoutLUTMapping,
        compute: {
            module: shaderModule,
            entryPoint: "main",
        },
      });


  
      return { computePipelineHorizontal, computePipelineVertical, computePipelineLUTMapping, bindGroupLayout };
    } catch (error) {
      console.error("Failed to create pipelines:", error);
      throw error;
    }
  }

  async function readStorageTextureToCPU(device, texture, width, height) {
   
    // Calculate total bytes needed
    const totalBytes = width * height * 4;

    // Create readback buffer with aligned size
    const bytesPerRow = Math.ceil((width * 4) / 256) * 256;
    
    const paddedBufferSize = bytesPerRow * height;

    const readbackBuffer = device.createBuffer({
        size: paddedBufferSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    // Copy texture to buffer
    const commandEncoder = device.createCommandEncoder();
    commandEncoder.copyTextureToBuffer(
        { 
            texture: texture,
            mipLevel: 0,
            origin: { x: 0, y: 0, z: 0 }
        },
        { 
            buffer: readbackBuffer,
            offset: 0,
            bytesPerRow: bytesPerRow,
            rowsPerImage: height
        },
        { 
            width: width,
            height: height,
            depthOrArrayLayers: 1
        }
    );

    // Submit and wait
    const commandBuffer = commandEncoder.finish();
    device.queue.submit([commandBuffer]);

    // Map and read data
    await readbackBuffer.mapAsync(GPUMapMode.READ);
    const arrayBuffer = readbackBuffer.getMappedRange();
    
    // Create final unpadded array
    const outputData = new Uint8Array(totalBytes);
    
    // Copy and remove padding
    const srcData = new Uint8Array(arrayBuffer);
    for (let y = 0; y < height; y++) {
        const srcOffset = y * bytesPerRow;
        const dstOffset = y * width * 4;
        outputData.set(
            srcData.subarray(srcOffset, srcOffset + width * 4),
            dstOffset
        );
    }

    readbackBuffer.unmap();
    
    return outputData;
}

function normalizeHeightmap(heightmap) {
  let min = heightmap[0];
  let max = heightmap[0];
  
  // Find min/max using a loop
  for (let i = 1; i < heightmap.length; i++) {
    if (heightmap[i] < min) min = heightmap[i];
    if (heightmap[i] > max) max = heightmap[i];
  }
  
  // Create normalized array
  const range = max - min;
  return Float32Array.from(heightmap, h => (h - min) / range);
}

async function saveTextureAsPNG(data, width, height) {
  // Create a canvas and set dimensions
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // Convert data into ImageData format for the canvas
  const imageData = new ImageData(new Uint8ClampedArray(data), width, height);
  ctx.putImageData(imageData, 0, 0);

  // Create a PNG data URL
  const pngDataUrl = canvas.toDataURL("image/png");

  // Trigger a download
  const link = document.createElement("a");
  link.href = pngDataUrl;
  link.download = "generated_texture.png";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export { createTextureFromLUT };