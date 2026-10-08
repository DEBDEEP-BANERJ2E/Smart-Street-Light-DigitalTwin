// scene.js — Animated street scene driven by live + historical sensor data
const BASE = 'http://localhost:3000';
const POLL_MS = 2000;

// ── State ──────────────────────────────────────────────────────────────────
let state = {
  temp: null, hum: null, ldr: null, ir1: 0, ir2: 0,
  led1: 0, led2: 0
};

// ── DOM refs ───────────────────────────────────────────────────────────────
const sky      = document.getElementById('sky');
const stars    = document.getElementById('stars');
const sunMoon  = document.getElementById('sun-moon');
const fog      = document.getElementById('fog');
const envLabel = document.getElementById('env-label');
const rainCvs  = document.getElementById('rain-canvas');
const rainCtx  = rainCvs.getContext('2d');
const connDot  = document.getElementById('conn-dot');

// ── Stars generation ───────────────────────────────────────────────────────
(function generateStars() {
  let html = '';
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * 100;
    const y = Math.random() * 60;
    const s = Math.random() * 2 + 0.5;
    const d = Math.random() * 3;
    html += `<div style="position:absolute;left:${x}%;top:${y}%;width:${s}px;height:${s}px;
      border-radius:50%;background:#fff;opacity:${0.4 + Math.random()*0.6};
      animation:twinkle ${2+Math.random()*3}s ${d}s ease-in-out infinite alternate;"></div>`;
  }
  stars.innerHTML = html;
  const style = document.createElement('style');
  style.textContent = `@keyframes twinkle{from{opacity:0.2}to{opacity:1}}`;
  document.head.appendChild(style);
})();

// ── Rain ───────────────────────────────────────────────────────────────────
const rainDrops = Array.from({length: 120}, () => ({
  x: Math.random() * window.innerWidth,
  y: Math.random() * window.innerHeight,
  len: 10 + Math.random() * 20,
  speed: 8 + Math.random() * 12,
  alpha: 0.3 + Math.random() * 0.4
}));

let isRaining = false;

function resizeRain() {
  rainCvs.width  = window.innerWidth;
  rainCvs.height = window.innerHeight;
}
resizeRain();
window.addEventListener('resize', resizeRain);

function animateRain() {
  if (!isRaining) { requestAnimationFrame(animateRain); return; }
  rainCtx.clearRect(0, 0, rainCvs.width, rainCvs.height);
  rainCtx.strokeStyle = 'rgba(174,214,241,0.5)';
  rainCtx.lineWidth = 1;
  rainDrops.forEach(d => {
    rainCtx.beginPath();
    rainCtx.moveTo(d.x, d.y);
    rainCtx.lineTo(d.x - 2, d.y + d.len);
    rainCtx.globalAlpha = d.alpha;
    rainCtx.stroke();
    d.y += d.speed;
    if (d.y > rainCvs.height) { d.y = -d.len; d.x = Math.random() * rainCvs.width; }
  });
  rainCtx.globalAlpha = 1;
  requestAnimationFrame(animateRain);
}
animateRain();

// ── Vehicles ───────────────────────────────────────────────────────────────
const vehicles = [
  { el: document.getElementById('vehicle1'), x: -80, speed: 1.8, lane: 0, active: false, type: 'car' },
  { el: document.getElementById('vehicle2'), x: -60, speed: 0.9, lane: 1, active: false, type: 'person' },
  { el: document.getElementById('vehicle3'), x: -80, speed: 2.4, lane: 0, active: false, type: 'car' }
];

// IR zones (% of screen width where each light is)
const IR1_ZONE = { min: 0.15, max: 0.40 };
const IR2_ZONE = { min: 0.55, max: 0.80 };

let vehicleAnimId = null;

