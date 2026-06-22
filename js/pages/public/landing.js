/**
 * Controller for Landing Page View.
 */
function renderLandingPage() {
  const content = document.getElementById('content-area');
  
  // Hide topbar/sidebar for landing page if desired, or keep shell
  document.getElementById('sidebar').classList.add('hidden');
  document.getElementById('topbar').classList.add('hidden');
  document.getElementById('mobile-navigation-bar').classList.add('hidden');
  document.getElementById('app-shell').style.display = 'block';

  content.innerHTML = `
    <div class="landing-container animate-page-enter">
      <!-- Top Sticky Navigation -->
      <nav style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-4) var(--space-8); background: var(--bg-glass); backdrop-filter: blur(10px); border-bottom: 1px solid var(--border-color); position: sticky; top: 0; z-index: var(--z-sticky);">
        <div class="sidebar-logo">
          <i data-lucide="shield-check"></i>
          <span>VoteTrust <strong style="color: var(--color-primary);">AI</strong></span>
        </div>
        <div style="display: flex; gap: var(--space-4); align-items: center;">
          <button class="theme-toggle-btn" aria-label="Toggle Light/Dark Theme">
            <i data-lucide="sun" class="sun-icon"></i>
            <i data-lucide="moon" class="moon-icon"></i>
          </button>
          <a href="#/login" class="btn btn-secondary btn-sm">Sign In</a>
          <a href="#/register" class="btn btn-primary btn-sm">Get Started</a>
        </div>
      </nav>

      <!-- Hero Section -->
      <header class="hero-section">
        <div class="hero-mesh"></div>
        <div class="container hero-grid">
          <div class="hero-content">
            <span class="hero-badge"><i data-lucide="lock"></i> End-to-End Cryptographic Security</span>
            <h1 class="hero-title">Secure Digital Elections Powered by <span class="gradient-text">AI & Cryptography</span></h1>
            <p class="hero-subtitle">Transparent, Tamper-Proof, and Trusted E-Voting for Universities and Enterprise Organizations.</p>
            <div class="hero-ctas">
              <a href="#/login" class="btn btn-primary btn-lg hover-lift">Vote Now</a>
              <a href="#/landing#features" class="btn btn-outline btn-lg">Explore Features</a>
            </div>
          </div>
          <div class="hero-illustration">
            <div class="illustration-bg"></div>
            <!-- Glassmorphism dashboard mockup element -->
            <div class="glass-card-strong illustration-card">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
                <span class="badge badge-success"><i data-lucide="circle-dot" class="animate-pulse"></i> LIVE election</span>
                <span style="font-size: var(--text-xs); color: var(--text-tertiary);">Turnout: 84.6%</span>
              </div>
              <h3 style="font-size: var(--text-base); margin-bottom: var(--space-2);">HTU presidential candidate count</h3>
              <!-- Micro chart bars -->
              <div style="display: flex; flex-direction: column; gap: var(--space-3); margin-top: var(--space-4);">
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: var(--text-xs); margin-bottom: var(--space-1);">
                    <span>Elena Rostova</span>
                    <span>52%</span>
                  </div>
                  <div style="height: 6px; background: var(--bg-tertiary); border-radius: 3px; overflow: hidden;">
                    <div style="width: 52%; height: 100%; background: var(--color-primary);"></div>
                  </div>
                </div>
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: var(--text-xs); margin-bottom: var(--space-1);">
                    <span>Marcus Vance</span>
                    <span>48%</span>
                  </div>
                  <div style="height: 6px; background: var(--bg-tertiary); border-radius: 3px; overflow: hidden;">
                    <div style="width: 48%; height: 100%; background: var(--color-purple);"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Floating verification widgets -->
            <div class="glass-card-strong floating-widget widget-top-left" style="padding: var(--space-3) var(--space-4); display: flex; gap: var(--space-2); align-items: center; border-color: rgba(34, 197, 94, 0.4);">
              <i data-lucide="check-circle" class="text-success"></i>
              <div style="text-align: left;">
                <p style="font-size: var(--text-xs); font-weight: bold; color: var(--text-primary); margin:0;">Vote Hash Verified</p>
                <span style="font-size: 10px; color: var(--text-tertiary);">SHA-256 Valid</span>
              </div>
            </div>

            <div class="glass-card-strong floating-widget widget-bottom-right" style="padding: var(--space-3) var(--space-4); display: flex; gap: var(--space-2); align-items: center; border-color: rgba(124, 58, 237, 0.4);">
              <i data-lucide="fingerprint" class="text-info"></i>
              <div style="text-align: left;">
                <p style="font-size: var(--text-xs); font-weight: bold; color: var(--text-primary); margin:0;">Voter Anonymized</p>
                <span style="font-size: 10px; color: var(--text-tertiary);">Zero-Knowledge Proof</span>
              </div>
            </div>

          </div>
        </div>
      </header>

      <!-- Features grid section -->
      <section id="features" class="section container">
        <div class="section-header">
          <span class="section-tag">Security & Protection</span>
          <h2 class="section-title">Designed for Ultimate Integrity</h2>
          <p class="section-subtitle">A modern civic ledger built on top-tier cryptographic protocols and advanced monitoring logic.</p>
        </div>

        <div class="features-grid">
          <div class="card card-hover feature-card">
            <div class="feature-icon-wrapper">
              <i data-lucide="shield-alert"></i>
            </div>
            <h3 class="feature-title">Secure Authentication</h3>
            <p class="feature-desc">Single sign-on binding, strict biometric credentials validation, and one-time MFA codes protect voting lines.</p>
          </div>

          <div class="card card-hover feature-card">
            <div class="feature-icon-wrapper">
              <i data-lucide="user-x"></i>
            </div>
            <h3 class="feature-title">Anonymous Voting</h3>
            <p class="feature-desc">Homomorphic encryption protects ballot options selection, making sure candidate choice is hidden from database keys.</p>
          </div>

          <div class="card card-hover feature-card">
            <div class="feature-icon-wrapper">
              <i data-lucide="bar-chart-3"></i>
            </div>
            <h3 class="feature-title">Real-Time Results</h3>
            <p class="feature-desc">Direct result summaries compile on audit chain update ticks, offering dynamic, trustable election charts instantly.</p>
          </div>

          <div class="card card-hover feature-card">
            <div class="feature-icon-wrapper">
              <i data-lucide="eye"></i>
            </div>
            <h3 class="feature-title">Fraud Detection</h3>
            <p class="feature-desc">AI monitors login session anomalies, threat levels, browser fingerprints, and multiple identity queries.</p>
          </div>

          <div class="card card-hover feature-card">
            <div class="feature-icon-wrapper">
              <i data-lucide="cpu"></i>
            </div>
            <h3 class="feature-title">Audit Verification</h3>
            <p class="feature-desc">Verify your ballot transaction ID matches the chain hash state, ensuring your vote was accurately stored.</p>
          </div>

          <div class="card card-hover feature-card">
            <div class="feature-icon-wrapper">
              <i data-lucide="database"></i>
            </div>
            <h3 class="feature-title">SHA-256 Audit Chain</h3>
            <p class="feature-desc">A back-linked cryptographic ledger enforces records preservation. Broken chains trigger threat scores instantly.</p>
          </div>
        </div>
      </section>

      <!-- How it works timeline -->
      <section class="section" style="background: var(--bg-secondary);">
        <div class="container">
          <div class="section-header">
            <span class="section-tag">Simplifying E-voting</span>
            <h2 class="section-title">Step-by-Step E-Voting Journey</h2>
            <p class="section-subtitle">Our 3-click voting process fits smoothly into any browser or smartphone layout.</p>
          </div>

          <div class="timeline">
            <div class="timeline-item">
              <div class="timeline-node"></div>
              <div class="timeline-step">Step 1</div>
              <h3 style="font-size: var(--text-lg); margin-bottom: var(--space-2);">Register Account</h3>
              <p style="font-size: var(--text-sm);">Provide credentials like student identity card, matching details, and set passphrase key.</p>
            </div>

            <div class="timeline-item">
              <div class="timeline-node"></div>
              <div class="timeline-step">Step 2</div>
              <h3 style="font-size: var(--text-lg); margin-bottom: var(--space-2);">Verify Identity</h3>
              <p style="font-size: var(--text-sm);">Confirm identity keys via verification link or multi-factor code confirmation codes.</p>
            </div>

            <div class="timeline-item">
              <div class="timeline-node"></div>
              <div class="timeline-step">Step 3</div>
              <h3 style="font-size: var(--text-lg); margin-bottom: var(--space-2);">Cast Ballot</h3>
              <p style="font-size: var(--text-sm);">Browse candidates, compare election manifestos, and securely submit choices.</p>
            </div>

            <div class="timeline-item">
              <div class="timeline-node"></div>
              <div class="timeline-step">Step 4</div>
              <h3 style="font-size: var(--text-lg); margin-bottom: var(--space-2);">Verify Vote</h3>
              <p style="font-size: var(--text-sm);">Download cryptographic verification receipt and lookup registration records on hash explorer.</p>
            </div>

            <div class="timeline-item">
              <div class="timeline-node"></div>
              <div class="timeline-step">Step 5</div>
              <h3 style="font-size: var(--text-lg); margin-bottom: var(--space-2);">View Results</h3>
              <p style="font-size: var(--text-sm);">Wait for election termination to review certified analytics breakdown tables.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Testimonials -->
      <section class="section container">
        <div class="section-header">
          <span class="section-tag">Organization Testimonials</span>
          <h2 class="section-title">Trusted by Academic Leaders</h2>
        </div>

        <div class="testimonials-slider">
          <div class="testimonial-track">
            <div class="testimonial-slide">
              <div class="glass-card text-center" style="max-width: 600px; margin: 0 auto;">
                <p style="font-size: var(--text-base); font-style: italic; margin-bottom: var(--space-4);">"VoteTrust AI redefined our student elections. Over 88% voter turnout was achieved with absolute confidence in election integrity."</p>
                <h4 style="font-size: var(--text-sm); margin-bottom: var(--space-1);">Prof. Evelyn Carter</h4>
                <span style="font-size: var(--text-xs); color: var(--text-tertiary);">Dean of Student Affairs, HTU</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Footer -->
      <footer class="landing-footer">
        <div class="container footer-grid">
          <div class="footer-brand">
            <div class="sidebar-logo">
              <i data-lucide="shield-check"></i>
              <span>VoteTrust <strong style="color: var(--color-primary);">AI</strong></span>
            </div>
            <p class="footer-desc">Next-generation secure, transparent digital voting technology built for institutions worldwide.</p>
          </div>
          <div class="footer-column">
            <h4 class="footer-col-title">Platform</h4>
            <div class="footer-links">
              <a href="#/login" class="footer-link">Vote Now</a>
              <a href="#/landing#features" class="footer-link">Security Specs</a>
              <a href="#/landing" class="footer-link">Institutional Pricing</a>
            </div>
          </div>
          <div class="footer-column">
            <h4 class="footer-col-title">Support</h4>
            <div class="footer-links">
              <a href="#/landing" class="footer-link">Audit Guide</a>
              <a href="#/landing" class="footer-link">Help Desk</a>
              <a href="#/landing" class="footer-link">System Status</a>
            </div>
          </div>
          <div class="footer-column">
            <h4 class="footer-col-title">Legal</h4>
            <div class="footer-links">
              <a href="#/landing" class="footer-link">Privacy Policy</a>
              <a href="#/landing" class="footer-link">Terms of Service</a>
              <a href="#/landing" class="footer-link">Voter Charter</a>
            </div>
          </div>
        </div>
        <div class="container footer-bottom">
          <span>&copy; 2026 VoteTrust AI. All rights reserved.</span>
          <span>Protected by AES-256 & SHA-256 Cryptography</span>
        </div>
      </footer>
    </div>
  `;
}

window.renderLandingPage = renderLandingPage;
