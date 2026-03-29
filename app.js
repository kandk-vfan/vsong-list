let data = [];

fetch("data.json")
  .then(res => res.json())
  .then(json => {
    data = json;
    renderAll();
  });

function renderAll() {
  renderSongs();
  renderStreams();
  renderArtists();
}

//
// 曲一覧
//
function renderSongs(list = data) {
  const map = {};

  list.forEach(d => {
    const key = d.songId;

    if (!map[key]) {
      map[key] = {
        title: d.title,
        artist: d.artist,
        count: 0,
        latest: d,
      };
    }

    map[key].count++;

    if (new Date(d.date) > new Date(map[key].latest.date)) {
      map[key].latest = d;
    }
  });

  let arr = Object.values(map);

  const sortType = document.getElementById("sort").value;

  arr.sort((a, b) => {
    switch (sortType) {
      case "title_desc": return b.title.localeCompare(a.title);
      case "artist_asc": return a.artist.localeCompare(b.artist);
      case "artist_desc": return b.artist.localeCompare(a.artist);
      case "count_desc": return b.count - a.count;
      case "count_asc": return a.count - b.count;
      default: return a.title.localeCompare(b.title);
    }
  });

  const tbody = document.getElementById("songsBody");
  tbody.innerHTML = "";

  arr.forEach(s => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${s.title}</td>
      <td>${s.artist}</td>
      <td>${s.count}</td>
      <td><button onclick="play('${s.latest.videoId}','${s.latest.time}')">▶</button></td>
    `;

    tbody.appendChild(tr);
  });
}

//
// 配信一覧
//
function renderStreams() {
  const map = {};

  data.forEach(d => {
    if (!map[d.videoId]) {
      map[d.videoId] = {
        title: d.videoTitle,
        songs: [],
      };
    }
    map[d.videoId].songs.push(d.title);
  });

  const tbody = document.getElementById("streamsBody");
  tbody.innerHTML = "";

  Object.entries(map).forEach(([videoId, s]) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td><a href="https://youtube.com/watch?v=${videoId}" target="_blank">${s.title}</a></td>
      <td>${[...new Set(s.songs)].join(", ")}</td>
    `;

    tbody.appendChild(tr);
  });
}

//
// アーティスト
//
function renderArtists() {
  const map = {};

  data.forEach(d => {
    if (!map[d.artist]) map[d.artist] = {};

    if (!map[d.artist][d.songId]) {
      map[d.artist][d.songId] = {
        title: d.title,
        count: 0,
      };
    }

    map[d.artist][d.songId].count++;
  });

  const tbody = document.getElementById("artistsBody");
  tbody.innerHTML = "";

  Object.entries(map).forEach(([artist, songs]) => {
    Object.values(songs).forEach(s => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${artist}</td>
        <td>${s.title}</td>
        <td>${s.count}</td>
      `;

      tbody.appendChild(tr);
    });
  });
}

//
// タブ切り替え
//
function showTab(id) {
  ["songs", "streams", "artists"].forEach(t => {
    document.getElementById(t).classList.add("hidden");
  });

  document.getElementById(id).classList.remove("hidden");
}

//
// 再生
//
function play(videoId, time) {
  const sec = toSeconds(time);
  const url = `https://www.youtube.com/embed/${videoId}?start=${sec}`;

  document.getElementById("player").innerHTML =
    `<iframe src="${url}" allowfullscreen></iframe>`;

  document.getElementById("modal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
  document.getElementById("player").innerHTML = "";
}

function toSeconds(t) {
  return t.split(":").map(Number).reduce((a, b) => a * 60 + b);
}

//
// 検索
//
document.getElementById("search").addEventListener("input", e => {
  const val = e.target.value.toLowerCase();

  const filtered = data.filter(d =>
    d.title.toLowerCase().includes(val) ||
    d.artist.toLowerCase().includes(val)
  );

  renderSongs(filtered);
});

//
// ソート変更
//
document.getElementById("sort").addEventListener("change", () => {
  renderSongs();
});

//
// ダークモード
//
function toggleDark() {
  document.body.classList.toggle("dark");

  localStorage.setItem(
    "darkMode",
    document.body.classList.contains("dark")
  );
}

if (localStorage.getItem("darkMode") === "true") {
  document.body.classList.add("dark");
}