// graph-page.js — Node graph, charts, heatmap, timeline, alerts
const BASE = 'http://localhost:3000';
const POLL_MS = 2000;

// ── Thresholds (localStorage) ──────────────────────────────────────────────
let thresholds = { temp:{high:40,low:0}, hum:{high:90,low:10}, ldr:{high:4000,low:0} };
let breachState = { temp:null, hum:null, ldr:null };
let timeline = [];
let alerts = [];
let prevControl = { led1:0, led2:0 };
let prevSensors = { ir1:0, ir2:0 };

try { const s = localStorage.getItem('slt_thresholds'); if(s) thresholds = JSON.parse(s); } catch{}

// ── Node positions ─────────────────────────────────────────────────────────
let nodePositions = {};
try { const s = localStorage.getItem('slt_node_positions'); if(s) nodePositions = JSON.parse(s); } catch{}

// ── Graph SVG connections ──────────────────────────────────────────────────
const CONNECTIONS = [
  {from:'ldr', to:'led1', ledKey:'led1'},
  {from:'ldr', to:'led2', ledKey:'led2'},
  {from:'ir1', to:'led1', ledKey:'led1'},
  {from:'ir2', to:'led2', ledKey:'led2'}
];
const COLOR_ON = '#00e5ff', COLOR_OFF = '#ffffff';
let svgLines = {}, svgDots = {}, currentControl = {led1:0,led2:0};

