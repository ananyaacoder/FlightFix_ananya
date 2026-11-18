const API_BASE = (window.location.protocol.startsWith('http') && window.location.port !== '')
  ? `${window.location.origin}/api`
  : 'http://localhost:8000/api';

const API = {

  async loadBackendState() {
    try {
      const res = await fetch(`${API_BASE}/sync`);
      if (!res.ok) throw new Error('Backend offline');
      const data = await res.json();
      if (data.success && data.state) {
        window.S = { ...window.S, ...data.state };
        console.log('[FlightFix] Synchronized state with Backend.');
        return true;
      }
    } catch (e) {
      console.warn('[FlightFix] Backend not reachable. Operating in local mode.');
    }
    return false;
  },


  async syncBackendState() {
    try {
      if (!window.S) return;
      await fetch(`${API_BASE}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(window.S)
      });
    } catch (e) {
     
    }
  },

  async getTelemetry(aircraftId) {
    try {
      const res = await fetch(`${API_BASE}/aircraft/${aircraftId}/telemetry`);
      const data = await res.json();
      return data.data;
    } catch (e) {
      return null;
    }
  }
};

window.addEventListener('DOMContentLoaded', () => {
  API.loadBackendState().then(() => {
    if (typeof render === 'function') {
      render();
    } else if (typeof rHome === 'function') {
      rHome();
    } else if (typeof renderHome === 'function') {
      renderHome();
    }
  });
});

window.API = API;
