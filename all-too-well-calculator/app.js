document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    lucide.createIcons();

    // ----------------------------------------------------
    // 1. FALLING LEAVES CANVAS ANIMATION
    // ----------------------------------------------------
    const canvas = document.getElementById('leaves-canvas');
    const ctx = canvas.getContext('2d');

    let leaves = [];
    const maxLeaves = 25;
    const leafColors = [
        'rgba(92, 22, 22, ',   // Deep Crimson
        'rgba(197, 155, 107, ', // Antique Gold
        'rgba(211, 84, 0, ',   // Rust Orange
        'rgba(230, 126, 34, ',  // Soft Orange
        'rgba(110, 30, 30, '    // Deep Mahogany
    ];

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    class Leaf {
        constructor() {
            this.reset();
            this.y = Math.random() * canvas.height; // Random start height on init
        }

        reset() {
            this.x = Math.random() * canvas.width;
            this.y = -20;
            this.size = Math.random() * 12 + 6;
            this.speedY = Math.random() * 1.2 + 0.6;
            this.speedX = Math.random() * 1 - 0.5;
            this.rotation = Math.random() * Math.PI * 2;
            this.rotationSpeed = Math.random() * 0.02 - 0.01;
            this.colorBase = leafColors[Math.floor(Math.random() * leafColors.length)];
            this.opacity = Math.random() * 0.4 + 0.2; // Keep them subtle
            this.swayingFreq = Math.random() * 0.02 + 0.005;
            this.swayingWidth = Math.random() * 15 + 5;
            this.time = Math.random() * 100;
        }

        update() {
            this.time += this.swayingFreq;
            this.y += this.speedY;
            this.x += this.speedX + Math.sin(this.time) * 0.4;
            this.rotation += this.rotationSpeed;

            // Reset when leaf goes off screen
            if (this.y > canvas.height + 20 || this.x < -20 || this.x > canvas.width + 20) {
                this.reset();
            }
        }

        draw() {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation);
            ctx.fillStyle = this.colorBase + this.opacity + ')';
            
            // Draw a simple organic leaf shape
            ctx.beginPath();
            ctx.moveTo(0, -this.size);
            // Curve out to the right
            ctx.quadraticCurveTo(this.size * 0.6, -this.size * 0.3, 0, this.size);
            // Curve out to the left
            ctx.quadraticCurveTo(-this.size * 0.6, -this.size * 0.3, 0, -this.size);
            ctx.closePath();
            ctx.fill();

            // Draw leaf stem
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 1;
            ctx.moveTo(0, -this.size);
            ctx.lineTo(0, this.size + 2);
            ctx.stroke();

            ctx.restore();
        }
    }

    // Initialize leaves
    for (let i = 0; i < maxLeaves; i++) {
        leaves.push(new Leaf());
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        leaves.forEach(leaf => {
            leaf.update();
            leaf.draw();
        });
        requestAnimationFrame(animate);
    }
    animate();


    // ----------------------------------------------------
    // 2. LEAFLET MAP SETUP
    // ----------------------------------------------------
    // Initialize the map showing the US by default
    const map = L.map('map', {
        zoomControl: true,
        scrollWheelZoom: true
    }).setView([40.0, -98.0], 4);

    // Warm, vintage, aesthetic tiles from CartoDB Voyager
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    let routeLayer = null;
    let markersLayer = L.featureGroup().addTo(map);

    // Custom Map Pin Icons
    const startIcon = L.divIcon({
        className: 'custom-pin start-pin',
        html: `<div style="background-color: #5c1616; width: 14px; height: 14px; border: 2.5px solid #fff; border-radius: 50%; box-shadow: 0 0 10px rgba(92, 22, 22, 0.7); transform: scale(1.2);"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
    });

    const destIcon = L.divIcon({
        className: 'custom-pin dest-pin',
        html: `<div style="background-color: #c59b6b; width: 14px; height: 14px; border: 2.5px solid #fff; border-radius: 50%; box-shadow: 0 0 10px rgba(197, 155, 107, 0.9); transform: scale(1.2);"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
    });


    // ----------------------------------------------------
    // 3. SONG UTILITIES
    // ----------------------------------------------------
    const songDurationSeconds = 613; // 10 minutes and 13 seconds

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }


    // ----------------------------------------------------
    // 4. ROUTE CALCULATION & TAYLOR QUOTES
    // ----------------------------------------------------
    const routeForm = document.getElementById('route-form');
    const startInput = document.getElementById('start-input');
    const destInput = document.getElementById('dest-input');
    
    // Screens & Layout Containers
    const resultsIdle = document.getElementById('results-idle');
    const resultDisplay = document.getElementById('result-display');
    const loadingDisplay = document.getElementById('loading-display');
    const errorDisplay = document.getElementById('error-display');
    const errorMessage = document.getElementById('error-message');
    
    // Results elements
    const listenCountEl = document.getElementById('listen-count');
    const routeDurationEl = document.getElementById('route-duration');
    const routeDistanceEl = document.getElementById('route-distance');
    const lyricCommentEl = document.getElementById('lyric-comment');
    const lyricContextEl = document.getElementById('lyric-context');
    const displayRouteNames = document.getElementById('display-route-names');
    const routeInfoBar = document.getElementById('route-info-bar');

    // UI Buttons and Map Actions
    const newCalculationBtn = document.getElementById('new-calculation-btn');
    const errorCloseBtn = document.getElementById('error-close-btn');
    const exportMapBtn = document.getElementById('export-map-btn');

    // Taylor Swift Lyric Quotes database based on listen count
    function getTaylorQuote(listens, minutes) {
        if (listens < 0.1) {
            return {
                quote: "You barely had time to get your scarf! A drive this short wouldn't even cover the intro.",
                context: "All Too Well (5 Second Version?)"
            };
        }
        if (listens < 1.0) {
            return {
                quote: `The drive is only ${minutes} minutes. We got lost in translation, you won't even reach the bridge!`,
                context: "Red (Taylor's Version)"
            };
        }
        if (listens >= 1.0 && listens < 2.0) {
            return {
                quote: "Wind in my hair, I was there, I remember it all too well...",
                context: "All Too Well (10 Minute Version)"
            };
        }
        if (listens >= 2.0 && listens < 4.0) {
            return {
                quote: "And you were tossing me the car keys... 'cause we're dancing 'round the kitchen in the refrigerator light.",
                context: "All Too Well (10 Minute Version)"
            };
        }
        if (listens >= 4.0 && listens < 8.0) {
            return {
                quote: "You call me up again just to break me like a promise. So casually cruel in the name of being honest...",
                context: "All Too Well (10 Minute Version)"
            };
        }
        if (listens >= 8.0 && listens < 15.0) {
            return {
                quote: "Time won't fly, it's like I'm paralyzed by it. I'd like to be my old self again, but I'm still trying to find it.",
                context: "All Too Well (10 Minute Version)"
            };
        }
        return {
            quote: "Are you okay? 'Cause I'm not okay at all. That is a massive journey down memory lane. Pack some tissues.",
            context: "All Too Well (Red Taylor's Version)"
        };
    }

    // Geocoding helper with Nominatim
    async function geocodeAddress(query) {
        // Appending user agent email is good practice for Nominatim usage policy
        const fetchGeocode = async (q) => {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&addressdetails=1&countrycodes=us&email=colin@example.com`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Geocoding server error');
            return await response.json();
        };

        let data = await fetchGeocode(query);

        // Fallback 1: Replace abbreviations (like 'phila' -> 'Philadelphia', 'philly' -> 'Philadelphia')
        if (data.length === 0) {
            let fallbackQuery = query;
            let changed = false;
            
            // Check for phila / philly
            if (/\bphila\b/i.test(fallbackQuery)) {
                fallbackQuery = fallbackQuery.replace(/\bphila\b/i, 'Philadelphia');
                changed = true;
            } else if (/\bphilly\b/i.test(fallbackQuery)) {
                fallbackQuery = fallbackQuery.replace(/\bphilly\b/i, 'Philadelphia');
                changed = true;
            }
            
            // Check for NYC
            if (/\bnyc\b/i.test(fallbackQuery)) {
                fallbackQuery = fallbackQuery.replace(/\bnyc\b/i, 'New York City');
                changed = true;
            }
            
            // Check for LA
            if (/\bla\b/i.test(fallbackQuery)) {
                fallbackQuery = fallbackQuery.replace(/\bla\b/i, 'Los Angeles');
                changed = true;
            }

            if (changed) {
                // Wait 500ms to respect rate limit
                await new Promise(resolve => setTimeout(resolve, 500));
                data = await fetchGeocode(fallbackQuery);
            }
        }

        // Fallback 2: Try stripping zip codes which can confuse OSM if indexed differently
        if (data.length === 0) {
            const zipRegex = /\b\d{5}(-\d{4})?\b/;
            if (zipRegex.test(query)) {
                const fallbackQuery = query.replace(zipRegex, '').replace(/\s+/g, ' ').trim();
                // Wait 500ms
                await new Promise(resolve => setTimeout(resolve, 500));
                data = await fetchGeocode(fallbackQuery);
            }
        }

        if (data.length === 0) {
            throw new Error(`Could not locate "${query}". Try spelling out abbreviations (e.g., "Philadelphia" instead of "phila").`);
        }

        return {
            lat: parseFloat(data[0].lat),
            lon: parseFloat(data[0].lon),
            name: formatAddress(data[0])
        };
    }

    // Address formatter to exclude neighborhoods (residential/suburb), county, and country (United States)
    function formatAddress(item) {
        if (!item.address) {
            return item.display_name;
        }
        const addr = item.address;
        
        // Combine house number and street road
        const street = [
            addr.house_number, 
            addr.road || addr.pedestrian || addr.footway || addr.path || addr.square || addr.highway || addr.street
        ].filter(Boolean).join(' ');
        
        // City, state, zip levels
        const city = addr.city || addr.town || addr.village || addr.hamlet || addr.municipality;
        const state = addr.state;
        const zip = addr.postcode;
        
        const parts = [];
        if (street) parts.push(street);
        if (city) parts.push(city);
        if (state) parts.push(state);
        if (zip) parts.push(zip);
        
        return parts.length > 0 ? parts.join(', ') : item.display_name;
    }

    // Dynamic metadata update helper for browser DOM (OpenGraph & Twitter previews)
    function updateDynamicMeta(start, dest, listensCount) {
        const title = `All Too Well Calculator: ${start} to ${dest}`;
        const description = `You can listen to All Too Well (10 Minute Version) exactly ${listensCount.toFixed(2)} times on this drive!`;
        
        document.title = title;
        
        const descMeta = document.querySelector('meta[name="description"]');
        if (descMeta) descMeta.setAttribute('content', description);
        
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) ogTitle.setAttribute('content', title);
        
        const ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc) ogDesc.setAttribute('content', description);
        
        const twTitle = document.querySelector('meta[name="twitter:title"]');
        if (twTitle) twTitle.setAttribute('content', title);
        
        const twDesc = document.querySelector('meta[name="twitter:description"]');
        if (twDesc) twDesc.setAttribute('content', description);
    }

    // Reset metadata helper to default tags
    function resetMeta() {
        const title = "All Too Well (10 Minute Version) Road Trip Calculator";
        const description = "Calculate how many times you can listen to Taylor Swift's All Too Well (10 Minute Version) on your road trip using open routing.";
        
        document.title = title;
        
        const descMeta = document.querySelector('meta[name="description"]');
        if (descMeta) descMeta.setAttribute('content', description);
        
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) ogTitle.setAttribute('content', title);
        
        const ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc) ogDesc.setAttribute('content', description);
        
        const twTitle = document.querySelector('meta[name="twitter:title"]');
        if (twTitle) twTitle.setAttribute('content', title);
        
        const twDesc = document.querySelector('meta[name="twitter:description"]');
        if (twDesc) twDesc.setAttribute('content', description);
    }

    // Routing helper with OSRM (Keyless, Public)
    async function getOSRMRoute(startCoords, destCoords) {
        const url = `https://router.project-osrm.org/route/v1/driving/${startCoords.lon},${startCoords.lat};${destCoords.lon},${destCoords.lat}?overview=full&geometries=geojson&annotations=duration`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Routing server error');
        }
        const data = await response.json();
        if (!data.routes || data.routes.length === 0) {
            throw new Error('No driving route found between these locations.');
        }
        return data.routes[0];
    }

    // Perform the calculation pipeline
    async function performCalculation(startQuery, destQuery) {
        // Show loading screen, hide results and idle states
        loadingDisplay.classList.remove('hidden');
        resultDisplay.classList.add('hidden');
        errorDisplay.classList.add('hidden');
        resultsIdle.classList.add('hidden');

        try {
            // 1. Geocode both locations
            const startCoords = await geocodeAddress(startQuery);
            // Delay slightly to respect Nominatim's 1-second limit policy
            await new Promise(resolve => setTimeout(resolve, 800));
            const destCoords = await geocodeAddress(destQuery);

            // 2. Fetch OSRM route
            const routeData = await getOSRMRoute(startCoords, destCoords);

            // 3. Process Route stats
            const durationSec = routeData.duration; // seconds
            const distanceMeters = routeData.distance; // meters
            
            const distanceMiles = distanceMeters * 0.000621371;
            const durationMins = durationSec / 60;
            const listensCount = durationSec / songDurationSeconds;

            // Formatted trip duration text
            const hours = Math.floor(durationSec / 3600);
            const minutes = Math.floor((durationSec % 3600) / 60);
            const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

            // Get themed Taylor quote
            const lyricsObj = getTaylorQuote(listensCount, Math.round(durationMins));

            // Update UI
            listenCountEl.textContent = listensCount.toFixed(2);
            routeDurationEl.textContent = durationText;
            routeDistanceEl.textContent = `${distanceMiles.toFixed(1)} mi`;
            lyricCommentEl.textContent = `"${lyricsObj.quote}"`;
            lyricContextEl.innerHTML = `&mdash; ${lyricsObj.context}`;

            // Clean up old map visual layers
            if (routeLayer) {
                map.removeLayer(routeLayer);
            }
            markersLayer.clearLayers();

            // Draw route on map
            routeLayer = L.geoJSON(routeData.geometry, {
                style: {
                    color: '#8c2424',
                    weight: 6,
                    opacity: 0.8,
                    lineJoin: 'round',
                    lineCap: 'round'
                }
            }).addTo(map);

            // Add custom styled markers
            const startMarkerName = startQuery.split(',')[0];
            const destMarkerName = destQuery.split(',')[0];

            L.marker([startCoords.lat, startCoords.lon], { icon: startIcon })
                .bindPopup(`<b>Start</b><br>${startMarkerName}`)
                .addTo(markersLayer);

            L.marker([destCoords.lat, destCoords.lon], { icon: destIcon })
                .bindPopup(`<b>Destination</b><br>${destMarkerName}`)
                .addTo(markersLayer);

            // Add loop completion markers along the route
            if (routeData.legs && routeData.legs[0] && routeData.legs[0].annotation && routeData.legs[0].annotation.duration) {
                const durations = routeData.legs[0].annotation.duration;
                const coords = routeData.geometry.coordinates;
                
                let currentAccumulatedTime = 0;
                let currentLoop = 1;
                
                for (let i = 0; i < durations.length; i++) {
                    currentAccumulatedTime += durations[i];
                    
                    // If we crossed a 10m 13s (613s) mark
                    if (currentAccumulatedTime >= currentLoop * songDurationSeconds) {
                        const targetCoord = coords[i + 1]; // Node after this interval
                        if (targetCoord) {
                            const loopLat = targetCoord[1];
                            const loopLon = targetCoord[0];
                            
                            // Custom HTML icon for loop marker (numbered gold badge)
                            const loopIcon = L.divIcon({
                                className: 'custom-pin loop-pin',
                                html: `<div style="background-color: #8c2424; color: #fdfbf7; width: 22px; height: 22px; border: 2px solid #c59b6b; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; box-shadow: 0 0 10px rgba(92, 22, 22, 0.6); transform: scale(1.15);">${currentLoop}</div>`,
                                iconSize: [22, 22],
                                iconAnchor: [11, 11]
                            });
                            
                            // Calculate formatted completion time for this loop (e.g. 10:13, 20:26, etc.)
                            const elapsedFormatted = formatTime(currentLoop * songDurationSeconds);
                            
                            L.marker([loopLat, loopLon], { icon: loopIcon })
                                .bindPopup(`<b>All Too Well (10m Version)</b><br>
                                            <span style="color: #c59b6b; font-weight: bold;">Listen #${currentLoop} Finished Here</span><br>
                                            Time elapsed: ${elapsedFormatted}<br>
                                            <i>"I was there, I remember it all too well..."</i>`)
                                .addTo(markersLayer);
                                
                            currentLoop++;
                        }
                    }
                }
            }

            // Zoom map to fit the route
            map.fitBounds(routeLayer.getBounds(), {
                padding: [50, 50]
            });

            // Update route header overlay details
            const routeNameText = `${startMarkerName} to ${destMarkerName}`;
            displayRouteNames.textContent = routeNameText;
            routeInfoBar.classList.remove('hidden');

            // Hide loading, show results and export map button
            loadingDisplay.classList.add('hidden');
            resultDisplay.classList.remove('hidden');
            exportMapBtn.classList.remove('hidden');

            // Update URL query parameters without reloading the page
            const newUrl = `${window.location.pathname}?start=${encodeURIComponent(startQuery)}&destination=${encodeURIComponent(destQuery)}`;
            window.history.pushState({ path: newUrl }, '', newUrl);

            // Update OpenGraph and Twitter card dynamic tags
            updateDynamicMeta(startMarkerName, destMarkerName, listensCount);

        } catch (error) {
            console.error(error);
            errorMessage.textContent = error.message || 'An error occurred during route planning.';
            loadingDisplay.classList.add('hidden');
            errorDisplay.classList.remove('hidden');
            exportMapBtn.classList.add('hidden');
        }
    }

    // Form submission
    routeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const startVal = startInput.value.trim();
        const destVal = destInput.value.trim();
        if (startVal && destVal) {
            performCalculation(startVal, destVal);
        }
    });



    // Reset controls
    newCalculationBtn.addEventListener('click', () => {
        resultDisplay.classList.add('hidden');
        routeInfoBar.classList.add('hidden');
        exportMapBtn.classList.add('hidden');
        if (routeLayer) {
            map.removeLayer(routeLayer);
            routeLayer = null;
        }
        markersLayer.clearLayers();
        map.setView([40.0, -98.0], 4);
        
        startInput.value = '';
        destInput.value = '';
        resultsIdle.classList.remove('hidden');

        // Clear query parameters
        const newUrl = window.location.pathname;
        window.history.pushState({ path: newUrl }, '', newUrl);

        // Reset metadata
        resetMeta();
    });

    errorCloseBtn.addEventListener('click', () => {
        errorDisplay.classList.add('hidden');
        exportMapBtn.classList.add('hidden');
        resultsIdle.classList.remove('hidden');

        // Clear query parameters
        const newUrl = window.location.pathname;
        window.history.pushState({ path: newUrl }, '', newUrl);

        // Reset metadata
        resetMeta();
    });

    // ----------------------------------------------------
    // 5. AUTOCOMPLETE FUNCTIONALITY (Nominatim)
    // ----------------------------------------------------
    function debounce(func, delay) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    function setupAutocomplete(inputEl, containerEl) {
        const fetchSuggestions = debounce(async (val) => {
            if (val.length < 3) {
                containerEl.innerHTML = '';
                containerEl.classList.remove('active');
                return;
            }

            try {
                // Nominatim search with limit 5, US filter, and addressdetails enabled
                const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&limit=5&addressdetails=1&countrycodes=us&email=colin@example.com`;
                const response = await fetch(url);
                if (!response.ok) return;
                const data = await response.json();
                
                containerEl.innerHTML = '';
                if (data.length === 0) {
                    containerEl.classList.remove('active');
                    return;
                }

                data.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'suggestion-item';
                    
                    const cleanedName = formatAddress(item);
                    div.textContent = cleanedName;
                    div.title = item.display_name; // Full details in tooltip
                    
                    div.addEventListener('click', () => {
                        inputEl.value = cleanedName;
                        containerEl.innerHTML = '';
                        containerEl.classList.remove('active');
                    });
                    containerEl.appendChild(div);
                });
                containerEl.classList.add('active');
            } catch (err) {
                console.error('Autocomplete error:', err);
            }
        }, 400);

        inputEl.addEventListener('input', (e) => {
            fetchSuggestions(e.target.value.trim());
        });

        // Close search lists on clicking outside
        document.addEventListener('click', (e) => {
            if (!inputEl.contains(e.target) && !containerEl.contains(e.target)) {
                containerEl.classList.remove('active');
            }
        });
    }

    // Initialize Autocomplete
    setupAutocomplete(startInput, document.getElementById('start-suggestions'));
    setupAutocomplete(destInput, document.getElementById('dest-suggestions'));

    // ----------------------------------------------------
    // 6. MAP IMAGE EXPORT (html2canvas)
    // ----------------------------------------------------
    exportMapBtn.addEventListener('click', () => {
        const originalText = exportMapBtn.innerHTML;
        exportMapBtn.innerHTML = '<i data-lucide="loader" class="spin"></i><span>Capturing...</span>';
        exportMapBtn.disabled = true;
        lucide.createIcons();

        const mapContainer = document.getElementById('map');

        // Helper to parse CSS transform strings (translate, translate3d, matrix, matrix3d)
        function getTranslation(transformStr) {
            if (!transformStr || transformStr === 'none') {
                return { x: 0, y: 0 };
            }
            
            // Check for translate3d or translate formats
            if (transformStr.includes('translate')) {
                const matches = transformStr.match(/translate(?:3d)?\(([^)]+)\)/);
                if (matches && matches[1]) {
                    const parts = matches[1].split(',');
                    return {
                        x: parseFloat(parts[0]) || 0,
                        y: parseFloat(parts[1]) || 0
                    };
                }
            }
            
            // Fallback to matrix parsing (used by computed style outputs)
            if (transformStr.startsWith('matrix3d')) {
                const parts = transformStr.split('(')[1].split(')')[0].split(',');
                return {
                    x: parseFloat(parts[12]) || 0,
                    y: parseFloat(parts[13]) || 0
                };
            } else if (transformStr.startsWith('matrix')) {
                const parts = transformStr.split('(')[1].split(')')[0].split(',');
                return {
                    x: parseFloat(parts[4]) || 0,
                    y: parseFloat(parts[5]) || 0
                };
            }
            return { x: 0, y: 0 };
        }

        // We capture map canvas with CORS enabled to capture standard basemap tiles
        html2canvas(mapContainer, {
            useCORS: true,
            logging: false,
            scale: 2, // High DPI export
            onclone: (clonedDoc) => {
                // Correct coordinate shifts for all leaflet panes inside the cloned DOM
                const leafletPanes = [
                    '.leaflet-map-pane',
                    '.leaflet-tile-container',
                    '.leaflet-marker-pane',
                    '.leaflet-overlay-pane',
                    '.leaflet-overlay-pane svg',
                    '.leaflet-shadow-pane',
                    '.leaflet-zoom-grid'
                ];
                
                leafletPanes.forEach(selector => {
                    clonedDoc.querySelectorAll(selector).forEach(el => {
                        let transform = el.style.transform || el.style.webkitTransform;
                        if (!transform || transform === 'none') {
                            const style = window.getComputedStyle(el);
                            transform = style.transform || style.webkitTransform;
                        }
                        
                        if (transform && transform !== 'none') {
                            const trans = getTranslation(transform);
                            el.style.transform = 'none';
                            el.style.webkitTransform = 'none';
                            
                            const curLeft = parseFloat(el.style.left) || 0;
                            const curTop = parseFloat(el.style.top) || 0;
                            el.style.left = `${curLeft + trans.x}px`;
                            el.style.top = `${curTop + trans.y}px`;
                        }
                    });
                });
                
                // Correct shifts for all markers and shadows inside the cloned DOM
                clonedDoc.querySelectorAll('.leaflet-marker-icon, .leaflet-marker-shadow').forEach(el => {
                    let transform = el.style.transform || el.style.webkitTransform;
                    if (!transform || transform === 'none') {
                        const style = window.getComputedStyle(el);
                        transform = style.transform || style.webkitTransform;
                    }
                    
                    if (transform && transform !== 'none') {
                        const trans = getTranslation(transform);
                        el.style.transform = 'none';
                        el.style.webkitTransform = 'none';
                        
                        const curLeft = parseFloat(el.style.left) || 0;
                        const curTop = parseFloat(el.style.top) || 0;
                        el.style.left = `${curLeft + trans.x}px`;
                        el.style.top = `${curTop + trans.y}px`;
                    }
                });
            }
        }).then(canvas => {
            // Revert Button state
            exportMapBtn.innerHTML = originalText;
            exportMapBtn.disabled = false;
            lucide.createIcons();

            // Create download anchor link
            const imgURL = canvas.toDataURL('image/png');
            const downloadLink = document.createElement('a');
            
            const startName = startInput.value.split(',')[0].trim().replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const destName = destInput.value.split(',')[0].trim().replace(/[^a-z0-9]/gi, '_').toLowerCase();
            
            downloadLink.download = `all_too_well_map_${startName}_to_${destName}.png`;
            downloadLink.href = imgURL;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        }).catch(err => {
            console.error('Export fail:', err);
            exportMapBtn.innerHTML = originalText;
            exportMapBtn.disabled = false;
            lucide.createIcons();
            alert('Could not export map. Try zooming out slightly or clearing cache.');
        });
    });

    // Check for query parameters to auto-calculate on page load
    const urlParams = new URLSearchParams(window.location.search);
    const paramStart = urlParams.get('start') || urlParams.get('s');
    const paramDest = urlParams.get('destination') || urlParams.get('dest') || urlParams.get('d');
    
    if (paramStart && paramDest) {
        startInput.value = paramStart;
        destInput.value = paramDest;
        // Delay slightly to ensure map tiles render first
        setTimeout(() => {
            performCalculation(paramStart, paramDest);
        }, 400);
    }
});
