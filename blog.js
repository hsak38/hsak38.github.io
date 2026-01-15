let blogs = [];          // semua data dari main.txt
let filteredBlogs = [];  // data aktif (semua atau hasil pencarian)
let currentPage = 1;
const itemsPerPage = 9;  // jumlah artikel per halaman

// =======================
// Halaman MAIN (index.html)
// =======================

async function loadBlogs() {
  try {
    const response = await fetch("main.txt"); // load sekali
    const text = await response.text();
    const lines = text.trim().split("\n");

    blogs = lines.map(line => {
      const [thumb, title, preview, date, file, category] = line.split("|");
      return { thumb, title, preview, date, file, category };
    });

    filteredBlogs = blogs; // default tampil semua
    renderBlogs();
    setupSearch();
  } catch (err) {
    console.error("Gagal load main.txt:", err);
    const container = document.getElementById("blog-list");
    if (container) container.innerHTML = "<p>Gagal memuat daftar blog.</p>";
  }
}

function renderBlogs() {
  const container = document.getElementById("blog-list");
  if (!container) return;

  container.innerHTML = "";

  const totalPages = Math.ceil(filteredBlogs.length / itemsPerPage);
  if (currentPage > totalPages) currentPage = 1;

  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const paginatedBlogs = filteredBlogs.slice(start, end);

  if (paginatedBlogs.length === 0) {
    container.innerHTML = "<p>Tidak ada artikel ditemukan.</p>";
    document.getElementById("pagination").innerHTML = "";
    return;
  }

  paginatedBlogs.forEach(blog => {
    const card = document.createElement("div");
    card.className = "blog-card";

    card.innerHTML = `
        <img src="${blog.thumb}" alt="${blog.title}" style="width:100%;height:auto;object-fit:cover;">
        <div>
            <h2><a href="view.html?file=${blog.file}">${blog.title}</a></h2>
            <p>${blog.preview}</p>
            <small>${blog.date} | Kategori: ${blog.category}</small>
        </div>
    `;

    container.appendChild(card);
  });

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const paginationContainer = document.getElementById("pagination");
  if (!paginationContainer) return;

  paginationContainer.innerHTML = "";

  const maxVisible = 2; // jumlah halaman sebelum & sesudah
  let startPage = Math.max(1, currentPage - maxVisible);
  let endPage = Math.min(totalPages, currentPage + maxVisible);

  if (startPage > 1) {
    const firstBtn = document.createElement("button");
    firstBtn.innerText = "« First";
    firstBtn.addEventListener("click", () => {
      currentPage = 1;
      renderBlogs();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    paginationContainer.appendChild(firstBtn);
  }

  for (let i = startPage; i <= endPage; i++) {
    const btn = document.createElement("button");
    btn.innerText = i;
    btn.style.margin = "0 5px";
    btn.disabled = (i === currentPage);

    btn.addEventListener("click", () => {
      currentPage = i;
      renderBlogs();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    paginationContainer.appendChild(btn);
  }

  if (endPage < totalPages) {
    const lastBtn = document.createElement("button");
    lastBtn.innerText = "Last »";
    lastBtn.addEventListener("click", () => {
      currentPage = totalPages;
      renderBlogs();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    paginationContainer.appendChild(lastBtn);
  }
}

// Pencarian realtime dengan pagination
function setupSearch() {
  const searchBox = document.getElementById("search-box");
  if (!searchBox) return;

  searchBox.addEventListener("input", function (e) {
    const keyword = e.target.value.toLowerCase().trim();

    if (keyword === "") {
      filteredBlogs = blogs; // tampilkan semua
    } else {
      filteredBlogs = blogs.filter(blog =>
        blog.title.toLowerCase().includes(keyword) ||
        blog.preview.toLowerCase().includes(keyword) ||
        blog.date.toLowerCase().includes(keyword) ||
        blog.category.toLowerCase().includes(keyword)
      );
    }

    currentPage = 1; // reset ke halaman pertama
    renderBlogs();
  });
}

// =======================
// Halaman VIEW (view.html)
// =======================
async function loadBlog() {
  const params = new URLSearchParams(window.location.search);
  const file = params.get("file");

  const titleEl = document.getElementById("title");
  const contentEl = document.getElementById("content");

  if (!file) {
    if (contentEl) contentEl.innerText = "artikel tidak ditemukan";
    return;
  }

  try {
    const response = await fetch("data/" + file);
    if (!response.ok) {
      contentEl.innerText = "artikel tidak ditemukan";
      return;
    }
    const text = await response.text();

    // Ambil baris pertama sebagai judul
    const lines = text.split("\n");
    let rawTitle = "Tanpa Judul";
    if (lines.length > 0) {
      const match = lines[0].match(/#(.+?)#/);
      if (match) {
        rawTitle = match[1].trim();
      }
    }

    // Set judul dengan efek
    document.title = rawTitle;
    titleEl.innerText = rawTitle;
    titleEl.classList.add("view-title");

    // Render isi (tanpa baris judul pertama)
    const contentWithoutTitle = lines.slice(1).join("\n");
    contentEl.innerHTML = parseCustomMarkup(contentWithoutTitle);
  } catch (error) {
    contentEl.innerText = "artikel tidak ditemukan";
  }
}

function parseCustomMarkup(text) {
  let html = text;

  // Blok kode multi-baris (triple backtick)
  html = html.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");

  // Heading
  html = html.replace(/###(.+?)###/g, "<h3>$1</h3>");
  html = html.replace(/##(.+?)##/g, "<h2>$1</h2>");
  html = html.replace(/#(.+?)#/g, "<h1>$1</h1>");

  // Bold
  html = html.replace(/\*(.+?)\*/g, "<strong>$1</strong>");

  // Code inline
  html = html.replace(/\*\*(.+?)\*\*/g, "<code>$1</code>");

  // Italic
  html = html.replace(/~(.+?)~/g, "<em>$1</em>");

  // List
  html = html.replace(/---(.+?)---/g, "<ul style='margin-left:40px'><li>$1</li></ul>");
  html = html.replace(/--(.+?)--/g, "<ul style='margin-left:20px'><li>$1</li></ul>");
  html = html.replace(/-(.+?)-/g, "<ul><li>$1</li></ul>");

  // Image
  html = html.replace(/\$(.+?)\$/g, "<img src='$1' alt='' style='max-width:100%;height:auto;'>");

  // Link
  html = html.replace(/@(.+?)=(https?:\/\/.+?)@/g, "<a href='$2' target='_blank'>$1</a>");

  // Ganti newline jadi <br> (kecuali dalam blok kode)
  html = html.replace(/\n/g, "<br>");

  return html;
}

// =======================
// Deteksi halaman
// =======================

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("blog-list")) {
    loadBlogs(); // Halaman main
  } else if (document.getElementById("content")) {
    loadBlog(); // Halaman view
  }
});
