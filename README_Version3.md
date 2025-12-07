```markdown
# Image → G-code Plotter (Browser)

What this is
- A self-contained client-side web app that converts a 2D image into simple raster G-code suitable for many pen/plotter setups.
- The page shows the generated G-code and, directly below it, the black-and-white raster used to produce the code (so you can verify the plotted result visually).
- Everything runs in your browser — no server required.

Files
- index.html — the web UI
- styles.css — styling
- script.js — image processing and G-code generation logic

How it works (quick)
1. Load an image (PNG/JPG/WebP/…).
2. Choose Max width (mm) and mm/pixel to control the output resolution and physical size.
3. Toggle Floyd–Steinberg dithering and invert (black/white) as needed. Serpentine scanning reduces travel.
4. Optionally edit the Pen down / Pen up commands to match your machine (e.g., servo commands).
5. Click "Generate G-code". The G-code appears in the page and is downloadable. The black-and-white preview below shows exactly the raster that produced the G-code.

Notes & tips
- The generated G-code is a simple rasterization (row-by-row line segments); for many machines you'll need to adapt the pen up/down commands (the UI supports custom strings).
- Coordinates use a top-left origin so the preview matches generated coordinates. If your machine expects bottom-left origin, flip Y coordinates or post-process the file.
- This tool is best for pen or simple plotting setups. For vector-style tracing or more advanced optimizations, consider adding edge tracing or run-merging.

Next steps I can do for you
- Add an option to export SVG or vector G-code (stroke tracing) instead of raster runs.
- Add run-merging and travel-optimization to reduce lifts and shorten runtime.
- Integrate this into your GitHub repo and push a branch (tell me the repo owner/name, branch name, and commit message).

Tell me which improvement or integration you'd like next and I'll update the project.
```