// ── Init SVG graph ─────────────────────────────────────────────────────────
function initGraph() {
  const svg = document.getElementById('graph-svg');
  const container = document.getElementById('graph-container');
  if (!svg || !container) return;

  svg.innerHTML = '';
  const defs = document.createElementNS('http://www.w3.org/2000/svg','defs');
  defs.innerHTML = `<filter id="glow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  svg.appendChild(defs);

  CONNECTIONS.forEach(conn => {
    const key = `${conn.from}-${conn.to}`;
    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('stroke-width','3');
    line.setAttribute('stroke-dasharray','8 5');
    svg.appendChild(line);
    svgLines[key] = line;

    const dot = document.createElementNS('http://www.w3.org/2000/svg','circle');
    dot.setAttribute('r','4');
    svg.appendChild(dot);
    svgDots[key] = dot;
  });

  // Apply saved positions
  Object.entries(nodePositions).forEach(([id, pos]) => {
    const el = document.getElementById(`node-${id}`);
    if (el) { el.style.left = pos.x+'px'; el.style.top = pos.y+'px'; }
  });

  // Drag
  ['temp','hum','ldr','ir1','ir2','led1','led2'].forEach(id => {
    const el = document.getElementById(`node-${id}`);
    if (!el) return;
    let dragging=false, sx,sy,ox,oy;
    el.addEventListener('pointerdown', e => {
      dragging=true; sx=e.clientX; sy=e.clientY;
      ox=parseInt(el.style.left)||el.offsetLeft; oy=parseInt(el.style.top)||el.offsetTop;
      el.setPointerCapture(e.pointerId); el.style.zIndex=100; e.preventDefault();
    });
    el.addEventListener('pointermove', e => {
      if(!dragging) return;
      el.style.left=(ox+e.clientX-sx)+'px'; el.style.top=(oy+e.clientY-sy)+'px';
      updateLines();
    });
    el.addEventListener('pointerup', () => {
      dragging=false; el.style.zIndex='';
      const x=parseInt(el.style.left), y=parseInt(el.style.top);
      nodePositions[id]={x,y};
      try{localStorage.setItem('slt_node_positions',JSON.stringify(nodePositions));}catch{}
    });
  });

  window.addEventListener('resize', updateLines);
  setTimeout(updateLines, 150);
}

function getCenter(nodeId) {
  const el = document.getElementById(`node-${nodeId}`);
  const container = document.getElementById('graph-container');
  if (!el || !container) return {x:0,y:0};
  const cr = container.getBoundingClientRect();
  const nr = el.getBoundingClientRect();
  return { x: nr.left-cr.left+nr.width/2, y: nr.top-cr.top+nr.height/2 };
}

function updateLines() {
  CONNECTIONS.forEach(conn => {
    const key = `${conn.from}-${conn.to}`;
    const line = svgLines[key], dot = svgDots[key];
    if (!line) return;
    const from = getCenter(conn.from), to = getCenter(conn.to);
    const isOn = currentControl[conn.ledKey] === 1;
    const color = isOn ? COLOR_ON : COLOR_OFF;
    line.setAttribute('x1',from.x); line.setAttribute('y1',from.y);
    line.setAttribute('x2',to.x);   line.setAttribute('y2',to.y);
    line.setAttribute('stroke',color);
    line.setAttribute('stroke-opacity', isOn ? '1' : '0.6');
    if (dot) {
      dot.setAttribute('fill',color);
      dot.setAttribute('opacity', isOn ? '1' : '0');
      if (isOn && typeof gsap !== 'undefined') {
        gsap.killTweensOf(dot);
        gsap.to(dot, { attr:{cx:to.x,cy:to.y}, duration:1.5, ease:'none', repeat:-1,
          onRepeat: () => gsap.set(dot, {attr:{cx:from.x,cy:from.y}}) });
        gsap.set(dot, {attr:{cx:from.x,cy:from.y}});
      } else if (typeof gsap !== 'undefined') {
        gsap.killTweensOf(dot);
        dot.setAttribute('cx',from.x); dot.setAttribute('cy',from.y);
      }
    }
  });
}

// ── Charts ─────────────────────────────────────────────────────────────────
const MAX_PTS = 100;
let liveCharts = {};

function fmt(d) {
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

const baseOpts = {
  responsive:true, maintainAspectRatio:false, animation:false,
  plugins:{ legend:{ labels:{ color:'#a0aec0', font:{family:'Share Tech Mono',size:10} } } },
  scales:{ x:{ ticks:{color:'#4a5568',maxTicksLimit:6,font:{size:9}}, grid:{color:'rgba(255,255,255,0.04)'} } }
};

function initLiveCharts() {
  liveCharts.tempHum = new Chart(document.getElementById('chart-temphum'), {
    type:'line', data:{ labels:[], datasets:[
      {label:'Temp °C',data:[],borderColor:'#ff6b6b',backgroundColor:'rgba(255,107,107,0.08)',tension:0.3,pointRadius:0,yAxisID:'yT'},
      {label:'Hum %',  data:[],borderColor:'#4ecdc4',backgroundColor:'rgba(78,205,196,0.08)', tension:0.3,pointRadius:0,yAxisID:'yH'}
    ]},
    options:{...baseOpts, scales:{...baseOpts.scales,
      yT:{position:'left', ticks:{color:'#ff6b6b',font:{size:9}}, grid:{color:'rgba(255,255,255,0.04)'}},
      yH:{position:'right',ticks:{color:'#4ecdc4',font:{size:9}}, grid:{display:false}}
    }}
  });

  liveCharts.ldr = new Chart(document.getElementById('chart-ldr'), {
    type:'line', data:{ labels:[], datasets:[
      {label:'LDR',data:[],borderColor:'#ffeb3b',backgroundColor:'rgba(255,235,59,0.08)',tension:0.3,pointRadius:0}
    ]},
    options:{...baseOpts, scales:{...baseOpts.scales,
      y:{ticks:{color:'#ffeb3b',font:{size:9}}, grid:{color:'rgba(255,255,255,0.04)'}, min:0, max:4095}
    }}
  });

  liveCharts.ir = new Chart(document.getElementById('chart-ir'), {
    type:'line', data:{ labels:[], datasets:[
      {label:'IR1',data:[],borderColor:'#00e5ff',backgroundColor:'rgba(0,229,255,0.08)',tension:0,pointRadius:0,stepped:true},
      {label:'IR2',data:[],borderColor:'#7c4dff',backgroundColor:'rgba(124,77,255,0.08)',tension:0,pointRadius:0,stepped:true}
    ]},
    options:{...baseOpts, scales:{...baseOpts.scales,
      y:{ticks:{color:'#00e5ff',font:{size:9},stepSize:1}, grid:{color:'rgba(255,255,255,0.04)'}, min:-0.1, max:1.1}
    }}
  });
}

function pushLive(sensors) {
  const ts = fmt(new Date());
  const push = (chart, ...vals) => {
    chart.data.labels.push(ts);
    if (chart.data.labels.length > MAX_PTS) chart.data.labels.shift();
    vals.forEach((v,i) => {
      chart.data.datasets[i].data.push(v);
      if (chart.data.datasets[i].data.length > MAX_PTS) chart.data.datasets[i].data.shift();
    });
    chart.update('none');
  };
  if (sensors.temp != null) push(liveCharts.tempHum, sensors.temp, sensors.hum);
  if (sensors.ldr  != null) push(liveCharts.ldr, sensors.ldr);
  if (sensors.ir1  != null) push(liveCharts.ir, sensors.ir1, sensors.ir2);
}

// ── History charts ─────────────────────────────────────────────────────────
let histCharts = {};

function initHistoryCharts() {
  histCharts.tempHum = new Chart(document.getElementById('hist-temphum'), {
    type:'line', data:{ labels:[], datasets:[
      {label:'Temp °C',data:[],borderColor:'#ff6b6b',backgroundColor:'rgba(255,107,107,0.06)',tension:0.3,pointRadius:0,yAxisID:'yT'},
      {label:'Hum %',  data:[],borderColor:'#4ecdc4',backgroundColor:'rgba(78,205,196,0.06)', tension:0.3,pointRadius:0,yAxisID:'yH'}
    ]},
    options:{...baseOpts, scales:{...baseOpts.scales,
      yT:{position:'left', ticks:{color:'#ff6b6b',font:{size:9}}, grid:{color:'rgba(255,255,255,0.04)'}},
      yH:{position:'right',ticks:{color:'#4ecdc4',font:{size:9}}, grid:{display:false}}
    }}
  });
  histCharts.ldr = new Chart(document.getElementById('hist-ldr'), {
    type:'line', data:{ labels:[], datasets:[
      {label:'LDR',data:[],borderColor:'#ffeb3b',backgroundColor:'rgba(255,235,59,0.06)',tension:0.3,pointRadius:0}
    ]},
    options:{...baseOpts, scales:{...baseOpts.scales,
      y:{ticks:{color:'#ffeb3b',font:{size:9}}, grid:{color:'rgba(255,255,255,0.04)'}, min:0, max:4095}
    }}
  });
  histCharts.ir = new Chart(document.getElementById('hist-ir'), {
    type:'line', data:{ labels:[], datasets:[
      {label:'IR1',data:[],borderColor:'#00e5ff',backgroundColor:'rgba(0,229,255,0.06)',tension:0,pointRadius:0,stepped:true},
      {label:'IR2',data:[],borderColor:'#7c4dff',backgroundColor:'rgba(124,77,255,0.06)',tension:0,pointRadius:0,stepped:true}
    ]},
    options:{...baseOpts, scales:{...baseOpts.scales,
      y:{ticks:{color:'#00e5ff',font:{size:9},stepSize:1}, grid:{color:'rgba(255,255,255,0.04)'}, min:-0.1, max:1.1}
    }}
  });
}

async function loadHistory() {
  try {
    const res = await fetch(`${BASE}/history?limit=500`);
    const rows = await res.json();
    if (!rows.length) return;
    const labels = rows.map(r => { const d=new Date(r.timestamp); return fmt(d); });
    histCharts.tempHum.data.labels = labels;
    histCharts.tempHum.data.datasets[0].data = rows.map(r=>r.temp);
    histCharts.tempHum.data.datasets[1].data = rows.map(r=>r.hum);
    histCharts.tempHum.update('none');
    histCharts.ldr.data.labels = labels;
    histCharts.ldr.data.datasets[0].data = rows.map(r=>r.ldr);
    histCharts.ldr.update('none');
    histCharts.ir.data.labels = labels;
    histCharts.ir.data.datasets[0].data = rows.map(r=>r.ir1);
    histCharts.ir.data.datasets[1].data = rows.map(r=>r.ir2);
    histCharts.ir.update('none');
  } catch(e) { console.warn('History load failed:', e); }
}

// ── Heatmap ────────────────────────────────────────────────────────────────
const COLS=60, ROWS=5;
const C_LOW={r:13,g:27,b:75}, C_HIGH={r:255,g:235,b:59};
let heatBuf=[], heatCtx, heatCanvas;

function lerpColor(t) {
  return `rgb(${Math.round(C_LOW.r+(C_HIGH.r-C_LOW.r)*t)},${Math.round(C_LOW.g+(C_HIGH.g-C_LOW.g)*t)},${Math.round(C_LOW.b+(C_HIGH.b-C_LOW.b)*t)})`;
}

function drawHeatmap() {
  if (!heatCtx) return;
  const w=heatCanvas.width, h=heatCanvas.height;
  const cw=w/COLS, ch=h/ROWS;
  heatCtx.clearRect(0,0,w,h);
  heatBuf.forEach((ldr,col) => {
    const t = Math.min(Math.max(ldr/4095,0),1);
    for (let row=0;row<ROWS;row++) {
      const bandIdx=ROWS-1-row;
      const bands=[[0,499],[500,999],[1000,1499],[1500,1999],[2000,4095]];
      const [bmin,bmax]=bands[bandIdx];
      const mid=(bmin+bmax)/2;
      const activity=Math.max(0,1-Math.abs(ldr-mid)/((bmax-bmin)/2+500));
      heatCtx.fillStyle=lerpColor(t*activity);
      heatCtx.fillRect(col*cw,row*ch,cw-1,ch-1);
    }
  });
  for (let col=heatBuf.length;col<COLS;col++) {
    heatCtx.fillStyle='rgba(13,13,26,0.8)';
    heatCtx.fillRect(col*cw,0,cw-1,h);
  }
}

function initHeatmap() {
  heatCanvas = document.getElementById('heatmap-canvas');
  if (!heatCanvas) return;
  heatCtx = heatCanvas.getContext('2d');
  const lc = document.getElementById('heatmap-legend');
  if (lc) {
    const lctx=lc.getContext('2d'), w=lc.width, h=lc.height;
    const g=lctx.createLinearGradient(0,0,w,0);
    g.addColorStop(0,`rgb(${C_LOW.r},${C_LOW.g},${C_LOW.b})`);
    g.addColorStop(1,`rgb(${C_HIGH.r},${C_HIGH.g},${C_HIGH.b})`);
    lctx.fillStyle=g; lctx.fillRect(0,0,w,h*0.6);
    lctx.fillStyle='#a0aec0'; lctx.font='9px Share Tech Mono,monospace';
    lctx.textAlign='left';   lctx.fillText('0',2,h-2);
    lctx.textAlign='center'; lctx.fillText('2048',w/2,h-2);
    lctx.textAlign='right';  lctx.fillText('4095',w-2,h-2);
  }
}

// ── Timeline ───────────────────────────────────────────────────────────────
let activeFilters = new Set(['LED','Motion','Alert']);

function addTimelineEntry(type, label) {
  timeline.unshift({ id:Date.now()+'_'+Math.random(), timestamp:new Date().toISOString(), type, label });
  if (timeline.length > 200) timeline.pop();
  renderTimeline();
}

function renderTimeline() {
  const list = document.getElementById('timeline-list');
  if (!list) return;
  const icons = {LED:'💡',Motion:'📡',Alert:'⚠️'};
  const filtered = timeline.filter(e => activeFilters.has(e.type));
  list.innerHTML = filtered.length ? filtered.map(e => `
    <div class="timeline-entry">
      <span class="tl-icon">${icons[e.type]||'•'}</span>
      <span class="tl-ts">${new Date(e.timestamp).toLocaleTimeString()}</span>
      <span class="tl-label">${e.label}</span>
    </div>`).join('') : '<div class="empty-msg">No events yet</div>';
}

function initTimeline() {
  ['LED','Motion','Alert'].forEach(type => {
    const btn = document.getElementById(`filter-${type.toLowerCase()}`);
    if (!btn) return;
    btn.addEventListener('click', () => {
      activeFilters.has(type) ? activeFilters.delete(type) : activeFilters.add(type);
      btn.classList.toggle('active', activeFilters.has(type));
      renderTimeline();
    });
  });
}

// ── Alerts ─────────────────────────────────────────────────────────────────
function checkAlerts(sensors) {
  ['temp','hum','ldr'].forEach(sensor => {
    const val = sensors[sensor];
    if (val == null) return;
    const th = thresholds[sensor];
    if (!th) return;
    if (val > th.high && breachState[sensor] !== 'high') {
      breachState[sensor] = 'high';
      fireAlert(sensor, val, 'HIGH', th.high);
    } else if (val < th.low && breachState[sensor] !== 'low') {
      breachState[sensor] = 'low';
      fireAlert(sensor, val, 'LOW', th.low);
    } else if (val >= th.low && val <= th.high) {
      breachState[sensor] = null;
    }
  });
}

function fireAlert(sensor, value, direction, threshold) {
  const entry = { id:`${sensor}_${Date.now()}`, timestamp:new Date().toISOString(), sensor, value, direction, threshold };
  alerts.unshift(entry);
  if (alerts.length > 50) alerts.pop();
  renderAlertLog();
  showToast(entry);
  addTimelineEntry('Alert', `${sensor.toUpperCase()} ${direction}: ${typeof value==='number'?value.toFixed(1):value} (th:${threshold})`);
}

function renderAlertLog() {
  const log = document.getElementById('alert-log');
  if (!log) return;
  log.innerHTML = alerts.length ? alerts.map(a => `
    <div class="alert-entry alert-${a.direction.toLowerCase()}">
      <span class="alert-ts">${new Date(a.timestamp).toLocaleTimeString()}</span>
      <span class="alert-sensor">${a.sensor.toUpperCase()}</span>
      <span class="alert-dir">${a.direction}</span>
      <span class="alert-val">${typeof a.value==='number'?a.value.toFixed(1):a.value}</span>
    </div>`).join('') : '<div class="empty-msg">No alerts yet</div>';
}

function showToast(alert) {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast toast-${alert.direction.toLowerCase()}`;
  t.innerHTML = `<span>${alert.direction==='HIGH'?'🔴':'🔵'}</span>
    <span><strong>${alert.sensor.toUpperCase()}</strong> ${alert.direction}: ${typeof alert.value==='number'?alert.value.toFixed(1):alert.value} (th:${alert.threshold})</span>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

// ── UI update ──────────────────────────────────────────────────────────────
function pulse(el) {
  if (!el) return;
  el.classList.add('pulse-update');
  setTimeout(() => el.classList.remove('pulse-update'), 800);
}

function setText(id, text) { const el=document.getElementById(id); if(el) el.textContent=text; }

function updateNodes(sensors, ctrl) {
  // Temp
  const tv = document.getElementById('temp-value');
  if (tv) { const t=sensors.temp!=null?`${parseFloat(sensors.temp).toFixed(1)}`:'--'; if(tv.textContent!==t){tv.textContent=t;pulse(tv.closest('.node-card'));} }

  // Hum
  const hv = document.getElementById('hum-value');
  if (hv) { const t=sensors.hum!=null?`${parseFloat(sensors.hum).toFixed(1)}`:'--'; if(hv.textContent!==t){hv.textContent=t;pulse(hv.closest('.node-card'));} }

  // LDR
  const lv = document.getElementById('ldr-value');
  const ll = document.getElementById('ldr-label');
  if (lv) { const t=sensors.ldr!=null?String(Math.round(sensors.ldr)):'--'; if(lv.textContent!==t){lv.textContent=t;pulse(lv.closest('.node-card'));} }
  if (ll) { const dark=sensors.ldr!=null&&sensors.ldr<2000; ll.textContent=sensors.ldr!=null?(dark?'DARK':'BRIGHT'):'--'; ll.className='ldr-badge '+(dark?'dark':'bright'); }

  // IR1
  const i1 = document.getElementById('ir1-value');
  if (i1) { const t=sensors.ir1===1?'MOTION':'CLEAR'; i1.textContent=t; i1.className='ir-state '+(sensors.ir1===1?'motion':'clear'); }

  // IR2
  const i2 = document.getElementById('ir2-value');
  if (i2) { const t=sensors.ir2===1?'MOTION':'CLEAR'; i2.textContent=t; i2.className='ir-state '+(sensors.ir2===1?'motion':'clear'); }

  // LEDs
  ['led1','led2'].forEach(k => {
    const card = document.getElementById(`node-${k}`);
    const label = document.getElementById(`${k}-label`);
    if (!card||!label) return;
    const isOn = ctrl[k]===1;
    label.textContent = isOn?'ON':'OFF';
    card.classList.toggle('led-on', isOn);
    card.classList.toggle('led-off', !isOn);
  });

  // Motion indicators
  ['ir1','ir2'].forEach(k => {
    const ind = document.getElementById(`${k}-indicator`);
    const st  = document.getElementById(`${k}-state`);
    if (!ind) return;
    const active = sensors[k]===1;
    ind.classList.toggle('motion-active', active);
    ind.classList.toggle('motion-inactive', !active);
    if (st) st.textContent = active?'MOTION':'CLEAR';
  });

  // Env panels
  const hi = sensors.temp!=null&&sensors.hum!=null ? parseFloat((sensors.temp+0.33*sensors.hum-4).toFixed(1)) : null;
  setText('env-temp', sensors.temp!=null?`${parseFloat(sensors.temp).toFixed(1)}°C`:'--');
  setText('env-hum',  sensors.hum!=null?`${parseFloat(sensors.hum).toFixed(1)}%`:'--');
  setText('env-hi',   hi!=null?`${hi}°C`:'--');

  const bright = sensors.ldr!=null ? parseFloat((Math.min(sensors.ldr/4095*100,100)).toFixed(1)) : null;
  const cond = sensors.ldr==null?'--':sensors.ldr<500?'🌙 NIGHT':sensors.ldr<2000?'🌤 DIM':'☀️ DAY';
  setText('light-ldr',    sensors.ldr!=null?String(Math.round(sensors.ldr)):'--');
  setText('light-bright', bright!=null?`${bright}%`:'--');
  setText('light-cond',   cond);

  const ledCount = (ctrl.led1===1?1:0)+(ctrl.led2===1?1:0);
  const motCount = (sensors.ir1===1?1:0)+(sensors.ir2===1?1:0);
  setText('status-leds',   `${ledCount} / 2`);
  setText('status-motion', `${motCount} sensor${motCount!==1?'s':''}`);
  setText('status-ts',     new Date().toLocaleTimeString());

  // Timeline events
  ['led1','led2'].forEach(k => {
    if (prevControl[k]!==ctrl[k]) addTimelineEntry('LED',`${k.toUpperCase()} turned ${ctrl[k]===1?'ON':'OFF'}`);
  });
  ['ir1','ir2'].forEach(k => {
    if (prevSensors[k]!==sensors[k]&&sensors[k]!=null) addTimelineEntry('Motion',`${k.toUpperCase()} ${sensors[k]===1?'MOTION detected':'CLEAR'}`);
  });

  prevControl = {...ctrl};
  prevSensors = {...sensors};
}

// ── Settings ───────────────────────────────────────────────────────────────
function initSettings() {
  const panel = document.getElementById('settings-panel');
  document.getElementById('settings-open')?.addEventListener('click', () => { panel.classList.add('open'); loadSettingsForm(); });
  document.getElementById('settings-close')?.addEventListener('click', () => panel.classList.remove('open'));
  document.getElementById('settings-save')?.addEventListener('click', () => {
    const g = id => { const el=document.getElementById(id); return el?parseFloat(el.value):null; };
    thresholds = { temp:{high:g('th-temp-high'),low:g('th-temp-low')}, hum:{high:g('th-hum-high'),low:g('th-hum-low')}, ldr:{high:g('th-ldr-high'),low:g('th-ldr-low')} };
    try{localStorage.setItem('slt_thresholds',JSON.stringify(thresholds));}catch{}
    panel.classList.remove('open');
  });
  panel?.addEventListener('click', e => { if(e.target===panel) panel.classList.remove('open'); });
}

function loadSettingsForm() {
  const s = (id,v) => { const el=document.getElementById(id); if(el) el.value=v; };
  s('th-temp-high',thresholds.temp.high); s('th-temp-low',thresholds.temp.low);
  s('th-hum-high', thresholds.hum.high);  s('th-hum-low', thresholds.hum.low);
  s('th-ldr-high', thresholds.ldr.high);  s('th-ldr-low', thresholds.ldr.low);
}

// ── Poll ───────────────────────────────────────────────────────────────────
async function poll() {
  try {
    const [dRes,cRes] = await Promise.all([fetch(`${BASE}/data`),fetch(`${BASE}/control`)]);
    const sensors = await dRes.json();
    const ctrl    = await cRes.json();

    currentControl = {...ctrl};
    updateNodes(sensors, ctrl);
    updateLines();
    pushLive(sensors);
    checkAlerts(sensors);

    if (sensors.ldr!=null) {
      heatBuf.push(sensors.ldr);
      if (heatBuf.length>COLS) heatBuf.shift();
      drawHeatmap();
    }

    document.getElementById('conn-dot').className = 'conn-dot conn-ok';
  } catch {
    document.getElementById('conn-dot').className = 'conn-dot conn-err';
  }
}

// ── Boot ───────────────────────────────────────────────────────────────────
initGraph();
initLiveCharts();
initHistoryCharts();
initHeatmap();
initTimeline();
initSettings();
loadHistory();
poll();
setInterval(poll, POLL_MS);
