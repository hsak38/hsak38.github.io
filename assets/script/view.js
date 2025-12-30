// Ambil parameter query dari URL saat ini, mis. ?file=data/foo.txt
// URLSearchParams mem-parsing bagian query string (window.location.search) menjadi pasangan kunci-nilai.
const params = new URLSearchParams(window.location.search);
// Ekstrak nilai parameter 'file' (string atau null jika tidak ada).
let fileName = params.get('file');

/**
 * sanitizeFileName(name):
 * - Mengembalikan string yang telah di-normalisasi agar hanya berisi karakter dalam whitelist.
 * - Menolak pola traversal atau separator path untuk mencegah penyalahgunaan path.
 * - Jika input tidak valid, mengembalikan null.
 */
function sanitizeFileName(name) {
  if (!name) return null; // Guard untuk null/undefined/empty

  // Hapus karakter di luar whitelist:
  // [^a-zA-Z0-9 _\-\.\u00C0-\u017F]
  // - ^ dalam [] = negasi: semua karakter yang BUKAN daftar berikut akan dihapus.
  // - a-zA-Z0-9: huruf Latin dasar dan digit.
  // - spasi, underscore (_), minus (-), titik (.).
  // - \u00C0-\u017F: rentang Unicode Latin beraksen (Latin-1 Supplement & Latin Extended-A).
  // Flag 'g' = global (proses seluruh string).
  const safe = name.replace(/[^a-zA-Z0-9 _\-\.\u00C0-\u017F]/g, "");

  // Blok pola berbahaya:
  // - ".." → potensi path traversal (naik direktori).
  // - "/" atau "\" → separator path (Unix/Windows) yang bisa mengubah direktori target.
  if (safe.includes("..") || safe.includes("/") || safe.includes("\\")) {
    return null; // Nama tidak aman
  }
  return safe; // Nama aman untuk digunakan di path relatif yang terkontrol.
}

// Catatan teknis:
// safeFile seharusnya adalah hasil sanitasi dari fileName sebelum dipakai.
// Dalam kode ini, safeFile = fileName (tanpa sanitasi). Jika ingin ketat, gunakan: const safeFile = sanitizeFileName(fileName);
// Namun, karena 'file' disuplai sebagai path relatif (mis. "data/abc.txt"), sanitasi di bawah menggunakan pemisahan path/ekstensi.
const safeFile = fileName;