function spawnVehicle(irSensor) {
  // Find an inactive vehicle
  const v = vehicles.find(v => !v.active);
  if (!v) return;
  v.active = true;
  v.x = -100;
  v.speed = v.type === 'person' ? 0.7 + Math.random() * 0.5 : 1.5 + Math.random() * 1.5;
  v.el.style.display = 'block';
  v.el.style.transform = 'translateX(0)';
}

function animateVehicles() {
  const W = window.innerWidth;
  vehicles.forEach(v => {
    if (!v.active) return;
    v.x += v.speed;
    v.el.style.transform = `translateX(${v.x}px)`;
    if (v.x > W + 100) {
      v.active = false;
      v.el.style.display = 'none';
    }
  });
  vehicleAnimId = requestAnimationFrame(animateVehicles);
}
animateVehicles();

// Hide vehicles initially
vehicles.forEach(v => { v.el.style.display = 'none'; });

// ── Environment update ─────────────────────────────────────────────────────
function updateEnvironment(s) {
  const ldr = s.ldr;
  const hum = s.hum;
  const temp = s.temp;

  // Sky condition based on LDR
  sky.className = '';
  if (ldr === null) {
    sky.classList.add('night');
  } else if (ldr >= 2000) {
    sky.classList.add('day');
    sunMoon.classList.remove('moon');
    stars.classList.remove('visible');
    envLabel.textContent = 'DAY';
  } else if (ldr >= 1000) {
    sky.classList.add('dusk');
    sunMoon.classList.remove('moon');
    stars.classList.remove('visible');
    envLabel.textContent = 'DUSK / DAWN';
  } else if (ldr >= 500) {
    sky.classList.add('dim');
    sunMoon.classList.add('moon');
    stars.classList.add('visible');
    envLabel.textContent = 'DIM';
  } else {
    sky.classList.add('night');
    sunMoon.classList.add('moon');
    stars.classList.add('visible');
    envLabel.textContent = 'NIGHT';
  }

  // Rain when humidity > 80
  const shouldRain = hum !== null && hum > 80;
  isRaining = shouldRain;
  rainCvs.classList.toggle('raining', shouldRain);

  // Fog when humidity > 70
  fog.classList.toggle('humid', hum !== null && hum > 70);

  // Cloud opacity based on humidity
  document.querySelectorAll('.cloud').forEach(c => {
    c.style.opacity = hum !== null ? Math.min(hum / 100 * 1.5, 1) : 0.3;
  });
}

// ── LED / light update ─────────────────────────────────────────────────────
function updateLights(s) {
  // LED 1
  document.getElementById('lamp1').classList.toggle('on', s.led1 === 1);
  document.getElementById('halo1').classList.toggle('on', s.led1 === 1);
  document.getElementById('cone1').classList.toggle('on', s.led1 === 1);

  // LED 2
  document.getElementById('lamp2').classList.toggle('on', s.led2 === 1);
  document.getElementById('halo2').classList.toggle('on', s.led2 === 1);
  document.getElementById('cone2').classList.toggle('on', s.led2 === 1);
}

// ── IR / motion update ─────────────────────────────────────────────────────
let prevIr1 = 0, prevIr2 = 0;

function updateMotion(s) {
  const ir1Badge = document.getElementById('ir1-badge');
  const ir2Badge = document.getElementById('ir2-badge');

  ir1Badge.classList.toggle('active', s.ir1 === 1);
  ir2Badge.classList.toggle('active', s.ir2 === 1);
  ir1Badge.textContent = s.ir1 === 1 ? '⚡ IR1 MOTION' : 'IR1';
  ir2Badge.textContent = s.ir2 === 1 ? '⚡ IR2 MOTION' : 'IR2';

  // Spawn vehicle when IR transitions 0→1
  if (s.ir1 === 1 && prevIr1 === 0) spawnVehicle(1);
  if (s.ir2 === 1 && prevIr2 === 0) spawnVehicle(2);

  prevIr1 = s.ir1;
  prevIr2 = s.ir2;
}

