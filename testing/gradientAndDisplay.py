import numpy as np
import pandas as pd
import plotly.graph_objects as go
import scipy.ndimage as ndimage
import matplotlib.pyplot as plt
import os

base_dir = os.path.dirname(os.path.abspath(__file__))
heightmap_path = os.path.join(base_dir, "eroded_terrain.csv")
# Load the heightmap data
heightmap_gpu = pd.read_csv(heightmap_path, header=None).values

print(type(heightmap_gpu))  # <class 'numpy.ndarray'>
print(heightmap_gpu.shape)  # (1024, 1024)

# Normalize the heightmap to the range [0, 1]
heightmap_gpu = (heightmap_gpu - heightmap_gpu.min()) / (heightmap_gpu.max() - heightmap_gpu.min())

# Optional smoothing of the heightmap
smooth = True
if smooth:
    heightmap_gpu = ndimage.gaussian_filter(heightmap_gpu, sigma=3)

# Compute the gradient in the x and y directions
gradient_y, gradient_x = np.gradient(heightmap_gpu)

# Compute the gradient magnitude
gradient_magnitude = np.sqrt(gradient_x**2 + gradient_y**2)

# Normalize the gradient magnitude for coloring
gradient_normalized = (gradient_magnitude - gradient_magnitude.min()) / (gradient_magnitude.max() - gradient_magnitude.min())

# Optionally, apply smoothing to the gradient magnitude
if smooth:
    gradient_normalized = ndimage.gaussian_filter(gradient_normalized, sigma=1)

custom_colorscale = [
    [0.0, 'rgb(15, 150, 50)'],
    [0.1, 'rgb(100, 60, 50)'],
    [0.3, 'rgb(50, 50, 60)'],
    [1.0, 'rgb(50, 50, 60)']
]

# Create the Plotly surface plot using gradient magnitude for coloring
fig = go.Figure(data=[
    go.Surface(
        z=heightmap_gpu,
        surfacecolor=gradient_normalized,
        colorscale=custom_colorscale,
        colorbar=dict(title='Gradient Magnitude')
    )
])

# Update layout for better visualization
fig.update_layout(
    title='Terrain Colored by Gradient Magnitude',
    scene=dict(
        zaxis=dict(range=[0, 3 * heightmap_gpu.max()]),
        xaxis_title='X',
        yaxis_title='Y',
        zaxis_title='Height'
    )
)

# Show the plot
fig.show()