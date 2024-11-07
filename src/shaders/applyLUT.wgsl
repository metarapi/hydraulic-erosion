// Define the maximum radius for the Gaussian blur
const MAX_RADIUS: u32 = 32u;

// Uniform buffer for integer data
struct IntUniforms {
    radius: u32,
    imgWidth: u32,
    imgHeight: u32,
    lutWidth: u32,
    lutHeight: u32,
    padding: u32, // Padding to align to 16 bytes
};

// Bindings
@group(0) @binding(0) var<storage, read_write> source: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;
@group(0) @binding(2) var<uniform> intUniforms: IntUniforms;
@group(0) @binding(3) var<storage, read> weights: array<f32>;
@group(0) @binding(4) var lutTexture: texture_2d<f32>;
@group(0) @binding(5) var outputTexture: texture_storage_2d<rgba8unorm, write>;

// Horizontal pass of Gaussian blur
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
        let pixelValue = source[index];
        let weight = weights[offset];
        value = value + pixelValue * weight;
    }

    let outputIndex = y * imgWidth + x;
    output[outputIndex] = value;
}

// Vertical pass of Gaussian blur
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
        let pixelValue = source[index];
        let weight = weights[offset];
        value = value + pixelValue * weight;
    }

    let outputIndex = y * imgWidth + x;
    output[outputIndex] = value;
}

// Gradient calculation and LUT mapping
@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let coords = vec2<i32>(i32(id.x), i32(id.y));
    
    if (coords.x >= i32(intUniforms.imgWidth) || coords.y >= i32(intUniforms.imgHeight)) {
        return;
    }

    // Load height value
    let height = output[u32(coords.y) * intUniforms.imgWidth + u32(coords.x)];

    // Calculate gradient
    let heightLeft = output[u32(coords.y) * intUniforms.imgWidth + u32(max(coords.x - 1, 0))];
    let heightRight = output[u32(coords.y) * intUniforms.imgWidth + u32(min(coords.x + 1, i32(intUniforms.imgWidth) - 1))];
    let heightDown = output[u32(max(coords.y - 1, 0)) * intUniforms.imgWidth + u32(coords.x)];
    let heightUp = output[u32(min(coords.y + 1, i32(intUniforms.imgHeight) - 1)) * intUniforms.imgWidth + u32(coords.x)];

    // let gradX = (heightRight - heightLeft) / 2.0;
    // let gradY = (heightUp - heightDown) / 2.0;
    let gradX = heightRight - heightLeft;
    let gradY = heightUp - heightDown;
    let steepness = sqrt(gradX * gradX + gradY * gradY) / sqrt(2.0); // Normalize to [0, 1]
    let scaledSteepness = steepness * 150.0; // Scale steepness to [0, 150] - magic number

    // Map height and steepness to LUT coordinates
    let lutX = i32(clamp(scaledSteepness * f32(intUniforms.lutWidth - 1u), 0.0, f32(intUniforms.lutWidth - 1u)));
    let lutY = i32(clamp(height * f32(intUniforms.lutHeight - 1u), 0.0, f32(intUniforms.lutHeight - 1u)));
    
    // Sample LUT texture
    let lutColor = textureLoad(lutTexture, vec2<i32>(lutX, lutY), 0);
    
    // Store final color
    textureStore(outputTexture, coords, lutColor);
}