struct UniformsU32 {
    droplets: u32,
    cycle: u32,
    max_iterations: u32,
    start_vol: u32,
    min_vol: u32,
    dim_x: u32,
    dim_z: u32,
    map_size: u32,
    barrier_interval: u32,
};

struct UniformsF32 {
    deposition_rate: f32,
    erosion_rate: f32,
    evap_rate: f32,
    };

const FIXED_POINT_SCALE: i32 = 1000;

@group(0) @binding(0) var<uniform> params_u32: UniformsU32;
@group(0) @binding(1) var<uniform> params_f32: UniformsF32;
@group(0) @binding(2) var<storage, read_write> heightMap: array<atomic<i32>>;
@group(0) @binding(3) var<storage, read_write> randomLog: array<atomic<i32>>;
@group(0) @binding(4) var<storage, read_write> startPositions: array<u32>;
@group(0) @binding(5) var<storage, read_write> smoothedHeightMap: array<atomic<i32>>;

// fn xxhash32(n: u32) -> u32 {
//     var h32 = n + 374761393u;
//     h32 = 668265263u * ((h32 << 17) | (h32 >> (32 - 17)));
//     h32 = 2246822519u * (h32 ^ (h32 >> 15));
//     h32 = 3266489917u * (h32 ^ (h32 >> 13));
//     return h32^(h32 >> 16);
// }

// // Simple hash function for 2D indices
// fn xxhash32_2d(p: vec2u) -> u32 {
//     let p2 = 2246822519u;
//     let p3 = 3266489917u;
//     let p4 = 668265263u;
//     let p5 = 374761393u;
//     var h32 = p.y + p5 + p.x * p3;
//     h32 = p4 * ((h32 << 17) | (h32 >> 15));
//     h32 = p2 * (h32 ^ (h32 >> 15));
//     h32 = p3 * (h32 ^ (h32 >> 13));
//     return h32 ^ (h32 >> 16);
// }