// ── HUD update ─────────────────────────────────────────────────────────────
function updateHUD(s, ctrl) {
  const set = (id, val, unit = '') => {
    const el = document.getElementById(id);
    if (el) el.textContent = val !== null && val !== undefined ? (typeof val === 'number' ? val.toFixed(1) : val) + unit : '--';
  };

  set('hud-temp', s.temp, '');
  set('hud-hum',  s.hum,  '');
  set('hud-ldr',  s.ldr !== null ? Math.round(s.ldr) : null, '');

  const ldrCond = document.getElementById('hud-ldr-cond');
  if (ldrCond) ldrCond.textContent = s.ldr === null ? '--' : s.ldr < 500 ? 'NIGHT' : s.ldr < 2000 ? 'DIM' : 'DAY';

  const led1El = document.getElementById('hud-led1');
  const led2El = document.getElementById('hud-led2');
  if (led1El) { led1El.textContent = ctrl.led1 === 1 ? 'ON' : 'OFF'; led1El.className = 'hud-val' + (ctrl.led1 === 1 ? ' on' : ''); }
  if (led2El) { led2El.textContent = ctrl.led2 === 1 ? 'ON' : 'OFF'; led2El.className = 'hud-val' + (ctrl.led2 === 1 ? ' on' : ''); }

  const ir1El = document.getElementById('hud-ir1');
  const ir2El = document.getElementById('hud-ir2');
  if (ir1El) { ir1El.textContent = s.ir1 === 1 ? 'MOTION' : 'CLEAR'; ir1El.className = 'hud-val' + (s.ir1 === 1 ? ' motion' : ''); }
  if (ir2El) { ir2El.textContent = s.ir2 === 1 ? 'MOTION' : 'CLEAR'; ir2El.className = 'hud-val' + (s.ir2 === 1 ? ' motion' : ''); }
}

// ── Poll live data ─────────────────────────────────────────────────────────
async function poll() {
  try {
    const [dRes, cRes] = await Promise.all([
      fetch(`${BASE}/data`),
      fetch(`${BASE}/control`)
    ]);
    const sensors = await dRes.json();
    const ctrl    = await cRes.json();

    state = { ...state, ...sensors, led1: ctrl.led1, led2: ctrl.led2 };

    updateEnvironment(state);
    updateLights(state);
    updateMotion(state);
    updateHUD(sensors, ctrl);

    connDot.className = 'conn-dot conn-ok';
  } catch {
    connDot.className = 'conn-dot conn-err';
  }
}

poll();
setInterval(poll, POLL_MS);

// ── Load historical data from CSV via /history ─────────────────────────────
let histTempHum = null, histLdr = null, histIr = null;

