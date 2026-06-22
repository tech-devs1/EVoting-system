/**
 * Controller for Voter Elections List View.
 */
function renderVoterElections() {
  const content = document.getElementById('content-area');
  const store = window.appStore.state;

  content.innerHTML = `
    <div class="animate-page-enter">
      
      <!-- Top filter tab selection row -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6); flex-wrap: wrap; gap: var(--space-4);">
        <div class="tabs-container" style="margin-bottom: 0;">
          <button class="tab-btn active" id="tab-all-elections">All Elections</button>
          <button class="tab-btn" id="tab-active-elections">Active</button>
          <button class="tab-btn" id="tab-upcoming-elections">Upcoming</button>
          <button class="tab-btn" id="tab-closed-elections">Closed</button>
        </div>
        
        <div class="form-input-container" style="max-width: 300px;">
          <i data-lucide="search" class="form-input-icon"></i>
          <input type="text" id="election-search" class="form-input form-input-with-icon" placeholder="Search elections...">
        </div>
      </div>

      <!-- Elections Cards Grid -->
      <div class="election-grid" id="voter-elections-grid-container">
        <!-- Rendered dynamically -->
      </div>

    </div>
  `;

  let selectedFilter = 'all';
  let searchQuery = '';

  function renderGrid() {
    const container = document.getElementById('voter-elections-grid-container');
    let list = store.elections;

    // Apply Status filter tabs
    if (selectedFilter !== 'all') {
      list = list.filter(el => el.status === selectedFilter);
    }

    // Apply Search Input values
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      list = list.filter(el => el.name.toLowerCase().includes(query) || el.description.toLowerCase().includes(query));
    }

    if (list.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <i data-lucide="folder-open"></i>
          <h3>No Elections Found</h3>
          <p>No matching election schedules fit the active queries.</p>
        </div>
      `;
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
      return;
    }

    container.innerHTML = list.map(el => {
      let badgeClass = 'badge-info';
      if (el.status === 'active') badgeClass = 'badge-success';
      if (el.status === 'closed') badgeClass = 'badge-danger';
      if (el.status === 'upcoming') badgeClass = 'badge-warning';

      let actionButton = '';
      if (el.status === 'active') {
        actionButton = `<a href="#/voter/candidates?electionId=${el.id}" class="btn btn-primary btn-sm">Vote Now</a>`;
      } else if (el.status === 'closed') {
        actionButton = `<a href="#/admin/results?electionId=${el.id}" class="btn btn-outline btn-sm">View Final Results</a>`;
      } else {
        actionButton = `<button class="btn btn-secondary btn-sm" disabled><i data-lucide="lock"></i> Locked</button>`;
      }

      return `
        <div class="card election-card card-hover">
          <div class="election-card-header">
            <h4 class="election-card-title">${el.name}</h4>
            <span class="badge ${badgeClass}">${el.status}</span>
          </div>
          <p class="election-card-desc">${el.description}</p>
          <div class="election-card-meta">
            <div class="countdown-timer" id="list-timer-${el.id}">
              <i data-lucide="clock"></i> Calculating...
            </div>
            ${actionButton}
          </div>
        </div>
      `;
    }).join('');

    // Start timers for active/upcoming elections
    list.forEach(el => {
      if (el.status === 'active' || el.status === 'upcoming') {
        startCountdownTimer(el.endsAt, `list-timer-${el.id}`);
      } else {
        const timerEl = document.getElementById(`list-timer-${el.id}`);
        if (timerEl) {
          timerEl.innerHTML = `<i data-lucide="clock"></i> Ended`;
        }
      }
    });

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  // Bind tab filter selectors
  const tabs = {
    'tab-all-elections': 'all',
    'tab-active-elections': 'active',
    'tab-upcoming-elections': 'upcoming',
    'tab-closed-elections': 'closed'
  };

  Object.entries(tabs).forEach(([id, filter]) => {
    document.getElementById(id).addEventListener('click', (e) => {
      // Remove all active tab states
      Object.keys(tabs).forEach(tabId => document.getElementById(tabId).classList.remove('active'));
      e.target.classList.add('active');
      selectedFilter = filter;
      renderGrid();
    });
  });

  // Bind search box input
  document.getElementById('election-search').addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderGrid();
  });

  renderGrid();
}

window.renderVoterElections = renderVoterElections;
