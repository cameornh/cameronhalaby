(function () {
    const jobs = new Set();
    const visible = new WeakMap();
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let overlay = null;

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            const inView = entry.isIntersecting && entry.intersectionRatio > 0;
            visible.set(entry.target, inView);
            entry.target.classList.toggle('effects-offscreen', !inView);
        });
        wake();
    }, { threshold: [0, 0.001] });

    function canRun(job) {
        return !document.hidden && job.active && visible.get(job.element) !== false &&
            (!overlay || overlay.contains(job.element)) && (!job.enabled || job.enabled());
    }

    function tick(now) {
        frame = 0;
        let running = false;
        for (const job of jobs) {
            if (!canRun(job)) { job.last = 0; continue; }
            running = true;
            const interval = 1000 / (reducedMotion.matches ? Math.min(job.fps, 10) : job.fps);
            if (!job.last || now - job.last >= interval - 1) {
                const delta = job.last ? Math.min((now - job.last) / 1000, 0.1) : 1 / job.fps;
                job.last = now;
                job.draw(now, delta);
            }
        }
        if (running) frame = requestAnimationFrame(tick);
    }

    function wake() {
        if (!frame && !document.hidden && Array.from(jobs).some(canRun)) frame = requestAnimationFrame(tick);
    }

    function animate(element, draw, options = {}) {
        const job = { element, draw, fps: options.fps || 30, enabled: options.enabled, active: options.active !== false, last: 0 };
        jobs.add(job);
        if (!visible.has(element)) {
            visible.set(element, false);
            observer.observe(element);
        }
        wake();
        return {
            start() { job.active = true; job.last = 0; wake(); },
            stop() { job.active = false; job.last = 0; }
        };
    }

    // Bound backing-store memory independently of Retina/4K display resolution.
    function pixelRatio(element, maxPixels = 1500000) {
        const area = Math.max(1, element.clientWidth * element.clientHeight);
        return Math.min(devicePixelRatio || 1, 1, Math.sqrt(maxPixels / area));
    }

    function watchSize(element, resize) {
        resize();
        const sizeObserver = new ResizeObserver(resize);
        sizeObserver.observe(element);
    }

    function syncVisibility() {
        document.documentElement.classList.toggle('effects-hidden', document.hidden);
        if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0; }
        jobs.forEach(job => { job.last = 0; });
        wake();
    }
    document.addEventListener('visibilitychange', syncVisibility);
    window.addEventListener('pageshow', syncVisibility);
    window.addEventListener('cameron-theme-change', wake);
    document.addEventListener('DOMContentLoaded', () => {
        const modals = Array.from(document.querySelectorAll('.lightbox, .project-lightbox, #deep-archive'));
        const syncOverlay = () => {
            overlay = modals.find(modal => modal.classList.contains('active')) || null;
            wake();
        };
        const modalObserver = new MutationObserver(syncOverlay);
        modals.forEach(modal => modalObserver.observe(modal, { attributes: true, attributeFilter: ['class'] }));
        syncOverlay();
    });
    window.CameronPerformance = { animate, pixelRatio, watchSize, wake };
}());