function initHistoryCharts() {
  const opts = {
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { legend: { labels: { color: '#a0aec0', font: { family: 'Share Tech Mono', size: 10 } } } },
    scales: {
      x: { ticks: { color: '#4a5568', maxTicksLimit: 6, font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.04)' } }
    }
  };

  histTempHum = new Chart(document.getElementById('hist-temphum'), {
    type: 'line',
    data: { labels: [], datasets: [
      { label: 'Temp °C', data: [], borderColor: '#ff6b6b', backgroundColor: 'rgba(255,107,107,0.08)', tension: 0.3, pointRadius: 0, yAxisID: 'yT' },
      { label: 'Hum %',   data: [], borderColor: '#4ecdc4', backgroundColor: 'rgba(78,205,196,0.08)',  tension: 0.3, pointRadius: 0, yAxisID: 'yH' }
    ]},
    options: { ...opts, scales: { ...opts.scales,
      yT: { position: 'left',  ticks: { color: '#ff6b6b', font:{size:9} }, grid: { color: 'rgba(255,255,255,0.04)' } },
      yH: { position: 'right', ticks: { color: '#4ecdc4', font:{size:9} }, grid: { display: false } }
    }}
  });

  histLdr = new Chart(document.getElementById('hist-ldr'), {
    type: 'line',
    data: { labels: [], datasets: [
      { label: 'LDR', data: [], borderColor: '#ffeb3b', backgroundColor: 'rgba(255,235,59,0.08)', tension: 0.3, pointRadius: 0 }
    ]},
    options: { ...opts, scales: { ...opts.scales,
      y: { ticks: { color: '#ffeb3b', font:{size:9} }, grid: { color: 'rgba(255,255,255,0.04)' }, min: 0, max: 4095 }
    }}
  });

  histIr = new Chart(document.getElementById('hist-ir'), {
    type: 'line',
    data: { labels: [], datasets: [
      { label: 'IR1', data: [], borderColor: '#00e5ff', backgroundColor: 'rgba(0,229,255,0.08)', tension: 0, pointRadius: 0, stepped: true },
      { label: 'IR2', data: [], borderColor: '#7c4dff', backgroundColor: 'rgba(124,77,255,0.08)', tension: 0, pointRadius: 0, stepped: true }
    ]},
    options: { ...opts, scales: { ...opts.scales,
      y: { ticks: { color: '#00e5ff', font:{size:9}, stepSize:1 }, grid: { color: 'rgba(255,255,255,0.04)' }, min: -0.1, max: 1.1 }
    }}
  });
}

async function loadHistory() {
  try {
    const res = await fetch(`${BASE}/history?limit=200`);
    const rows = await res.json();
    if (!rows.length) return;

    const labels = rows.map(r => {
      const d = new Date(r.timestamp);
      return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
    });

    histTempHum.data.labels = labels;
    histTempHum.data.datasets[0].data = rows.map(r => r.temp);
    histTempHum.data.datasets[1].data = rows.map(r => r.hum);
    histTempHum.update('none');

    histLdr.data.labels = labels;
    histLdr.data.datasets[0].data = rows.map(r => r.ldr);
    histLdr.update('none');

    histIr.data.labels = labels;
    histIr.data.datasets[0].data = rows.map(r => r.ir1);
    histIr.data.datasets[1].data = rows.map(r => r.ir2);
    histIr.update('none');
  } catch (e) {
    console.warn('Could not load history:', e);
  }
}

// Also append live data to history charts
function appendLiveToHistory(sensors) {
  if (!histTempHum) return;
  const now = new Date();
  const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

  const push = (chart, ...vals) => {
    chart.data.labels.push(ts);
    if (chart.data.labels.length > 200) chart.data.labels.shift();
    vals.forEach((v, i) => {
      chart.data.datasets[i].data.push(v);
      if (chart.data.datasets[i].data.length > 200) chart.data.datasets[i].data.shift();
    });
    chart.update('none');
  };

  if (sensors.temp !== undefined) push(histTempHum, sensors.temp, sensors.hum);
  if (sensors.ldr  !== undefined) push(histLdr, sensors.ldr);
  if (sensors.ir1  !== undefined) push(histIr, sensors.ir1, sensors.ir2);
}

// Override poll to also update history charts
const _origPoll = poll;
async function pollWithHistory() {
  try {
    const [dRes, cRes] = await Promise.all([
      fetch(`${BASE}/data`),
      fetch(`${BASE}/control`)
    ]);
    const sensors = await dRes.json();
    const ctrl    = await cRes.json();

    state = { ...state, ...sensors, led1: ctrl.led1, led2: ctrl.led2 };

    updateEnvironment(state);
    updateLights(state);
    updateMotion(state);
    updateHUD(sensors, ctrl);
    appendLiveToHistory(sensors);

    connDot.className = 'conn-dot conn-ok';
  } catch {
    connDot.className = 'conn-dot conn-err';
  }
}

// Init
initHistoryCharts();
loadHistory();
// Replace interval with history-aware version
clearInterval(window._pollInterval);
window._pollInterval = setInterval(pollWithHistory, POLL_MS);
pollWithHistory();
