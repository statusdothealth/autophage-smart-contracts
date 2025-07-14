// Theme management for Autophage Protocol - LaTeX Style
// Theme Manager with time-based and system preference detection
const ThemeManager = {
    // Get the appropriate theme based on time, system preference, or saved preference
    getTheme: function() {
        // First check if user has explicitly set a theme
        const savedTheme = localStorage.getItem('theme');
        const savedThemeTime = localStorage.getItem('themeSetTime');
        
        // If theme was manually set in the last 24 hours, respect it
        if (savedTheme && savedThemeTime) {
            const hoursSinceSet = (Date.now() - parseInt(savedThemeTime)) / (1000 * 60 * 60);
            if (hoursSinceSet < 24) {
                return savedTheme;
            }
        }
        
        // Check if it's after 7 PM or before 6 AM
        const hour = new Date().getHours();
        if (hour >= 19 || hour < 6) {
            return 'dark';
        }
        
        // Check system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        
        // Default to light
        return 'light';
    },
    
    // Apply theme to the page
    applyTheme: function(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            const button = document.querySelector('.mode-toggle');
            if (button) button.textContent = 'L';
        } else {
            document.body.classList.remove('dark-mode');
            const button = document.querySelector('.mode-toggle');
            if (button) button.textContent = 'D';
        }
    },
    
    // Save theme preference with timestamp
    saveTheme: function(theme) {
        localStorage.setItem('theme', theme);
        localStorage.setItem('themeSetTime', Date.now().toString());
    }
};

// Initialize theme before page render to prevent flash
(function() {
    const theme = ThemeManager.getTheme();
    
    // Add class to html element to prevent flash
    if (theme === 'dark') {
        document.documentElement.classList.add('dark-mode-init');
    }
})();

// Apply theme to body when DOM is ready
window.addEventListener('DOMContentLoaded', function() {
    // Remove the init class and apply theme properly
    document.documentElement.classList.remove('dark-mode-init');
    
    const theme = ThemeManager.getTheme();
    ThemeManager.applyTheme(theme);
    
    // Listen for system theme changes
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            // Only auto-switch if user hasn't manually set theme recently
            const savedThemeTime = localStorage.getItem('themeSetTime');
            if (!savedThemeTime || (Date.now() - parseInt(savedThemeTime)) > (1000 * 60 * 60 * 24)) {
                const theme = ThemeManager.getTheme();
                ThemeManager.applyTheme(theme);
            }
        });
    }
    
    // Check for time-based theme changes every minute
    setInterval(() => {
        const savedThemeTime = localStorage.getItem('themeSetTime');
        if (!savedThemeTime || (Date.now() - parseInt(savedThemeTime)) > (1000 * 60 * 60 * 24)) {
            const theme = ThemeManager.getTheme();
            ThemeManager.applyTheme(theme);
        }
    }, 60000); // Check every minute
});

// Theme toggle function
function toggleTheme() {
    const isDark = document.body.classList.contains('dark-mode');
    const newTheme = isDark ? 'light' : 'dark';
    ThemeManager.applyTheme(newTheme);
    ThemeManager.saveTheme(newTheme);
}

// Keyboard shortcuts for theme switching
document.addEventListener('keydown', function(event) {
    // Don't trigger if user is typing in an input
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
    }
    
    // L key for light mode
    if (event.key === 'l' || event.key === 'L') {
        if (document.body.classList.contains('dark-mode')) {
            ThemeManager.applyTheme('light');
            ThemeManager.saveTheme('light');
        }
    }
    
    // D key for dark mode
    if (event.key === 'd' || event.key === 'D') {
        if (!document.body.classList.contains('dark-mode')) {
            ThemeManager.applyTheme('dark');
            ThemeManager.saveTheme('dark');
        }
    }
});

// Listen for theme changes across tabs
window.addEventListener('storage', (e) => {
    if (e.key === 'theme') {
        const theme = e.newValue;
        if (theme) {
            ThemeManager.applyTheme(theme);
        }
    }
});