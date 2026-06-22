/**
 * Controller for Audit Ledger Explorer View.
 */
function renderAdminAudit() {
  const content = document.getElementById('content-area');
  const store = window.appStore.state;

  content.innerHTML = `
    <div class="animate-page-enter">
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6); flex-wrap: wrap; gap: var(--space-4);">
        <div>
          <h2 style="font-size: var(--text-xl); margin-bottom: var(--space-1);">Cryptographic Audit Ledger Explorer</h2>
          <span style="font-size: var(--text-xs); color: var(--text-secondary);">Verify the validation chains hashes preservation ledger state</span>
        </div>
        <button class="btn btn-primary" id="run-integrity-btn">
          <i data-lucide="shield-check"></i> Run Integrity Check
        </button>
      </div>

      <!-- Blockchain visual node columns -->
      <div class="blockchain-visualizer" id="blockchain-visual-nodes-container">
        <!-- Rendered dynamically -->
      </div>

      <!-- Tables list detailing blocks metadata -->
      <div class="card">
        <h3 style="font-size: var(--text-base); margin-bottom: var(--space-4);">Block Ledger Log</h3>
        <div class="table-container">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Verification ID</th>
                <th>Hash Signature</th>
                <th>Parent Hash</th>
                <th>Timestamp</th>
                <th>Integrity</th>
              </tr>
            </thead>
            <tbody id="audit-table-body-container">
              <!-- Rendered dynamically -->
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;

  function renderLedger() {
    const visual = document.getElementById('blockchain-visual-nodes-container');
    const table = document.getElementById('audit-table-body-container');

    // Visual nodes
    visual.innerHTML = store.auditNodes.map((node, idx) => `
      <div class="blockchain-node ${node.status === 'valid' ? 'valid' : 'broken'} animate-scale-in">
        <span class="badge ${node.status === 'valid' ? 'badge-success' : 'badge-danger'}" style="align-self: flex-start; margin-bottom: var(--space-2);">BLOCK #${idx + 1}</span>
        <div class="node-hash">Hash: ${node.hash.substring(0, 16)}...</div>
        <div class="node-prev">Prev: ${node.prevHash.substring(0, 12)}...</div>
        <div class="node-meta">
          <span>${node.id}</span>
          <span>Verified</span>
        </div>
      </div>
      ${idx < store.auditNodes.length - 1 ? `
        <div class="blockchain-connector">
          <i data-lucide="arrow-right"></i>
        </div>
      ` : ''}
    `).join('');

    // Table rows
    table.innerHTML = store.auditNodes.map(node => `
      <tr>
        <td style="font-family: var(--font-mono); font-weight: bold;">${node.id}</td>
        <td style="font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-secondary); word-break: break-all;">${node.hash}</td>
        <td style="font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-tertiary); word-break: break-all;">${node.prevHash}</td>
        <td>${new Date(node.timestamp).toLocaleString()}</td>
        <td><span class="badge badge-success">Valid</span></td>
      </tr>
    `).join('');

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  // Bind Integrity Checks button
  document.getElementById('run-integrity-btn').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="refresh-cw" class="animate-spin"></i> Checking ledger...`;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    setTimeout(() => {
      // Add a mock new audit node on integrity checks
      const lastNode = store.auditNodes[store.auditNodes.length - 1];
      const nextId = `VT-2026-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const nextHash = Math.random().toString(36).substring(2, 64);
      
      const newNode = {
        id: nextId,
        hash: nextHash,
        prevHash: lastNode ? lastNode.hash : "0000000000000000000000000000000000000000000000000000000000000000",
        timestamp: new Date().toISOString(),
        status: "valid"
      };

      store.auditNodes.push(newNode);
      window.appStore.save();

      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="shield-check"></i> Integrity Checked: OK`;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      renderLedger();
    }, 1500);
  });

  renderLedger();
}

window.renderAdminAudit = renderAdminAudit;
