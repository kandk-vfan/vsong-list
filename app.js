let data = [];

fetch("data.json")
  .then(r => r.json())
  .then(j => {
    data = j;
    renderAll();
  });

function key(d){
  return d.title + "||" + d.artist;
}

function renderAll(){
  renderSongs();
  renderStreams();
  renderArtists();
}

function renderSongs(){
  const map = {};

  data.forEach(d=>{
    const k = key(d);
    if(!map[k]){
      map[k]={title:d.title,artist:d.artist,count:0,latest:d};
    }
    map[k].count++;
    if(new Date(d.date)>new Date(map[k].latest.date)){
      map[k].latest=d;
    }
  });

  let arr = Object.values(map);

  const keyword = document.getElementById("searchSongs").value.toLowerCase();
  if(keyword){
    arr = arr.filter(s =>
      s.title.toLowerCase().includes(keyword) ||
      s.artist.toLowerCase().includes(keyword)
    );
  }

  const type = document.getElementById("sortSongsType").value;
  const order = document.getElementById("sortSongsOrder").value;

  arr.sort((a,b)=>{
    let res = 0;
    if(type === "artist") res = a.artist.localeCompare(b.artist);
    else if(type === "count") res = a.count - b.count;
    else res = a.title.localeCompare(b.title);
    return order === "desc" ? -res : res;
  });

  const tbody = document.getElementById("songsBody");
  tbody.innerHTML = "";

  arr.forEach(s=>{
    tbody.innerHTML += `
<tr>
<td>${s.title}</td>
<td>${s.artist}</td>
<td>${s.count}</td>
<td><button onclick="play('${s.latest.videoId}','${s.latest.time}')">▶</button></td>
</tr>`;
  });
}

function renderStreams(){
  const map = {};

  data.forEach(d=>{
    if(!map[d.videoId]){
      map[d.videoId] = {
        title: d.videoTitle,
        date: d.date,
        songs: []
      };
    }
    map[d.videoId].songs.push(d);
  });

  let arr = Object.entries(map);

  arr.sort((a,b)=>{
    const aDate = Math.max(...a[1].songs.map(s => new Date(s.date).getTime()));
    const bDate = Math.max(...b[1].songs.map(s => new Date(s.date).getTime()));
    return bDate - aDate;
  });

  const keyword = document.getElementById("searchStreams").value.toLowerCase();
  const container = document.getElementById("streamsContainer");
  container.innerHTML = "";

  arr.forEach(([vid, v])=>{
    const match = v.songs.some(s =>
      !keyword ||
      s.title.toLowerCase().includes(keyword) ||
      s.artist.toLowerCase().includes(keyword)
    );
    if(!match) return;

    const unique = [];
    const seen = new Set();

    v.songs.forEach(s=>{
      const k = `${s.time}||${s.title}||${s.artist}`;
      if(!seen.has(k)){
        seen.add(k);
        unique.push(s);
      }
    });

    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
<div class="stream-title-row">
<a href="https://youtube.com/watch?v=${vid}" target="_blank">${v.title}</a>
</div>

<div class="stream-date">
${formatDate(v.date)}
</div>

<div class="grid">
${unique.map((s,i)=>`
<div class="song-card">
<div class="song-card-head">
<span class="num">${String(i+1).padStart(2,"0")}</span>
<button onclick="play('${vid}','${s.time}')">▶</button>
</div>
<div class="song-card-title">${s.title}</div>
<div class="song-card-artist">${s.artist}</div>
</div>
`).join("")}
</div>
`;

    container.appendChild(card);
  });
}

function renderArtists(){
  const map = {};

  data.forEach(d=>{
    if(!map[d.artist]) map[d.artist] = new Set();
    map[d.artist].add(d.title);
  });

  let artists = Object.keys(map);

  const keyword = document.getElementById("searchArtists").value.toLowerCase();

  if(keyword){
    artists = artists.filter(a =>
      a.toLowerCase().includes(keyword) ||
      Array.from(map[a]).some(t => t.toLowerCase().includes(keyword))
    );
  }

  const order = document.getElementById("sortArtistsOrder").value;

  artists.sort((a,b)=>{
    let res = a.localeCompare(b);
    return order === "desc" ? -res : res;
  });

  const tbody = document.getElementById("artistsBody");
  tbody.innerHTML = "";

  artists.forEach(a=>{
    tbody.innerHTML += `
<tr class="artist-header">
<td colspan="2">${a}</td>
</tr>
`;

    Array.from(map[a]).sort().forEach(t=>{
      tbody.innerHTML += `
<tr class="artist-song-row">
<td></td>
<td>${t}</td>
</tr>
`;
    });
  });
}

function showTab(id, btn){
  document.querySelectorAll(".section").forEach(el => el.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");

  document.querySelectorAll(".tab-button").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
}

function play(videoId, time){
  const sec = time.split(":").reduce((a,b)=>a*60+Number(b));
  document.getElementById("player").innerHTML =
`<iframe src="https://www.youtube.com/embed/${videoId}?start=${sec}&autoplay=1" allow="autoplay" allowfullscreen></iframe>`;
  document.getElementById("modal").classList.remove("hidden");
}

function closeModal(){
  document.getElementById("player").innerHTML = "";
  document.getElementById("modal").classList.add("hidden");
}

function formatDate(d){
  const date = new Date(d);
  return `${date.getFullYear()}/${String(date.getMonth()+1).padStart(2,"0")}/${String(date.getDate()).padStart(2,"0")}`;
}

document.getElementById("searchSongs").addEventListener("input", renderSongs);
document.getElementById("sortSongsType").addEventListener("change", renderSongs);
document.getElementById("sortSongsOrder").addEventListener("change", renderSongs);

document.getElementById("searchStreams").addEventListener("input", renderStreams);

document.getElementById("searchArtists").addEventListener("input", renderArtists);
document.getElementById("sortArtistsOrder").addEventListener("change", renderArtists);