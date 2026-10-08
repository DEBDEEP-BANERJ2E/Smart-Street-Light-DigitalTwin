// settings.js — Slide-out settings panel for threshold configuration
const Settings = (() => {
  const STORAGE_KEY = 'slt_thresholds';

  function getInputVal(id) {
    const el = document.getElementById(id);
    return el ? parseFloat(el.value) : null;
  }

  function setInputVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  function loadIntoForm(thresholds) {
    setInputVal('th-temp-high', thresholds.temp.high);
    setInputVal('th-temp-low',  thresholds.temp.low);
    setInputVal('th-hum-high',  thresholds.hum.high);
    setInputVal('th-hum-low',   thresholds.hum.low);
    setInputVal('th-ldr-high',  thresholds.ldr.high);
    setInputVal('th-ldr-low',   thresholds.ldr.low);
  }

  function saveFromForm() {
    const thresholds = {
      temp: { high: getInputVal('th-temp-high'), low: getInputVal('th-temp-low') },
      hum:  { high: getInputVal('th-hum-high'),  low: getInputVal('th-hum-low')  },
      ldr:  { high: getInputVal('th-ldr-high'),  low: getInputVal('th-ldr-low')  }
    };
    Store.setThresholds(thresholds);
    closePanel();
  }

  function openPanel() {
    const panel = document.getElementById('settings-panel');
    if (panel) panel.classList.add('open');
  }

  function closePanel() {
    const panel = document.getElementById('settings-panel');
    if (panel) panel.classList.remove('open');
  }

  function init() {
    const state = Store.getState();
    loadIntoForm(state.thresholds);

    const openBtn  = document.getElementById('settings-open');
    const closeBtn = document.getElementById('settings-close');
    const saveBtn  = document.getElementById('settings-save');

    if (openBtn)  openBtn.addEventListener('click', openPanel);
    if (closeBtn) closeBtn.addEventListener('click', closePanel);
    if (saveBtn)  saveBtn.addEventListener('click', saveFromForm);

    // Close on backdrop click
    const panel = document.getElementById('settings-panel');
    if (panel) {
      panel.addEventListener('click', e => {
        if (e.target === panel) closePanel();
      });
    }
  }

  return { init };
})();
