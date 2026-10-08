// poller.js — Polls backend every 2000ms
const Poller = (() => {
  const POLL_INTERVAL = 2000;
  const BASE_URL = 'http://localhost:3000';

  async function poll() {
    try {
      const [dataRes, controlRes] = await Promise.all([
        fetch(`${BASE_URL}/data`),
        fetch(`${BASE_URL}/control`)
      ]);
      const sensors = await dataRes.json();
      const control = await controlRes.json();
      Store.update(sensors, control);
    } catch (err) {
      Store.setConnectionStatus('error');
    }
  }

  function start() {
    poll(); // immediate first poll
    setInterval(poll, POLL_INTERVAL);
  }

  return { start, poll };
})();
