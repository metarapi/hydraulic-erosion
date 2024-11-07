import numpy as np
import pandas as pd
import plotly.graph_objects as go
import scipy.ndimage as ndimage
import matplotlib.pyplot as plt
import os

base_dir = os.path.dirname(os.path.abspath(__file__))
heightmap_path = os.path.join(base_dir, "eroded_terrain.csv")
heightmap_gpu = pd.read_csv(heightmap_path, header=None).values


print(type(heightmap_gpu))
print(heightmap_gpu.shape)

smooth = True

if smooth:
    heightmap_gpu = ndimage.gaussian_filter(heightmap_gpu, sigma=3)

fig = go.Figure(data=[go.Surface(z=heightmap_gpu, colorscale='Viridis')])
fig.update_layout(scene_zaxis_range=[0, 3*heightmap_gpu.max()])
fig.show()
