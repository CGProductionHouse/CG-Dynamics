# Photoshop UXP proof renderer

`scene-to-psd.psjs` is the first local Photoshop 2026 proof path. Run it from **File → Scripts → Browse…**, then choose the private job folder containing `scene-v1.json` and its relative assets. It creates a PSD, PNG preview and renderer receipt under that job's `output` folder.

The script intentionally requests a single job folder rather than full-disk access and never uses the network. It creates genuine smart-object image layers, live Photoshop text layers, independent pixel rectangles and layer groups. The current beta explicitly reports unsupported path, ellipse, gradient, filter and clip-path layers; the portable SVG remains the visually complete interim document until those PSD primitives are implemented and visually verified.

Loading/running this locally developed script is a Computer Use confirmation boundary. Do not claim PSD support from source inspection alone: open the resulting PSD, inspect its Layers panel and verify a text-only amendment before calling the path proven.
