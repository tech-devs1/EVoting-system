/**
 * Controller for Registration View.
 */
function renderRegisterPage() {
  const content = document.getElementById('content-area');
  
  // Hide topbar/sidebar for auth page
  document.getElementById('sidebar').classList.add('hidden');
  document.getElementById('topbar').classList.add('hidden');
  document.getElementById('mobile-navigation-bar').classList.add('hidden');
  document.getElementById('app-shell').style.display = 'block';

  let currentStep = 1;

  function updateFormContent() {
    const cardBody = document.getElementById('register-card-body');
    const progressBar = document.getElementById('reg-progress-bar');
    const steps = document.querySelectorAll('.reg-step');

    // Update Steps
    steps.forEach((step, idx) => {
      if (idx + 1 < currentStep) {
        step.className = 'reg-step completed';
        step.innerHTML = '<i data-lucide="check" style="width: 14px; height: 14px;"></i>';
      } else if (idx + 1 === currentStep) {
        step.className = 'reg-step active';
        step.innerHTML = idx + 1;
      } else {
        step.className = 'reg-step';
        step.innerHTML = idx + 1;
      }
    });

    progressBar.style.width = `${((currentStep - 1) / 3) * 100}%`;

    if (currentStep === 1) {
      cardBody.innerHTML = `
        <form id="reg-form-step-1">
          <div class="form-group">
            <label class="form-label" for="reg-id">Student ID / Employee Code</label>
            <div class="form-input-container">
              <i data-lucide="hash" class="form-input-icon"></i>
              <input type="text" id="reg-id" class="form-input form-input-with-icon" placeholder="HTU-2026-8849" required>
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-full hover-lift" style="margin-top: var(--space-4);">
            Verify Student Record <i data-lucide="arrow-right"></i>
          </button>
        </form>
      `;
    } else if (currentStep === 2) {
      cardBody.innerHTML = `
        <form id="reg-form-step-2">
          <div class="form-group">
            <label class="form-label" for="reg-name">Full Name (Matches ID)</label>
            <div class="form-input-container">
              <i data-lucide="user" class="form-input-icon"></i>
              <input type="text" id="reg-name" class="form-input form-input-with-icon" placeholder="Alex Mercer" required>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-email">Institution Email Address</label>
            <div class="form-input-container">
              <i data-lucide="mail" class="form-input-icon"></i>
              <input type="email" id="reg-email" class="form-input form-input-with-icon" placeholder="alex.mercer@htu.edu" required>
            </div>
          </div>
          <div style="display: flex; gap: var(--space-4); margin-top: var(--space-4);">
            <button type="button" class="btn btn-secondary btn-full" id="reg-back-1">Back</button>
            <button type="submit" class="btn btn-primary btn-full">Continue</button>
          </div>
        </form>
      `;
    } else if (currentStep === 3) {
      cardBody.innerHTML = `
        <form id="reg-form-step-3">
          <div class="form-group">
            <label class="form-label" for="reg-password">Ballot Security Passphrase</label>
            <div class="form-input-container">
              <i data-lucide="lock" class="form-input-icon"></i>
              <input type="password" id="reg-password" class="form-input form-input-with-icon" placeholder="••••••••••••" required>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-confirm">Confirm Passphrase</label>
            <div class="form-input-container">
              <i data-lucide="lock" class="form-input-icon"></i>
              <input type="password" id="reg-confirm" class="form-input form-input-with-icon" placeholder="••••••••••••" required>
            </div>
          </div>
          <div style="display: flex; gap: var(--space-4); margin-top: var(--space-4);">
            <button type="button" class="btn btn-secondary btn-full" id="reg-back-2">Back</button>
            <button type="submit" class="btn btn-primary btn-full">Generate Digital Signature</button>
          </div>
        </form>
      `;
    } else if (currentStep === 4) {
      cardBody.innerHTML = `
        <div class="success-screen">
          <div class="success-icon-wrapper">
            <i data-lucide="mail-check"></i>
          </div>
          <h3 class="auth-title">Registration Verified</h3>
          <p class="auth-subtitle" style="margin-bottom: var(--space-4);">
            An email verification challenge was sent. Tap the confirmation link in your institutional inbox to activate key verification.
          </p>
          <a href="#/login" class="btn btn-primary btn-full hover-lift">Proceed to Login Terminal</a>
        </div>
      `;
    }

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    // Bind sub-form listeners
    if (currentStep === 1) {
      document.getElementById('reg-form-step-1').addEventListener('submit', (e) => {
        e.preventDefault();
        currentStep = 2;
        updateFormContent();
      });
    } else if (currentStep === 2) {
      document.getElementById('reg-form-step-2').addEventListener('submit', (e) => {
        e.preventDefault();
        currentStep = 3;
        updateFormContent();
      });
      document.getElementById('reg-back-1').addEventListener('click', () => {
        currentStep = 1;
        updateFormContent();
      });
    } else if (currentStep === 3) {
      document.getElementById('reg-form-step-3').addEventListener('submit', (e) => {
        e.preventDefault();
        currentStep = 4;
        updateFormContent();
      });
      document.getElementById('reg-back-2').addEventListener('click', () => {
        currentStep = 2;
        updateFormContent();
      });
    }
  }

  content.innerHTML = `
    <div class="auth-container animate-page-enter">
      <div class="auth-mesh"></div>
      
      <div class="glass-card-strong auth-card">
        <div class="auth-header">
          <div class="auth-logo">
            <i data-lucide="shield-check"></i>
            <span>VoteTrust <strong style="color: var(--color-primary);">AI</strong></span>
          </div>
          <h2 class="auth-title">Voter Registration</h2>
          <p class="auth-subtitle">Verify your student profile to claim voter verification certificates.</p>
        </div>

        <div class="reg-progress">
          <div class="reg-progress-bar" id="reg-progress-bar" style="width: 0%;"></div>
          <div class="reg-step active">1</div>
          <div class="reg-step">2</div>
          <div class="reg-step">3</div>
          <div class="reg-step">4</div>
        </div>

        <div id="register-card-body"></div>

        <div class="auth-security-badge" style="margin-top: var(--space-6);">
          <i data-lucide="shield-check"></i> Protected by VoteTrust AI Security
        </div>
      </div>
    </div>
  `;

  updateFormContent();
}

window.renderRegisterPage = renderRegisterPage;
