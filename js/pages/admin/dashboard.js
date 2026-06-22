/**
 * Controller for Admin Executive Dashboard View.
 */
function renderAdminDashboard() {
  const content = document.getElementById('content-area');
  const store = window.appStore.state;

  content.innerHTML = `
    <div class="animate-page-enter">
      
      <!-- Executive KPI Cards -->
      <div class="admin-grid-top">
        
        <div class="card kpi-card">
          <div class="kpi-details">
            <span class="kpi-label">Total Elections</span>
            <span class="kpi-value">${store.elections.length}</span>
            <div class="kpi-trend up">
              <i data-lucide="trending-up"></i> +12% vs last sem
            </div>
          </div>
          <div class="kpi-icon-wrapper purple">
            <i data-lucide="archive"></i>
          </div>
        </div>

        <div class="card kpi-card">
          <div class="kpi-details">
            <span class="kpi-label">Active Polls</span>
            <span class="kpi-value">${store.elections.filter(e => e.status === 'active').length}</span>
            <div class="kpi-trend up">
              <i data-lucide="check"></i> 100% up status
            </div>
          </div>
          <div class="kpi-icon-wrapper blue">
            <i data-lucide="activity"></i>
          </div>
        </div>

        <div class="card kpi-card">
          <div class="kpi-details">
            <span class="kpi-label">Registered Voters</span>
            <span class="kpi-value">2,840</span>
            <div class="kpi-trend up">
              <i data-lucide="trending-up"></i> +8.2% registration
            </div>
          </div>
          <div class="kpi-icon-wrapper green">
            <i data-lucide="users"></i>
          </div>
        </div>

        <div class="card kpi-card">
          <div class="kpi-details">
            <span class="kpi-label">Total Votes Cast</span>
            <span class="kpi-value">${2084 + store.votesCast.length}</span>
            <div class="kpi-trend up">
              <i data-lucide="trending-up"></i> 84.6% Turnout
            </div>
          </div>
          <div class="kpi-icon-wrapper amber">
            <i data-lucide="vote"></i>
          </div>
        </div>

      </div>

      <!-- Real-Time Activity Charts Grid -->
      <div class="admin-grid-charts">
        
        <!-- Main Line Chart -->
        <div class="card chart-card">
          <div class="chart-header">
            <h3 class="chart-title">Real-Time Voting Activity Stream</h3>
            <span class="badge badge-success"><i data-lucide="refresh-cw" class="animate-spin-slow"></i> Live updates</span>
          </div>
          <div class="chart-body">
            <canvas id="votingActivityChart"></canvas>
          </div>
        </div>

        <!-- Doughnut / Pie Chart -->
        <div class="card chart-card">
          <div class="chart-header">
            <h3 class="chart-title">Voter turnout status</h3>
          </div>
          <div class="chart-body">
            <canvas id="participationTrendsChart"></canvas>
          </div>
        </div>

      </div>

    </div>
  `;

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // Render Chart.js charts
  const ctxLine = document.getElementById('votingActivityChart');
  const ctxPie = document.getElementById('participationTrendsChart');

  if (ctxLine && ctxPie && typeof Chart !== 'undefined') {
    // Destroy existing instances if any to prevent memory leaks
    if (window.activityChartInstance) window.activityChartInstance.destroy();
    if (window.trendsChartInstance) window.trendsChartInstance.destroy();

    window.activityChartInstance = new Chart(ctxLine, {
      type: 'line',
      data: {
        labels: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'],
        datasets: [{
          label: 'Votes Cast / Hour',
          data: [120, 240, 480, 520, 310, 450, 610],
          borderColor: '#2563EB',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { grid: { color: 'rgba(148, 163, 184, 0.1)' } },
          x: { grid: { display: false } }
        }
      }
    });

    window.trendsChartInstance = new Chart(ctxPie, {
      type: 'doughnut',
      data: {
        labels: ['Voted', 'Remaining'],
        datasets: [{
          data: [2084, 756],
          backgroundColor: ['#10B981', '#E2E8F0'],
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
}

window.renderAdminDashboard = renderAdminDashboard;
