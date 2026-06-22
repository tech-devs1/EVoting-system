/**
 * Controller for Real-Time Results View.
 */
function renderAdminResults() {
  const content = document.getElementById('content-area');
  const store = window.appStore.state;

  // Find queried/active presidential election
  const activePres = store.elections.find(e => e.id === "el-1");

  if (!activePres) {
    content.innerHTML = `
      <div class="empty-state">
        <i data-lucide="alert-triangle"></i>
        <h3>No Presidential Election Found</h3>
        <p>Could not locate the default election node to render results charts.</p>
      </div>
    `;
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
    return;
  }

  content.innerHTML = `
    <div class="animate-page-enter">
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6); flex-wrap: wrap; gap: var(--space-4);">
        <div>
          <h2 style="font-size: var(--text-xl); margin-bottom: var(--space-1);">${activePres.name}</h2>
          <div class="live-indicator">Live Vote Streaming</div>
        </div>
        <div style="display: flex; align-items: center; gap: var(--space-3); font-size: var(--text-sm); color: var(--text-secondary);">
          <i data-lucide="refresh-cw" class="animate-spin-slow"></i> Stream active (2s auto-refresh)
        </div>
      </div>

      <!-- Main layouts charts grid -->
      <div class="admin-grid-charts" style="grid-template-columns: 1.2fr 1fr;">
        
        <!-- Live rank bar progress indicators -->
        <div class="card">
          <h3 style="font-size: var(--text-base); margin-bottom: var(--space-6);">Candidate Vote Standings</h3>
          <div class="rankings-list" id="results-ranks-list-container">
            <!-- Rendered dynamically -->
          </div>
        </div>

        <!-- Dynamic Pie Chart display -->
        <div class="card">
          <h3 style="font-size: var(--text-base); margin-bottom: var(--space-6);">Vote Share Breakdown</h3>
          <div style="height: 280px; position: relative;">
            <canvas id="resultsVoteShareChart"></canvas>
          </div>
        </div>

      </div>

    </div>
  `;

  let totalVotes = activePres.candidates.reduce((sum, c) => sum + c.votes, 0);

  function renderRanks() {
    const list = document.getElementById('results-ranks-list-container');
    list.innerHTML = activePres.candidates.map(cand => {
      const percentage = totalVotes > 0 ? Math.round((cand.votes / totalVotes) * 100) : 0;
      return `
        <div class="ranking-item">
          <div class="ranking-info">
            <span>${cand.name} (${cand.position})</span>
            <span>${cand.votes.toLocaleString()} votes (${percentage}%)</span>
          </div>
          <div class="ranking-progress-bg">
            <div class="ranking-progress-bar" style="width: ${percentage}%;"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  function initChart() {
    const ctx = document.getElementById('resultsVoteShareChart');
    if (!ctx || typeof Chart === 'undefined') return;

    if (window.resultsShareChartInstance) window.resultsShareChartInstance.destroy();

    window.resultsShareChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: activePres.candidates.map(c => c.name),
        datasets: [{
          data: activePres.candidates.map(c => c.votes),
          backgroundColor: ['#2563EB', '#7C3AED', '#10B981'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  // Simulate real-time auto updates every 2 seconds
  renderRanks();
  initChart();
  
  const refreshInterval = setInterval(() => {
    // Check if user has navigated away from view
    if (!document.getElementById('results-ranks-list-container')) {
      clearInterval(refreshInterval);
      return;
    }

    // Mock incrementing vote counts slightly
    activePres.candidates.forEach(cand => {
      cand.votes += Math.floor(Math.random() * 5);
    });

    totalVotes = activePres.candidates.reduce((sum, c) => sum + c.votes, 0);
    renderRanks();
    
    // Update chart data values
    if (window.resultsShareChartInstance) {
      window.resultsShareChartInstance.data.datasets[0].data = activePres.candidates.map(c => c.votes);
      window.resultsShareChartInstance.update('none'); // silent update
    }
  }, 2000);

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

window.renderAdminResults = renderAdminResults;
