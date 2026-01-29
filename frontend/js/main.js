document.addEventListener('DOMContentLoaded', () => {
    // Inicijalizacija mape
    const map = L.map('map').setView([44.7866, 20.4489], 12); // Centrirano na Beograd

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    let markers = [];
    const loadButton = document.getElementById('load-btn');
    const apiUrlInput = document.getElementById('apiUrl');
    const chargerListEl = document.getElementById('charger-list-items');

    loadButton.addEventListener('click', loadChargers);

    // Initial load if desired
    // loadChargers();

    async function loadChargers() {
        const apiUrl = apiUrlInput.value.trim();
        if (!apiUrl) {
            alert('Molimo unesite API URL');
            return;
        }

        loadButton.disabled = true;
        loadButton.textContent = 'Učitavanje...';

        // Očisti stare markere
        markers.forEach(m => map.removeLayer(m));
        markers = [];
        chargerListEl.innerHTML = '';

        try {
            console.log("Učitavam punjače sa:", apiUrl);
            const response = await fetch(apiUrl);

            if (!response.ok) {
                throw new Error(`HTTP greška! Status: ${response.status}`);
            }

            const chargers = await response.json();
            console.log("Pronađeno punjača:", chargers.length);

            if (chargers.length === 0) {
                chargerListEl.innerHTML = '<li style="padding:1rem; text-align:center;">Nema pronađenih punjača.</li>';
                return;
            }

            chargers.forEach(charger => {
                // Backend vraća ravnu strukturu
                const lat = charger.latitude;
                const lon = charger.longitude;
                const title = charger.title || 'Nepoznat punjač';
                const status = charger.status || 'Unknown';
                const town = charger.town || 'N/A';
                const id = charger.chargerId;

                if (lat && lon) {
                    const statusClass = status.toLowerCase() === 'available' ? 'available' : 'offline';
                    const markerColor = statusClass === 'available' ? 'blue' : 'red'; // Leaflet default markers are blue, can use custom icons later

                    const marker = L.marker([lat, lon]).addTo(map);
                    marker.bindPopup(`
                        <div style="min-width: 200px;">
                            <h3 style="margin:0 0 5px 0;">${title}</h3>
                            <p style="margin:0;"><strong>Grad:</strong> ${town}</p>
                            <p style="margin:0;"><strong>Status:</strong> ${status}</p>
                        </div>
                    `);
                    markers.push(marker);

                    // Dodaj u listu
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

            // Fit map to markers bounds if there are any
            if (markers.length > 0) {
                const group = new L.featureGroup(markers);
                map.fitBounds(group.getBounds().pad(0.1));
            }

        } catch (error) {
            console.error("Greška prilikom učitavanja:", error);
            alert("Došlo je do greške prilikom učitavanja punjača.\nProverite konzolu i validnost URL-a.");
        } finally {
            loadButton.disabled = false;
            loadButton.textContent = 'Učitaj punjače';
        }
    }
});
