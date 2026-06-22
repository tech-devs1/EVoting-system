/**
 * Controller for Login View.
 */
function renderLoginPage() {
  const content = document.getElementById('content-area');
  
  // Hide topbar/sidebar for auth page
  document.getElementById('sidebar').classList.add('hidden');
  document.getElementById('topbar').classList.add('hidden');
  document.getElementById('mobile-navigation-bar').classList.add('hidden');
  document.getElementById('app-shell').style.display = 'block';

  content.innerHTML = `
    <div class="auth-container animate-page-enter">
      <div class="auth-mesh"></div>
      
      <div class="glass-card-strong auth-card">
        <div class="auth-header">
          <div class="auth-logo">
            <i data-lucide="shield-check"></i>
            <span>VoteTrust <strong style="color: var(--color-primary);">AI</strong></span>
          </div>
          <h2 class="auth-title">Voter & Admin Portal</h2>
          <p class="auth-subtitle">Sign in to review credentials and submit your ballot.</p>
        </div>

        <form id="login-form">
          <div class="form-group">
            <label class="form-label" for="login-email">Email Address</label>
            <div class="form-input-container">
              <i data-lucide="mail" class="form-input-icon"></i>
              <input type="email" id="login-email" class="form-input form-input-with-icon" placeholder="alex.mercer@htu.edu" required value="alex.mercer@htu.edu">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="login-password">Ballot Security Passphrase</label>
            <div class="form-input-container">
              <i data-lucide="lock" class="form-input-icon"></i>
              <input type="password" id="login-password" class="form-input form-input-with-icon" placeholder="••••••••••••" required value="password123">
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6);">
            <label class="form-checkbox-container">
              <input type="checkbox" class="form-checkbox" checked>
              <span>Remember this session</span>
            </label>
            <a href="#/login" style="font-size: var(--text-sm);">Forgot Key?</a>
          </div>

          <button type="submit" class="btn btn-primary btn-full hover-lift">
            <i data-lucide="key-round"></i> Decrypt & Access Terminal
          </button>
        </form>

        <div class="divider-text">Or Sign In with Organization Accounts</div>

        <div class="auth-social">
          <button class="btn btn-secondary btn-full" id="university-login-btn">
            <i data-lucide="school"></i> HTU Academic Account
          </button>
          <button class="btn btn-outline btn-full" id="admin-login-btn" style="border-color: rgba(124, 58, 237, 0.3); color: var(--color-purple);">
            <i data-lucide="fingerprint"></i> System Administrator Portal
          </button>
        </div>

        <div class="auth-security-badge">
          <i data-lucide="shield-check"></i> Protected by VoteTrust AI Security
        </div>
      </div>
    </div>
  `;

  // Bind Submit events
  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    // Simulate regular voter login
    window.appStore.state.currentUser = 'voter';
    window.appStore.save();
    window.location.hash = '#/voter/dashboard';
  });

  document.getElementById('university-login-btn').addEventListener('click', () => {
    window.appStore.state.currentUser = 'voter';
    window.appStore.save();
    window.location.hash = '#/voter/dashboard';
  });

  document.getElementById('admin-login-btn').addEventListener('click', () => {
    window.appStore.state.currentUser = 'admin';
    window.appStore.save();
    window.location.hash = '#/admin/dashboard';
  });
}

window.renderLoginPage = renderLoginPage;
