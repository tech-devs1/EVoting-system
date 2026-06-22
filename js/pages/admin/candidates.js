/**
 * Controller for Candidate Directory View.
 */
function renderAdminCandidates() {
  const content = document.getElementById('content-area');
  const store = window.appStore.state;

  // Retrieve Election ID parameter
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
  const electionId = urlParams.get('electionId') || store.elections[0]?.id;
  const election = store.elections.find(el => el.id === electionId);

  if (!election) {
    content.innerHTML = `
      <div class="empty-state">
        <i data-lucide="alert-triangle"></i>
        <h3>Select Active Election</h3>
        <p>No valid elections directories fit the queried request parameters.</p>
        <a href="#/admin/elections" class="btn btn-primary">Back to Elections List</a>
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
          <a href="#/admin/elections" style="display: inline-flex; align-items: center; gap: 4px; font-size: var(--text-sm); margin-bottom: var(--space-2);">
            <i data-lucide="arrow-left" style="width: 14px; height: 14px;"></i> Return to Elections
          </a>
          <h2 style="font-size: var(--text-xl);">${election.name} - Candidates Directory</h2>
        </div>
        <button class="btn btn-primary" id="add-candidate-btn">
          <i data-lucide="plus-circle"></i> Add Candidate
        </button>
      </div>

      <!-- Grid layout -->
      <div class="candidate-grid" id="admin-candidates-grid">
        <!-- Rendered dynamically -->
      </div>

      <!-- Add Candidate Modal -->
      <div class="modal-overlay" id="add-candidate-modal">
        <div class="modal-container">
          <div class="modal-header">
            <h3 class="modal-title">Add Candidate Profile</h3>
            <button class="modal-close" id="candidate-close-modal-btn">&times;</button>
          </div>
          <form id="add-candidate-form">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label" for="cand-name">Candidate Name</label>
                <input type="text" id="cand-name" class="form-input" placeholder="e.g. John Doe" required>
              </div>
              <div class="form-group" style="margin-top: var(--space-4);">
                <label class="form-label" for="cand-pos">Position</label>
                <input type="text" id="cand-pos" class="form-input" placeholder="e.g. President" required>
              </div>
              <div class="form-group" style="margin-top: var(--space-4);">
                <label class="form-label" for="cand-man">Manifesto</label>
                <textarea id="cand-man" class="form-input" placeholder="Enter manifesto text details..." style="min-height: 80px;" required></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="candidate-modal-cancel-btn">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Candidate</button>
            </div>
          </form>
        </div>
      </div>

    </div>
  `;

  function renderGrid() {
    const grid = document.getElementById('admin-candidates-grid');
    if (election.candidates.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <i data-lucide="users"></i>
          <h3>No Candidates</h3>
          <p>No candidate entries exist for this ballot. Tap Add Candidate above to get started.</p>
        </div>
      `;
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
      return;
    }

    grid.innerHTML = election.candidates.map(cand => `
      <div class="card candidate-card">
        <img src="${cand.photo || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300'}" alt="${cand.name}" class="candidate-photo">
        <h4 class="candidate-name">${cand.name}</h4>
        <span class="candidate-position">${cand.position}</span>
        <p class="candidate-manifesto line-clamp-3" style="margin-bottom: var(--space-4); font-size: var(--text-xs);">${cand.manifesto}</p>
        <button class="btn btn-danger btn-sm btn-full delete-cand-btn" data-cand-id="${cand.id}">
          <i data-lucide="trash"></i> Remove Candidate
        </button>
      </div>
    `).join('');

    // Bind delete events
    grid.querySelectorAll('.delete-cand-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const candId = btn.getAttribute('data-cand-id');
        election.candidates = election.candidates.filter(c => c.id !== candId);
        window.appStore.save();
        renderGrid();
      });
    });

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  // Bind Modals trigger buttons
  const modal = document.getElementById('add-candidate-modal');
  document.getElementById('add-candidate-btn').addEventListener('click', () => {
    modal.classList.add('active');
  });

  const closeModal = () => modal.classList.remove('active');
  document.getElementById('candidate-close-modal-btn').addEventListener('click', closeModal);
  document.getElementById('candidate-modal-cancel-btn').addEventListener('click', closeModal);

  document.getElementById('add-candidate-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('cand-name').value;
    const pos = document.getElementById('cand-pos').value;
    const man = document.getElementById('cand-man').value;

    const newCandidate = {
      id: `cand-${Date.now()}`,
      name,
      position: pos,
      manifesto: man,
      photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300',
      votes: 0
    };

    election.candidates.push(newCandidate);
    window.appStore.save();
    closeModal();
    renderGrid();
  });

  renderGrid();
}

window.renderAdminCandidates = renderAdminCandidates;
