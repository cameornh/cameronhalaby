(function () {
    const manifestFiles = [
        "ar1.JPG",
        "ar2.JPG",
        "ar3.JPG",
        "ar4.JPG",
        "ar5.JPG",
        "ar6.JPG",
        "p1.jpg",
        "p2.jpg",
        "p3.jpg",
        "p4.jpg",
        "p4a.jpg",
        "p5.jpg",
        "p6.jpg",
        "pr1a.jpg",
        "pr2a.jpg",
        "pr3a.jpg",
        "pr4a.jpg",
        "pr4b.jpg",
        "song1.mp3",
        "song2.mp3",
        "song3.mp3",
        "song4.mp3",
        "song5.mp3",
        "song6.mp3",
        "song7.mp3",
        "song8.mp3",
        "song9.mp3",
        "strip1.jpg",
        "strip2.jpg",
        "strip2a.jpg",
        "strip2b.jpg",
        "strip2c.jpg",
        "strip3.jpg",
        "strip4.jpg",
        "strip5.jpg",
        "strip6.jpg",
        "strip7.jpg",
        "strip8.jpg",
        "strip9.jpg",
        "strip9a.jpg",
        "strip10.jpg"
    ];

    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
    const imagePattern = /\.(avif|gif|jpe?g|png|webp)$/i;
    const audioPattern = /\.(flac|m4a|mp3|ogg|wav)$/i;
    let files = normalizeFiles(manifestFiles);

    function assetPath(file) {
        return "./assets/" + file;
    }

    function normalizeFileName(file) {
        return decodeURIComponent(String(file || ""))
            .split("/")
            .pop()
            .replace(/[?#].*$/, "")
            .trim();
    }

    function normalizeFiles(sourceFiles) {
        return Array.from(new Set(sourceFiles
            .map(normalizeFileName)
            .filter(file => file && file !== "." && file !== "..")
            .filter(file => file !== ".DS_Store" && file !== "icon.png")
        )).sort(collator.compare);
    }

    async function discoverDirectoryFiles() {
        if(location.protocol === "file:") return [];

        try {
            const response = await fetch("./assets/", { cache: "no-store" });
            if(!response.ok) return [];

            const text = await response.text();
            if(!/href=/i.test(text)) return [];

            const doc = new DOMParser().parseFromString(text, "text/html");
            return normalizeFiles(Array.from(doc.querySelectorAll("a[href]"), link => link.getAttribute("href")));
        } catch (err) {
            return [];
        }
    }

    const ready = discoverDirectoryFiles().then(discovered => {
        files = normalizeFiles(files.concat(discovered));
        return files;
    });

    function currentFiles() {
        return files.slice();
    }

    function getNumericLetterGroups(prefix, options = {}) {
        const mediaPattern = options.type === "audio" ? audioPattern : imagePattern;
        const matcher = new RegExp("^" + prefix + "(\\d+)([a-z]*)\\.[^.]+$", "i");
        const groups = new Map();

        currentFiles().forEach(file => {
            if(!mediaPattern.test(file)) return;
            const match = file.match(matcher);
            if(!match) return;

            const index = parseInt(match[1], 10);
            const suffix = match[2].toLowerCase();
            if(!groups.has(index)) groups.set(index, []);
            groups.get(index).push({
                file,
                index,
                suffix,
                src: assetPath(file),
                label: prefix + match[1] + suffix
            });
        });

        return Array.from(groups.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([index, variants]) => ({
                index,
                variants: variants.sort((a, b) => {
                    if(a.suffix === b.suffix) return collator.compare(a.file, b.file);
                    if(a.suffix === "") return -1;
                    if(b.suffix === "") return 1;
                    return collator.compare(a.suffix, b.suffix);
                })
            }));
    }

    function getArtImages() {
        return getNumericLetterGroups("ar")
            .flatMap(group => group.variants)
            .map((variant, index) => ({
                src: variant.src,
                alt: "Artwork " + String(index + 1).padStart(2, "0")
            }));
    }

    function getIndexPhotos() {
        return getNumericLetterGroups("p")
            .map(group => {
                const base = group.variants.find(variant => variant.suffix === "");
                if(!base) return null;

                const lightbox = group.variants.find(variant => variant.suffix === "a") || base;
                return {
                    index: group.index,
                    thumb: base.src,
                    lightbox: lightbox.src,
                    alt: "Photo " + group.index
                };
            })
            .filter(Boolean);
    }

    function getProjectGroups() {
        return getNumericLetterGroups("pr")
            .map(group => {
                const thumb = group.variants.find(variant => variant.suffix === "a") || group.variants[0];
                return {
                    index: group.index,
                    thumb: thumb ? thumb.src : "",
                    files: group.variants.map(variant => variant.src),
                    fallback: "pr" + group.index + " image pending"
                };
            })
            .filter(group => group.thumb && group.files.length);
    }

    function getSongs() {
        return getNumericLetterGroups("song", { type: "audio" })
            .flatMap(group => group.variants)
            .map(variant => ({
                name: "Song " + variant.index,
                displayName: "Song " + String(variant.index).padStart(2, "0"),
                src: variant.src
            }));
    }

    function getStripImages() {
        return getNumericLetterGroups("strip")
            .flatMap(group => group.variants)
            .map(variant => ({
                src: variant.src,
                caption: variant.label.replace(/^strip/i, "strip ")
            }));
    }

    window.CameronAssets = {
        ready,
        files: currentFiles,
        artImages: getArtImages,
        indexPhotos: getIndexPhotos,
        projectGroups: getProjectGroups,
        songs: getSongs,
        stripImages: getStripImages
    };
}());
