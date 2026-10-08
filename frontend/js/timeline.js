// timeline.js — Event log with LED/Motion/Alert filter toggles
const Timeline = (() => {
  let activeFilters = new Set(['LED', 'Motion', 'Alert']);

  function formatTs(isoStr) {
    try {
      return new Date(isoStr).toLocaleTimeString();
    } catch { return isoStr; }
  }

  function typeIcon(type) {
    if (type === 'LED')    return '💡';
    if (type === 'Motion') return '📡';
    return '⚠️';
  }

  function render(entries) {
    const list = document.getElementById('timeline-list');
    if (!list) return;

    const filtered = entries.filter(e => activeFilters.has(e.type));
    list.innerHTML = filtered.map(e => `
      <div class="timeline-entry timeline-${e.type.toLowerCase()}">
        <span class="tl-icon">${typeIcon(e.type)}</span>
        <span class="tl-ts">${formatTs(e.timestamp)}</span>
        <span class="tl-label">${e.label}</span>
      </div>`).join('');
  }

  function initFilters() {
    ['LED', 'Motion', 'Alert'].forEach(type => {
      const btn = document.getElementById(`filter-${type.toLowerCase()}`);
      if (!btn) return;
      btn.classList.add('active');
      btn.addEventListener('click', () => {
        if (activeFilters.has(type)) {
          activeFilters.delete(type);
          btn.classList.remove('active');
        } else {
          activeFilters.add(type);
          btn.classList.add('active');
        }
        render(Store.getState().timeline);
      });
    });
  }

  function init() {
    initFilters();
    Store.subscribe('timeline', entries => render(entries));
  }

  return { init };
})();
