// Fokus otomatis ke input pencarian saat halaman dibuka.
// document.getElementById('search') melakukan lookup elemen DOM dengan id 'search'.
// .focus() mengaktifkan fokus keyboard pada elemen, menempatkan caret di dalam input.
document.getElementById('search').focus();

let judulList = []; // Variabel global (block-scoped dengan let) untuk menyimpan array judul yang di-parse dari data.txt

// Ambil daftar judul dari file data menggunakan Fetch API.
// fetch('data.txt') melakukan HTTP GET ke resource relatif 'data.txt'.
// fetch mengembalikan Promise yang resolve ke Response; error hanya pada kegagalan jaringan (bukan status 4xx/5xx).
fetch('data.txt') // melakukan HTTP GET ke resource relatif 'data.txt'
    .then(response => response.text())
    // response.text() mengubah body Response menjadi string isi file

    .then(text => {
        // Pecah isi file berdasarkan tanda pemisah '|'
        judulList = text.split('|')
            .map(item => {
                // Setiap item dipisah lagi berdasarkan tanda '-'
                const parts = item.split('-');
                return {
                    // Bagian pertama dianggap judul
                    judul: parts[0].trim(),
                    // Bagian kedua (jika ada) dianggap kategori
                    kategori: (parts[1] || "").trim()
                };
            })
            // Buang entri yang tidak punya judul
            .filter(obj => obj.judul !== '');

        // Panggil fungsi untuk menampilkan daftar judul ke halaman
        tampilkanJudul(judulList);
    })

    // Tangani error jaringan (misalnya file tidak ditemukan atau gagal fetch)
    .catch(error => console.error('Gagal memuat data:', error));

// Fungsi tampilkan daftar judul ke dalam <ul id="arsip-list"> dan memperbarui jumlah.
// Parameter 'list' adalah array string yang akan dirender.
function tampilkanJudul(list) {
    // Ambil elemen <ul> dengan id 'arsip-list' sebagai wadah daftar judul
    const ul = document.getElementById('arsip-list');
    // Ambil elemen dengan id 'jumlah-judul' untuk menampilkan jumlah judul
    const jumlah = document.getElementById('jumlah-judul');

    // Kosongkan isi <ul> sebelum menambahkan item baru
    ul.innerHTML = "";

    // Tampilkan jumlah judul di elemen jumlah
    jumlah.textContent = list.length;

    // Loop setiap item dalam list (item adalah objek {judul, kategori})
    list.forEach((item, index) => {
        // Buat elemen <li> untuk setiap judul
        const li = document.createElement('li');
        // Buat elemen <a> sebagai link ke file teks
        const link = document.createElement('a');
        // Isi teks link dengan judul dari item
        link.textContent = item.judul;

        // Sanitasi nama file agar aman dipakai di path
        const safeName = sanitizeFileName(item.judul);
        if (safeName) {
            // Set href link ke view.html dengan parameter file
            // encodeURIComponent memastikan nama file aman di URL
            link.href = `view.html?file=${encodeURIComponent("data/" + safeName + ".txt")}`;
            // target="_self" artinya link dibuka di tab yang sama
            link.target = "_self";

            // Masukkan link ke dalam <li>
            li.appendChild(link);

            // Tambahkan kelas CSS 'fade-in' untuk animasi
            li.classList.add('fade-in');
            // Atur delay animasi berdasarkan index (0.1s per item)
            li.style.animationDelay = `${index * 0.1}s`;

            // Tambahkan <li> ke dalam <ul>
            ul.appendChild(li);
        }
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

// Tambahkan event listener ke elemen input dengan id 'search'
// Event 'input' akan dipicu setiap kali pengguna mengetik atau mengubah isi kotak pencarian
document.getElementById('search').addEventListener('input', function () {
    // Ambil elemen dengan id 'search' (biasanya input text) 
    // lalu tambahkan event listener untuk event 'input' (setiap kali user mengetik)

    const input = sanitizeInput(this.value.toLowerCase());
    // Ambil nilai dari input, ubah ke huruf kecil (lowercase),
    // lalu bersihkan dengan fungsi sanitizeInput (misalnya untuk menghindari karakter berbahaya)

    const parts = input.split('-').map(p => p.trim()).filter(p => p !== '');
    // Pisahkan input berdasarkan tanda '-' menjadi array
    // Hilangkan spasi di setiap bagian dengan trim()
    // Buang elemen kosong agar tidak mengganggu logika pencarian

    let hasil = judulList;
    // Variabel hasil berisi daftar judul (judulList) sebagai default

    if (parts.length === 0) {
        // Jika input kosong → tampilkan semua data
        hasil = judulList;
    } else if (parts.length === 1) {
        // Jika hanya ada satu kata → gunakan sebagai keyword
        // Cari di kategori ATAU judul
        const keyword = parts[0];
        hasil = judulList.filter(item =>
            item.judul.toLowerCase().includes(keyword) ||   // cocokkan dengan judul
            item.kategori.toLowerCase().includes(keyword)   // atau cocokkan dengan kategori
        );
    } else if (parts.length >= 2) {
        // Jika ada dua kata atau lebih → gunakan pola:
        // parts[0] dianggap sebagai kategori, parts[1] sebagai judul
        const kategoriKeyword = parts[0];
        const judulKeyword = parts[1];
        hasil = judulList.filter(item =>
            item.kategori.toLowerCase().includes(kategoriKeyword) && // kategori harus cocok
            item.judul.toLowerCase().includes(judulKeyword)          // judul juga harus cocok
        );
    }

    tampilkanJudul(hasil);
    // Panggil fungsi tampilkanJudul untuk menampilkan hasil pencarian ke layar
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

