/**
 * Controller for Voter Confirmation View.
 */
function renderVoterVoteConfirm() {
  const content = document.getElementById('content-area');
  const store = window.appStore.state;

  const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
  const electionId = urlParams.get('electionId');
  const election = store.elections.find(el => el.id === electionId);
  const candId = store.selectedCandidates[electionId];
  const candidate = election ? election.candidates.find(c => c.id === candId) : null;

  if (!election || !candidate) {
    content.innerHTML = `
      <div class="empty-state">
        <i data-lucide="alert-triangle"></i>
        <h3>Invalid Session</h3>
        <p>No valid candidates selection parameters were registered for this checkout flow.</p>
        <a href="#/voter/elections" class="btn btn-primary">Back to Elections</a>
      </div>
    `;
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
    return;
  }

  content.innerHTML = `
    <div class="confirm-box animate-page-enter">
      
      <div style="margin-bottom: var(--space-8);">
        <h2 style="margin-bottom: var(--space-2);">Confirm Your Vote Choice</h2>
        <p style="color: var(--text-secondary); font-size: var(--text-sm);">Verify the details of your cryptographic ballot before transmission to the audit chain.</p>
      </div>

      <!-- Selected summary card -->
      <div class="glass-card" style="margin-bottom: var(--space-6); text-align: left; display: flex; gap: var(--space-4); align-items: center; border-color: rgba(37, 99, 235, 0.2);">
        <img src="${candidate.photo}" alt="${candidate.name}" style="width: 80px; height: 80px; object-fit: cover; border-radius: var(--radius-lg);">
        <div>
          <span style="font-size: var(--text-xs); color: var(--color-primary); font-weight: bold; text-transform: uppercase; letter-spacing: var(--tracking-wide);">${candidate.position} Choice</span>
          <h3 style="font-size: var(--text-xl); margin: var(--space-1) 0;">${candidate.name}</h3>
          <p style="font-size: var(--text-xs); color: var(--text-tertiary); margin: 0;">${election.name}</p>
        </div>
      </div>

      <!-- Warning Panel alert -->
      <div class="alert alert-warning" style="margin-bottom: var(--space-8); text-align: left;">
        <i data-lucide="alert-triangle" style="flex-shrink: 0;"></i>
        <div>
          <p style="font-weight: bold; margin: 0; color: var(--text-primary);">Warning: Action is Permanent</p>
          <p style="margin: 0; font-size: var(--text-xs);">Your vote cannot be changed or recalled after submission. The audit ledger does not support modifications once block confirmation completes.</p>
        </div>
      </div>

      <!-- Submit items actions -->
      <div style="display: flex; gap: var(--space-4); justify-content: center;">
        <a href="#/voter/candidates?electionId=${electionId}" class="btn btn-secondary btn-lg">
          <i data-lucide="arrow-left"></i> Go Back
        </a>
        <button class="btn btn-primary btn-lg" id="submit-ballot-btn">
          <i data-lucide="shield-check"></i> Cast Ballot Securely
        </button>
      </div>

    </div>
  `;

  // Bind submission logic
  document.getElementById('submit-ballot-btn').addEventListener('click', () => {
    // Generate verification ID details
    const verificationId = `VT-2026-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const auditRecord = {
      id: verificationId,
      electionId: electionId,
      electionName: election.name,
      timestamp: new Date().toISOString()
    };

    // Push details to ledger
    store.votesCast.push(auditRecord);

    // Save to store
    window.appStore.save();

    // Route to Success Screen
    window.location.hash = `#/voter/vote-success?verificationId=${verificationId}`;
  });

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

window.renderVoterVoteConfirm = renderVoterVoteConfirm;
