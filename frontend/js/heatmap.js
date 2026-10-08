// heatmap.js — Canvas 2D LDR heatmap (60×5 grid)
const Heatmap = (() => {
  const COLS = 60;
  const ROWS = 5;
  const BANDS = [
    { min: 0,    max: 499,  label: '0-499' },
    { min: 500,  max: 999,  label: '500-999' },
    { min: 1000, max: 1499, label: '1000-1499' },
    { min: 1500, max: 1999, label: '1500-1999' },
    { min: 2000, max: 4095, label: '2000+' }
  ];

  // Color: dark blue (#0d1b4b) → bright yellow (#ffeb3b)
  const COLOR_LOW  = { r: 13,  g: 27,  b: 75  };
  const COLOR_HIGH = { r: 255, g: 235, b: 59  };

  let canvas, ctx;
  let buffer = []; // rolling 60-point LDR buffer

  function lerpColor(t) {
    const r = Math.round(COLOR_LOW.r + (COLOR_HIGH.r - COLOR_LOW.r) * t);
    const g = Math.round(COLOR_LOW.g + (COLOR_HIGH.g - COLOR_LOW.g) * t);
    const b = Math.round(COLOR_LOW.b + (COLOR_HIGH.b - COLOR_LOW.b) * t);
    return `rgb(${r},${g},${b})`;
  }

  function ldrToT(ldr) {
    return Math.min(Math.max(ldr / 4095, 0), 1);
  }

  function getBandActivity(ldr, bandIndex) {
    const band = BANDS[bandIndex];
    if (ldr >= band.min && ldr <= band.max) return 1;
    // Partial glow for adjacent bands
    const mid = (band.min + band.max) / 2;
    const dist = Math.abs(ldr - mid);
    const range = (band.max - band.min) / 2 + 500;
    return Math.max(0, 1 - dist / range);
  }

  function draw() {
    if (!canvas || !ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const cellW = w / COLS;
    const cellH = h / ROWS;

    ctx.clearRect(0, 0, w, h);

    for (let col = 0; col < buffer.length; col++) {
      const ldr = buffer[col];
      const t = ldrToT(ldr);

      for (let row = 0; row < ROWS; row++) {
        // Row 0 = highest band (2000+), row 4 = lowest (0-499)
        const bandIdx = ROWS - 1 - row;
        const activity = getBandActivity(ldr, bandIdx);
        const cellT = t * activity;
        ctx.fillStyle = lerpColor(cellT);
        ctx.fillRect(col * cellW, row * cellH, cellW - 1, cellH - 1);
      }
    }

    // Fill empty columns with background
    for (let col = buffer.length; col < COLS; col++) {
      ctx.fillStyle = 'rgba(13,13,26,0.8)';
      ctx.fillRect(col * cellW, 0, cellW - 1, h);
    }
  }

  function drawLegend() {
    const legendCanvas = document.getElementById('heatmap-legend');
    if (!legendCanvas) return;
    const lctx = legendCanvas.getContext('2d');
    const w = legendCanvas.width;
    const h = legendCanvas.height;

    const grad = lctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0,   `rgb(${COLOR_LOW.r},${COLOR_LOW.g},${COLOR_LOW.b})`);
    grad.addColorStop(1,   `rgb(${COLOR_HIGH.r},${COLOR_HIGH.g},${COLOR_HIGH.b})`);
    lctx.fillStyle = grad;
    lctx.fillRect(0, 0, w, h * 0.6);

    lctx.fillStyle = '#a0aec0';
    lctx.font = '10px Share Tech Mono, monospace';
    lctx.textAlign = 'left';
    lctx.fillText('0', 2, h - 2);
    lctx.textAlign = 'center';
    lctx.fillText('2048', w / 2, h - 2);
    lctx.textAlign = 'right';
    lctx.fillText('4095', w - 2, h - 2);
  }

  function init() {
    canvas = document.getElementById('heatmap-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    drawLegend();

    Store.subscribe('sensors', ({ sensors }) => {
      if (sensors.ldr !== null && sensors.ldr !== undefined) {
        buffer.push(sensors.ldr);
        if (buffer.length > COLS) buffer.shift();
      }
      draw();
    });
  }

  return { init, lerpColor, ldrToT };
})();
