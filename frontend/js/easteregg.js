document.addEventListener('DOMContentLoaded', () => {
    const checkMapInterval = setInterval(() => {
        if (window.leafletMap) {
            clearInterval(checkMapInterval);
            initEasterEgg(window.leafletMap);
        }
    }, 100);

    function initEasterEgg(map) {
        const JAHORINA_COORDS = { lat: 43.7385239, lon: 18.5635638 };
        const TRIGGER_DISTANCE_KM = 7;

        map.on('click', function (e) {
            const distance = calculateDistance(e.latlng.lat, e.latlng.lng, JAHORINA_COORDS.lat, JAHORINA_COORDS.lon);

            if (distance < TRIGGER_DISTANCE_KM) {
                console.log("Triggering Easter Egg!");
                showEasterEgg();
            }
        });

        function calculateDistance(lat1, lon1, lat2, lon2) {
            const R = 6371;
            const dLat = deg2rad(lat2 - lat1);
            const dLon = deg2rad(lon2 - lon1);
            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const d = R * c;
            return d;
        }

        function deg2rad(deg) {
            return deg * (Math.PI / 180);
        }
    }

    window.showEasterEgg = function () {
        const modal = document.getElementById('easterEggModal');
        if (modal) modal.style.display = 'flex';
    }

    window.closeEasterEgg = function () {
        const modal = document.getElementById('easterEggModal');
        if (modal) modal.style.display = 'none';
    }

    window.addEventListener('click', function (event) {
        const modal = document.getElementById('easterEggModal');
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    });
});
