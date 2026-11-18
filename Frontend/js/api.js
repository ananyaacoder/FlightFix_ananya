// FlightFix MRO API Client & Synchronizer
const API_BASE = window.location.protocol.startsWith('http')
  ? `${window.location.origin}/api`
  : 'http://127.0.0.1:8000/api';

let _syncDebounceTimer = null;
let _isSyncing = false;

const API = {
  /**
   * Fetch full state from backend on startup or reconnect
   */
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

  /**
   * Debounced synchronization to backend to optimize network throughput
   */
  syncBackendState() {
    clearTimeout(_syncDebounceTimer);
    _syncDebounceTimer = setTimeout(async () => {
      if (_isSyncing || !window.S) return;
      _isSyncing = true;
      try {
        await fetch(`${API_BASE}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(window.S)
        });
      } catch (e) {
        // Fallback silently in offline mode
      } finally {
        _isSyncing = false;
      }
    }, 250);
  },

  /**
   * Fetch live aircraft telemetry sensor readings
   */
  async getTelemetry(aircraftId) {
    try {
      const res = await fetch(`${API_BASE}/aircraft/${encodeURIComponent(aircraftId)}/telemetry`);
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
