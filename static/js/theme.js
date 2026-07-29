/**
 * Theme Manager — Dark/Light mode toggle with localStorage persistence.
 */
(function() {
    'use strict';

    const STORAGE_KEY = 'nexusai-theme';

    function getTheme() {
        return localStorage.getItem(STORAGE_KEY) || 'dark';
    }

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(STORAGE_KEY, theme);

        // Update highlight.js theme
        const hljsLink = document.getElementById('hljs-theme');
        if (hljsLink) {
            hljsLink.href = theme === 'dark'
                ? 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css'
                : 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
        }

        // Update active state in settings modal
        document.querySelectorAll('.theme-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });
    }

    function toggleTheme() {
        const current = getTheme();
        setTheme(current === 'dark' ? 'light' : 'dark');
    }

    // Apply saved theme immediately
    setTheme(getTheme());

    // Bind toggle button
    document.addEventListener('DOMContentLoaded', () => {
        const toggleBtn = document.getElementById('themeToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggleTheme);
        }

        // Settings modal theme buttons
        document.querySelectorAll('.theme-option').forEach(btn => {
            btn.addEventListener('click', () => {
                setTheme(btn.dataset.theme);
            });
        });

        // Set initial active states
        setTheme(getTheme());
    });

    // Expose globally
    window.NexusTheme = { getTheme, setTheme, toggleTheme };
})();
