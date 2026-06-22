/**
 * Controller for Candidate Selection View.
 */
function renderVoterCandidates() {
  const content = document.getElementById('content-area');
  const store = window.appStore.state;

  // Retrieve URL Election query key
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
  const electionId = urlParams.get('electionId');
  const election = store.elections.find(el => el.id === electionId);

  if (!election) {
    content.innerHTML = `
      <div class="empty-state">
        <i data-lucide="alert-triangle"></i>
        <h3>Election Not Found</h3>
        <p>No valid active election parameters were passed to this terminal session.</p>
        <a href="#/voter/elections" class="btn btn-primary" style="margin-top: var(--space-4);">Back to List</a>
      </div>
    `;
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
    return;
  }

  content.innerHTML = `
    <div class="candidate-selection-container animate-page-enter">
      
      <div style="margin-bottom: var(--space-8);">
        <a href="#/voter/elections" style="display: flex; align-items: center; gap: var(--space-1); font-size: var(--text-sm); font-weight: var(--weight-semibold); margin-bottom: var(--space-4);">
          <i data-lucide="arrow-left" style="width: 16px; height: 16px;"></i> Return to Elections
        </a>
        <h2 style="margin-bottom: var(--space-2);">${election.name}</h2>
        <p style="font-size: var(--text-sm); color: var(--text-secondary); max-width: 700px;">${election.description}</p>
      </div>

      <!-- Action items panel: compare modal button -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6);">
        <h3 style="font-size: var(--text-lg);">Select Your Candidate</h3>
        <button class="btn btn-secondary btn-sm" id="compare-candidates-btn">
          <i data-lucide="columns-2"></i> Compare Candidates Side-by-Side
        </button>
      </div>

      <div class="candidate-grid">
        ${election.candidates.map(cand => {
          const isSelected = store.selectedCandidates[electionId] === cand.id;
          return `
            <div class="card candidate-card ${isSelected ? 'selected' : ''}" data-cand-id="${cand.id}">
              <div class="candidate-select-indicator">
                <i data-lucide="check" style="width: 14px; height: 14px;"></i>
              </div>
              <img src="${cand.photo || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300'}" alt="${cand.name}" class="candidate-photo">
              <h4 class="candidate-name">${cand.name}</h4>
              <span class="candidate-position">${cand.position}</span>
              <p class="candidate-manifesto line-clamp-3" style="font-size: var(--text-sm); margin-bottom: var(--space-4);">${cand.manifesto}</p>
              <button class="btn btn-outline btn-full btn-sm cand-expand-profile-btn" data-cand-id="${cand.id}">
                View Full Profile & Manifesto
              </button>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Next submit button -->
      <div style="display: flex; justify-content: flex-end; gap: var(--space-4); border-top: 1px solid var(--border-color); padding-top: var(--space-6);">
        <a href="#/voter/elections" class="btn btn-secondary">Cancel</a>
        <button class="btn btn-primary" id="voter-candidates-proceed-btn" disabled>
          Review Selection <i data-lucide="arrow-right"></i>
        </button>
      </div>

      <!-- Candidate profile expansion Modal -->
      <div class="modal-overlay" id="profile-modal">
        <div class="modal-container">
          <div class="modal-header">
            <h3 class="modal-title" id="profile-modal-name">Candidate Profile</h3>
            <button class="modal-close" id="profile-modal-close-btn">&times;</button>
          </div>
          <div class="modal-body" style="display: flex; flex-direction: column; gap: var(--space-4);">
            <img id="profile-modal-photo" src="" alt="" style="width: 100%; height: 240px; object-fit: cover; border-radius: var(--radius-lg);">
            <div>
              <span class="candidate-position" id="profile-modal-position"></span>
              <p id="profile-modal-manifesto" style="font-size: var(--text-sm); line-height: 1.6; margin-top: var(--space-2);"></p>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="profile-modal-cancel-btn">Close</button>
            <button class="btn btn-primary" id="profile-modal-select-btn">Select Candidate</button>
          </div>
        </div>
      </div>

      <!-- Comparison Modal layout -->
      <div class="modal-overlay" id="compare-modal">
        <div class="modal-container" style="max-width: 800px;">
          <div class="modal-header">
            <h3 class="modal-title">Compare Candidates</h3>
            <button class="modal-close" id="compare-modal-close-btn">&times;</button>
          </div>
          <div class="modal-body candidate-compare-overlay" id="compare-modal-body-content">
            <!-- Dynamic comparison profiles columns layout -->
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="compare-modal-cancel-btn">Close</button>
          </div>
        </div>
      </div>

    </div>
  `;

  // Bind Selection state
  const cards = document.querySelectorAll('.candidate-card');
  const proceedBtn = document.getElementById('voter-candidates-proceed-btn');

  function checkProceedState() {
    const electionSelection = store.selectedCandidates[electionId];
    proceedBtn.disabled = !electionSelection;
  }

  cards.forEach(card => {
    card.addEventListener('click', (e) => {
      // Ignore click if interactive buttons are pressed
      if (e.target.classList.contains('cand-expand-profile-btn')) return;

      const candId = card.getAttribute('data-cand-id');
      
      // Clear previous active states
      cards.forEach(c => c.classList.remove('selected'));
      
      // Update store state values
      store.selectedCandidates[electionId] = candId;
      card.classList.add('selected');
      
      window.appStore.save();
      checkProceedState();
    });
  });

  // Bind Candidate profile view modal
  const profileModal = document.getElementById('profile-modal');
  const expandButtons = document.querySelectorAll('.cand-expand-profile-btn');

  let activeModalCandId = null;

  expandButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const candId = btn.getAttribute('data-cand-id');
      const candidate = election.candidates.find(c => c.id === candId);
      if (!candidate) return;

      activeModalCandId = candId;
      document.getElementById('profile-modal-name').innerText = candidate.name;
      document.getElementById('profile-modal-position').innerText = candidate.position;
      document.getElementById('profile-modal-photo').src = candidate.photo;
      document.getElementById('profile-modal-manifesto').innerText = candidate.manifesto;

      profileModal.classList.add('active');
    });
  });

  const closeProfileModal = () => profileModal.classList.remove('active');
  document.getElementById('profile-modal-close-btn').addEventListener('click', closeProfileModal);
  document.getElementById('profile-modal-cancel-btn').addEventListener('click', closeProfileModal);
  document.getElementById('profile-modal-select-btn').addEventListener('click', () => {
    store.selectedCandidates[electionId] = activeModalCandId;
    cards.forEach(c => {
      if (c.getAttribute('data-cand-id') === activeModalCandId) {
        c.classList.add('selected');
      } else {
        c.classList.remove('selected');
      }
    });
    window.appStore.save();
    checkProceedState();
    closeProfileModal();
  });

  // Bind Comparison Modal action handlers
  const compareModal = document.getElementById('compare-modal');
  document.getElementById('compare-candidates-btn').addEventListener('click', () => {
    const compareBody = document.getElementById('compare-modal-body-content');
    
    compareBody.innerHTML = election.candidates.map(cand => `
      <div style="border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3);">
        <img src="${cand.photo}" alt="${cand.name}" style="width: 100%; height: 140px; object-fit: cover; border-radius: var(--radius-md);">
        <h4 style="margin: 0;">${cand.name}</h4>
        <span class="badge badge-info" style="align-self: flex-start;">${cand.position}</span>
        <p style="font-size: var(--text-xs); color: var(--text-secondary); line-height: 1.5;">${cand.manifesto}</p>
        <button class="btn btn-primary btn-sm compare-select-btn" data-cand-id="${cand.id}">Select</button>
      </div>
    `).join('');

    compareModal.classList.add('active');

    // Bind inside buttons
    compareBody.querySelectorAll('.compare-select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const candId = btn.getAttribute('data-cand-id');
        store.selectedCandidates[electionId] = candId;
        cards.forEach(c => {
          if (c.getAttribute('data-cand-id') === candId) {
            c.classList.add('selected');
          } else {
            c.classList.remove('selected');
          }
        });
        window.appStore.save();
        checkProceedState();
        compareModal.classList.remove('active');
      });
    });
  });

  const closeCompareModal = () => compareModal.classList.remove('active');
  document.getElementById('compare-modal-close-btn').addEventListener('click', closeCompareModal);
  document.getElementById('compare-modal-cancel-btn').addEventListener('click', closeCompareModal);

  // Bind Proceed to review screen
  proceedBtn.addEventListener('click', () => {
    window.location.hash = `#/voter/vote-confirm?electionId=${electionId}`;
  });

  checkProceedState();
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

window.renderVoterCandidates = renderVoterCandidates;
