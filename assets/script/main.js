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
                    kategori: (parts[1] || "").trim(),
                    thumbnail: (parts[2] || "").trim(),
                    preview: (parts[3] || "").trim()
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
  const ul = document.getElementById('arsip-list');
  const jumlah = document.getElementById('jumlah-judul');
  ul.innerHTML = "";
  jumlah.textContent = list.length;

  list.forEach((item, index) => {
    const li = document.createElement('li');

    // Thumbnail
    if (item.thumbnail) {
      const img = document.createElement('img');
      img.src = item.thumbnail;
      img.alt = item.judul;
      img.classList.add('thumbnail');
      li.appendChild(img);
    }

    // Judul sebagai link
    const safeName = sanitizeFileName(item.judul);
    if (safeName) {
      const titleLink = document.createElement('a');
      titleLink.textContent = `${item.judul} - ${item.kategori}`;
      titleLink.href = `view.html?file=${encodeURIComponent("data/" + safeName + ".txt")}`;
      titleLink.target = "_self";

      const title = document.createElement('h3');
      title.appendChild(titleLink);
      li.appendChild(title);
    }

    // Preview isi
    if (item.preview) {
      const preview = document.createElement('p');
      preview.textContent = item.preview;
      li.appendChild(preview);
    }

    li.classList.add('fade-in');
    li.style.animationDelay = `${index * 0.1}s`;
    ul.appendChild(li);
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


const toggleBtn = document.getElementById('toggle-search');
const searchContainer = document.querySelector('.search-container');
const searchInput = document.getElementById('search');
const iconToggle = document.getElementById('icon-toggle');

toggleBtn.addEventListener('click', () => {
  searchContainer.classList.toggle('active');

  if (searchContainer.classList.contains('active')) {
    // ganti ke ikon close
    iconToggle.src = "/assets/icon/close.svg";
    iconToggle.alt = "Close Icon";
    searchInput.focus();
  } else {
    // ganti ke ikon search
    iconToggle.src = "/assets/icon/search.svg";
    iconToggle.alt = "Search Icon";
  }
});

// Tutup otomatis saat ukuran layar berubah
const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;

window.addEventListener('resize', () => {
  if (!isTouchDevice) { // hanya perangkat non-touch (desktop)
    if (searchContainer.classList.contains('active')) {
      searchContainer.classList.remove('active');
      iconToggle.src = "/assets/icon/search.svg";
      iconToggle.alt = "Search Icon";
    }
  }
});





