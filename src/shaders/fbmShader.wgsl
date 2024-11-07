// Uniforms for map size
@group(0) @binding(0) var<storage, read_write> heightMap: array<f32>;
@group(0) @binding(1) var<uniform> levels: i32;
@group(0) @binding(2) var<uniform> exponentFactor: f32;
@group(0) @binding(3) var<uniform> xSize: f32;
@group(0) @binding(4) var<uniform> ySize: f32;

// Simplex noise utility functions remain the same
fn mod289(x: vec2f) -> vec2f {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn mod289_3(x: vec3f) -> vec3f {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn permute3(x: vec3f) -> vec3f {
    return mod289_3(((x * 34.0) + 1.0) * x);
}

fn simplexNoise2(v: vec2f) -> f32 {
    let C = vec4f(
        0.211324865405187, 
        0.366025403784439, 
        -0.577350269189626, 
        0.024390243902439
    );

    var i = floor(v + dot(v, C.yy));
    let x0 = v - i + dot(i, C.xx);

    var i1 = select(vec2f(0.0, 1.0), vec2f(1.0, 0.0), x0.x > x0.y);

    var x12 = x0.xyxy + C.xxzz;
    x12.x = x12.x - i1.x;
    x12.y = x12.y - i1.y;

    i = mod289(i);

    var p = permute3(permute3(i.y + vec3f(0.0, i1.y, 1.0)) + i.x + vec3f(0.0, i1.x, 1.0));
    var m = max(0.5 - vec3f(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), vec3f(0.0));
    m *= m;
    m *= m;

    let x = 2.0 * fract(p * C.www) - 1.0;
    let h = abs(x) - 0.5;
    let ox = floor(x + 0.5);
    let a0 = x - ox;

    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

    let g = vec3f(a0.x * x0.x + h.x * x0.y, a0.yz * x12.xz + h.yz * x12.yw);
    return 130.0 * dot(m, g);
}

var<private> m2: mat2x2f = mat2x2f(vec2f(0.8, 0.6), vec2f(-0.6, 0.8));



fn fbm(p: vec2f) -> f32 {
    var position = p;
    var totalNoise = 0.0;
    var amplitude = 1.0;
    var frequency = 1.0;
    var maxAmplitude = 0.0;

    for (var i = 0; i < levels; i = i + 1) {
        totalNoise += simplexNoise2(position  * frequency) * amplitude;
        maxAmplitude += amplitude;
        amplitude *= exponentFactor;
        frequency *= 2.0;
        position  = m2 * position ;
    }

    //return totalNoise;
    return (totalNoise / maxAmplitude) * 0.5 + 0.5; // Normalize to [0, 1]
}



@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let x = global_id.x;
    let y = global_id.y;

    let pos = vec2f(f32(x), f32(y)) / vec2f(xSize, ySize); // Convert `x` and `y` to `f32`
    let noiseValue = fbm(pos);

    let index = x + y * u32(xSize); // Convert 2D coordinates to 1D index
    heightMap[index] = noiseValue;
}