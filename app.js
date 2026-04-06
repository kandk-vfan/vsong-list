let data = [];
let currentRangeType = null;

const STORAGE_KEY = "tableTheme";
const MONETIZED_DATE = new Date("2026-02-23");

let YOMI_MAP = {};

function getYomi(str){
  if(!str) return "";
  const s = normalize(str);
  return YOMI_MAP[str] || str;
}

function toLocalDateString(dateStr){
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

function getFilteredData(){
  const isMonetizedOnly = document.querySelector(".monetizedToggle")?.checked;

  let result = data;

  if(isMonetizedOnly){
    result = result.filter(d => toLocalDateString(d.date) >= toLocalDateString(MONETIZED_DATE));
  }

  const startEl = document.querySelector(".startDate");
  const endEl = document.querySelector(".endDate");

  const start = startEl?.value;
  const end = endEl?.value;

  if(start){
    result = result.filter(d => toLocalDateString(d.date) >= start);
  }

  if(end){
    result = result.filter(d => toLocalDateString(d.date) <= end);
  }

  return result;
}

function syncDateInputs(start, end){
  document.querySelectorAll(".startDate").forEach(el=>{
    el.value = start;
  });

  document.querySelectorAll(".endDate").forEach(el=>{
    el.value = end;
  });
}

function normalize(str){
  return str.replace(/^[\s　]+|[\s　]+$/g, "");
}

function setDateRange(type){
  if(currentRangeType === type){
    currentRangeType = null;
    syncDateInputs("", "");
    highlightButton(null);
    renderAll();
    return;
  }

  currentRangeType = type;

  const now = new Date();

  let start = "";
  let end = "";

  if(type === "thisMonth"){
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date();
  }

  if(type === "lastMonth"){
    start = new Date(now.getFullYear(), now.getMonth()-1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 0);
  }

  if(type === "thisYear"){
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date();
  }

  if(type === "lastYear"){
    start = new Date(now.getFullYear()-1, 0, 1);
    end = new Date(now.getFullYear()-1, 11, 31);
  }

  if(type === "all"){
    if(data.length === 0){
      start = "";
      end = "";
    }else{
      const dates = data.map(d => new Date(d.date));
      start = new Date(Math.min(...dates));
      end = new Date(Math.max(...dates));
    }
  }

  const s = formatInputDate(start);
  const e = formatInputDate(end);

  syncDateInputs(s, e);
  highlightButton(type);
  renderAll();
}

function formatInputDate(d){
  if(!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function highlightButton(type){
  document.querySelectorAll(".quick-buttons button").forEach(btn=>{
    btn.classList.toggle("active", btn.dataset.type === type);
  });
}

function debounce(fn, delay=300){
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

Promise.all([
  fetch("data.json").then(r=>r.json()),
  fetch("yomi.json")
    .then(r => r.ok ? r.json() : {})
    .catch(() => ({}))
]).then(([dataJson, yomiJson])=>{
  YOMI_MAP = yomiJson || {};

  data = dataJson.map(d => ({
    ...d,
    title: normalize(d.title),
    artist: normalize(d.artist)
  }));

  document.querySelectorAll(".startDate").forEach(el=>el.value="");
  document.querySelectorAll(".endDate").forEach(el=>el.value="");

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
  const src = getFilteredData();

  const songSet=new Set();
  const artistSet=new Set();

  src.forEach(d=>{
    songSet.add(key(d));
    artistSet.add(d.artist);
  });

  const html = `
  <div class="summary-row"><span class="label">曲数 (ユニーク)</span><span class="value">${songSet.size}</span></div>
  <div class="summary-row"><span class="label">歌唱回数</span><span class="value">${src.length}</span></div>
  <div class="summary-row"><span class="label">アーティスト数</span><span class="value">${artistSet.size}</span></div>
  `;

  document.getElementById("songsSummary").innerHTML = html;
  document.getElementById("streamsSummary").innerHTML = html;
  document.getElementById("artistsSummary").innerHTML = html;
}

function renderSongs(){
  const src = getFilteredData();

  const map={};

  src.forEach(d=>{
    const k=key(d);
    if(!map[k]) map[k]={title:d.title,artist:d.artist,count:0,latest:d};
    map[k].count++;
    if(new Date(d.date)>new Date(map[k].latest.date)){
      map[k].latest=d;
    }
  });

  let arr=Object.values(map);

  const keyword=document.getElementById("searchSongs").value.toLowerCase();
  if(keyword){
    arr=arr.filter(s=>s.title.toLowerCase().includes(keyword)||s.artist.toLowerCase().includes(keyword));
  }

  if(arr.length===0){
    document.getElementById("songsBody").innerHTML=`<tr><td colspan="4">該当する結果がありません</td></tr>`;
    return;
  }

  const type=document.getElementById("sortSongsType").value;
  const order=document.getElementById("sortSongsOrder").value;

  arr.sort((a,b)=>{
    let res=0;
    if(type==="artist") res=getYomi(a.artist).localeCompare(getYomi(b.artist),"ja");
    else if(type==="count") res=a.count-b.count;
    else res=getYomi(a.title).localeCompare(getYomi(b.title),"ja");
    return order==="desc"?-res:res;
  });

  const tbody=document.getElementById("songsBody");

  let html="";
  arr.forEach(s=>{
    html+=`
<tr>
<td>${s.title}</td>
<td>${s.artist}</td>
<td>${s.count}</td>
<td><button onclick="play('${s.latest.videoId}','${s.latest.time}')">▶</button></td>
</tr>`;
  });

  tbody.innerHTML=html;
}

function renderArtists(){
  const src = getFilteredData();

  const map={};

  src.forEach(d=>{
    if(!map[d.artist]) map[d.artist]=new Set();
    map[d.artist].add(d.title);
  });

  let artists=Object.keys(map);

  const keyword=document.getElementById("searchArtists").value.toLowerCase();

  if(keyword){
    artists=artists.filter(a=>a.toLowerCase().includes(keyword)||Array.from(map[a]).some(t=>t.toLowerCase().includes(keyword)));
  }

  if(artists.length===0){
    document.getElementById("artistsBody").innerHTML=`<tr><td colspan="2">該当する結果がありません</td></tr>`;
    return;
  }

  const type=document.getElementById("sortArtistsType").value;
  const order=document.getElementById("sortArtistsOrder").value;

  artists.sort((a,b)=>{
    let res=0;

    if(type==="count"){
      res = map[a].size - map[b].size;
    }else{
      res = getYomi(a).localeCompare(getYomi(b),"ja");
    }

    return order==="desc"?-res:res;
  });

  const tbody=document.getElementById("artistsBody");

  let html="";
  artists.forEach(a=>{
    const count = map[a].size;

    html+=`
<tr class="artist-header">
<td colspan="2">${a} (${count}曲)</td>
</tr>`;

    const songs = Array.from(map[a]).sort((a,b)=>
      getYomi(a).localeCompare(getYomi(b),"ja")
    );

    songs.forEach(t=>{
      html+=`
<tr class="artist-song-row">
<td></td>
<td>${t}</td>
</tr>`;
    });
  });

  tbody.innerHTML=html;
}

function renderStreams(){
  const src = getFilteredData();

  const map={};

  src.forEach(d=>{
    if(!map[d.videoId]){
      map[d.videoId]={title:d.videoTitle,latestDate:new Date(d.date),songs:[]};
    }
    map[d.videoId].songs.push(d);
  
    const dDate = new Date(d.date);
    if(dDate > map[d.videoId].latestDate){
      map[d.videoId].latestDate = dDate;
    }
  });

  let arr=Object.entries(map);

  const order=document.getElementById("sortStreamsOrder").value;

  arr.sort((a,b)=>{
    const aDate=a[1].latestDate;
    const bDate=b[1].latestDate;
    return order==="desc"?bDate-aDate:aDate-bDate;
  });

  const keyword=document.getElementById("searchStreams").value.toLowerCase();
  const container=document.getElementById("streamsContainer");
  container.innerHTML="";

  let hitCount=0;

  arr.forEach(([vid,v])=>{
    const unique=[];
    const seen=new Set();

    v.songs.forEach(s=>{
      const k=`${s.time}||${s.title}||${s.artist}`;
      if(!seen.has(k)){
        seen.add(k);
        unique.push(s);
      }
    });

    const filtered = unique;
    
    function isMatch(s){
      if(!keyword) return false;
      return s.title.toLowerCase().includes(keyword) || s.artist.toLowerCase().includes(keyword);
    }
    
    if(keyword && !unique.some(isMatch)) return;

    hitCount++;

    const card=document.createElement("div");
    card.className="card";

    card.innerHTML=`
<div class="stream-title-row">
<a href="https://youtube.com/watch?v=${vid}" target="_blank">${v.title}</a>
</div>
<div class="stream-date">${formatDate(v.latestDate)}</div>
<div class="grid">
${filtered.map((s,i)=>`
<div class="song-card ${isMatch(s) ? "highlight" : ""}">
<div class="song-card-head">
<span class="num">${String(i+1).padStart(2,"0")}</span>
<button onclick="play('${vid}','${s.time}')">▶</button>
</div>
<div class="song-card-title">${s.title}</div>
<div class="song-card-artist">${s.artist}</div>
</div>`).join("")}
</div>`;

    container.appendChild(card);
  });

  if(hitCount===0){
    container.innerHTML="<p>該当する結果がありません</p>";
  }
}

function showTab(id,btn){
  document.querySelectorAll(".section").forEach(el=>el.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  document.querySelectorAll(".tab-button").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
}

function play(videoId,time){
  const sec=time.split(":").reduce((a,b)=>a*60+Number(b));
  document.getElementById("player").innerHTML=
`<iframe src="https://www.youtube.com/embed/${videoId}?start=${sec}&autoplay=1" allow="autoplay" allowfullscreen></iframe>`;
  document.getElementById("modal").classList.remove("hidden");
}

function closeModal(){
  document.getElementById("player").innerHTML="";
  document.getElementById("modal").classList.add("hidden");
}

function formatDate(d){
  const date=new Date(d);
  return `${date.getFullYear()}/${String(date.getMonth()+1).padStart(2,"0")}/${String(date.getDate()).padStart(2,"0")}`;
}

document.getElementById("searchSongs").addEventListener("input", debounce(renderSongs));
document.getElementById("searchStreams").addEventListener("input", debounce(renderStreams));
document.getElementById("searchArtists").addEventListener("input", debounce(renderArtists));

document.getElementById("sortSongsOrder").addEventListener("change", renderSongs);
document.getElementById("sortStreamsOrder").addEventListener("change", renderStreams);
document.getElementById("sortArtistsOrder").addEventListener("change", renderArtists);

document.getElementById("sortArtistsType").addEventListener("change", ()=>{
  const type = document.getElementById("sortArtistsType").value;

  if(type === "count"){
    document.getElementById("sortArtistsOrder").value = "desc";
  }else{
    document.getElementById("sortArtistsOrder").value = "asc";
  }

  renderArtists();
});

document.getElementById("sortSongsType").addEventListener("change", ()=>{
  const type = document.getElementById("sortSongsType").value;

  if(type === "count"){
    document.getElementById("sortSongsOrder").value = "desc";
  }else{
    document.getElementById("sortSongsOrder").value = "asc";
  }

  renderSongs();
});

document.getElementById("themeToggleSongs").addEventListener("change", toggleTheme);
document.getElementById("themeToggleStreams").addEventListener("change", toggleTheme);
document.getElementById("themeToggleArtists").addEventListener("change", toggleTheme);
document.querySelector(".monetizedToggle").addEventListener("change", renderAll);
document.querySelectorAll(".monetizedToggle").forEach(el=>{
  el.addEventListener("change", ()=>{
    const checked = el.checked;

    document.querySelectorAll(".monetizedToggle").forEach(t=>{
      t.checked = checked;
    });

    renderAll();
  });
});

document.querySelectorAll(".quick-buttons button[data-type]").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    setDateRange(btn.dataset.type);
  });
});

document.querySelectorAll(".startDate").forEach(el=>{
  el.addEventListener("change", ()=>{
    syncDateInputs(el.value, document.querySelector(".endDate")?.value || "");
    highlightButton(null);
    renderAll();
  });
});

document.querySelectorAll(".endDate").forEach(el=>{
  el.addEventListener("change", ()=>{
    syncDateInputs(document.querySelector(".startDate")?.value || "", el.value);
    highlightButton(null);
    renderAll();
  });
});

document.querySelectorAll(".quick-buttons button:not([data-type])").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    currentRangeType = null;
    syncDateInputs("", "");
    highlightButton(null);
    renderAll();
  });
});

document.getElementById("clearSongs").addEventListener("click", ()=>{
  document.getElementById("searchSongs").value = "";
  renderSongs();
});

document.getElementById("clearStreams").addEventListener("click", ()=>{
  document.getElementById("searchStreams").value = "";
  renderStreams();
});

document.getElementById("clearArtists").addEventListener("click", ()=>{
  document.getElementById("searchArtists").value = "";
  renderArtists();
});