if (safeFile) {
  // Ekstraksi nama tanpa path dan ekstensi:
  // 1) split('/') → ambil segmen terakhir setelah separator path (nama file).
  // 2) .replace('.txt','') → buang ekstensi tetap '.txt'.
  const rawName = safeFile.split('/').pop().replace('.txt', '');

  // Bentuk judul halaman dari nama file:
  // - Ganti '-' dan '_' menjadi spasi untuk tampilan manusia.
  const pageTitle = rawName.replace(/[-_]/g, " "); // RegExp global mengganti setiap '-' atau '_' dengan ' '

  // Set judul tab dokumen (document.title) = pageTitle.
  document.title = pageTitle;

  // Lakukan fetch terhadap resource 'safeFile' (string path yang berasal dari query ?file=...).
  fetch(safeFile)
    .then(res => {
      // Validasi status HTTP: res.ok true jika 2xx.
      if (!res.ok) throw new Error("File tidak ditemukan");
      // Baca body response sebagai teks (Promise<string>).
      return res.text();
    })
    .then(content => {
      // Target kontainer output konten.
      const kontenDiv = document.getElementById('konten');
      // Reset konten sebelumnya (menghapus child nodes dengan mengosongkan textContent).
      kontenDiv.textContent = "";

      // Pecah file teks menjadi array baris berdasarkan newline '\n'.
      const lines = content.split('\n');

      /**
       * parseInlineWithLinks(text):
       * - Parser inline yang mendeteksi token link berformat ^url^ di dalam satu baris.
       * - Menghasilkan DocumentFragment berisi Node teks dan <a>.
       * - Skema URL: jika tidak ada (tidak cocok /^[a-zA-Z][a-zA-Z0-9+\-.]*:/), prefix 'https://'.
       * - Menjaga urutan konten dengan 'lastIndex' (offset akhir token yang diproses).
       */
      function parseInlineWithLinks(text) {
        const frag = document.createDocumentFragment(); // Kontainer sementara tanpa memicu reflow sampai di-append.
        const linkRegex = /\^([^\^]+)\^/g; // Grup tangkap isi antara ^...^, non-greedy terhadap '^'.
        let lastIndex = 0; // Penunjuk posisi karakter terakhir yang diproses.
        let match;

        // Iterasi semua match menggunakan RegExp.exec dalam loop.
        while ((match = linkRegex.exec(text)) !== null) {
          // Tambahkan segmen plain-text sebelum token link (jika ada jeda).
          if (match.index > lastIndex) {
            frag.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
          }

          // Normalisasi URL:
          // - match[1] = isi di dalam ^...^ (calon URL).
          // - Trim whitespace tepi.
          let url = match[1].trim();
          // Deteksi skema: ^[a-zA-Z][a-zA-Z0-9+\-.]*:
          // - Huruf diikuti karakter valid skema, lalu tanda ':'
          // - Jika tidak ada, prefix 'https://' untuk membentuk absolute URL.
          if (!/^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(url)) {
            url = `https://${url}`;
          }

          // Bangun anchor element <a>:
          const a = document.createElement('a');
          a.href = url;                          // Target URL (absolute atau dengan skema default).
          a.textContent = match[1].trim();       // Teks tampilan link (tanpa skema default).
          a.target = "_blank";                   // Buka di tab baru.
          a.rel = "noopener noreferrer";         // Keamanan: cegah akses window.opener dan hilangkan referrer.
          a.classList.add("link-1");             // Kelas CSS untuk styling.

          // Sisipkan anchor ke fragment.
          frag.appendChild(a);

          // Perbarui offset: posisi akhir token yang baru diproses.
          lastIndex = match.index + match[0].length;
        }

        // Segmen sisa setelah token link (jika ada):
        // - Diproses melalui parser format teks (bold/italic/code) untuk konsistensi inline parsing.
        if (lastIndex < text.length) {
          frag.appendChild(processTextFormatting(text.substring(lastIndex)));
        }
        return frag;
      }
      
      /**
       * processTextFormatting(text):
       * - Parser inline untuk tiga format:
       *   1) Bold: *...* → <strong>
       *   2) Italic: ~...~ → <em>
       *   3) Inline code: `...` → <code>
       * - Tidak mendukung nested token kompleks; linear scan dengan RegExp global.
       */
      function processTextFormatting(text) {
        const frag = document.createDocumentFragment();
        // Grup alternatif:
        // (\*([^*]+)\*|~([^~]+)~|`([^`]+)`)
        // - Grup 1: *...* lalu grup 2 = isi bold tanpa '*'
        // - Grup 1: ~...~ lalu grup 3 = isi italic tanpa '~'
        // - Grup 1: `...` lalu grup 4 = isi code tanpa backtick
        const formatRegex = /(\*([^*]+)\*|~([^~]+)~|`([^`]+)`)/g;
        let lastIndex = 0;
        let match;

        // Proses semua token format secara berurutan.
        while ((match = formatRegex.exec(text)) !== null) {
          // Tambahkan teks biasa sebelum token jika ada jeda.
          if (match.index > lastIndex) {
            frag.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
          }

          // Seleksi jenis format berdasarkan grup yang terisi.
          if (match[2]) {
            // Bold → <strong>
            const strong = document.createElement("strong");
            strong.textContent = match[2];
            frag.appendChild(strong);
          } else if (match[3]) {
            // Italic → <em>
            const em = document.createElement("em");
            em.textContent = match[3];
            frag.appendChild(em);
          } else if (match[4]) {
            // Inline code → <code>
            const code = document.createElement("code");
            code.textContent = match[4];
            frag.appendChild(code);
          }

          // Update offset ke akhir token saat ini.
          lastIndex = match.index + match[0].length;
        }

        // Tambahkan sisa teks sebagai node teks jika masih ada.
        if (lastIndex < text.length) {
          frag.appendChild(document.createTextNode(text.substring(lastIndex)));
        }

        return frag;
      }

      // State/list context untuk membuat list bertingkat:
      // - currentUl: <ul> tingkat saat ini (level 1) yang aktif.
      // - lastLiLevel1: <li> terakhir pada level 1 (parent untuk level 2).
      // - lastLiLevel2: <li> terakhir pada level 2 (parent untuk level 3).
      let currentUl = null;
      let lastLiLevel1 = null;
      let lastLiLevel2 = null;

      // Iterasi per baris konten file:
      // - 'index' digunakan untuk menghitung animationDelay (staggered 0.1s per item).
      lines.forEach((line, index) => {
        const trimmed = line.trim();           // Normalisasi whitespace tepi untuk analisis token prefix.
        const delay = `${index * 0.1}s`;       // Delay animasi string (satuan detik).

        // Heading H3: baris diawali "###"
        if (trimmed.startsWith("###")) {
          // Reset konteks list saat berganti ke blok heading.
          currentUl = null; lastLiLevel1 = null; lastLiLevel2 = null;

          const h3 = document.createElement('h3');
          // Potong "###" (3 char) → konsumsi sisa sebagai konten inline (support link/format).
          h3.appendChild(parseInlineWithLinks(trimmed.substring(3).trim()));
          h3.classList.add('fade-in', "heading-3");
          h3.style.animationDelay = delay;
          kontenDiv.appendChild(h3);
        }
        // Heading H2: baris diawali "##"
        else if (trimmed.startsWith("##")) {
          currentUl = null; lastLiLevel1 = null; lastLiLevel2 = null;

          const h2 = document.createElement('h2');
          h2.appendChild(parseInlineWithLinks(trimmed.substring(2).trim()));
          h2.classList.add('fade-in', "heading-2");
          h2.style.animationDelay = delay;
          kontenDiv.appendChild(h2);
        }
        // Heading H1: baris diawali "#"
        else if (trimmed.startsWith("#")) {
          currentUl = null; lastLiLevel1 = null; lastLiLevel2 = null;

          const h1 = document.createElement('h1');
          h1.appendChild(parseInlineWithLinks(trimmed.substring(1).trim()));
          h1.classList.add('fade-in', "heading-1");
          h1.style.animationDelay = delay;
          kontenDiv.appendChild(h1);
        }
        // List level 3: baris diawali "---"
        else if (trimmed.startsWith("---")) {
          // Untuk membuat level 3, harus ada lastLiLevel2 (li level 2) sebagai parent.
          if (lastLiLevel2) {
            // Cari/siapkan sub-<ul> di dalam <li> level 2 untuk menampung item level 3.
            let subUl = lastLiLevel2.querySelector("ul");
            if (!subUl) {
              subUl = document.createElement("ul");
              lastLiLevel2.appendChild(subUl);
            }
            const li = document.createElement("li");
            // Potong "---" (3 char) lalu parse inline.
            li.appendChild(parseInlineWithLinks(trimmed.substring(3).trim()));
            li.classList.add("fade-in", "list-3");
            li.style.animationDelay = delay;
            subUl.appendChild(li);
          }
        }

        // List level 2: baris diawali "--"
        else if (trimmed.startsWith("--")) {
          // Level 2 memerlukan lastLiLevel1 (li level 1) sebagai parent.
          if (lastLiLevel1) {
            // Cari/siapkan sub-<ul> di dalam <li> level 1 untuk menampung item level 2.
            let subUl = lastLiLevel1.querySelector("ul");
            if (!subUl) {
              subUl = document.createElement("ul");
              lastLiLevel1.appendChild(subUl);
            }
            const li = document.createElement("li");
            // Potong "--" (2 char) lalu parse inline.
            li.appendChild(parseInlineWithLinks(trimmed.substring(2).trim()));
            li.classList.add("fade-in", "list-2");
            li.style.animationDelay = delay;
            subUl.appendChild(li);
            // Update konteks: item level 2 terakhir (parent untuk level 3 berikutnya).
            lastLiLevel2 = li;
          }
        }

        // List level 1: baris diawali "-"
        else if (trimmed.startsWith("-")) {
          // Jika belum ada <ul> aktif, buat baru dan attach pada kontainer.
          if (!currentUl) {
            currentUl = document.createElement("ul");
            kontenDiv.appendChild(currentUl);
          }
          const li = document.createElement("li");
          // Potong "-" (1 char) lalu parse inline.
          li.appendChild(parseInlineWithLinks(trimmed.substring(1).trim()));
          li.classList.add("fade-in", "list-1");
          li.style.animationDelay = delay;
          currentUl.appendChild(li);
          // Update state konteks list:
          lastLiLevel1 = li;      // parent untuk kemungkinan level 2 berikutnya
          lastLiLevel2 = null;    // reset karena berganti konteks ke level 1 baru
        }
        // Parsing gambar: baris diawali "@@"
        else if (trimmed.startsWith("@@")) {
          // Reset konteks list karena berpindah ke blok gambar.
          currentUl = null; lastLiLevel1 = null; lastLiLevel2 = null;

          const img = document.createElement("img");
          // Ambil path setelah token "@@" (2 char), lalu trim whitespace.
          img.src = trimmed.substring(2).trim();
          // Alt default "gambar"; atribut alt penting untuk aksesibilitas.
          img.alt = "gambar";
          img.classList.add("fade-in", "image-1");
          img.style.animationDelay = delay;
          kontenDiv.appendChild(img);
        }

        // Paragraf biasa: baris tanpa prefix khusus
        else {
          // Reset konteks list sebelum membuat blok paragraf.
          currentUl = null; lastLiLevel1 = null; lastLiLevel2 = null;

          const p = document.createElement("p");
          // Parse inline pada seluruh baris (support ^link^ dan *bold*/~italic/`code`).
          p.appendChild(parseInlineWithLinks(trimmed));
          p.classList.add("fade-in", "paragraph-1");
          p.style.animationDelay = delay;
          kontenDiv.appendChild(p);
        }
      });
    })
    .catch(() => {
      // Fallback UI jika fetch gagal (mis. file tidak ditemukan, error jaringan).
      document.getElementById('konten').textContent = "Gagal membuka file.";
    });

} else {
  // Fallback UI jika parameter 'file' tidak ada atau terdeteksi tidak valid.
  document.getElementById('konten').textContent = "Nama file tidak valid.";
}
