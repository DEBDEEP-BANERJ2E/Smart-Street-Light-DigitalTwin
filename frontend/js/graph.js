// graph.js — SVG Node Graph with animated connection lines and drag support
const Graph = (() => {
  const CONNECTIONS = [
    { from: 'ldr',  to: 'led1', ledKey: 'led1' },
    { from: 'ldr',  to: 'led2', ledKey: 'led2' },
    { from: 'ir1',  to: 'led1', ledKey: 'led1' },
    { from: 'ir2',  to: 'led2', ledKey: 'led2' }
  ];

  const COLOR_ON  = '#00e5ff';
  const COLOR_OFF = '#333333';

  let svgEl, graphContainer;
  let lines = {};
  let flowDots = {};
  let currentControl = { led1: 0, led2: 0 };

  function getNodeCenter(nodeId) {
    const el = document.getElementById(`node-${nodeId}`);
    if (!el || !graphContainer) return { x: 0, y: 0 };
    const containerRect = graphContainer.getBoundingClientRect();
    const nodeRect = el.getBoundingClientRect();
    return {
      x: nodeRect.left - containerRect.left + nodeRect.width / 2,
      y: nodeRect.top  - containerRect.top  + nodeRect.height / 2
    };
  }

  function getLineColor(ledKey) {
    return currentControl[ledKey] === 1 ? COLOR_ON : COLOR_OFF;
  }

  function updateLines() {
    CONNECTIONS.forEach(conn => {
      const key = `${conn.from}-${conn.to}`;
      const line = lines[key];
      const dot  = flowDots[key];
      if (!line) return;

      const from = getNodeCenter(conn.from);
      const to   = getNodeCenter(conn.to);
      const color = getLineColor(conn.ledKey);
      const isOn  = currentControl[conn.ledKey] === 1;

      line.setAttribute('x1', from.x);
      line.setAttribute('y1', from.y);
      line.setAttribute('x2', to.x);
      line.setAttribute('y2', to.y);
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-opacity', isOn ? '0.8' : '0.3');

      if (dot) {
        dot.setAttribute('cx', from.x);
        dot.setAttribute('cy', from.y);
        dot.setAttribute('fill', color);
        dot.setAttribute('opacity', isOn ? '1' : '0');

        if (isOn && typeof gsap !== 'undefined') {
          gsap.killTweensOf(dot);
          gsap.to(dot, {
            attr: { cx: to.x, cy: to.y },
            duration: 1.5,
            ease: 'none',
            repeat: -1,
            onRepeat: () => {
              gsap.set(dot, { attr: { cx: from.x, cy: from.y } });
            }
          });
        } else if (typeof gsap !== 'undefined') {
          gsap.killTweensOf(dot);
        }
      }
    });
  }

  function createSVGElements() {
    svgEl.innerHTML = '';
    // Defs for glow filter
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <filter id="glow-line">
        <feGaussianBlur stdDeviation="2" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>`;
    svgEl.appendChild(defs);

    CONNECTIONS.forEach(conn => {
      const key = `${conn.from}-${conn.to}`;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('filter', 'url(#glow-line)');
      line.setAttribute('stroke-dasharray', '6 4');
      svgEl.appendChild(line);
      lines[key] = line;

      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('r', '4');
      svgEl.appendChild(dot);
      flowDots[key] = dot;
    });
  }

  // ── Drag support ──────────────────────────────────────────────────────────
  function makeDraggable(nodeId) {
    const el = document.getElementById(`node-${nodeId}`);
    if (!el) return;

    let dragging = false, startX, startY, origLeft, origTop;

    el.addEventListener('pointerdown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      origLeft = parseInt(el.style.left) || el.offsetLeft;
      origTop  = parseInt(el.style.top)  || el.offsetTop;
      el.setPointerCapture(e.pointerId);
      el.style.zIndex = 100;
      e.preventDefault();
    });

    el.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      el.style.left = (origLeft + dx) + 'px';
      el.style.top  = (origTop  + dy) + 'px';
      updateLines();
    });

    el.addEventListener('pointerup', e => {
      if (!dragging) return;
      dragging = false;
      el.style.zIndex = '';
      const x = parseInt(el.style.left);
      const y = parseInt(el.style.top);
      Store.setNodePosition(nodeId, x, y);
    });
  }

  function applyStoredPositions() {
    const positions = Store.getState().nodePositions;
    Object.entries(positions).forEach(([id, pos]) => {
      const el = document.getElementById(`node-${id}`);
      if (el) {
        el.style.left = pos.x + 'px';
        el.style.top  = pos.y + 'px';
      }
    });
  }

  function init() {
    graphContainer = document.getElementById('graph-container');
    svgEl = document.getElementById('graph-svg');
    if (!graphContainer || !svgEl) return;

    createSVGElements();
    applyStoredPositions();

    ['temp', 'hum', 'ldr', 'ir1', 'ir2', 'led1', 'led2'].forEach(makeDraggable);

    Store.subscribe('control', ({ control }) => {
      currentControl = { ...control };
      updateLines();
    });

    Store.subscribe('sensors', () => updateLines());

    window.addEventListener('resize', updateLines);
    setTimeout(updateLines, 100);
  }

  return { init, updateLines, getLineColor };
})();
