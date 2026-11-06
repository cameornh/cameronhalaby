const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function runtime() {
    const events = {};
    const frames = new Map();
    let nextFrame = 1, intersect, mutate;
    const element = (width = 1280, height = 720) => ({
        clientWidth: width, clientHeight: height,
        classList: { toggle() {}, contains() { return false; } }
    });
    const modal = element();
    modal.contains = target => target === modal;
    const document = {
        hidden: false,
        documentElement: element(),
        addEventListener(name, fn) { events[name] = fn; },
        querySelectorAll() { return [modal]; }
    };
    const context = {
        document, devicePixelRatio: 3,
        window: { addEventListener(name, fn) { events[name] = fn; } },
        matchMedia: () => ({ matches: false }),
        requestAnimationFrame(fn) { const id = nextFrame++; frames.set(id, fn); return id; },
        cancelAnimationFrame(id) { frames.delete(id); },
        IntersectionObserver: class { constructor(fn) { intersect = fn; } observe() {} },
        ResizeObserver: class { observe() {} },
        MutationObserver: class { constructor(fn) { mutate = fn; } observe() {} }
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../site-performance.js'), 'utf8'), context);
    events.DOMContentLoaded();
    return {
        api: context.window.CameronPerformance, document, events, frames, element, modal,
        visible(target, isIntersecting) { intersect([{ target, isIntersecting, intersectionRatio: isIntersecting ? 1 : 0 }]); },
        overlay(active) { modal.classList.contains = () => active; mutate(); },
        tick(time) { const pending = Array.from(frames.values()); frames.clear(); pending.forEach(fn => fn(time)); }
    };
}

test('offscreen animations stop scheduling and resume when visible', () => {
    const r = runtime(), el = r.element();
    let draws = 0;
    r.api.animate(el, () => draws++);
    assert.equal(r.frames.size, 0);
    r.visible(el, true); r.tick(100);
    assert.equal(draws, 1);
    r.visible(el, false); r.tick(150);
    assert.equal(draws, 1);
    assert.equal(r.frames.size, 0);
    r.visible(el, true); r.tick(200);
    assert.equal(draws, 2);
});

test('hidden tabs cancel rendering and resume without a large simulation jump', () => {
    const r = runtime(), el = r.element();
    let delta;
    r.api.animate(el, (now, dt) => { delta = dt; });
    r.visible(el, true); r.tick(100);
    r.document.hidden = true; r.events.visibilitychange();
    assert.equal(r.frames.size, 0);
    r.document.hidden = false; r.events.visibilitychange(); r.tick(100000);
    assert(delta < 0.05);
});

test('an open modal pauses the page underneath while its own canvas runs', () => {
    const r = runtime(), bg = r.element();
    let background = 0, foreground = 0;
    r.api.animate(bg, () => background++);
    r.api.animate(r.modal, () => foreground++);
    r.visible(bg, true); r.visible(r.modal, true);
    r.overlay(true); r.tick(100);
    assert.equal(background, 0); assert.equal(foreground, 1);
    r.overlay(false); r.tick(150);
    assert.equal(background, 1);
});

test('frame rate is capped and explicit stop/start remains reusable', () => {
    const r = runtime(), el = r.element();
    let draws = 0;
    const loop = r.api.animate(el, () => draws++, { fps: 24, active: false });
    r.visible(el, true); r.tick(100); assert.equal(draws, 0);
    loop.start();
    for (let time = 100; time < 1100; time += 1000 / 120) r.tick(time);
    assert(draws >= 23 && draws <= 25);
    loop.stop(); r.tick(1200); assert.equal(r.frames.size, 0);
    loop.start(); r.tick(1300); assert(r.frames.size > 0);
});

test('large and Retina canvases respect their pixel budget', () => {
    const r = runtime(), el = r.element(3840, 6000);
    const ratio = r.api.pixelRatio(el, 600000);
    assert(el.clientWidth * el.clientHeight * ratio * ratio <= 600001);
    assert.equal(r.api.pixelRatio(r.element()), 1);
});
