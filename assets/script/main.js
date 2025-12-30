// Fokus otomatis ke input pencarian saat halaman dibuka.
// document.getElementById('search') melakukan lookup elemen DOM dengan id 'search'.
// .focus() mengaktifkan fokus keyboard pada elemen, menempatkan caret di dalam input.
document.getElementById('search').focus();

let judulList = []; // Variabel global (block-scoped dengan let) untuk menyimpan array judul yang di-parse dari data.txt

// Ambil daftar judul dari file data menggunakan Fetch API.
// fetch('data.txt') melakukan HTTP GET ke resource relatif 'data.txt'.
// fetch mengembalikan Promise yang resolve ke Response; error hanya pada kegagalan jaringan (bukan status 4xx/5xx).
fetch('data.txt')
    .then(response => response.text()) // Response.body dibaca sebagai teks (stream → string), mengembalikan Promise<string>.
    .then(text => {
        // text.split('|'): memecah payload teks berdasarkan delimiter '|' menghasilkan array string.
        // .map(j => j.trim()): menghapus whitespace leading/trailing dari setiap elemen.
        // .filter(j => j !== ''): mengeliminasi entri kosong untuk mencegah item kosong di UI.
        judulList = text.split('|').map(j => j.trim()).filter(j => j !== '');
        // Render awal seluruh daftar ke DOM menggunakan fungsi tampilkanJudul.
        tampilkanJudul(judulList);
    })
    .catch(error => console.error('Gagal memuat data:', error)); // Penanganan error Promise: log stack/objek error ke konsol.

// Fungsi tampilkan daftar judul ke dalam <ul id="arsip-list"> dan memperbarui jumlah.
// Parameter 'list' adalah array string yang akan dirender.
function tampilkanJudul(list) {
    const ul = document.getElementById('arsip-list');   // Node referensi kontainer list (UL).
    const jumlah = document.getElementById('jumlah-judul'); // Node referensi penampil jumlah (SPAN).
    ul.innerHTML = ""; // Menghapus seluruh child nodes dengan mengosongkan markup; trigger reflow saat append berikutnya.

    // tampilkan jumlah judul saat ini (setelah filter bila ada).
    // textContent menetapkan node text tanpa parsing HTML (aman terhadap injeksi markup).
    jumlah.textContent = list.length;

    // Iterasi list menggunakan Array.prototype.forEach (callback sinkron per elemen).
    list.forEach((judul, index) => {
        // Buat node element baru menggunakan Document API. Belum ter-attach ke DOM hingga appendChild dipanggil.
        const li = document.createElement('li');
        const link = document.createElement('a');

        // Set konten teks anchor; menggunakan textContent agar tidak mengeksekusi HTML/JS yang mungkin terkandung.
        link.textContent = judul;

        // Konversi judul menjadi nama file yang aman (whitelist karakter + blokir traversal/path injection).
        const safeName = sanitizeFileName(judul);
        if (safeName) {
            // Bangun URL ke halaman view dengan parameter query 'file'.
            // encodeURIComponent meng-encode karakter khusus (spasi, aksen, dll) agar valid di query string.
            link.href = `view.html?file=${encodeURIComponent("data/" + safeName + ".txt")}`;
            // target _self eksplisit: navigasi di konteks browsing yang sama (tab saat ini).
            link.target = "_self";
            // Sisipkan <a> sebagai child dari <li>; operasi DOM ini menambahkan node ke pohon namun belum ke UL.
            li.appendChild(link);

            // Tambahkan kelas CSS untuk animasi; classList adalah DOMTokenList (mutasi atribut class).
            li.classList.add('fade-in');
            // Inline style animation-delay diatur per item untuk efek staggered.
            // Nilai string dengan satuan 's' (detik). index*0.1 menghasilkan delay linear bertahap.
            li.style.animationDelay = `${index * 0.1}s`; // setiap item delay 0.1 detik

            // Append <li> ke dalam <ul>; menyebabkan reflow/repaint sesuai layout engine.
            ul.appendChild(li);
        }
        // Jika safeName null, item tidak dirender (fail-safe terhadap input tidak valid/berbahaya).
    });
}

// Sanitasi nama file judul
function sanitizeFileName(name) {
    if (!name) return null; // Guard clause: undefined/null/empty → dianggap tidak valid.

    // Regex pengganti karakter non-whitelist:
    // [^a-zA-Z0-9 ,:_\-\.\u00C0-\u017F]
    // - ^ di dalam [] berarti negasi: "semua yang BUKAN karakter berikut".
    // - a-zA-Z0-9: huruf Latin basic dan digit.
    // - spasi, koma, titik dua, underscore (_), minus (-), titik (.).
    // - \u00C0-\u017F: rentang Unicode Latin-1 Supplement & Latin Extended-A (mendukung aksen).
    // Flag 'g': global (semua kemunculan).
    const safe = name.replace(/[^a-zA-Z0-9 ,:_\-\.\u00C0-\u017F]/g, "");

    // Pemeriksaan pola traversal/manipulasi path:
    // - ".." mengindikasikan naik direktori.
    // - "/" dan "\" merupakan separator path pada sistem Unix/Windows.
    // Mengembalikan null untuk menolak nama berisiko sebelum digunakan dalam URL/file path.
    if (safe.includes("..") || safe.includes("/") || safe.includes("\\")) {
        return null;
    }
    return safe; // Nama yang sudah dinormalisasi sesuai whitelist.
}

// Event pencarian aman
document.getElementById('search').addEventListener('input', function () {
    // this.value: nilai string input saat event 'input' terpicu (ketikan/paste/delete).
    // .toLowerCase(): normalisasi untuk pencarian case-insensitive.
    const keyword = sanitizeInput(this.value.toLowerCase());
    // Filter array judulList:
    // - j.toLowerCase(): normalisasi masing-masing judul.
    // - .includes(keyword): pencocokan substring (O(n*m) tergantung panjang string).
    const hasil = judulList.filter(j => j.toLowerCase().includes(keyword));
    // Render ulang hasil filter ke DOM (full re-render konten UL).
    tampilkanJudul(hasil);
});

// Sanitasi input pencarian
function sanitizeInput(input) {
    // Regex mirip dengan sanitizeFileName namun disesuaikan untuk input pencarian:
    // - Mengizinkan huruf/angka + spasi + underscore + minus + titik + rentang Latin beraksen.
    // Flag 'g' global dan 'i' case-insensitive (mengizinkan A-Z tanpa perlu menulis dua rentang).
    // Penggunaan replace menghapus karakter non-whitelist, menghasilkan string "bersih".
    return input.replace(/[^a-z0-9 _\-\.\u00C0-\u017F]/gi, "");
}


const navbar = document.querySelector('.search-container');

window.addEventListener('scroll', () => {
  if (window.scrollY > 0) {
    navbar.classList.add('shadow');
  } else {
    navbar.classList.remove('shadow');
  }
});

