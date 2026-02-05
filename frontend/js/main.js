document.addEventListener('DOMContentLoaded', () => {
    const map = L.map('map').setView([44.7866, 20.4489], 12); // Centrirano na Beograd
    window.leafletMap = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    let markers = [];
    const chargerListEl = document.getElementById('charger-list-items');

    loadChargers();
    enableLiveLocation(map);

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

            if (chargers.length === 0) {
                chargerListEl.innerHTML = '<li style="padding:1rem; text-align:center;">Nema pronađenih punjača.</li>';
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

        } catch (error) {
            console.error("Greška prilikom učitavanja:", error);
            chargerListEl.innerHTML = '<li style="padding:1rem; color:red; text-align:center;">Greška prilikom učitavanja podataka.</li>';
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