@compute @workgroup_size(${workgroupSize}, 1, 1)
fn main(@builtin(global_invocation_id) id: vec3u) {
    let isValid = id.x < params_u32.droplets;

    // Precomputed neighbor offsets for efficiency
    let NEIGHBOR_OFFSETS: array<i32, 8> = array<i32, 8>(
        -1 - i32(params_u32.dim_x), // Southwest
        -i32(params_u32.dim_x),     // South
        1 - i32(params_u32.dim_x),  // Southeast
        -1,                         // West
        1,                          // East
        -1 + i32(params_u32.dim_x), // Northwest
        i32(params_u32.dim_x),      // North
        1 + i32(params_u32.dim_x)   // Northeast
    );

    let dropletIndex = id.x;

    // Initialize droplet properties
    var volume: i32 = 0;
    var sediment: i32 = 0;
    var current_idx: i32 = 0;

    if (isValid) {
        volume = i32(params_u32.start_vol);
        sediment = 0;
        current_idx = i32(startPositions[dropletIndex]);
    }

    // Initialize the iterator
    var continue_processing: bool = true;

    // Loop with max iterations
    for (var j: u32 = 1u; j <= params_u32.max_iterations; j = j + 1u) {

        if (continue_processing) {
            if (volume <= i32(params_u32.min_vol)) {
                continue_processing = false;
            } else {

                let height_current = atomicLoad(&heightMap[current_idx]);
                var min_height = height_current;
                var min_offset: i32 = 0;

                // Find the lowest neighboring height
                for (var i = 0; i < 8; i = i + 1) {
                    let offset = NEIGHBOR_OFFSETS[i];
                    let neighbor_idx = current_idx + offset;
                    let neighbor_row = neighbor_idx / i32(params_u32.dim_x);
                    let current_row = current_idx / i32(params_u32.dim_x);

                    // Ensure the neighbor is valid and does not overflow to a different row
                    if (neighbor_idx >= 0 && neighbor_idx < i32(params_u32.map_size) && neighbor_row == current_row + (offset / i32(params_u32.dim_x))) {
                        let height_neighbor = atomicLoad(&heightMap[neighbor_idx]);
                        if (height_neighbor < min_height) {
                            min_height = height_neighbor;
                            min_offset = offset;
                        }
                    }
                }

                // If no lower neighbor is found, deposit remaining sediment and terminate
                if (min_offset == 0) {
                    // Deposit remaining sediment
                    atomicAdd(&heightMap[current_idx], sediment);
                    sediment = 0;

                    // Log the droplet's path at the current position
                    atomicAdd(&randomLog[current_idx], 1);

                    // Indicate that this thread has finished processing
                    continue_processing = false;
                }

                // Calculate height difference and sediment capacity
                let height_diff = height_current - min_height;
                var max_sediment = volume * height_diff;

                if (max_sediment < 0) {
                    // Deposit all remaining sediment
                    max_sediment = 0;

                    // Dump the remaining sediment in the droplet onto the terrain
                    let sediment_change_float = f32(sediment) * params_f32.deposition_rate;
                    let sediment_change = i32(sediment_change_float);

                    // Update the height map and reset droplet sediment
                    atomicSub(&heightMap[current_idx], sediment_change);
                    sediment = 0;
                } else {
                    // Regular erosion and deposition logic
                    let sediment_diff = max_sediment - sediment;
                    var sediment_change_float: f32;

                    if (sediment_diff > 0) {
                        // Erosion: droplet picks up sediment
                        sediment_change_float = f32(sediment_diff) * params_f32.erosion_rate;
                    } else {
                        // Deposition: droplet deposits sediment
                        sediment_change_float = f32(sediment_diff) * params_f32.deposition_rate;
                    }

                let sediment_change = i32(sediment_change_float);

                // Update sediment and apply erosion
                sediment += sediment_change;
                atomicSub(&heightMap[current_idx], sediment_change);

                }

                // Evaporate droplet volume (at floating point precision)
                var evapFactor : f32 = pow(1.0 - params_f32.evap_rate, f32(j));

                // Move droplet to the lowest neighbor
                current_idx += min_offset;

                // Evaporate droplet volume and convert back to integer
                volume = i32(f32(volume) * evapFactor);

                // Log the droplet's path
                atomicAdd(&randomLog[current_idx], 1);
                    
            }
        }
            
        // Synchronize every 5 iterations with memory and execution barriers
        if (j % params_u32.barrier_interval == 0u) {
            storageBarrier(); // Ensure all memory writes are visible.
            workgroupBarrier(); // Ensure all threads reach this point before proceeding.
        }
    }
}

@compute @workgroup_size(${workgroupSize}, 1, 1)
fn blurHeightMap(@builtin(global_invocation_id) id: vec3u) {
    let idx = i32(id.x);
    if (u32(idx) >= params_u32.map_size) {
        return;
    }

    let dim_x = i32(params_u32.dim_x);
    let dim_z = i32(params_u32.dim_z);

    // Calculate current x and y coordinates
    let x = idx % dim_x;
    let y = idx / dim_x;

    let blurOffsets: array<vec2i, 9> = array<vec2i, 9>(
        vec2i(-1, -1), vec2i(0, -1), vec2i(1, -1),
        vec2i(-1,  0), vec2i(0,  0), vec2i(1,  0),
        vec2i(-1,  1), vec2i(0,  1), vec2i(1,  1)
    );

    let blurWeights: array<f32, 9> = array<f32, 9>(
        0.0625, 0.125, 0.0625,
        0.125,  0.25,  0.125,
        0.0625, 0.125, 0.0625
    );

    var smoothedHeight: f32 = 0.0;
    var weightSum: f32 = 0.0;

    // Loop over the neighbor offsets
    for (var i = 0; i < 9; i = i + 1) {
        let offset = blurOffsets[i];
        let nx = x + offset.x;
        let ny = y + offset.y;

        // Check if neighbor coordinates are within bounds
        if (nx >= 0 && nx < dim_x && ny >= 0 && ny < dim_z) {
            let neighbor_idx = nx + ny * dim_x;
            smoothedHeight += f32(atomicLoad(&heightMap[u32(neighbor_idx)])) * blurWeights[i];
            weightSum += blurWeights[i];
        }
    }

    // Normalize the smoothed height
    if (weightSum > 0.0) {
        smoothedHeight /= weightSum;
    }

    atomicStore(&smoothedHeightMap[u32(idx)], i32(smoothedHeight));
}
