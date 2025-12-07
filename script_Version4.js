// Image -> G-code (raster) generator
// Produces simple row-by-row G-code and shows the black & white raster used to create it.

(() => {
  // Elements
  const fileInput = document.getElementById('file');
  const maxWidthMmInput = document.getElementById('maxWidthMm');
  const mmPerPixelInput = document.getElementById('mmPerPixel');
  const feedRateInput = document.getElementById('feedRate');
  const ditherCheckbox = document.getElementById('dither');
  const invertCheckbox = document.getElementById('invert');
  const serpentineCheckbox = document.getElementById('serpentine');
  const penDownCmdInput = document.getElementById('penDownCmd');
  const penUpCmdInput = document.getElementById('penUpCmd');

  const generateBtn = document.getElementById('generate');
  const downloadLink = document.getElementById('download');
  const clearBtn = document.getElementById('clear');
  const status = document.getElementById('status');
  const gcodeEl = document.getElementById('gcode');
  const copyGBtn = document.getElementById('copyG');
  const previewCanvas = document.getElementById('preview');
  const pctx = previewCanvas.getContext('2d');

  let imageBitmap = null;
  let bwBuffer = null;

  function setStatus(msg) { status.textContent = msg || ''; }

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setStatus('Loading image...');
    try {
      imageBitmap = await createImageBitmap(file);
      renderSourcePreview(imageBitmap);
      setStatus('Image loaded. Configure options and click Generate.');
    } catch (err) {
      console.error(err);
      setStatus('Failed to load image.');
    }
  });

  clearBtn.addEventListener('click', () => {
    fileInput.value = '';
    imageBitmap = null;
    bwBuffer = null;
    gcodeEl.textContent = '';
    pctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    downloadLink.classList.add('hidden');
    setStatus('');
  });

  generateBtn.addEventListener('click', async () => {
    if (!imageBitmap) {
      setStatus('Please select an image first.');
      return;
    }
    setStatus('Processing image...');
    await sleep(10);

    const maxWidthMm = parseFloat(maxWidthMmInput.value) || 150;
    const mmPerPixel = parseFloat(mmPerPixelInput.value) || 0.5;
    const feed = parseFloat(feedRateInput.value) || 1200;
    const useDither = ditherCheckbox.checked;
    const invert = invertCheckbox.checked;
    const serpentine = serpentineCheckbox.checked;
    const penDownCmd = (penDownCmdInput.value || 'G1 Z0.000').trim();
    const penUpCmd = (penUpCmdInput.value || 'G1 Z5.000').trim();

    // pixel target width to respect maxWidthMm
    const maxPixelWidth = Math.max(1, Math.round(maxWidthMm / mmPerPixel));

    // scale image to target pixel width (downscale only)
    const scale = Math.min(1, maxPixelWidth / imageBitmap.width) || 1;
    const w = Math.max(1, Math.round(imageBitmap.width * scale));
    const h = Math.max(1, Math.round(imageBitmap.height * scale));

    // draw into offscreen canvas and extract pixels
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    const tctx = tmp.getContext('2d');
    tctx.imageSmoothingEnabled = true;
    tctx.imageSmoothingQuality = 'high';
    tctx.drawImage(imageBitmap, 0, 0, w, h);
    const imgData = tctx.getImageData(0, 0, w, h);

    // compute luminance 0..1
    const gray = new Float32Array(w * h);
    for (let i = 0, j = 0; i < imgData.data.length; i += 4, j++) {
      const r = imgData.data[i], g = imgData.data[i + 1], b = imgData.data[i + 2];
      gray[j] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    }

    // produce binary BW buffer (1 = draw/black, 0 = white)
    const bw = new Uint8ClampedArray(w * h);
    if (useDither) {
      floydSteinbergDither(gray, bw, w, h, invert);
    } else {
      const thresh = 0.5;
      for (let i = 0; i < gray.length; i++) {
        const v = gray[i];
        bw[i] = (invert ? (v > thresh) : (v <= thresh)) ? 1 : 0;
      }
    }

    bwBuffer = { w, h, data: bw };

    // render the black & white preview (this is the raster used to generate the gcode)
    renderBWPreview(bwBuffer);

    setStatus('Generating G-code...');
    await sleep(10);

    const gcode = generateGcodeFromBW(bwBuffer, {
      mmPerPixel,
      feed,
      penUpCmd,
      penDownCmd,
      serpentine,
      originAtTopLeft: true
    });

    gcodeEl.textContent = gcode;

    // make download link
    const blob = new Blob([gcode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.classList.remove('hidden');

    setStatus('G-code ready — preview below. You can download or copy it.');
  });

  copyGBtn.addEventListener('click', async () => {
    const txt = gcodeEl.textContent || '';
    if (!txt) return setStatus('No G-code to copy.');
    try {
      await navigator.clipboard.writeText(txt);
      setStatus('G-code copied to clipboard.');
    } catch (err) {
      setStatus('Failed to copy to clipboard.');
    }
  });

  // --- helpers ---

  function renderSourcePreview(img) {
    // draw the source image into preview for quick visual feedback (then overwritten by BW when generated)
    const cw = previewCanvas.width, ch = previewCanvas.height;
    const ar = img.width / img.height;
    let dw = cw, dh = Math.round(cw / ar);
    if (dh > ch) { dh = ch; dw = Math.round(ch * ar); }
    const x = Math.round((cw - dw) / 2), y = Math.round((ch - dh) / 2);
    pctx.clearRect(0, 0, cw, ch);
    pctx.imageSmoothingEnabled = true;
    pctx.drawImage(img, x, y, dw, dh);
  }

  function renderBWPreview(bw) {
    const w = bw.w, h = bw.h;
    // draw to temp canvas then scale to preview to preserve pixel crispness
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    const tctx = tmp.getContext('2d');
    const id = tctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const val = bw.data[y * w + x] ? 0 : 255; // 0 = black, 255 = white in canvas
        const idx = (y * w + x) * 4;
        id.data[idx] = val;
        id.data[idx + 1] = val;
        id.data[idx + 2] = val;
        id.data[idx + 3] = 255;
      }
    }
    tctx.putImageData(id, 0, 0);

    // scale into preview canvas
    pctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    pctx.imageSmoothingEnabled = false;
    const cw = previewCanvas.width, ch = previewCanvas.height;
    const ar = w / h;
    let dw = cw, dh = Math.round(cw / ar);
    if (dh > ch) { dh = ch; dw = Math.round(ch * ar); }
    const x = Math.round((cw - dw) / 2), y = Math.round((ch - dh) / 2);
    pctx.drawImage(tmp, 0, 0, w, h, x, y, dw, dh);
  }

  function floydSteinbergDither(gray, outBW, w, h, invert) {
    // gray: Float32Array 0..1 (copied)
    const g = new Float32Array(gray); // copy
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const old = g[idx];
        const newv = old < 0.5 ? 0 : 1;
        const draw = invert ? (newv === 1 ? 0 : 1) : (newv === 0 ? 1 : 0);
        outBW[idx] = draw ? 1 : 0;
        const err = old - newv;
        if (x + 1 < w) g[idx + 1] += err * 7 / 16;
        if (x - 1 >= 0 && y + 1 < h) g[idx + w - 1] += err * 3 / 16;
        if (y + 1 < h) g[idx + w] += err * 5 / 16;
        if (x + 1 < w && y + 1 < h) g[idx + w + 1] += err * 1 / 16;
      }
    }
  }

  function generateGcodeFromBW(bw, opts = {}) {
    const w = bw.w, h = bw.h;
    const mmPerPixel = opts.mmPerPixel || 0.5;
    const feed = opts.feed || 1200;
    const penUpCmd = opts.penUpCmd || 'G1 Z5.000';
    const penDownCmd = opts.penDownCmd || 'G1 Z0.000';
    const serpentine = !!opts.serpentine;
    const originAtTopLeft = !!opts.originAtTopLeft;

    const X = x => (x * mmPerPixel).toFixed(3);
    const Y = y => {
      // keep top-left origin (preview -> gcode)
      return (y * mmPerPixel).toFixed(3);
    };

    const lines = [];
    lines.push('; Generated by Image→G-code (raster)');
    lines.push(`; size px: ${w}x${h}`);
    lines.push('G21 ; units = mm');
    lines.push('G90 ; absolute coordinates');
    lines.push(`G0 Z5.000 F${feed} ; safe move`);
    lines.push('');

    // Start at origin 0,0
    lines.push(`G0 X0.000 Y0.000 F${feed}`);

    for (let y = 0; y < h; y++) {
      const leftToRight = !(serpentine && (y % 2 === 1));
      const start = leftToRight ? 0 : w - 1;
      const end = leftToRight ? w - 1 : 0;
      const step = leftToRight ? 1 : -1;

      let inRun = false;
      let runStart = 0;

      for (let xi = start; leftToRight ? xi <= end : xi >= end; xi += step) {
        const pixel = bw.data[y * w + xi] ? 1 : 0;
        if (pixel && !inRun) {
          inRun = true;
          runStart = xi;
        } else if ((!pixel && inRun) || (inRun && xi === end && pixel)) {
          // close run (if ended on black at last pixel, include it)
          const runEnd = (!pixel && inRun) ? xi - step : xi;
          const sx = X(runStart), sy = Y(y);
          const ex = X(runEnd), ey = Y(y);
          lines.push(`; row ${y} run ${runStart}-${runEnd}`);
          lines.push(`G0 X${sx} Y${sy} F${feed}`);
          lines.push(`${penDownCmd} ; pen down`);
          lines.push(`G1 X${ex} Y${ey} F${feed}`);
          lines.push(`${penUpCmd} ; pen up`);
          inRun = false;
        }
      }
    }

    lines.push('');
    lines.push(`G0 X0.000 Y0.000 F${feed}`);
    lines.push(`G0 Z5.000 F${feed}`);
    lines.push('; End of program');

    return lines.join('\n');
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
})();