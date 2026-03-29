let data = [];

const STORAGE_KEY = "theme";

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
  return localStorage.getItem(STORAGE_KEY) || "dark";
}

function applyTheme(){
  const isLight = getTheme() === "light";

  document.getElementById("songsTable").classList.toggle("light", isLight);
  document.getElementById("artistsTable").classList.toggle("light", isLight);
  document.body.classList.toggle("streams-light", isLight);

  document.getElementById("themeToggle").checked = isLight;
}

function toggleTheme(){
  const next = getTheme() === "dark" ? "light" : "dark";
  localStorage.setItem(STORAGE_KEY, next);
  applyTheme();
}

fetch("data.json")
.then(r=>r.json())
.then(j=>{
  data = j.map(d=>({
    ...d,
    title: normalize(d.title),
    artist: normalize(d.artist)
  }));
  renderAll();
  applyTheme();
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
  const s=new Set();
  const a=new Set();

  data.forEach(d=>{
    s.add(key(d));
    a.add(d.artist);
  });

  const text=`曲数：${s.size} / アーティスト数：${a.size}`;

  songsSummary.innerText=text;
  streamsSummary.innerText=text;
  artistsSummary.innerText=text;
}

function renderSongs(){
  const map={};

  data.forEach(d=>{
    const k=key(d);
    if(!map[k]) map[k]={...d,count:0};
    map[k].count++;
  });

  let arr=Object.values(map);

  const kw=searchSongs.value.toLowerCase();
  if(kw){
    arr=arr.filter(s=>s.title.toLowerCase().includes(kw)||s.artist.toLowerCase().includes(kw));
  }

  const type=sortSongsType.value;
  const order=sortSongsOrder.value;

  arr.sort((a,b)=>{
    let r=0;
    if(type==="count") r=a.count-b.count;
    else if(type==="artist") r=a.artist.localeCompare(b.artist);
    else r=a.title.localeCompare(b.title);
    return order==="desc"?-r:r;
  });

  songsBody.innerHTML = arr.length===0
    ? `<tr><td colspan="4">該当する結果がありません</td></tr>`
    : arr.map(s=>`
<tr>
<td>${s.title}</td>
<td>${s.artist}</td>
<td>${s.count}</td>
<td><button onclick="play('${s.videoId}','${s.time}')">▶</button></td>
</tr>`).join("");
}

function renderStreams(){
  const map={};

  data.forEach(d=>{
    if(!map[d.videoId]){
      map[d.videoId]={title:d.videoTitle,date:d.date,songs:[]};
    }
    map[d.videoId].songs.push(d);
  });

  let arr=Object.entries(map);

  const order=sortStreamsOrder.value;

  arr.sort((a,b)=>{
    const aDate=Math.max(...a[1].songs.map(s=>new Date(s.date)));
    const bDate=Math.max(...b[1].songs.map(s=>new Date(s.date)));
    return order==="desc"?bDate-aDate:aDate-bDate;
  });

  const kw=searchStreams.value.toLowerCase();

  streamsContainer.innerHTML="";
  let hit=0;

  arr.forEach(([vid,v])=>{
    const list=v.songs.filter(s=>!kw||s.title.toLowerCase().includes(kw)||s.artist.toLowerCase().includes(kw));
    if(list.length===0) return;

    hit++;

    streamsContainer.innerHTML+=`
<div class="card">
<div class="stream-title-row">
<a href="https://youtube.com/watch?v=${vid}" target="_blank">${v.title}</a>
</div>
<div class="stream-date">${v.date}</div>
<div class="grid">
${list.map((s)=>`
<div class="song-card ${kw&&(s.title.toLowerCase().includes(kw)||s.artist.toLowerCase().includes(kw))?"highlight":""}">
<div class="song-card-title">${s.title}</div>
<div class="song-card-artist">${s.artist}</div>
</div>`).join("")}
</div>
</div>`;
  });

  if(hit===0){
    streamsContainer.innerHTML="<p>該当する結果がありません</p>";
  }
}

function renderArtists(){
  const map={};
  data.forEach(d=>{
    if(!map[d.artist]) map[d.artist]=new Set();
    map[d.artist].add(d.title);
  });

  let arr=Object.entries(map).map(([artist,set])=>({
    artist,
    songs:[...set],
    count:set.size
  }));

  const kw=searchArtists.value.toLowerCase();

  if(kw){
    arr=arr.filter(a=>a.artist.toLowerCase().includes(kw)||a.songs.some(t=>t.toLowerCase().includes(kw)));
  }

  const type=sortArtistsType.value;
  const order=sortArtistsOrder.value;

  arr.sort((a,b)=>{
    let r= type==="count"?a.count-b.count:a.artist.localeCompare(b.artist);
    return order==="desc"?-r:r;
  });

  artistsBody.innerHTML = arr.length===0
    ? `<tr><td colspan="2">該当する結果がありません</td></tr>`
    : arr.map(a=>`
<tr class="artist-header"><td colspan="2">${a.artist}（${a.count}曲）</td></tr>
${a.songs.map(t=>`<tr><td></td><td>${t}</td></tr>`).join("")}
`).join("");
}

function showTab(id,btn){
  document.querySelectorAll(".section").forEach(e=>e.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  document.querySelectorAll(".tab-button").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
}

function play(v,t){
  const sec=t.split(":").reduce((a,b)=>a*60+Number(b));
  player.innerHTML=`<iframe src="https://www.youtube.com/embed/${v}?start=${sec}&autoplay=1"></iframe>`;
  modal.classList.remove("hidden");
}

function closeModal(){
  player.innerHTML="";
  modal.classList.add("hidden");
}

searchSongs.addEventListener("input",debounce(renderSongs));
searchStreams.addEventListener("input",debounce(renderStreams));
searchArtists.addEventListener("input",debounce(renderArtists));

sortSongsOrder.addEventListener("change",renderSongs);
sortStreamsOrder.addEventListener("change",renderStreams);
sortArtistsOrder.addEventListener("change",renderArtists);
sortArtistsType.addEventListener("change",renderArtists);

sortSongsType.addEventListener("change",()=>{
  if(sortSongsType.value==="count") sortSongsOrder.value="desc";
  renderSongs();
});

themeToggle.addEventListener("change",toggleTheme);