/**
 * Controller for SOC Fraud Detection Operations Center View.
 */
function renderAdminFraud() {
  const content = document.getElementById('content-area');
  const store = window.appStore.state;

  content.innerHTML = `
    <div class="animate-page-enter">
      
      <div class="soc-dark-panel">
        
        <div class="soc-title-section">
          <div>
            <h3 style="font-size: var(--text-xl); margin-bottom: 2px;">Threat Mitigation Command</h3>
            <span style="color: var(--text-tertiary); font-size: var(--text-xs);">Cybersecurity & Fraud Prevention Operations Dashboard</span>
          </div>
          <div class="soc-live-ticker">
            <span class="live-indicator">LIVE MONITOR ACTIVATED</span>
          </div>
        </div>

        <!-- SOC Top row threat score display -->
        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: var(--space-6); margin-bottom: var(--space-8); align-items: center; flex-wrap: wrap;">
          
          <div class="soc-threat-score-card">
            <span style="font-size: var(--text-xs); color: #94A3B8; text-transform: uppercase;">Active Threat Score</span>
            <div class="soc-threat-score">34</div>
            <span class="badge badge-warning">Medium Risk Level</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: var(--space-4);">
            <h4 style="font-size: var(--text-base); border-bottom: 1px solid #1E293B; padding-bottom: var(--space-2);">Real-Time Signals Tracked</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
              <div style="border: 1px solid #1E293B; padding: var(--space-3); border-radius: var(--radius-md);">
                <span style="font-size: 10px; color: #94A3B8; display: block; margin-bottom: 2px;">Duplicate Registers</span>
                <span style="font-size: var(--text-lg); font-weight: bold; color: var(--color-success);">0 Flagged</span>
              </div>
              <div style="border: 1px solid #1E293B; padding: var(--space-3); border-radius: var(--radius-md);">
                <span style="font-size: 10px; color: #94A3B8; display: block; margin-bottom: 2px;">Multiple Login Tries</span>
                <span style="font-size: var(--text-lg); font-weight: bold; color: var(--color-warning);">4 Queries</span>
              </div>
              <div style="border: 1px solid #1E293B; padding: var(--space-3); border-radius: var(--radius-md);">
                <span style="font-size: 10px; color: #94A3B8; display: block; margin-bottom: 2px;">Rapid Vote Spikes</span>
                <span style="font-size: var(--text-lg); font-weight: bold; color: var(--color-success);">0 Spikes</span>
              </div>
              <div style="border: 1px solid #1E293B; padding: var(--space-3); border-radius: var(--radius-md);">
                <span style="font-size: 10px; color: #94A3B8; display: block; margin-bottom: 2px;">Suspicious Devices</span>
                <span style="font-size: var(--text-lg); font-weight: bold; color: var(--color-danger);">1 Flagged</span>
              </div>
            </div>
          </div>

        </div>

        <!-- Alerts feed lists layout -->
        <div>
          <h4 style="font-size: var(--text-base); margin-bottom: var(--space-4);">System Threat Activity Log</h4>
          <div class="soc-alert-timeline" id="soc-alerts-feed-container">
            <!-- Rendered dynamically -->
          </div>
        </div>

      </div>

    </div>
  `;

  function renderAlerts() {
    const container = document.getElementById('soc-alerts-feed-container');
    container.innerHTML = store.alerts.map(al => {
      let badgeClass = 'low';
      if (al.type === 'critical') badgeClass = 'critical';
      if (al.type === 'high') badgeClass = 'high';
      if (al.type === 'medium') badgeClass = 'medium';

      return `
        <div class="soc-alert-item ${badgeClass}">
          <span class="soc-alert-badge ${badgeClass}">${al.type}</span>
          <div style="flex: 1;">
            <p style="margin: 0; color: #F8FAFC; font-size: var(--text-sm);">${al.message}</p>
            <span style="font-size: 10px; color: #64748B;">Timestamp: ${al.timestamp}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  renderAlerts();

  // Simulate threat logs updates every 4 seconds
  const alertSimInterval = setInterval(() => {
    if (!document.getElementById('soc-alerts-feed-container')) {
      clearInterval(alertSimInterval);
      return;
    }

    const mockAlerts = [
      { id: Date.now().toString(), type: "low", message: "SSO Connection Token refreshed for terminal segment.", timestamp: new Date().toLocaleTimeString() },
      { id: Date.now().toString(), type: "medium", message: "Anomaly Warning: Browser fingerprint query mismatch registered for voter alex.mercer.", timestamp: new Date().toLocaleTimeString() }
    ];

    const randomAlert = mockAlerts[Math.floor(Math.random() * mockAlerts.length)];
    store.alerts.unshift(randomAlert);
    
    // Cap alerts size to prevent lag
    if (store.alerts.length > 8) store.alerts.pop();

    renderAlerts();
  }, 4000);

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

window.renderAdminFraud = renderAdminFraud;
