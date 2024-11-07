@group(0) @binding(0) var<uniform> SIZE: u32; // Size of the heightmap (always square)
@group(0) @binding(1) var<uniform> SCALE: u32; // Fixed-point scale factor
@group(0) @binding(2) var<storage, read> heightmap: array<i32>;
@group(0) @binding(3) var<storage, read_write> gradient_magnitude: array<f32>;
@group(0) @binding(4) var<storage, read_write> gradient_direction: array<f32>;

@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) GlobalInvocationID: vec3<u32>) {
    let x: u32 = GlobalInvocationID.x;
    let y: u32 = GlobalInvocationID.y;

    // Boundary check
    if (x >= SIZE || y >= SIZE) {
        return;
    }

    let index: u32 = y * SIZE + x;

    // Handle boundaries by clamping
    let xm1: u32 = select(x - 1, x, x == 0);
    let xp1: u32 = select(x + 1, x, x == SIZE - 1);
    let ym1: u32 = select(y - 1, y, y == 0);
    let yp1: u32 = select(y + 1, y, y == SIZE - 1);

    let index_left: u32 = y * SIZE + xm1;
    let index_right: u32 = y * SIZE + xp1;
    let index_down: u32 = ym1 * SIZE + x;
    let index_up: u32 = yp1 * SIZE + x;

    // Read heightmap values
    let fx_plus: i32 = heightmap[index_right];
    let fx_minus: i32 = heightmap[index_left];
    let fy_plus: i32 = heightmap[index_up];
    let fy_minus: i32 = heightmap[index_down];

    // Compute gradient components (fixed-point to float)
    let grad_x_fp: i32 = fx_plus - fx_minus;
    let grad_y_fp: i32 = fy_plus - fy_minus;

    // Convert to float by dividing by (2.0 * f32(SCALE))
    let grad_x: f32 = f32(grad_x_fp) / (2.0 * f32(SCALE));
    let grad_y: f32 = f32(grad_y_fp) / (2.0 * f32(SCALE));

    // Compute magnitude and direction
    let magnitude: f32 = sqrt(grad_x * grad_x + grad_y * grad_y);
    let direction: f32 = atan2(grad_y, grad_x);

    // Write to output buffers
    gradient_magnitude[index] = magnitude;
    gradient_direction[index] = direction;
}
