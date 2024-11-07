const MAX_RADIUS: u32 = 32u;

// Uniform buffer for integer data
struct IntUniforms {
    radius: u32,
    imgWidth: u32,
    imgHeight: u32,
    padding: u32, // Padding to align to 16 bytes
};

@group(0) @binding(0) var<storage, read> source: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;
@group(0) @binding(2) var<uniform> intUniforms: IntUniforms;
@group(0) @binding(3) var<storage, read> weights: array<f32>;

fn getRgba(pixel: u32) -> vec4<u32> {
    return vec4<u32>(
        pixel & 0xffu,
        (pixel >> 8u) & 0xffu,
        (pixel >> 16u) & 0xffu,
        (pixel >> 24u) & 0xffu
    );
}

fn rgbaToUint(rgba: vec4<u32>) -> u32 {
    return (rgba.x) | (rgba.y << 8u) | (rgba.z << 16u) | (rgba.w << 24u);
}

@compute @workgroup_size(16, 16)
fn horizontalPass(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let imgWidth = intUniforms.imgWidth;
    let imgHeight = intUniforms.imgHeight;

    let x = global_id.x;
    let y = global_id.y;

    if (x >= imgWidth || y >= imgHeight) {
        return;
    }

    let radius = intUniforms.radius;
    var value = 0.0;

    for (var i: i32 = -i32(radius); i <= i32(radius); i = i + 1) {
        let offset = u32(i + i32(radius));
        let sampleX = clamp(u32(i32(x) + i), 0u, imgWidth - 1u);
        let index = y * imgWidth + sampleX;
        let pixelValue = source[index]; // Grayscale value
        let weight = weights[offset];
        value = value + pixelValue * weight;
    }

    let outputIndex = y * imgWidth + x;
    output[outputIndex] = value; // Store the computed grayscale value
}

@compute @workgroup_size(16, 16)
fn verticalPass(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let imgWidth = intUniforms.imgWidth;
    let imgHeight = intUniforms.imgHeight;

    let x = global_id.x;
    let y = global_id.y;

    if (x >= imgWidth || y >= imgHeight) {
        return;
    }

    let radius = intUniforms.radius;
    var value = 0.0;

    for (var i: i32 = -i32(radius); i <= i32(radius); i = i + 1) {
        let offset = u32(i + i32(radius));
        let sampleY = clamp(u32(i32(y) + i), 0u, imgHeight - 1u);
        let index = sampleY * imgWidth + x;
        let pixelValue = source[index]; // Grayscale value
        let weight = weights[offset];
        value = value + pixelValue * weight;
    }

    let outputIndex = y * imgWidth + x;
    output[outputIndex] = value; // Store the computed grayscale value
}