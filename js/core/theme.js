/**
 * Handles Dark/Light Mode Theme switches.
 */
class ThemeManager {
  constructor(toggleButtonSelector = '.theme-toggle-btn') {
    this.toggleButtonSelector = toggleButtonSelector;
    this.currentTheme = localStorage.getItem('theme') || 'light';
    this.init();
  }

  init() {
    this.applyTheme(this.currentTheme);
    
    // Listen for dynamically created toggles
    document.addEventListener('click', (e) => {
      if (e.target.closest(this.toggleButtonSelector)) {
        this.toggleTheme();
      }
    });
  }

  toggleTheme() {
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.applyTheme(newTheme);
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    this.currentTheme = theme;
  }
}

window.ThemeManager = ThemeManager;
