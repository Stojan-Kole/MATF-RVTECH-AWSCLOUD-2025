document.addEventListener('DOMContentLoaded', () => {
    const map = L.map('map').setView([44.7866, 20.4489], 12); // Centrirano na Beograd
    window.leafletMap = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    let markers = [];
    const chargerListEl = document.getElementById('charger-list-items');
    const closestListEl = document.getElementById('closest-stations-list');
    let allChargers = [];
    let userLat = null;
    let userLon = null;
    const chargerIdToMarker = new Map();

    loadChargers();
    enableLiveLocation(map);

    function euclideanDistanceKm(lat1, lon1, lat2, lon2) {
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const lat1Rad = lat1 * (Math.PI / 180);
        const kmPerDegLat = 111.32;
        const kmPerDegLon = 111.32 * Math.cos(lat1Rad);
        const kmLat = dLat * kmPerDegLat;
        const kmLon = dLon * kmPerDegLon;
        return Math.sqrt(kmLat * kmLat + kmLon * kmLon);
    }

    function updateClosestStations() {
        if (!closestListEl) return;
        if (userLat == null || userLon == null) {
            closestListEl.innerHTML = '<li class="closest-placeholder">Čekanje lokacije (plava tačka)...</li>';
            return;
        }
        if (allChargers.length === 0) {
            closestListEl.innerHTML = '<li class="closest-placeholder">Nema učitane liste punjača.</li>';
            return;
        }
        const withDistance = allChargers
            .filter(c => c.latitude != null && c.longitude != null)
            .map(c => ({
                ...c,
                distanceKm: euclideanDistanceKm(userLat, userLon, c.latitude, c.longitude)
            }));
        withDistance.sort((a, b) => a.distanceKm - b.distanceKm);
        const top5 = withDistance.slice(0, 5);

        closestListEl.innerHTML = '';
        top5.forEach((charger, index) => {
            const li = document.createElement('li');
            li.className = 'closest-station-item';
            li.innerHTML = `
                <span class="closest-station-name">${index + 1}. ${charger.title || 'Nepoznat punjač'}</span>
            `;
            li.addEventListener('click', () => {
                map.setView([charger.latitude, charger.longitude], 15);
                const marker = chargerIdToMarker.get(charger.chargerId)
                    || chargerIdToMarker.get(`${charger.latitude},${charger.longitude}`);
                if (marker) marker.openPopup();
            });
            closestListEl.appendChild(li);
        });
    }

    function getSyncUrl() {
        const apiUrl = API_CONFIG.apiUrl || '';
        return apiUrl.replace(/\/chargers\/?$/, '/sync');
    }

    async function triggerSyncThenLoad() {
        const btn = document.getElementById('btn-load-chargers');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Učitavanje...';
        }
        const syncUrl = getSyncUrl();
        try {
            const res = await fetch(syncUrl);
            if (!res.ok) throw new Error('Sync nije uspeo');
            const data = await res.json().catch(() => ({}));
            console.log('Sync rezultat:', data);
        } catch (e) {
            console.error('Greška pri sync-u:', e);
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Učitaj punjače';
            }
            chargerListEl.innerHTML = '<li style="padding:1rem; color:red; text-align:center;">Greška pri učitavanju iz OCM. Proverite da li LocalStack i Lambda rade.</li>';
            return;
        }
        await loadChargers();
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Učitaj punjače';
        }
    }

    async function loadChargers() {
        if (typeof API_CONFIG === 'undefined' || !API_CONFIG.apiUrl) {
            console.error("API_CONFIG nije definisan. Proverite js/config.js.");
            chargerListEl.innerHTML = '<li style="padding:1rem; color:red; text-align:center;">Greška: Nedostaje konfiguracija (pokušajte ponovo ./setup.sh)</li>';
            return;
        }

        const apiUrl = API_CONFIG.apiUrl;
        console.log("Auto-učitavanje sa:", apiUrl);

        chargerListEl.innerHTML = '<li style="padding:1rem; text-align:center;">Učitavanje podataka...</li>';

        try {
            const response = await fetch(apiUrl);

            if (!response.ok) {
                throw new Error(`HTTP greška! Status: ${response.status}`);
            }

            const chargers = await response.json();
            console.log("Pronađeno punjača:", chargers.length);

            chargerListEl.innerHTML = '';
            markers.forEach(m => map.removeLayer(m));
            markers = [];
            chargerIdToMarker.clear();
            allChargers = chargers;

            if (chargers.length === 0) {
                chargerListEl.innerHTML = `
                    <li class="empty-state">
                        <p>Nema pronađenih punjača.</p>
                        <p class="empty-hint">Podaci se učitavaju iz Open Charge Map. Ako je ovo prvi put, učitaj punjače.</p>
                        <button type="button" id="btn-load-chargers" class="btn-load-chargers">Učitaj punjače</button>
                    </li>
                `;
                document.getElementById('btn-load-chargers').addEventListener('click', triggerSyncThenLoad);
                updateClosestStations();
                return;
            }

            chargers.forEach(charger => {
                const lat = charger.latitude;
                const lon = charger.longitude;
                const title = charger.title || 'Nepoznat punjač';
                const status = charger.status || 'Unknown';
                const town = charger.town || 'N/A';

                const id = charger.chargerId;

                if (lat && lon) {
                    const statusClass = status.toLowerCase() === 'available' ? 'available' : 'offline';

                    const marker = L.marker([lat, lon]).addTo(map);
                    if (id != null) chargerIdToMarker.set(String(id), marker);
                    chargerIdToMarker.set(`${lat},${lon}`, marker);
                    marker.bindPopup(`
                        <div style="min-width: 200px;">
                            <h3 style="margin:0 0 5px 0;">${title}</h3>
                            <p style="margin:0;"><strong>Grad:</strong> ${town}</p>
                            <p style="margin:0;"><strong>Status:</strong> ${status}</p>
                        </div>
                    `);
                    markers.push(marker);

                    const li = document.createElement('li');
                    li.className = 'charger-item';
                    li.innerHTML = `
                        <span class="charger-title">${title}</span>
                        <span class="charger-info">${town}</span>
                        <span class="charger-status ${statusClass}">${status}</span>
                    `;

                    li.addEventListener('click', () => {
                        map.setView([lat, lon], 15);
                        marker.openPopup();
                    });

                    chargerListEl.appendChild(li);
                }
            });

            if (markers.length > 0) {
                const group = new L.featureGroup(markers);
                map.fitBounds(group.getBounds().pad(0.1));
            }

            updateClosestStations();
        } catch (error) {
            console.error("Greška prilikom učitavanja:", error);
            chargerListEl.innerHTML = `
                <li class="empty-state error-state">
                    <p>Greška prilikom učitavanja podataka.</p>
                    <p class="empty-hint">Proverite da li je LocalStack pokrenut i da li je API dostupan.</p>
                    <button type="button" id="btn-retry-load" class="btn-load-chargers">Pokušaj ponovo</button>
                </li>
            `;
            document.getElementById('btn-retry-load').addEventListener('click', () => loadChargers());
        }
    }

    function enableLiveLocation(map) {
        if (!navigator.geolocation) {
            console.log("Geolocation is not supported by your browser");
            return;
        }

        let userMarker, accuracyCircle;
        let firstLocationUpdate = true;

        navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                // console.log(`Live Location: ${latitude}, ${longitude} (Accuracy: ${accuracy}m)`);

                userLat = latitude;
                userLon = longitude;

                if (userMarker) {
                    userMarker.setLatLng([latitude, longitude]);
                    accuracyCircle.setLatLng([latitude, longitude]);
                    accuracyCircle.setRadius(accuracy);
                } else {
                    // Create Custom Pulse Icon
                    const pulseIcon = L.divIcon({
                        className: 'user-location-marker',
                        html: '<div class="user-location-pulse"></div><div class="user-location-dot"></div>',
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    });

                    userMarker = L.marker([latitude, longitude], { icon: pulseIcon }).addTo(map);
                    accuracyCircle = L.circle([latitude, longitude], { radius: accuracy, startAngle: 45 }).addTo(map); // startAngle for nice overlap if supported, else ignored, standard circle is fine
                }

                if (firstLocationUpdate) {
                    map.setView([latitude, longitude], 13);
                    firstLocationUpdate = false;
                }
                updateClosestStations();
            },
            (error) => {
                console.error("Geolocation error:", error);
                // Optional: Show toast or ignore
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }
});
