/**
 * Main application bootstrap and coordination.
 */
document.addEventListener('DOMContentLoaded', () => {
  // Initialize mock store instance
  window.appStore = new Store();
  window.appStore.load(); // restore local storage values if exists

  // Initialize theme manager
  window.themeManager = new ThemeManager();

  // Define SPA routes map mapping location hashes to render actions
  const routes = {
    // Public routes
    '#/landing': renderLandingPage,
    '#/login': renderLoginPage,
    '#/register': renderRegisterPage,

    // Voter routes
    '#/voter/dashboard': () => {
      enforceAuth('voter');
      renderLayoutShell('voter');
      renderVoterDashboard();
    },
    '#/voter/elections': () => {
      enforceAuth('voter');
      renderLayoutShell('voter');
      renderVoterElections();
    },
    '#/voter/candidates': () => {
      enforceAuth('voter');
      renderLayoutShell('voter');
      renderVoterCandidates();
    },
    '#/voter/vote-confirm': () => {
      enforceAuth('voter');
      renderLayoutShell('voter');
      renderVoterVoteConfirm();
    },
    '#/voter/vote-success': () => {
      enforceAuth('voter');
      renderLayoutShell('voter');
      renderVoterVoteSuccess();
    },
    '#/voter/verify': () => {
      enforceAuth('voter');
      renderLayoutShell('voter');
      renderVoterVerify();
    },

    // Admin routes
    '#/admin/dashboard': () => {
      enforceAuth('admin');
      renderLayoutShell('admin');
      renderAdminDashboard();
    },
    '#/admin/elections': () => {
      enforceAuth('admin');
      renderLayoutShell('admin');
      renderAdminElections();
    },
    '#/admin/candidates': () => {
      enforceAuth('admin');
      renderLayoutShell('admin');
      renderAdminCandidates();
    },
    '#/admin/results': () => {
      enforceAuth('admin');
      renderLayoutShell('admin');
      renderAdminResults();
    },
    '#/admin/fraud': () => {
      enforceAuth('admin');
      renderLayoutShell('admin');
      renderAdminFraud();
    },
    '#/admin/audit': () => {
      enforceAuth('admin');
      renderLayoutShell('admin');
      renderAdminAudit();
    },
    '#/admin/analytics': () => {
      enforceAuth('admin');
      renderLayoutShell('admin');
      renderAdminAnalytics();
    }
  };

  // Initialize router
  window.appRouter = new Router(routes, '#/landing');
  window.appRouter.init();
});

/**
 * Enforces authentication rules for protected views.
 */
function enforceAuth(requiredRole) {
  const store = window.appStore.state;
  if (!store.currentUser || store.currentUser !== requiredRole) {
    // If not authenticated, redirect back to login
    window.location.hash = '#/login';
  }
}

/**
 * Orchestrates layout adjustments (sidebar items, bottom mobile nav buttons) 
 * depending on Voter vs Admin perspectives.
 */
function renderLayoutShell(role) {
  const sidebar = document.getElementById('sidebar');
  const topbar = document.getElementById('topbar');
  const mobileNav = document.getElementById('mobile-navigation-bar');

  // Make layout blocks visible
  sidebar.classList.remove('hidden');
  topbar.classList.remove('hidden');
  mobileNav.classList.remove('hidden');
  document.getElementById('app-shell').style.display = 'flex';

  const menu = document.getElementById('sidebar-menu');
  const profile = document.getElementById('sidebar-profile-box');

  const voterLinks = [
    { label: "Dashboard", hash: "#/voter/dashboard", icon: "layout-dashboard" },
    { label: "Elections List", hash: "#/voter/elections", icon: "archive" },
    { label: "Verify Vote", hash: "#/voter/verify", icon: "search" }
  ];

  const adminLinks = [
    { label: "Executive Dashboard", hash: "#/admin/dashboard", icon: "layout-dashboard" },
    { label: "Manage Elections", hash: "#/admin/elections", icon: "settings" },
    { label: "Live Results", hash: "#/admin/results", icon: "activity" },
    { label: "Fraud Monitor", hash: "#/admin/fraud", icon: "shield-alert" },
    { label: "Audit Ledger", hash: "#/admin/audit", icon: "database" },
    { label: "Analytics Module", hash: "#/admin/analytics", icon: "bar-chart-3" }
  ];

  const links = role === 'admin' ? adminLinks : voterLinks;
  const currentHash = window.location.hash.split('?')[0];

  // Render Sidebar navigation links
  menu.innerHTML = links.map(lnk => {
    const isActive = currentHash === lnk.hash;
    return `
      <a href="${lnk.hash}" class="sidebar-link ${isActive ? 'active' : ''}">
        <i data-lucide="${lnk.icon}"></i>
        <span>${lnk.label}</span>
      </a>
    `;
  }).join('');

  // Render Profile panel footer
  const name = role === 'admin' ? "System Administrator" : window.appStore.state.currentVoterName;
  const sub = role === 'admin' ? "Audit Cleared" : window.appStore.state.currentVoterId;
  const initials = name.split(' ').map(n => n[0]).join('');

  profile.innerHTML = `
    <div class="user-profile-card">
      <div class="user-avatar">${initials}</div>
      <div class="user-info">
        <div class="user-name truncate">${name}</div>
        <div class="user-role truncate">${sub}</div>
      </div>
      <button id="logout-shell-btn" style="color: var(--text-tertiary);" title="Log out">
        <i data-lucide="log-out" style="width: 16px; height: 16px;"></i>
      </button>
    </div>
  `;

  // Bind logout listener
  document.getElementById('logout-shell-btn').addEventListener('click', () => {
    window.appStore.state.currentUser = null;
    window.appStore.save();
    window.location.hash = '#/landing';
  });

  // Render Mobile Bottom Nav matching the current roles
  mobileNav.innerHTML = links.map(lnk => {
    const isActive = currentHash === lnk.hash;
    return `
      <a href="${lnk.hash}" class="mobile-nav-link ${isActive ? 'active' : ''}">
        <i data-lucide="${lnk.icon}"></i>
        <span>${lnk.label}</span>
      </a>
    `;
  }).join('');

  // Update Page Title headers
  const activeLink = links.find(lnk => lnk.hash === currentHash);
  if (activeLink) {
    document.getElementById('page-title-header').innerText = activeLink.label;
    document.getElementById('page-subtitle-header').innerText = role === 'admin' ? 'Administrator Terminal Session' : 'Secure Voter Balloting Session';
  }

  // Refresh Lucide Icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}
