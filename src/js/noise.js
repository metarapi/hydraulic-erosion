import fbmShader from '../shaders/fbmShader.wgsl';

export async function generateBaseTerrain(device, xSize, ySize, levels = 5, exponentFactor = 0.5) {
  const dataSize = xSize * ySize * 4; // Each f32 is 4 bytes

  // Create the storage buffer for the height map
  const heightMapBuffer = device.createBuffer({
    size: dataSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });

  // Create uniform buffers for levels, exponent factor, xSize, and ySize
  const levelsBuffer = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const exponentFactorBuffer = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const xSizeBuffer = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const ySizeBuffer = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // Write values to the uniform buffers
  device.queue.writeBuffer(levelsBuffer, 0, new Int32Array([levels]));
  device.queue.writeBuffer(exponentFactorBuffer, 0, new Float32Array([exponentFactor]));
  device.queue.writeBuffer(xSizeBuffer, 0, new Float32Array([xSize]));
  device.queue.writeBuffer(ySizeBuffer, 0, new Float32Array([ySize]));

  // Create the compute pipeline
  const computePipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: device.createShaderModule({
        code: fbmShader.code,
      }),
      entryPoint: 'main',
    },
  });

  // Create the bind group
  const uniformBindGroup = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: heightMapBuffer } },
      { binding: 1, resource: { buffer: levelsBuffer } },
      { binding: 2, resource: { buffer: exponentFactorBuffer } },
      { binding: 3, resource: { buffer: xSizeBuffer } },
      { binding: 4, resource: { buffer: ySizeBuffer } },
    ],
  });

  // Encode commands for the compute pass
  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass();
  passEncoder.setPipeline(computePipeline);
  passEncoder.setBindGroup(0, uniformBindGroup);
  passEncoder.dispatchWorkgroups(
    Math.ceil(xSize / 8),
    Math.ceil(ySize / 8)
  );
  passEncoder.end();

  device.queue.submit([commandEncoder.finish()]);

  // Read back the height map data
  const readBuffer = device.createBuffer({
    size: dataSize,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  const copyEncoder = device.createCommandEncoder();
  copyEncoder.copyBufferToBuffer(heightMapBuffer, 0, readBuffer, 0, dataSize);
  device.queue.submit([copyEncoder.finish()]);

  // Map the buffer to read the data
  await readBuffer.mapAsync(GPUMapMode.READ);
  const arrayBuffer = readBuffer.getMappedRange();
  const heightMap = new Float32Array(arrayBuffer);

  const output = heightMap.slice();

  // Clean up
  readBuffer.unmap();
  heightMapBuffer.destroy();
  levelsBuffer.destroy();
  exponentFactorBuffer.destroy();
  xSizeBuffer.destroy();
  ySizeBuffer.destroy();

  return output;
}
