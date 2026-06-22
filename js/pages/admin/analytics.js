/**
 * Controller for Admin Analytics View.
 */
function renderAdminAnalytics() {
  const content = document.getElementById('content-area');

  content.innerHTML = `
    <div class="animate-page-enter">
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6); flex-wrap: wrap; gap: var(--space-4);">
        <div>
          <h2 style="font-size: var(--text-xl); margin-bottom: var(--space-1);">Detailed Election Analytics</h2>
          <span style="font-size: var(--text-xs); color: var(--text-secondary);">Historical metrics, trends and download logs</span>
        </div>
        
        <!-- Export tool buttons options dropdown -->
        <div style="display: flex; gap: var(--space-3);">
          <button class="btn btn-secondary btn-sm" id="export-pdf-btn"><i data-lucide="file-text"></i> Export PDF</button>
          <button class="btn btn-secondary btn-sm" id="export-excel-btn"><i data-lucide="file-spreadsheet"></i> Export Excel</button>
          <button class="btn btn-primary btn-sm" id="export-csv-btn"><i data-lucide="download"></i> Export CSV</button>
        </div>
      </div>

      <!-- Turnout and analytics metrics charts grid -->
      <div class="admin-grid-charts" style="grid-template-columns: 1fr 1fr; margin-bottom: var(--space-6);">
        
        <div class="card chart-card">
          <h3 class="chart-title" style="margin-bottom: var(--space-4);">Participation Rate by Department</h3>
          <div class="chart-body">
            <canvas id="deptParticipationChart"></canvas>
          </div>
        </div>

        <div class="card chart-card">
          <h3 class="chart-title" style="margin-bottom: var(--space-4);">Peak Voting Times Stream</h3>
          <div class="chart-body">
            <canvas id="peakTimesChart"></canvas>
          </div>
        </div>

      </div>

    </div>
  `;

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // Setup export alert binds
  const bindAlert = (format) => {
    document.getElementById(`export-${format}-btn`).addEventListener('click', () => {
      alert(`Exporting complete analytical data logs in ${format.toUpperCase()} format...`);
    });
  };
  ['pdf', 'excel', 'csv'].forEach(bindAlert);

  // Load analytics Chart instances
  const ctxDept = document.getElementById('deptParticipationChart');
  const ctxPeak = document.getElementById('peakTimesChart');

  if (ctxDept && ctxPeak && typeof Chart !== 'undefined') {
    if (window.deptChartInstance) window.deptChartInstance.destroy();
    if (window.peakChartInstance) window.peakChartInstance.destroy();

    window.deptChartInstance = new Chart(ctxDept, {
      type: 'bar',
      data: {
        labels: ['Computer Science', 'Engineering', 'Business School', 'Design & Arts', 'Medical Sci'],
        datasets: [{
          label: 'Turnout %',
          data: [92, 85, 78, 88, 71],
          backgroundColor: '#3B82F6',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });

    window.peakChartInstance = new Chart(ctxPeak, {
      type: 'line',
      data: {
        labels: ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00'],
        datasets: [{
          label: 'Ballots Processed',
          data: [50, 180, 420, 290, 510, 230],
          borderColor: '#7C3AED',
          backgroundColor: 'rgba(124, 58, 237, 0.1)',
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });
  }
}

window.renderAdminAnalytics = renderAdminAnalytics;
