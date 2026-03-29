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

//
// 曲一覧
//
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

  const sort = document.getElementById("sortSongs").value;

  arr.sort((a,b)=>{
    if(sort==="artist") return a.artist.localeCompare(b.artist);
    if(sort==="count") return b.count-a.count;
    return a.title.localeCompare(b.title);
  });

  const tbody = document.getElementById("songsBody");
  tbody.innerHTML="";

  arr.forEach(s=>{
    tbody.innerHTML+=`
<tr>
<td>${s.title}</td>
<td>${s.artist}</td>
<td>${s.count}</td>
<td>
<button onclick="play('${s.latest.videoId}','${s.latest.time}')">
▶ 最新
</button>
</td>
</tr>`;
  });
}

//
// 配信一覧（改善版）
//
function renderStreams(){
  const map={};

  data.forEach(d=>{
    if(!map[d.videoId]){
      map[d.videoId]={
        title:d.videoTitle,
        date:d.date,
        songs:[]
      };
    }
    map[d.videoId].songs.push(d);
  });

  let arr = Object.entries(map);
  arr.sort((a,b)=> new Date(b[1].date)-new Date(a[1].date));

  const keyword = document.getElementById("searchStreams").value.toLowerCase();

  const container = document.getElementById("streamsContainer");
  container.innerHTML="";

  arr.forEach(([vid,v])=>{

    const match = v.songs.some(s =>
      !keyword ||
      s.title.toLowerCase().includes(keyword) ||
      s.artist.toLowerCase().includes(keyword)
    );

    if(!match) return;

    const div = document.createElement("div");
    div.className="card";

    div.innerHTML=`
<a href="https://youtube.com/watch?v=${vid}" target="_blank">${v.title}</a>
<div class="date">${formatDate(v.date)}</div>

<div class="grid">
${v.songs.map((s,i)=>`
<div class="song">
<button onclick="play('${vid}','${s.time}')">▶</button>
<span class="num">${String(i+1).padStart(2,"0")}</span>
<span>${s.title} / ${s.artist}</span>
</div>
`).join("")}
</div>
`;

    container.appendChild(div);
  });
}

//
// アーティスト
//
function renderArtists(){
  const map={};

  data.forEach(d=>{
    if(!map[d.artist]) map[d.artist]={};

    const k=key(d);

    if(!map[d.artist][k]){
      map[d.artist][k]={title:d.title,count:0};
    }

    map[d.artist][k].count++;
  });

  let artists=Object.keys(map);

  const sort=document.getElementById("sortArtists").value;
  artists.sort((a,b)=> sort==="desc"?b.localeCompare(a):a.localeCompare(b));

  const keyword=document.getElementById("searchArtists").value.toLowerCase();

  const tbody=document.getElementById("artistsBody");
  tbody.innerHTML="";

  artists.forEach(a=>{
    Object.values(map[a]).forEach(s=>{

      if(keyword && !(
        s.title.toLowerCase().includes(keyword) ||
        a.toLowerCase().includes(keyword)
      )) return;

      tbody.innerHTML+=`
<tr>
<td>${a}</td>
<td>${s.title}</td>
<td>${s.count}</td>
</tr>`;
    });
  });
}

//
// UI
//
function showTab(id){
  ["songs","streams","artists"].forEach(t=>{
    document.getElementById(t).classList.add("hidden");
  });
  document.getElementById(id).classList.remove("hidden");
}

function play(videoId,time){
  const sec=time.split(":").reduce((a,b)=>a*60+Number(b));
  document.getElementById("player").innerHTML=
`<iframe src="https://www.youtube.com/embed/${videoId}?start=${sec}" allowfullscreen></iframe>`;
  document.getElementById("modal").classList.remove("hidden");
}

function closeModal(){
  document.getElementById("modal").classList.add("hidden");
  document.getElementById("player").innerHTML=""; // ←再生停止
}

function formatDate(d){
  const date=new Date(d);
  return `${date.getFullYear()}/${String(date.getMonth()+1).padStart(2,"0")}/${String(date.getDate()).padStart(2,"0")} ${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`;
}

//
// イベント
//
document.getElementById("searchSongs").addEventListener("input", renderSongs);
document.getElementById("sortSongs").addEventListener("change", renderSongs);

document.getElementById("searchStreams").addEventListener("input", renderStreams);

document.getElementById("searchArtists").addEventListener("input", renderArtists);
document.getElementById("sortArtists").addEventListener("change", renderArtists);