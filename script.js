// Ganti dengan Project URL dan anon public key Anda
const supabaseClient_URL = 'https://jyjunbzusfrmaywmndpa.supabase.co';
const supabaseClient_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5anVuYnp1c2ZybWF5d21uZHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NDMxMTgsImV4cCI6MjA2OTQxOTExOH0.IQ6yyyR2OpvQj1lIL1yFsWfVNhJIm2_EFt5Pnv4Bd38';
// Dapatkan semua tombol dengan class 'tombol-lintasan'
const tombolLintasan = document.querySelectorAll('.tombol-lintasan');
// Inisialisasi klien supabaseClient
const supabaseClient = supabase.createClient(supabaseClient_URL, supabaseClient_ANON_KEY);

const map = L.map('map').setView([-7.769356, 110.383056], 25);

// Tambahkan peta dasar dari OpenStreetMap
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png', {
    maxZoom: 29,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
}).addTo(map);

// --- Bagian untuk Menambahkan Gambar Satelit Anda ---

const getBounds = [
    [-7.7695260,110.3828710], // Sudut Kiri Bawah (min lat, min lon)
    [-7.7692240,110.3832520]  // Sudut Kanan Atas (max lat, max lon)
];

map.setMaxBounds(getBounds);
map.fitBounds(getBounds); 


// --- Fungsi untuk memperbarui UI ---
// Fungsi untuk memperbarui UI data navigasi
function updateNavUI(data) {
    // Perbaikan: Pastikan `data` ada sebelum mengakses propertinya
    if (!data) {
        // Jika data kosong, atur semua ke 'N/A'
        document.getElementById('timestamp').innerText = 'N/A';
        document.getElementById('sog_kmh').innerText = 'N/A';
        document.getElementById('sog_knots').innerText = 'N/A';
        // document.getElementById('cog').innerText = 'N/A';
        document.getElementById('latitude').innerText = 'N/A';
        document.getElementById('longitude').innerText = 'N/A';
        return;
    }

    const sog_knots = msToKnots(data.sog_ms);
    const sog_kmh = msToKmh(data.sog_ms);

    document.getElementById('timestamp').innerText = new Date(data.timestamp).toLocaleString();
    document.getElementById('sog_kmh').innerText = sog_kmh.toFixed(2);
    document.getElementById('sog_knots').innerText = sog_knots.toFixed(2);
    // document.getElementById('cog').innerText = data.cog.toFixed(2);
    document.getElementById('latitude').innerText = data.latitude.toFixed(6);
    document.getElementById('longitude').innerText = data.longitude.toFixed(6);
}



// Tambahkan event listener untuk setiap tombol
tombolLintasan.forEach(tombol => {
    tombol.addEventListener('click', () => {
        // Hapus class 'aktif' dari semua tombol
        tombolLintasan.forEach(t => {
            t.classList.remove('aktif');
        });

        // Tambahkan class 'aktif' ke tombol yang baru diklik
        tombol.classList.add('aktif');
    });
});

function updateCogUI(data) {
    document.getElementById('cog').innerText = data.cog ? data.cog.toFixed(2) : 'N/A';
}

// Fungsi untuk memperbarui UI gambar misi
function updateMissionImagesUI(images) {
    const kameraDepanContainer = document.getElementById('kamera-depan-container');
    const kameraBelakangContainer = document.getElementById('kamera-belakang-container');

    // Kosongkan container
    kameraDepanContainer.innerHTML = '';
    kameraBelakangContainer.innerHTML = '';

    if (!images || images.length === 0) {
        kameraDepanContainer.innerHTML = '<p>Belum ada foto.</p>';
        kameraBelakangContainer.innerHTML = '<p>Belum ada foto.</p>';
        return;
    }

    // Proses setiap gambar yang diambil dari database
    images.forEach(imgData => {
        const imgElement = document.createElement('img');
        imgElement.src = imgData.image_url;
        imgElement.alt = `Foto dari ${imgData.image_slot_name}`;

        if (imgData.image_slot_name === 'kamera_atas') {
            kameraDepanContainer.appendChild(imgElement);
        } else if (imgData.image_slot_name === 'kamera_bawah') {
            kameraBelakangContainer.appendChild(imgElement);
        }
    });
}

// Fungsi untuk mengkonversi meter per detik ke kilometer per jam
function msToKmh(sog_ms) {
    if (typeof sog_ms !== 'number' || isNaN(sog_ms)) {
        return 0;
    }
    return sog_ms * 3.6;
}

// Fungsi untuk mengkonversi meter per detik ke knot
function msToKnots(sog_ms) {
    if (typeof sog_ms !== 'number' || isNaN(sog_ms)) {
        return 0;
    }
    return sog_ms * 1.94384;
}

// --- Fungsi untuk mengambil data awal (initial fetch) ---
async function fetchInitialData() {
    const errorMessageElement = document.getElementById('error-message');
    try {
        // Ambil data navigasi paling baru
        errorMessageElement.innerText = '';
        errorMessageElement.classList.remove('error-message');
        
        const { data: navData, error: navError } = await supabaseClient
            .from('nav_data') // Perbaikan: Gunakan 'nav_data' yang konsisten
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(1);

        if (navError) throw navError;
        if (navData.length > 0) {
            updateNavUI(navData[0]);
        } else {
            // Tangani kasus di mana tidak ada data navigasi
            updateNavUI(null);
        }

        const {data: cogData, error: cogError} = await supabaseClient
            .from('cog_data') // Perbaikan: Gunakan 'cog' yang
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(1);

        if (cogError) throw cogError;
        if (cogData.length > 0) {
            updateCogUI(cogData[0]);
        } else {
            // Tangani kasus di mana tidak ada data COG     
            updateCogUI({ cog: null });
        }
        
        // Ambil semua data gambar
        const { data: images, error: imagesError } = await supabaseClient
            .from('gambar_atas')
            .select('*');
        
        if (imagesError) throw imagesError;
        
        updateMissionImagesUI(images); // Perbaikan: Kirim data langsung ke fungsi UI

        errorMessageElement.innerText = '';

    } catch (error) {
        errorMessageElement.innerText = `Gagal mengambil data awal: ${error.message}. Periksa konsol.`;
        errorMessageElement.classList.add('error-message');
        console.error('Error fetching initial data:', error);
    }
}

// --- Realtime Subscriptions untuk update otomatis ---

// Menggunakan Realtime untuk data navigasi
supabaseClient
  .channel('nav_data_changes')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'nav_data' }, payload => { // Perbaikan: Gunakan 'nav_data'
    console.log('Realtime Nav Data Update:', payload.new);
    updateNavUI(payload.new);
  })
  .subscribe();

// Menggunakan Realtime untuk gambar misi
supabaseClient
  .channel('mission_images_changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'gambar_atas' }, async payload => {
    console.log('Realtime Mission Images Update:', payload);
    
    // Perbaikan: Panggil ulang fungsi yang mengambil semua gambar terbaru
    // untuk memastikan tampilan selalu sinkron.
    const { data: images, error } = await supabaseClient
      .from('gambar_atas')
      .select('*');

    if (error) {
        console.error('Error fetching mission images after realtime update:', error);
        return;
    }
    updateMissionImagesUI(images);
  })
  .subscribe();

// Panggil fungsi untuk mengambil data awal saat halaman dimuat
document.addEventListener('DOMContentLoaded', fetchInitialData);