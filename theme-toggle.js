(function () {
    const storageKey = 'cameron-theme-preview';
    const visibleClass = 'theme-switcher-visible';
    const modes = [
        { id: 'auto', label: 'Auto', hour: null },
        { id: 'noon', label: 'Noon', hour: 12 },
        { id: 'evening', label: '6 PM', hour: 18 },
        { id: 'midnight', label: 'Midnight', hour: 0 },
        { id: 'morning', label: '6 AM', hour: 6 }
    ];

    function getMode() {
        const saved = localStorage.getItem(storageKey);
        return modes.some(mode => mode.id === saved) ? saved : 'auto';
    }

    function getModeData() {
        return modes.find(mode => mode.id === getMode()) || modes[0];
    }

    function getDate() {
        const mode = getModeData();
        const date = new Date();

        if (mode.hour !== null) {
            date.setHours(mode.hour, 0, 0, 0);
        }

        return date;
    }

    function getHour() {
        const date = getDate();
        return date.getHours() + date.getMinutes() / 60;
    }

    function getIntensity() {
        return (Math.cos((getHour() - 12) / 24 * Math.PI * 2) + 1) / 2;
    }

    function applyDocumentState() {
        const root = document.documentElement;
        const mode = getMode();
        const hour = getHour();
        const intensity = getIntensity();

        root.dataset.themePreview = mode;
        root.dataset.themePeriod = intensity > 0.5 ? 'day' : 'night';
        root.style.setProperty('--theme-hour', hour.toFixed(2));
        root.style.setProperty('--theme-intensity', intensity.toFixed(4));

        document.querySelectorAll('[data-theme-mode]').forEach(button => {
            button.classList.toggle('is-active', button.dataset.themeMode === mode);
        });
    }

    function refreshPageTheme() {
        applyDocumentState();

        if (typeof window.updateTheme === 'function') {
            window.updateTheme();
        }

        window.dispatchEvent(new CustomEvent('cameron-theme-change', {
            detail: {
                mode: getMode(),
                hour: getHour(),
                intensity: getIntensity()
            }
        }));
    }

    function setMode(mode) {
        if (!modes.some(item => item.id === mode)) return;
        localStorage.setItem(storageKey, mode);
        refreshPageTheme();
    }

    function toggleVisibility() {
        const visible = document.body.classList.toggle(visibleClass);
        const panel = document.getElementById('theme-switcher');
        if (panel) panel.setAttribute('aria-hidden', visible ? 'false' : 'true');
    }

    function injectStyles() {
        if (document.getElementById('theme-switcher-styles')) return;

        const style = document.createElement('style');
        style.id = 'theme-switcher-styles';
        style.textContent = `
            .theme-switcher {
                position: fixed;
                left: 24px;
                bottom: 24px;
                z-index: 10000;
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 10px;
                color: #f4f4f5;
                background: rgba(10, 10, 12, 0.68);
                border: 1px solid rgba(255, 255, 255, 0.16);
                box-shadow: 0 18px 50px rgba(0, 0, 0, 0.38);
                backdrop-filter: blur(18px) saturate(1.08);
                -webkit-backdrop-filter: blur(18px) saturate(1.08);
                opacity: 0;
                pointer-events: none;
                transform: translateY(8px);
                transition: opacity 0.22s ease, transform 0.22s ease;
                font-family: 'Archivo', sans-serif;
            }

            body.theme-switcher-visible .theme-switcher {
                opacity: 1;
                pointer-events: auto;
                transform: translateY(0);
            }

            .theme-switcher__label {
                padding: 0 8px 0 2px;
                color: rgba(244, 244, 245, 0.58);
                font-size: 0.62rem;
                letter-spacing: 1.6px;
                text-transform: uppercase;
                white-space: nowrap;
            }

            .theme-switcher button {
                border: 1px solid rgba(255, 255, 255, 0.18);
                background: transparent;
                color: inherit;
                padding: 8px 10px;
                min-width: 58px;
                font: inherit;
                font-size: 0.62rem;
                letter-spacing: 1.2px;
                text-transform: uppercase;
                cursor: pointer;
            }

            .theme-switcher button:hover {
                border-color: rgba(255, 255, 255, 0.42);
            }

            .theme-switcher button.is-active {
                background: #f4f4f5;
                border-color: #f4f4f5;
                color: #08080a;
            }

            @media (max-width: 720px) {
                .theme-switcher {
                    right: 16px;
                    bottom: 16px;
                    left: 16px;
                    flex-wrap: wrap;
                }

                .theme-switcher__label {
                    width: 100%;
                }

                .theme-switcher button {
                    flex: 1 1 auto;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function buildSwitcher() {
        if (document.getElementById('theme-switcher')) return;

        injectStyles();

        const panel = document.createElement('div');
        panel.id = 'theme-switcher';
        panel.className = 'theme-switcher';
        panel.setAttribute('aria-hidden', 'true');

        const label = document.createElement('div');
        label.className = 'theme-switcher__label';
        label.textContent = 'Theme Time';
        panel.appendChild(label);

        modes.forEach(mode => {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.themeMode = mode.id;
            button.textContent = mode.label;
            button.addEventListener('click', () => setMode(mode.id));
            panel.appendChild(button);
        });

        document.body.appendChild(panel);
        applyDocumentState();
    }

    document.addEventListener('keydown', event => {
        const target = event.target;
        const tagName = target && target.tagName ? target.tagName.toLowerCase() : '';
        const isTyping = tagName === 'input' || tagName === 'textarea' || tagName === 'select' || (target && target.isContentEditable);

        if (isTyping || event.metaKey || event.ctrlKey || event.altKey) return;
        if (event.key.toLowerCase() === 'x') toggleVisibility();
    });

    window.addEventListener('storage', event => {
        if (event.key === storageKey) refreshPageTheme();
    });

    window.CameronTheme = {
        getDate,
        getHour,
        getIntensity,
        getMode,
        setMode,
        toggleVisibility,
        refresh: refreshPageTheme
    };

    applyDocumentState();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildSwitcher);
    } else {
        buildSwitcher();
    }
})();
