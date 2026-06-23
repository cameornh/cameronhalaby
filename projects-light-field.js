(function () {
    const STYLE_ID = 'projects-light-field-style';
    const CANVAS_ID = 'projects-light-field';

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${CANVAS_ID} {
                position: absolute;
                top: 0;
                bottom: 0;
                left: 50%;
                width: 100vw;
                height: 100%;
                transform: translateX(-50%);
                z-index: 8;
                pointer-events: none;
                opacity: var(--projects-light-field-opacity, 0.96);
                filter: blur(10px) saturate(1.04) contrast(1.18);
            }

            .page-section {
                position: relative;
                isolation: isolate;
            }
        `;
        document.head.appendChild(style);
    }

    function createCanvas() {
        let canvas = document.getElementById(CANVAS_ID);
        if (canvas) return canvas;

        canvas = document.createElement('canvas');
        canvas.id = CANVAS_ID;
        canvas.setAttribute('aria-hidden', 'true');
        const projectSection = document.querySelector('.page-section');
        if (!projectSection) return canvas;

        projectSection.insertBefore(canvas, projectSection.firstChild);
        return canvas;
    }

    function getThemeState() {
        const hour = window.CameronTheme ? window.CameronTheme.getHour() : new Date().getHours();
        const intensity = window.CameronTheme ? window.CameronTheme.getIntensity() : (Math.cos((hour - 12) / 24 * Math.PI * 2) + 1) / 2;
        const dayTravel = Math.max(0, Math.min(1, (hour - 6) / 12));
        return { hour, intensity, dayTravel };
    }

    function startCanvasFallback(canvas) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        function resize() {
            const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
            canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
            canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
        }

        function draw(now) {
            resize();
            const { intensity, dayTravel } = getThemeState();
            const w = canvas.width;
            const h = canvas.height;
            ctx.clearRect(0, 0, w, h);
            ctx.globalCompositeOperation = 'source-over';

            const warm = intensity;
            const shadowAlpha = 0.08 + (1 - intensity) * 0.08;
            ctx.strokeStyle = warm > 0.5 ? 'rgba(80, 55, 18,' + shadowAlpha + ')' : 'rgba(23, 38, 78,' + shadowAlpha + ')';
            ctx.lineWidth = Math.max(22, w * 0.035);
            ctx.filter = 'blur(' + Math.max(10, w * 0.012) + 'px)';
            const angle = (-0.72 + dayTravel * 1.08) * Math.PI;
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);

            for (let i = -12; i < 24; i++) {
                const offset = i * w * 0.095 + Math.sin(now * 0.00018 + i) * 34;
                ctx.beginPath();
                ctx.moveTo(offset - dx * w, -dy * h);
                ctx.bezierCurveTo(
                    offset + w * 0.24, h * 0.28 + Math.sin(i) * 60,
                    offset + w * 0.76, h * 0.72 + Math.cos(i) * 70,
                    offset + dx * w * 1.8, h + dy * h
                );
                ctx.stroke();
            }

            ctx.filter = 'none';
            ctx.globalAlpha = warm > 0.5 ? 0.09 : 0.075;
            const glow = ctx.createRadialGradient(w * (0.12 + dayTravel * 0.76), h * 0.08, 0, w * (0.12 + dayTravel * 0.76), h * 0.08, Math.max(w, h) * 0.9);
            glow.addColorStop(0, warm > 0.5 ? '#ffd785' : '#aab9ff');
            glow.addColorStop(1, 'transparent');
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, w, h);
            ctx.globalAlpha = 1;
            requestAnimationFrame(draw);
        }

        window.addEventListener('resize', resize);
        requestAnimationFrame(draw);
    }

    function startLightField(canvas) {
        const gl = canvas.getContext('webgl', {
            alpha: true,
            antialias: false,
            premultipliedAlpha: false,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance'
        });

        if (!gl) {
            startCanvasFallback(canvas);
            return;
        }

        const vertexSource = `
            attribute vec2 aPosition;
            varying vec2 vUv;

            void main() {
                vUv = aPosition * 0.5 + 0.5;
                gl_Position = vec4(aPosition, 0.0, 1.0);
            }
        `;

        const fragmentSource = `
            precision highp float;

            uniform vec2 uResolution;
            uniform vec2 uMouse;
            uniform float uTime;
            uniform float uIntensity;
            uniform float uDayTravel;
            varying vec2 vUv;

            const float PI = 3.14159265359;

            float hash21(vec2 p) {
                p = fract(p * vec2(234.34, 435.345));
                p += dot(p, p + 34.23);
                return fract(p.x * p.y);
            }

            float valueNoise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(
                    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
                    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
                    u.y
                );
            }

            float fbm(vec2 p) {
                float value = 0.0;
                float amp = 0.5;
                mat2 turn = mat2(1.62, -1.17, 1.17, 1.62);
                for (int i = 0; i < 5; i++) {
                    value += amp * valueNoise(p);
                    p = turn * p + 9.31;
                    amp *= 0.48;
                }
                return value;
            }

            mat2 rotate2d(float angle) {
                float s = sin(angle);
                float c = cos(angle);
                return mat2(c, -s, s, c);
            }

            float cellular(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                float nearest = 2.0;
                for (int y = -1; y <= 1; y++) {
                    for (int x = -1; x <= 1; x++) {
                        vec2 g = vec2(float(x), float(y));
                        vec2 o = vec2(hash21(i + g), hash21(i + g + 8.41));
                        o = 0.5 + 0.5 * sin(uTime * 0.09 + 6.2831 * o);
                        nearest = min(nearest, dot(g + o - f, g + o - f));
                    }
                }
                return sqrt(nearest);
            }

            float leafLayer(vec2 p, float scale, float drift, float width) {
                vec2 grid = p * scale;
                vec2 cell = floor(grid);
                vec2 f = fract(grid) - 0.5;
                vec2 offset = vec2(hash21(cell + 1.73), hash21(cell + 6.19)) - 0.5;
                f -= offset * 0.54;

                float angle = hash21(cell + 12.41) * PI * 2.0 + drift;
                vec2 leaf = rotate2d(angle) * f;
                float rib = abs(leaf.x) * 0.22;
                float body = dot(leaf * vec2(1.95, width), leaf * vec2(1.95, width)) + rib;
                float taper = smoothstep(0.48, 0.08, abs(leaf.x));
                float shape = smoothstep(0.16, 0.055, body) * taper;
                return shape;
            }

            float shadeBlobLayer(vec2 p, float scale, float seed, float stretch) {
                vec2 grid = p * scale;
                vec2 cell = floor(grid);
                vec2 f = fract(grid) - 0.5;
                vec2 offset = vec2(hash21(cell + seed), hash21(cell + seed + 9.7)) - 0.5;
                f -= offset * 0.42;
                float localTurn = (hash21(cell + seed + 17.0) - 0.5) * 0.28;
                f = rotate2d(localTurn) * f;
                float d = length(f * vec2(0.58, stretch));
                float blob = smoothstep(0.58, 0.12, d);
                float presence = smoothstep(0.24, 0.86, hash21(cell + seed + 31.0));
                return blob * presence;
            }

            void main() {
                vec2 uv = vUv;
                float aspect = uResolution.x / max(uResolution.y, 1.0);
                vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

                float daylight = smoothstep(0.08, 0.92, uIntensity);
                float angle = mix(-0.95, 0.42, uDayTravel) * PI;
                angle = mix(-0.32 * PI, angle, daylight);

                vec2 raySpace = rotate2d(angle) * p;
                vec2 mouseOffset = (uMouse - 0.5) * vec2(0.24 * aspect, 0.18);
                vec2 drift = vec2(uTime * 0.018, -uTime * 0.012) + mouseOffset;
                vec2 shadeSpace = raySpace + drift;

                float largeWash = fbm(shadeSpace * vec2(0.86, 1.28) + vec2(0.0, uTime * 0.018));
                float midWash = fbm(shadeSpace * vec2(1.72, 2.18) - drift.yx * 0.62);
                float diagonalWave = sin(shadeSpace.y * 8.8 + shadeSpace.x * 1.8 + largeWash * 3.6 + uTime * 0.22) * 0.5 + 0.5;
                float shadowBlobA = shadeBlobLayer(shadeSpace + vec2(uTime * 0.006, 0.0), 3.15, 2.0, 1.92);
                float shadowBlobB = shadeBlobLayer(shadeSpace * 1.28 - vec2(0.18, uTime * 0.008), 3.85, 11.0, 2.36);
                float shadowBlobC = shadeBlobLayer(shadeSpace * 0.72 + vec2(0.14, -0.08), 2.35, 21.0, 1.68);
                float cluster = smoothstep(0.36, 0.88, largeWash * 0.72 + midWash * 0.28);
                float shade = max(max(shadowBlobA, shadowBlobB * 0.86), shadowBlobC * 0.78);
                shade = max(shade, smoothstep(0.64, 0.92, diagonalWave + midWash * 0.28) * 0.58);
                shade *= 0.58 + cluster * 0.42;
                shade = max(shade, smoothstep(0.58, 0.82, largeWash + diagonalWave * 0.26) * 0.52);
                shade = smoothstep(0.04, 0.66, shade);

                vec2 source = vec2(mix(0.08, 0.92, uDayTravel), -0.08);
                vec2 moonSource = vec2(0.84 - 0.32 * sin(uTime * 0.035), -0.05);
                vec2 lightSource = mix(moonSource, source, daylight);
                float distanceFromLight = length((uv - lightSource) * vec2(aspect, 1.0));
                float glow = smoothstep(1.12, 0.0, distanceFromLight);
                float ray = smoothstep(0.08, 0.92, 1.0 - abs(raySpace.x + largeWash * 0.15 - 0.05) * 1.06);
                float lightBlobA = shadeBlobLayer(shadeSpace * 0.92 + vec2(0.4, -0.18), 2.7, 41.0, 2.15);
                float lightBlobB = shadeBlobLayer(shadeSpace * 1.5 - vec2(0.2, 0.3), 4.2, 54.0, 2.5);
                float lightGap = smoothstep(0.28, 0.92, max(lightBlobA, lightBlobB * 0.72) + (1.0 - shade) * 0.28);
                float light = glow * (0.18 + ray * 0.2 + lightGap * 0.42) * (1.0 - shade * 0.28);

                float vignette = smoothstep(1.0, 0.12, length(p));
                float grain = hash21(gl_FragCoord.xy + floor(uTime * 30.0));
                float textureGrain = (grain - 0.5) * 0.026;

                vec3 dayLight = vec3(1.0, 0.83, 0.50);
                vec3 dayShadow = vec3(0.105, 0.105, 0.088);
                vec3 moonLight = vec3(0.55, 0.66, 1.0);
                vec3 moonShadow = vec3(0.01, 0.025, 0.085);
                vec3 lightColor = mix(moonLight, dayLight, daylight);
                vec3 shadowColor = mix(moonShadow, dayShadow, daylight);

                float lightAlpha = light * mix(0.15, 0.21, daylight) * (0.46 + vignette * 0.54);
                float shadowAlpha = shade * mix(0.34, 0.38, daylight) * (0.5 + vignette * 0.5);
                float shadowOnly = smoothstep(lightAlpha, shadowAlpha + lightAlpha, shadowAlpha);
                vec3 color = mix(lightColor, shadowColor, shadowOnly);
                float alpha = clamp(lightAlpha + shadowAlpha, 0.0, mix(0.36, 0.44, daylight));

                color += textureGrain;
                alpha *= mix(0.84, 1.0, daylight) * (0.91 + 0.09 * sin(uTime * 0.11));

                gl_FragColor = vec4(clamp(color, 0.0, 1.0), alpha);
            }
        `;

        function compileShader(type, source) {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.warn(gl.getShaderInfoLog(shader));
                gl.deleteShader(shader);
                return null;
            }
            return shader;
        }

        const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
        if (!vertexShader || !fragmentShader) {
            startCanvasFallback(canvas);
            return;
        }

        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.warn(gl.getProgramInfoLog(program));
            startCanvasFallback(canvas);
            return;
        }

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

        const positionLocation = gl.getAttribLocation(program, 'aPosition');
        const resolutionLocation = gl.getUniformLocation(program, 'uResolution');
        const mouseLocation = gl.getUniformLocation(program, 'uMouse');
        const timeLocation = gl.getUniformLocation(program, 'uTime');
        const intensityLocation = gl.getUniformLocation(program, 'uIntensity');
        const dayTravelLocation = gl.getUniformLocation(program, 'uDayTravel');
        const targetMouse = { x: 0.5, y: 0.5 };
        const smoothMouse = { x: 0.5, y: 0.5 };
        const startedAt = performance.now();
        let lastWidth = 0;
        let lastHeight = 0;

        function resize() {
            const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
            const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
            const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
            if (width !== lastWidth || height !== lastHeight) {
                lastWidth = width;
                lastHeight = height;
                canvas.width = width;
                canvas.height = height;
                gl.viewport(0, 0, width, height);
            }
        }

        function render(now) {
            const theme = getThemeState();
            resize();
            smoothMouse.x += (targetMouse.x - smoothMouse.x) * 0.055;
            smoothMouse.y += (targetMouse.y - smoothMouse.y) * 0.055;

            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.useProgram(program);
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
            gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
            gl.uniform2f(mouseLocation, smoothMouse.x, smoothMouse.y);
            gl.uniform1f(timeLocation, (now - startedAt) * 0.001);
            gl.uniform1f(intensityLocation, theme.intensity);
            gl.uniform1f(dayTravelLocation, theme.dayTravel);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            requestAnimationFrame(render);
        }

        window.addEventListener('pointermove', event => {
            const rect = canvas.getBoundingClientRect();
            targetMouse.x = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(rect.width, 1)));
            targetMouse.y = 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(rect.height, 1)));
        });

        window.addEventListener('resize', resize);
        requestAnimationFrame(render);
    }

    function boot() {
        injectStyles();
        startLightField(createCanvas());
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
