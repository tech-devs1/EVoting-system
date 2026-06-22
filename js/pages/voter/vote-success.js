/**
 * Controller for Vote Success View.
 */
function renderVoterVoteSuccess() {
  const content = document.getElementById('content-area');
  const store = window.appStore.state;

  const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
  const verificationId = urlParams.get('verificationId');

  if (!verificationId) {
    content.innerHTML = `
      <div class="empty-state">
        <i data-lucide="alert-triangle"></i>
        <h3>Invalid Session</h3>
        <p>No valid ballot validation receipts were returned during this browser session.</p>
        <a href="#/voter/dashboard" class="btn btn-primary">Back to Dashboard</a>
      </div>
    `;
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
    return;
  }

  content.innerHTML = `
    <div class="confirm-box animate-page-enter" style="max-width: 500px;">
      
      <!-- Success animated checkmark -->
      <div class="success-checkmark" style="margin-bottom: var(--space-6);">
        <div class="check-icon"></div>
      </div>

      <h2 style="margin-bottom: var(--space-2);">Vote Cast Successfully!</h2>
      <p style="color: var(--text-secondary); font-size: var(--text-sm); margin-bottom: var(--space-8);">Your ballot transaction has been processed and saved to the audit ledger.</p>

      <!-- Digital Receipt box details -->
      <div class="receipt-box" style="text-align: left; background: var(--bg-secondary); border-color: var(--color-success); border-style: solid; box-shadow: var(--shadow-glow-green);">
        <div style="font-weight: bold; font-family: var(--font-body); font-size: var(--text-xs); color: var(--color-success); text-transform: uppercase; letter-spacing: var(--tracking-wide); margin-bottom: var(--space-4); display: flex; align-items: center; gap: var(--space-1.5);">
          <i data-lucide="shield-check" style="width: 14px; height: 14px;"></i> Crypto Receipt Generated
        </div>
        <div class="receipt-row">
          <span>Verification ID:</span>
          <span style="font-weight: bold; color: var(--text-primary);" id="success-v-id">${verificationId}</span>
        </div>
        <div class="receipt-row">
          <span>Ledger Status:</span>
          <span style="color: var(--color-success); font-weight: bold;">HASH_VERIFIED</span>
        </div>
        <div class="receipt-row">
          <span>Timestamp:</span>
          <span style="font-size: var(--text-xs);">${new Date().toLocaleString()}</span>
        </div>
      </div>

      <!-- Action items tools -->
      <div style="display: flex; flex-direction: column; gap: var(--space-3); margin-bottom: var(--space-6);">
        <div style="display: flex; gap: var(--space-3);">
          <button class="btn btn-secondary btn-full btn-sm" id="copy-v-id-btn">
            <i data-lucide="copy"></i> Copy Verification ID
          </button>
          <button class="btn btn-secondary btn-full btn-sm" id="download-receipt-btn">
            <i data-lucide="download"></i> Download Receipt
          </button>
        </div>
        <a href="#/voter/verify?verificationId=${verificationId}" class="btn btn-primary">
          <i data-lucide="search"></i> Verify on Audit Explorer
        </a>
      </div>

      <a href="#/voter/dashboard" style="font-size: var(--text-sm); font-weight: var(--weight-semibold);">
        Return to Dashboard Terminal
      </a>

    </div>
  `;

  // Bind utilities events
  document.getElementById('copy-v-id-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(verificationId);
    alert('Verification ID copied to clipboard!');
  });

  document.getElementById('download-receipt-btn').addEventListener('click', () => {
    const text = `VOTETRUST AI DIGITAL BALLOT RECEIPT\n==================================\nVerification ID: ${verificationId}\nStatus: HASH_VERIFIED\nTimestamp: ${new Date().toISOString()}\n==================================`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VoteTrust-Receipt-${verificationId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  });

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

window.renderVoterVoteSuccess = renderVoterVoteSuccess;
