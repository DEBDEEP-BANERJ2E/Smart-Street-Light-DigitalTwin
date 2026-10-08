// charts.js — Chart.js wrappers with rolling 100-point buffers
const Charts = (() => {
  const MAX_POINTS = 100;
  let tempHumChart = null;
  let ldrChart = null;
  let irChart = null;
  let initialized = false;

  function formatTime(d) {
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { labels: { color: '#a0aec0', font: { family: 'Share Tech Mono' } } }
    },
    scales: {
      x: {
        ticks: { color: '#4a5568', maxTicksLimit: 8, font: { family: 'Share Tech Mono', size: 10 } },
        grid: { color: 'rgba(255,255,255,0.05)' }
      }
    }
  };

  function makeYAxis(label, color, position = 'left') {
    return {
      position,
      ticks: { color, font: { family: 'Share Tech Mono', size: 10 } },
      grid: { color: 'rgba(255,255,255,0.05)' },
      title: { display: true, text: label, color }
    };
  }

  function initCharts() {
    if (initialized) return;
    if (typeof Chart === 'undefined') return;

    const tempHumCtx = document.getElementById('chart-temphum');
    const ldrCtx     = document.getElementById('chart-ldr');
    const irCtx      = document.getElementById('chart-ir');
    if (!tempHumCtx || !ldrCtx || !irCtx) return;

    tempHumChart = new Chart(tempHumCtx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          { label: 'Temp (°C)', data: [], borderColor: '#ff6b6b', backgroundColor: 'rgba(255,107,107,0.1)', yAxisID: 'yTemp', tension: 0.3, pointRadius: 0 },
          { label: 'Hum (%)',   data: [], borderColor: '#4ecdc4', backgroundColor: 'rgba(78,205,196,0.1)',  yAxisID: 'yHum',  tension: 0.3, pointRadius: 0 }
        ]
      },
      options: {
        ...chartDefaults,
        scales: {
          x: chartDefaults.scales.x,
          yTemp: makeYAxis('°C', '#ff6b6b', 'left'),
          yHum:  makeYAxis('%',  '#4ecdc4', 'right')
        }
      }
    });

    ldrChart = new Chart(ldrCtx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          { label: 'LDR', data: [], borderColor: '#ffeb3b', backgroundColor: 'rgba(255,235,59,0.1)', tension: 0.3, pointRadius: 0 }
        ]
      },
      options: {
        ...chartDefaults,
        scales: {
          x: chartDefaults.scales.x,
          y: { ...makeYAxis('LDR (0-4095)', '#ffeb3b'), min: 0, max: 4095 }
        }
      }
    });

    irChart = new Chart(irCtx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          { label: 'IR1', data: [], borderColor: '#00e5ff', backgroundColor: 'rgba(0,229,255,0.1)', tension: 0, pointRadius: 0, stepped: true },
          { label: 'IR2', data: [], borderColor: '#7c4dff', backgroundColor: 'rgba(124,77,255,0.1)', tension: 0, pointRadius: 0, stepped: true }
        ]
      },
      options: {
        ...chartDefaults,
        scales: {
          x: chartDefaults.scales.x,
          y: { ...makeYAxis('Motion (0/1)', '#00e5ff'), min: -0.1, max: 1.1, ticks: { stepSize: 1, color: '#4a5568' } }
        }
      }
    });

    initialized = true;
  }

  function pushToBuffer(chart, datasetIndex, value) {
    const ds = chart.data.datasets[datasetIndex];
    ds.data.push(value);
    if (ds.data.length > MAX_POINTS) ds.data.shift();
  }

  function update(sensors, history) {
    initCharts();
    if (!initialized) return;

    const ts = formatTime(new Date());
    const labels = tempHumChart.data.labels;
    labels.push(ts);
    if (labels.length > MAX_POINTS) labels.shift();
    // Sync all charts to same labels
    ldrChart.data.labels = [...labels];
    irChart.data.labels  = [...labels];

    if (sensors.temp !== null && sensors.temp !== undefined) pushToBuffer(tempHumChart, 0, sensors.temp);
    if (sensors.hum  !== null && sensors.hum  !== undefined) pushToBuffer(tempHumChart, 1, sensors.hum);
    if (sensors.ldr  !== null && sensors.ldr  !== undefined) pushToBuffer(ldrChart, 0, sensors.ldr);
    if (sensors.ir1  !== null && sensors.ir1  !== undefined) pushToBuffer(irChart, 0, sensors.ir1);
    if (sensors.ir2  !== null && sensors.ir2  !== undefined) pushToBuffer(irChart, 1, sensors.ir2);

    tempHumChart.update('none');
    ldrChart.update('none');
    irChart.update('none');
  }

  function init() {
    Store.subscribe('sensors', ({ sensors, history }) => {
      update(sensors, history);
    });
  }

  return { init, formatTime };
})();
