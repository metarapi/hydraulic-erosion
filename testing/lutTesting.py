import numpy as np
import pandas as pd
import pyvista as pv
from PIL import Image
import scipy.ndimage as ndimage
import os

# ----------------------------
# 1. Load and Preprocess Heightmap
# ----------------------------

def load_heightmap(csv_path, smooth=True, sigma=1):
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Heightmap CSV file not found at: {csv_path}")

    heightmap_df = pd.read_csv(csv_path, header=None)
    heightmap = heightmap_df.values.astype(np.float32)

    if smooth:
        heightmap = ndimage.gaussian_filter(heightmap, sigma=sigma)

    height_min = heightmap.min()
    height_max = heightmap.max()
    heightmap_normalized = (heightmap - height_min) / (height_max - height_min)

    return heightmap_normalized

# ----------------------------
# 2. Compute Steepness (Gradient Magnitude)
# ----------------------------

def compute_steepness(heightmap):
    grad_y, grad_x = np.gradient(heightmap)
    gradient_magnitude = np.sqrt(grad_x**2 + grad_y**2)
    gradient_magnitude = gradient_magnitude

    #steepness_normalized = (gradient_magnitude - gradient_magnitude.min()) / (gradient_magnitude.max() - gradient_magnitude.min())

    # Normalize steepness based on theoretical maximum (sqrt(2))
    steepness_normalized = gradient_magnitude / np.sqrt(2)

    # Clip values to [0, 1] to handle any numerical anomalies
    #steepness_normalized = np.clip(steepness_normalized, 0, 1)

    return steepness_normalized

# ----------------------------
# 3. Load and Preprocess LUT Image
# ----------------------------

def load_lut(lut_path):
    if not os.path.exists(lut_path):
        raise FileNotFoundError(f"LUT image file not found at: {lut_path}")

    lut_image = Image.open(lut_path).convert('RGB')
    lut = np.array(lut_image).astype(np.float32) / 255.0
    return lut

# ----------------------------
# 4. Map Height and Steepness to LUT and Sample Colors
# ----------------------------

def sample_lut_colors(heightmap, steepness, lut):
    lut_height, lut_width, _ = lut.shape

    lut_x = np.clip((steepness * (lut_width - 1)).astype(np.int32), 0, lut_width - 1)
    lut_y = np.clip((heightmap * (lut_height - 1)).astype(np.int32), 0, lut_height - 1)

    sampled_colors = lut[lut_y, lut_x]

    return sampled_colors

# ----------------------------
# 5. Generate 3D Mesh with Vertex Colors
# ----------------------------

def generate_mesh(heightmap, colors, z_scale=1.0):
    height, width = heightmap.shape

    x = np.linspace(0, 1, width)
    y = np.linspace(0, 1, height)
    x_grid, y_grid = np.meshgrid(x, y)

    x_flat = x_grid.flatten()
    y_flat = y_grid.flatten()
    z_flat = heightmap.flatten() * z_scale

    colors_flat = colors.reshape(-1, 3)

    return x_flat, y_flat, z_flat, colors_flat

# ----------------------------
# 6. Create PyVista Mesh
# ----------------------------

def create_pyvista_mesh(x, y, z, colors):
    points = np.column_stack((x, y, z))
    grid = pv.StructuredGrid()
    grid.points = points
    grid.dimensions = (len(np.unique(x)), len(np.unique(y)), 1)
    grid["colors"] = colors

    return grid

# ----------------------------
# 7. Visualization
# ----------------------------

def visualize(grid):
    plotter = pv.Plotter()
    plotter.add_mesh(grid, scalars="colors", rgb=True)
    plotter.show()

# ----------------------------
# 8. Main Function
# ----------------------------

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    heightmap_path = os.path.join(base_dir, "eroded_terrain.csv")
    lut_path = os.path.join(base_dir, "lut.png")

    heightmap = load_heightmap(heightmap_path, smooth=True, sigma=3)
    steepness = compute_steepness(heightmap)
    lut = load_lut(lut_path)
    sampled_colors = sample_lut_colors(heightmap, steepness*150, lut)
    x, y, z, colors = generate_mesh(heightmap, sampled_colors, z_scale=.25)
    grid = create_pyvista_mesh(x, y, z, colors)
    visualize(grid)

if __name__ == "__main__":
    main()