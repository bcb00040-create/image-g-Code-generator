# Image → G-code Plotter (client-side)

A simple static web app that converts an image into G-code suitable for a pen/plotter and shows a black & white preview.

How it works
- Upload an image.
- Configure target width (mm), step size (mm per pixel), threshold (0–255), feed rates and pen up/down Z positions.
- Click "Generate G-code".
- The app raster-scans the image row-by-row and creates continuous draw segments for dark pixels (or inverted if selected).
- G-code uses G21 (mm), G90 (absolute), G0 for travel (pen up) and G1 for drawing; pen up/down is represented by Z moves.

Files
- index.html — UI
- app.js — image processing & G-code generation (client-side)
- styles.css — styling

Usage notes and tips
- Step (mm per pixel) controls resolution: smaller step → higher resolution → more lines and larger G-code.
- Target width (mm) combined with step determines the pixel width used for rasterization:
  pixelWidth = max(1, round(width_mm / step_mm))
- If your plotter uses a different command to control the pen (e.g., servo M3/M5 or specific tooling), adjust the generated G-code accordingly after download or edit the script to change the pen-up/pen-down mechanism.
- The preview's origin is top-left. If your machine expects a different origin, offset/flip as needed before sending to the machine.

License: MIT