let data = [];

const STORAGE_KEY = "tableTheme";

function normalize(str){
  return str.replace(/^[\s　]+|[\s　]+$/g, "");
}

function debounce(fn, delay=200){
  let timer;
  return (...args)=>{
    clearTimeout(timer);
    timer = setTimeout(()=>fn(...args), delay);
  };
}

function getTheme(){
  const saved = localStorage.getItem(STORAGE_KEY);
  if(saved) return saved;

  if(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches){
    return "dark";
  }
  return "light";
}

function applyTheme(){
  const theme = getTheme();
  const isLight = theme === "light";

  document.getElementById("songsTable").classList.toggle("light", isLight);
  document.getElementById("artistsTable").classList.toggle("light", isLight);
  document.body.classList.toggle("streams-light", isLight);
}

function toggleTheme(){
  const next = getTheme() === "dark" ? "light" : "dark";
  localStorage.setItem(STORAGE_KEY, next);
  applyTheme();
  updateButtons();
}

function updateButtons(){
  const isLight = getTheme() === "light";
  document.getElementById("themeToggleSongs").checked = isLight;
  document.getElementById("themeToggleStreams").checked = isLight;
  document.getElementById("themeToggleArtists").checked = isLight;
}

fetch("data.json")
  .then(r=>r.json())
  .then(j=>{
    data = j.map(d => ({
      ...d,
      title: normalize(d.title),
      artist: normalize(d.artist)
    }));
    renderAll();
    applyTheme();
    updateButtons();
  });

function key(d){
  return d.title + "||" + d.artist;
}

function renderAll(){
  renderSummary();
  renderSongs();
  renderStreams();
  renderArtists();
}

function renderSummary(){
  const songSet=new Set();
  const artistSet=new Set();

  data.forEach(d=>{
    songSet.add(key(d));
    artistSet.add(d.artist);
  });

  const text=`曲数：${songSet.size} / アーティスト数：${artistSet.size}`;

  document.getElementById("songsSummary").innerText=text;
  document.getElementById("streamsSummary").innerText=text;
  document.getElementById("artistsSummary").innerText=text;
}

function renderArtists(){
  const map={};

  data.forEach(d=>{
    if(!map[d.artist]) map[d.artist]=new Set();
    map[d.artist].add(d.title);
  });

  let arr = Object.entries(map).map(([artist, set]) => ({
    artist,
    songs: Array.from(set),
    count: set.size
  }));

  const keyword=document.getElementById("searchArtists").value.toLowerCase();

  if(keyword){
    arr = arr.filter(a =>
      a.artist.toLowerCase().includes(keyword) ||
      a.songs.some(t => t.toLowerCase().includes(keyword))
    );
  }

  if(arr.length===0){
    document.getElementById("artistsBody").innerHTML=`<tr><td colspan="2">該当する結果がありません</td></tr>`;
    return;
  }

  const type=document.getElementById("sortArtistsType").value;
  const order=document.getElementById("sortArtistsOrder").value;

  arr.sort((a,b)=>{
    let res=0;
    if(type==="count") res=a.count-b.count;
    else res=a.artist.localeCompare(b.artist);
    return order==="desc"?-res:res;
  });

  const tbody=document.getElementById("artistsBody");
  tbody.innerHTML="";

  arr.forEach(a=>{
    tbody.innerHTML+=`
<tr class="artist-header">
<td colspan="2">${a.artist}（${a.count}曲）</td>
</tr>
`;

    a.songs.sort().forEach(t=>{
      tbody.innerHTML+=`
<tr class="artist-song-row">
<td></td>
<td>${t}</td>
</tr>
`;
    });
  });
}

document.getElementById("searchArtists").addEventListener("input", debounce(renderArtists));
document.getElementById("sortArtistsOrder").addEventListener("change", renderArtists);
document.getElementById("sortArtistsType").addEventListener("change", renderArtists);