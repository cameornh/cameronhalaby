(function () {
    const STYLE_ID = 'cameron-liquid-lightbox-style';
    const FILTER_ID = 'cameron-liquid-glass-filter';
    const LENS_ZOOM = 2.15;

    function injectLiquidLightboxStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .liquid-lightbox-stage {
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                max-width: 100%;
                max-height: 100%;
                cursor: crosshair;
                overflow: visible;
            }

            .liquid-lightbox-stage > img {
                display: block;
                max-width: 100%;
                max-height: calc(100vh - 110px);
            }

            .liquid-glass-lens {
                --lens-x: 50vw;
                --lens-y: 50vh;
                --lens-bg-x: 50%;
                --lens-bg-y: 50%;
                --lens-bg-width: 100%;
                --lens-bg-height: 100%;
                position: fixed;
                left: var(--lens-x);
                top: var(--lens-y);
                width: clamp(150px, 16vw, 245px);
                height: clamp(150px, 16vw, 245px);
                pointer-events: none;
                z-index: 3002;
                opacity: 0;
                transform: translate3d(-50%, -50%, 0) scale(0.92);
                border: 1px solid rgba(255,255,255,0.42);
                border-radius: 48% 52% 46% 54% / 54% 43% 57% 46%;
                background-image:
                    radial-gradient(circle at 32% 24%, rgba(255,255,255,0.42), rgba(255,255,255,0.08) 22%, transparent 42%),
                    radial-gradient(circle at 72% 80%, rgba(255,255,255,0.16), transparent 34%),
                    var(--lens-image);
                background-repeat: no-repeat, no-repeat, no-repeat;
                background-size: 100% 100%, 100% 100%, var(--lens-bg-width) var(--lens-bg-height);
                background-position: center, center, var(--lens-bg-x) var(--lens-bg-y);
                box-shadow:
                    inset 0 0 0 1px rgba(255,255,255,0.36),
                    inset 18px 24px 42px rgba(255,255,255,0.16),
                    inset -22px -28px 48px rgba(8,12,18,0.48),
                    0 24px 70px rgba(0,0,0,0.42);
                filter: url(#${FILTER_ID}) saturate(1.08) contrast(1.04);
                overflow: hidden;
                transition: opacity 0.18s ease, transform 0.18s ease;
                animation: liquidLensDrift 6.5s ease-in-out infinite;
            }

            .liquid-glass-lens::before,
            .liquid-glass-lens::after {
                content: '';
                position: absolute;
                inset: 0;
                pointer-events: none;
            }

            .liquid-glass-lens::before {
                border-radius: inherit;
                background:
                    conic-gradient(from 92deg at 45% 45%, transparent 0 18%, rgba(255,255,255,0.18) 24%, transparent 31%, transparent 64%, rgba(255,255,255,0.2) 72%, transparent 82%),
                    linear-gradient(135deg, rgba(255,255,255,0.34), transparent 32%, rgba(255,255,255,0.08) 68%, transparent);
                mix-blend-mode: screen;
                opacity: 0.82;
            }

            .liquid-glass-lens::after {
                opacity: 0.18;
                mix-blend-mode: overlay;
                background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='2.9' numOctaves='1' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 7 -3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
            }

            .liquid-glass-lens.is-visible {
                opacity: 1;
                transform: translate3d(-50%, -50%, 0) scale(1);
            }

            .liquid-glass-filter-host {
                position: absolute;
                width: 0;
                height: 0;
                overflow: hidden;
                pointer-events: none;
            }

            @keyframes liquidLensDrift {
                0%, 100% { border-radius: 48% 52% 46% 54% / 54% 43% 57% 46%; }
                33% { border-radius: 56% 44% 51% 49% / 46% 55% 45% 54%; }
                66% { border-radius: 44% 56% 54% 46% / 58% 42% 52% 48%; }
            }

            @media (max-width: 680px) {
                .liquid-glass-lens {
                    width: 136px;
                    height: 136px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function injectLiquidFilter() {
        if (document.getElementById(FILTER_ID)) return;

        const host = document.createElement('div');
        host.className = 'liquid-glass-filter-host';
        host.setAttribute('aria-hidden', 'true');
        host.innerHTML = `
            <svg width="0" height="0" focusable="false" aria-hidden="true">
                <filter id="${FILTER_ID}" x="-20%" y="-20%" width="140%" height="140%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.018 0.028" numOctaves="2" seed="7" result="noise">
                        <animate attributeName="baseFrequency" values="0.014 0.022;0.024 0.034;0.014 0.022" dur="7s" repeatCount="indefinite" />
                    </feTurbulence>
                    <feDisplacementMap in="SourceGraphic" in2="noise" scale="14" xChannelSelector="R" yChannelSelector="G" />
                    <feGaussianBlur stdDeviation="0.22" />
                </filter>
            </svg>
        `;
        document.body.appendChild(host);
    }

    function cssUrl(value) {
        return 'url("' + String(value).replace(/"/g, '\\"') + '")';
    }

    function enhanceLightbox(lightbox, image) {
        if (!lightbox || !image || image.dataset.liquidLightbox === 'true') return;

        image.dataset.liquidLightbox = 'true';
        injectLiquidLightboxStyles();
        injectLiquidFilter();

        const stage = document.createElement('div');
        stage.className = 'liquid-lightbox-stage';
        image.parentNode.insertBefore(stage, image);
        stage.appendChild(image);
        stage.addEventListener('click', event => event.stopPropagation());

        const lens = document.createElement('div');
        lens.className = 'liquid-glass-lens';
        lens.setAttribute('aria-hidden', 'true');
        lightbox.appendChild(lens);

        function syncLensImage() {
            const src = image.currentSrc || image.src;
            if (src) lens.style.setProperty('--lens-image', cssUrl(src));
        }

        function hideLens() {
            lens.classList.remove('is-visible');
        }

        function moveLens(clientX, clientY) {
            const rect = image.getBoundingClientRect();
            if (!rect.width || !rect.height) {
                hideLens();
                return;
            }

            const insideImage = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
            if (!insideImage || !lightbox.classList.contains('active')) {
                hideLens();
                return;
            }

            const lensRect = lens.getBoundingClientRect();
            const localX = clientX - rect.left;
            const localY = clientY - rect.top;
            const zoomedWidth = rect.width * LENS_ZOOM;
            const zoomedHeight = rect.height * LENS_ZOOM;
            const backgroundX = (lensRect.width / 2) - (localX * LENS_ZOOM);
            const backgroundY = (lensRect.height / 2) - (localY * LENS_ZOOM);

            syncLensImage();
            lens.style.setProperty('--lens-x', clientX + 'px');
            lens.style.setProperty('--lens-y', clientY + 'px');
            lens.style.setProperty('--lens-bg-width', zoomedWidth + 'px');
            lens.style.setProperty('--lens-bg-height', zoomedHeight + 'px');
            lens.style.setProperty('--lens-bg-x', backgroundX + 'px');
            lens.style.setProperty('--lens-bg-y', backgroundY + 'px');
            lens.classList.add('is-visible');
        }

        stage.addEventListener('pointermove', event => moveLens(event.clientX, event.clientY));
        stage.addEventListener('pointerdown', event => moveLens(event.clientX, event.clientY));
        stage.addEventListener('pointerleave', hideLens);
        lightbox.addEventListener('pointerleave', hideLens);
        image.addEventListener('load', syncLensImage);

        const observer = new MutationObserver(() => {
            if (!lightbox.classList.contains('active')) hideLens();
            syncLensImage();
        });
        observer.observe(lightbox, { attributes: true, attributeFilter: ['class'] });
        observer.observe(image, { attributes: true, attributeFilter: ['src'] });

        syncLensImage();
    }

    function enhanceAllLightboxes() {
        const lightboxes = document.querySelectorAll('.lightbox');
        for (let i = 0; i < lightboxes.length; i++) {
            const lightbox = lightboxes[i];
            const image = lightbox.querySelector('img');
            enhanceLightbox(lightbox, image);
        }
    }

    window.CameronLiquidLightbox = {
        enhanceAll: enhanceAllLightboxes
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', enhanceAllLightboxes);
    } else {
        enhanceAllLightboxes();
    }
})();
