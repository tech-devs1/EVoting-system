/**
 * Controller for Voter Dashboard View.
 */
function renderVoterDashboard() {
  const content = document.getElementById('content-area');
  const store = window.appStore.state;

  content.innerHTML = `
    <div class="dashboard-grid animate-page-enter">
      
      <!-- Main Content Column -->
      <div style="display: flex; flex-direction: column; gap: var(--space-6);">
        
        <!-- Welcome banner card -->
        <div class="welcome-card">
          <h2>Welcome back, ${store.currentVoterName}!</h2>
          <p>Your digital identity profile is cryptographic verification ready. Explore running ballots or check validation history tokens below.</p>
          
          <div class="quick-stats-grid">
            <div class="stat-widget">
              <span class="stat-widget-label">Active E-ballots</span>
              <span class="stat-widget-val">2</span>
            </div>
            <div class="stat-widget">
              <span class="stat-widget-label">Total Verified Votes</span>
              <span class="stat-widget-val">${store.votesCast.length}</span>
            </div>
            <div class="stat-widget">
              <span class="stat-widget-label">ID Hash Signature</span>
              <span class="stat-widget-val" style="font-size: var(--text-sm); font-family: var(--font-mono); word-break: break-all;">${store.currentVoterId}</span>
            </div>
          </div>
        </div>

        <!-- Dynamic list of running elections -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
            <h3>Active Elections</h3>
            <a href="#/voter/elections" style="font-size: var(--text-sm); font-weight: var(--weight-semibold);">View All</a>
          </div>

          <div class="election-grid" id="dashboard-active-elections">
            <!-- Filled dynamically -->
          </div>
        </div>

      </div>

      <!-- Sidebar widgets column -->
      <div style="display: flex; flex-direction: column; gap: var(--space-6);">
        
        <!-- Live Notifications -->
        <div class="card">
          <h4 style="margin-bottom: var(--space-4); font-size: var(--text-base);">Security Announcements</h4>
          <div class="notification-item">
            <div class="notification-icon blue"><i data-lucide="shield-check"></i></div>
            <div class="notification-content">
              <p style="font-weight: bold; margin: 0;">Multi-Factor Authentication</p>
              <p style="color: var(--text-secondary); margin: 0; font-size: var(--text-xs);">SSO Credentials validated successfully from current session.</p>
              <div class="notification-time">10 mins ago</div>
            </div>
          </div>
          <div class="notification-item">
            <div class="notification-icon green"><i data-lucide="key"></i></div>
            <div class="notification-content">
              <p style="font-weight: bold; margin: 0;">Ledger Integrity Checked</p>
              <p style="color: var(--text-secondary); margin: 0; font-size: var(--text-xs);">SHA-256 ledger integrity validation complete. 0 errors.</p>
              <div class="notification-time">2 hours ago</div>
            </div>
          </div>
        </div>

        <!-- Quick voter credentials profile card -->
        <div class="card">
          <h4 style="margin-bottom: var(--space-3); font-size: var(--text-base);">Cryptographic Verification</h4>
          <p style="font-size: var(--text-xs); color: var(--text-secondary); margin-bottom: var(--space-4);">Use your tracking token ID to lookup audit nodes status.</p>
          <a href="#/voter/verify" class="btn btn-outline btn-full btn-sm">
            <i data-lucide="search"></i> Lookup Verification ID
          </a>
        </div>

      </div>

    </div>
  `;

  // Render elections list
  const container = document.getElementById('dashboard-active-elections');
  const activeElections = store.elections.filter(el => el.status === 'active');

  if (activeElections.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="inbox"></i>
        <h3>No Active Elections</h3>
        <p>There are no elections running right now. Check upcoming schedules.</p>
      </div>
    `;
  } else {
    container.innerHTML = activeElections.map(el => `
      <div class="card election-card card-hover">
        <div class="election-card-header">
          <h4 class="election-card-title">${el.name}</h4>
          <span class="badge badge-success">Active</span>
        </div>
        <p class="election-card-desc">${el.description}</p>
        <div class="election-card-meta">
          <div class="countdown-timer" id="timer-${el.id}">
            <i data-lucide="clock"></i> Calculating time...
          </div>
          <a href="#/voter/candidates?electionId=${el.id}" class="btn btn-primary btn-sm">Vote Now</a>
        </div>
      </div>
    `).join('');

    // Setup active timers
    activeElections.forEach(el => {
      startCountdownTimer(el.endsAt, `timer-${el.id}`);
    });
  }

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

/**
 * Handles countdown timer logic.
 */
function startCountdownTimer(endTimeStr, elementId) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const endTime = new Date(endTimeStr).getTime();

  function update() {
    const now = Date.now();
    const diff = endTime - now;

    if (diff <= 0) {
      element.innerHTML = `<i data-lucide="clock"></i> Closed`;
      element.className = 'countdown-timer';
      return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);

    element.innerHTML = `<i data-lucide="clock"></i> ${hours}h ${mins}m ${secs}s`;

    if (hours < 24) {
      element.classList.add('ending-soon');
    }
  }

  update();
  const interval = setInterval(() => {
    if (!document.getElementById(elementId)) {
      clearInterval(interval);
      return;
    }
    update();
  }, 1000);
}

window.renderVoterDashboard = renderVoterDashboard;
window.startCountdownTimer = startCountdownTimer;
