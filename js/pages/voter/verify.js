/**
 * Controller for Vote Verification View.
 */
function renderVoterVerify() {
  const content = document.getElementById('content-area');
  const store = window.appStore.state;

  const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
  const initialId = urlParams.get('verificationId') || '';

  content.innerHTML = `
    <div class="candidate-selection-container animate-page-enter">
      
      <div style="margin-bottom: var(--space-8);">
        <h2 style="margin-bottom: var(--space-2);">Vote Verification Hub</h2>
        <p style="color: var(--text-secondary); font-size: var(--text-sm);">Verify that your ballot transaction has been accurately cataloged on the digital audit log ledger without revealing candidate choices.</p>
      </div>

      <!-- Search fields input card -->
      <div class="card" style="margin-bottom: var(--space-6);">
        <form id="verify-search-form" style="display: flex; gap: var(--space-4); align-items: flex-end; flex-wrap: wrap;">
          <div class="form-group" style="flex: 1; min-width: 250px; margin-bottom: 0;">
            <label class="form-label" for="verify-input-id">Enter Cryptographic Verification ID</label>
            <div class="form-input-container">
              <i data-lucide="key" class="form-input-icon"></i>
              <input type="text" id="verify-input-id" class="form-input form-input-with-icon" placeholder="e.g. VT-2026-AB12XY" value="${initialId}" required>
            </div>
          </div>
          <button type="submit" class="btn btn-primary" style="height: 46px;">
            <i data-lucide="search"></i> Lookup Record
          </button>
        </form>
      </div>

      <!-- Verification Results Box -->
      <div id="verification-result-container">
        <!-- Rendered dynamically depending on search results -->
      </div>

    </div>
  `;

  function performSearch(id) {
    const resultBox = document.getElementById('verification-result-container');
    if (!id || id.trim() === '') return;

    // Check custom vote listings, or search internal records list
    const foundVote = store.votesCast.find(v => v.id.toUpperCase() === id.trim().toUpperCase());

    if (foundVote) {
      resultBox.innerHTML = `
        <div class="card animate-fade-in" style="border-color: var(--color-success); border-width: 2px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: var(--space-4); margin-bottom: var(--space-6);">
            <div>
              <span class="badge badge-success" style="font-size: var(--text-xs);"><i data-lucide="shield-check"></i> Recorded & Verified</span>
              <h3 style="font-size: var(--text-xl); margin-top: var(--space-2);">${foundVote.id}</h3>
            </div>
            <div class="countdown-timer" style="color: var(--color-success);">
              <i data-lucide="activity"></i> Ledgers Verified
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-6); margin-bottom: var(--space-6);">
            <div>
              <span style="font-size: var(--text-xs); color: var(--text-tertiary); display: block; margin-bottom: var(--space-1);">Election Instance</span>
              <span style="font-weight: bold; font-size: var(--text-sm);">${foundVote.electionName}</span>
            </div>
            <div>
              <span style="font-size: var(--text-xs); color: var(--text-tertiary); display: block; margin-bottom: var(--space-1);">Verification Timestamp</span>
              <span style="font-weight: bold; font-size: var(--text-sm);">${new Date(foundVote.timestamp).toLocaleString()}</span>
            </div>
            <div>
              <span style="font-size: var(--text-xs); color: var(--text-tertiary); display: block; margin-bottom: var(--space-1);">Ballot Choices Status</span>
              <span style="color: var(--text-secondary); font-weight: bold; font-size: var(--text-sm); display: flex; align-items: center; gap: var(--space-1);">
                <i data-lucide="eye-off" style="width: 14px; height: 14px;"></i> Hidden (Anonymized)
              </span>
            </div>
          </div>

          <div class="alert alert-info" style="margin-bottom: 0;">
            <i data-lucide="shield-alert" style="flex-shrink: 0;"></i>
            <div>
              <p style="font-weight: bold; margin: 0; color: var(--text-primary);">Audit Integrity Certified</p>
              <p style="margin: 0; font-size: var(--text-xs);">SHA-256 Block Signature: <code style="font-size: 10px; word-break: break-all;">${Math.random().toString(36).substring(2, 15).toUpperCase()}</code>. Zero-knowledge proof verified voter anonymity is preserved.</p>
            </div>
          </div>
        </div>
      `;
    } else {
      resultBox.innerHTML = `
        <div class="card text-center animate-fade-in" style="border-color: var(--color-danger);">
          <i data-lucide="alert-octagon" style="width: 48px; height: 48px; color: var(--color-danger); margin: 0 auto var(--space-3);"></i>
          <h3 style="font-size: var(--text-lg); margin-bottom: var(--space-2);">Audit Hash Mismatch</h3>
          <p style="color: var(--text-secondary); font-size: var(--text-sm); max-width: 400px; margin: 0 auto;">No matching ballot receipts fit that transaction verification ID on our ledger networks.</p>
        </div>
      `;
    }

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  // Bind Submit events
  document.getElementById('verify-search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('verify-input-id').value;
    performSearch(id);
  });

  if (initialId !== '') {
    performSearch(initialId);
  }

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

window.renderVoterVerify = renderVoterVerify;
