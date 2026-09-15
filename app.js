let data = [];
let currentRangeType = null;

const STORAGE_KEY = "tableTheme";
const MONETIZED_DATE = new Date("2026-02-23");

let YOMI_MAP = {};
function getYomi(str, artist){
  if(!str) return "";

  const s = normalize(str);
  const a = normalize(artist || "");

  const key = `${s}||${a}`;

  return YOMI_MAP[key] || YOMI_MAP[s] || s;
}

let bookmarkedIds = new Set();

window.onBookmarksChanged = function(ids){
  bookmarkedIds = ids;
  renderAll();
};

function showToast(message){
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);

  setTimeout(() => el.classList.add("show"), 10);
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, 1800);
}

function escapeHtml(str){
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let myPlaylists = [];

window.onPlaylistsChanged = function(playlists){
  myPlaylists = playlists;
  renderPlaylistAccordion();
  renderSongs();
  renderStreams();
  renderBookmarks();
};

function closePlaylistMenu(){
  document.getElementById("activePlaylistMenu")?.remove();
}

async function openPlaylistMenu(btn, title, artist, videoId, time, note){
  closePlaylistMenu();

  const uid = window.vsongAuth.auth.currentUser.uid;
  const playlistIds = myPlaylists.map(p => p.id);
  const containing = await window.vsongPlaylists.getPlaylistsContainingSong(uid, playlistIds, title, artist, videoId, time);

  const menu = document.createElement("div");
  menu.className = "playlist-menu";
  menu.id = "activePlaylistMenu";

  menu.innerHTML = `
    <div class="playlist-menu-title">保存先...</div>
    ${myPlaylists.map(p => `
      <button class="playlist-menu-item" data-id="${p.id}">
        <span>${escapeHtml(p.name)}</span>
        <span class="playlist-menu-check">${containing[p.id] ? "✅" : "☐"}</span>
      </button>
    `).join("")}
    <button class="playlist-menu-item playlist-menu-new" data-id="__new__">＋ 新しいリスト</button>
  `;

  menu.style.visibility = "hidden";
  document.body.appendChild(menu);

  const rect = btn.getBoundingClientRect();
  const menuHeight = menu.offsetHeight;
  const spaceBelow = window.innerHeight - rect.bottom;

  menu.style.position = "fixed";
  menu.style.left = `${rect.left}px`;

  if(spaceBelow < menuHeight + 8){
    menu.style.top = `${rect.top - menuHeight - 4}px`;
  }else{
    menu.style.top = `${rect.bottom + 4}px`;
  }

  menu.style.visibility = "";

  menu.querySelectorAll(".playlist-menu-item").forEach(item => {
    item.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = item.dataset.id;

      if(id === "__new__"){
        closePlaylistMenu();
        const name = prompt("新しいリスト名を入力してください");
        if(!name) return;
        const newId = await window.vsongPlaylists.createPlaylist(uid, name);
        await window.vsongPlaylists.addSongToPlaylist(uid, newId, title, artist, videoId, time, note);
        showToast(`「${name}」に追加しました`);
        return;
      }

      const name = item.querySelector("span").textContent;

      if(containing[id]){
        await window.vsongPlaylists.removeSongFromPlaylist(uid, id, title, artist, videoId, time);
        showToast(`「${name}」から外しました`);
      }else{
        await window.vsongPlaylists.addSongToPlaylist(uid, id, title, artist, videoId, time, note);
        showToast(`「${name}」に追加しました`);
      }

      closePlaylistMenu();
    });
  });

  setTimeout(() => {
    document.addEventListener("click", closePlaylistMenu, { once: true });
  }, 0);
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".playlist-add-btn");
  if(!btn) return;
  e.stopPropagation();

  if(!btn.dataset.endTime){
    showToast("終了時刻が未設定のため、リストに追加できません");
    return;
  }

  openPlaylistMenu(btn, btn.dataset.title, btn.dataset.artist, btn.dataset.videoId, btn.dataset.time, btn.dataset.note);
});

function toggleBookmark(videoId, videoTitle){
  if(!currentUsername){
    return;
  }

  const isBookmarked = bookmarkedIds.has(videoId);
  const uid = window.vsongAuth.auth.currentUser.uid;

  window.vsongBookmarks.toggleBookmark(uid, videoId, !isBookmarked)
    .then(() => {
      showToast(isBookmarked ? "ブックマークを解除しました" : "ブックマークに追加しました");
    })
    .catch(() => {
      showToast("エラーが発生しました");
    });
}

function matchText(text, keyword, exact, caseSensitive){
  text = normalizeSearch(text);
  keyword = normalizeSearch(keyword);

  if(!caseSensitive){
    text = text.toLowerCase();
    keyword = keyword.toLowerCase();
  }

  if(exact){
    return text === keyword;
  }else{
    return text.includes(keyword);
  }
}

function parseKeyword(input){
  const raw = normalize(input);

  if(raw.includes("&&") || raw.includes("＆＆")){
    return {
      mode: "AND",
      keywords: raw
        .split(/&&|＆＆/)
        .map(k => normalize(k))
        .filter(k => k)
    };
  }

  return {
    mode: "SINGLE",
    keywords: [raw]
  };
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

function normalizeSearch(str){
  return normalize(str).normalize("NFKC");
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

Promise.all([
  fetch("data.json").then(r=>r.json()),
  fetch("../common/yomi.json")
    .then(r => r.ok ? r.json() : {})
    .catch(() => ({})),
  fetch("status.json")
    .then(r => r.ok ? r.json() : {})
    .catch(() => ({}))
]).then(([dataJson, yomiJson, statusJson])=>{
  YOMI_MAP = yomiJson || {};

  data = dataJson.map(d => ({
    ...d,
    title: normalize(d.title),
    artist: normalize(d.artist)
  }));

  document.querySelectorAll(".statusCheckedAt").forEach(el=>{
    el.textContent = formatDateTime(statusJson?.checkedAt);
  });

  document.querySelectorAll(".startDate").forEach(el=>el.value="");
  document.querySelectorAll(".endDate").forEach(el=>el.value="");

  renderAll();
});

function key(d){
  return d.title + "||" + d.artist;
}

function toWatchUrl(videoId, time){
  const sec = time.split(":").reduce((a,b)=>a*60+Number(b));
  return `https://www.youtube.com/watch?v=${videoId}&t=${sec}s`;
}

function statusLabel(status){
  if(status === "unlisted") return "限定公開のため視聴不可";
  if(status === "gone") return "非公開または削除のため視聴不可";
  if(status === "members") return "メンバー限定";
  return "";
}

function renderPlayButton(item){
  const status = item.status || "public";

  if(status === "public"){
    return `<button class="play-btn" onclick="play('${item.videoId}','${item.time}')">▶</button>`;
  }

  if(status === "members"){
    return `<a class="play-btn" href="${toWatchUrl(item.videoId, item.time)}" target="_blank" title="${statusLabel(status)}">▶</a>`;
  }

  return `<button class="play-btn" disabled title="${statusLabel(status)}">▶</button>`;
}

function renderPlaylistAddButton(item){
  if(!currentUsername) return "";
  if(!item.status || item.status !== "public") return "";

  return `<button class="playlist-add-btn" data-title="${escapeHtml(item.title)}" data-artist="${escapeHtml(item.artist)}" data-video-id="${item.videoId}" data-time="${item.time}" data-end-time="${item.endTime || ""}" data-note="${escapeHtml(item.note || "")}" title="ブックマーク(曲)に追加">＋</button>`;
}

function formatDateTime(iso){
  if(!iso) return "";
  const d = new Date(iso);

  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(d);

  const get = type => parts.find(p => p.type === type)?.value;

  return `${get("year")}/${get("month")}/${get("day")} ${get("hour")}:${get("minute")}`;
}

function renderAll(){
  renderSummary();
  renderSongs();
  renderStreams();
  renderBookmarks();
  renderArtists();
}

function renderSummary(){
  const isStreams = !document.getElementById("streams").classList.contains("hidden");

  let src;

  if(isStreams){
    let base = getFilteredData();

    const unplayableOnly = document.getElementById("filterStreamsUnplayable")?.checked;
    if(unplayableOnly){
      base = base.filter(d => (d.status || "public") === "public");
    }

    const hikigatariOnly = document.getElementById("filterStreamsHikigatari")?.checked;

    if(hikigatariOnly){
      src = base.filter(d =>
        normalize(d.videoTitle).includes("弾き語り") ||
        normalize(d.videoTitle).includes("ギター")
      );
    }else{
      src = base;
    }

  }else{
    let base = getFilteredData();

    const unplayableOnly = document.getElementById("filterUnplayable")?.checked;
    if(unplayableOnly){
      base = base.filter(d => (d.status || "public") === "public");
    }

    const hikigatariOnly = document.getElementById("filterHikigatari")?.checked;
    if(hikigatariOnly){
      src = base.filter(d =>
        (d.note || "").replace(/^[\s　]+|[\s　]+$/g, "") === "弾き語り"
      );
    }else{
      src = base;
    }
  }

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

  const isArtists = !document.getElementById("artists").classList.contains("hidden");

  if(isStreams){
    document.getElementById("streamsSummary").innerHTML = html;
  }else if(isArtists){
    document.getElementById("artistsSummary").innerHTML = html;
  }else{
    document.getElementById("songsSummary").innerHTML = html;
  }
}

function renderSongs(){
  let src = getFilteredData();

  const unplayableOnly = document.getElementById("filterUnplayable")?.checked;
  if(unplayableOnly){
    src = src.filter(d => (d.status || "public") === "public");
  }

  const map={};

  src.forEach(d=>{
    const k=key(d);
    if(!map[k]) map[k]={
      title:d.title,artist:d.artist,notes:new Set(),count:0,
      latest:d,latestPlayable:null,
      latestOngen:null,latestOngenPlayable:null,
      latestHikigatari:null,latestHikigatariPlayable:null
    };
    const note = (d.note || "").replace(/^[\s　]+|[\s　]+$/g, "");
    const isPlayable = (d.status || "public") === "public";
    map[k].notes.add(note);
    map[k].count++;
    if(new Date(d.date)>new Date(map[k].latest.date)){
      map[k].latest=d;
    }
    if(isPlayable && (!map[k].latestPlayable || new Date(d.date)>new Date(map[k].latestPlayable.date))){
      map[k].latestPlayable=d;
    }
    if(note === "弾き語り"){
      if(!map[k].latestHikigatari || new Date(d.date)>new Date(map[k].latestHikigatari.date)){
        map[k].latestHikigatari=d;
      }
      if(isPlayable && (!map[k].latestHikigatariPlayable || new Date(d.date)>new Date(map[k].latestHikigatariPlayable.date))){
        map[k].latestHikigatariPlayable=d;
      }
    }else{
      if(!map[k].latestOngen || new Date(d.date)>new Date(map[k].latestOngen.date)){
        map[k].latestOngen=d;
      }
      if(isPlayable && (!map[k].latestOngenPlayable || new Date(d.date)>new Date(map[k].latestOngenPlayable.date))){
        map[k].latestOngenPlayable=d;
      }
    }
  });

  let arr=Object.values(map);

  arr.forEach(s=>{
    s.latest = s.latestPlayable || s.latest;
    s.latestOngen = s.latestOngenPlayable || s.latestOngen;
    s.latestHikigatari = s.latestHikigatariPlayable || s.latestHikigatari;
  });

  arr.forEach(s=>{
    const notes = s.notes;
    const noteList = [...notes];
    const muteNote = noteList.find(n => n.includes("ミュート"));
    const labels = [];
  
    if(notes.has("")) labels.push("音源");
    if(notes.has("弾き語り")) labels.push("弾き語り");
    if(muteNote) labels.push(muteNote);
  
    if(labels.length === 1 && labels[0] === "音源"){
      s.displayNote = "";
    } else {
      s.displayNote = labels.join("・");
    }
  
    s.hasHikigatari = notes.has("弾き語り");
  });

  const hikigatariOnly = document.getElementById("filterHikigatari").checked;
  if(hikigatariOnly){
    arr = arr.filter(s => s.hasHikigatari);
  }

  let keyword = document.getElementById("searchSongs").value;
  const {mode, keywords} = parseKeyword(keyword);
  
  const exact = document.getElementById("exactMatchSongs").checked;
  const caseSensitive = document.getElementById("caseSensitiveSongs").checked;
  
  if(keywords[0]){
    arr = arr.filter(s => {
  
      if(mode === "AND"){
        return keywords.every(k =>
          matchText(s.title, k, exact, caseSensitive) ||
          matchText(s.artist, k, exact, caseSensitive)
        );
      }
  
      return matchText(s.title, keywords[0], exact, caseSensitive) ||
             matchText(s.artist, keywords[0], exact, caseSensitive);
    });
  }

  if(arr.length===0){
    document.getElementById("songsBody").innerHTML=`<tr><td colspan="4">該当する結果がありません</td></tr>`;
    return;
  }

  const type=document.getElementById("sortSongsType").value;
  const order=document.getElementById("sortSongsOrder").value;

  arr.sort((a,b)=>{
    let res=0;
  
    if(type==="artist"){
      res = getYomi(a.artist).localeCompare(getYomi(b.artist),"ja");
  
      if(res===0){
        return getYomi(a.title, a.artist).localeCompare(getYomi(b.title, b.artist),"ja");
      }
    }
  
    else if(type==="count"){
      res = a.count - b.count;
  
      if(res===0){
        return getYomi(a.title, a.artist).localeCompare(getYomi(b.title, b.artist),"ja");
      }
    }

    else if(type==="date"){
      res = new Date(a.latest.date) - new Date(b.latest.date);
    
      if(res===0){
        return getYomi(a.title, a.artist).localeCompare(getYomi(b.title, b.artist),"ja");
      }
    }
  
    else{
      res = getYomi(a.title, a.artist).localeCompare(getYomi(b.title, b.artist),"ja");
    }
  
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
<td>
  <div class="song-play-area">
    ${s.displayNote.includes("・") ? `
    <div class="play-group">
      ${renderPlayButton(s.latestOngen)}
      <div class="song-date">${formatDate(s.latestOngen.date)}<br>(音源)${s.latestOngen.status && s.latestOngen.status !== "public" ? `<br>${statusLabel(s.latestOngen.status)}` : ""}</div>
      ${renderPlaylistAddButton(s.latestOngen)}
    </div>
    <div class="play-group">
      ${renderPlayButton(s.latestHikigatari)}
      <div class="song-date">${formatDate(s.latestHikigatari.date)}<br>(弾き語り)${s.latestHikigatari.status && s.latestHikigatari.status !== "public" ? `<br>${statusLabel(s.latestHikigatari.status)}` : ""}</div>
      ${renderPlaylistAddButton(s.latestHikigatari)}
    </div>
    ` : `
    ${renderPlayButton(s.latest)}
    <div class="song-date">${formatDate(s.latest.date)}${s.latest.status && s.latest.status !== "public" ? `<br>${statusLabel(s.latest.status)}` : ""}</div>
    ${renderPlaylistAddButton(s.latest)}
    `}
  </div>
</td>
<td>${s.displayNote}</td>
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

  let keyword = document.getElementById("searchArtists").value;
  const {mode, keywords} = parseKeyword(keyword);
  
  const exact = document.getElementById("exactMatchArtists").checked;
  const caseSensitive = document.getElementById("caseSensitiveArtists").checked;
  
  if(keywords[0]){
    artists = artists.filter(a => {
  
      if(mode === "AND"){
        return keywords.every(k =>
          matchText(a, k, exact, caseSensitive) ||
          Array.from(map[a]).some(t => matchText(t, k, exact, caseSensitive))
        );
      }
  
      return matchText(a, keywords[0], exact, caseSensitive) ||
             Array.from(map[a]).some(t => matchText(t, keywords[0], exact, caseSensitive));
    });
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

    const songs = Array.from(map[a]).sort((t1,t2)=>
      getYomi(t1, a).localeCompare(getYomi(t2, a),"ja")
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

function renderStreamList(config){
  let src = config.getSrc();

  const map={};

  src.forEach(d=>{
    if(!map[d.videoId]){
      map[d.videoId]={
        title:d.videoTitle,
        latestDate:new Date(d.date),
        streamNote:d.streamNote || "",
        songs:[]
      };
    }
    map[d.videoId].songs.push(d);
  
    const dDate = new Date(d.date);
    if(dDate > map[d.videoId].latestDate){
      map[d.videoId].latestDate = dDate;
    }
  });

  let arr=Object.entries(map);

  const hikigatariOnly = document.getElementById(config.hikigatariCheckboxId)?.checked;
  if(hikigatariOnly){
    arr = arr.filter(([vid, v]) =>
      normalize(v.title).includes("弾き語り") ||
      normalize(v.title).includes("ギター")
    );
  }

  const order=document.getElementById(config.sortSelectId).value;

  arr.sort((a,b)=>{
    const aDate=a[1].latestDate;
    const bDate=b[1].latestDate;
    return order==="desc"?bDate-aDate:aDate-bDate;
  });

  let keyword = document.getElementById(config.searchInputId).value;
  const {mode, keywords} = parseKeyword(keyword);
  
  const exact = document.getElementById(config.exactId).checked;
  const caseSensitive = document.getElementById(config.caseId).checked;
  const container=document.getElementById(config.containerId);
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

    // 備考で表示したいワード (部分一致で検索される)
    const streamNoteKeywords = [
      "ミュート"
    ];
    
    const notes = unique
      .filter(s => {
        const note = (s.note || "").trim();
        return note && streamNoteKeywords.some(keyword => note.includes(keyword));
      })
      .map(s => ({
        title: s.title,
        note: s.note.trim()
      }));

    const videoStatus = unique[0]?.status || "public";
    
    function isMatch(s){
      if(!keywords[0]) return false;
    
      if(mode === "AND"){
        return keywords.every(k =>
          matchText(s.title, k, exact, caseSensitive) ||
          matchText(s.artist, k, exact, caseSensitive)
        );
      }
    
      return matchText(s.title, keywords[0], exact, caseSensitive) ||
             matchText(s.artist, keywords[0], exact, caseSensitive);
    }
    
    if(keyword && !unique.some(isMatch)) return;

    hitCount++;

    const card=document.createElement("div");
    card.className="card";

    const bookmarked = bookmarkedIds.has(vid);

    card.innerHTML=`
<div class="stream-title-row">
<a href="https://youtube.com/watch?v=${vid}" target="_blank">${v.title}</a>
${currentUsername ? `
<button class="bookmark-btn ${bookmarked ? "bookmarked" : ""}" onclick="toggleBookmark('${vid}')" title="${bookmarked ? "ブックマーク済み(クリックで解除)" : "ブックマークに追加"}">
${bookmarked ? "★" : "☆"}ブックマーク${bookmarked ? "済み" : ""}
</button>
` : ""}
</div>

<div class="stream-date">${formatDate(v.latestDate)}</div>

${v.streamNote || notes.length || videoStatus !== "public" ? `
<div class="stream-notes">
  <b>備考</b>
  ${videoStatus !== "public" ? `<div>🔒 ${statusLabel(videoStatus)}</div>` : ""}
  ${v.streamNote ? `<div>${v.streamNote}</div>` : ""}
  ${notes.length ? `
  <ul>
  ${notes.map(n => `
  <li>${n.title}：${n.note}</li>
  `).join("")}
  </ul>
  ` : ""}
</div>
` : ""}

<div class="grid">
${filtered.map((s,i)=>`
<div class="song-card ${isMatch(s) ? "highlight" : ""}">
<div class="song-card-head">
<span class="num">${String(i+1).padStart(2,"0")}</span>
${renderPlayButton({videoId: vid, time: s.time, status: s.status})}
</div>
<div class="song-card-title">${s.title}</div>
<div class="song-card-artist">${s.artist}</div>
${renderPlaylistAddButton({ title: s.title, artist: s.artist, videoId: vid, time: s.time, endTime: s.endTime, note: s.note, status: s.status })}
</div>`).join("")}
</div>`;

    container.appendChild(card);
  });

  document.getElementById(config.countId).innerText = `${config.countLabel}：${hitCount}件`;
  
  if(hitCount===0){
    container.innerHTML = `<p>${src.length===0 ? config.emptyMessage : "該当する結果がありません"}</p>`;
  }
}

function renderStreams(){
  renderStreamList({
    getSrc: () => {
      let src = getFilteredData();
      const unplayableOnly = document.getElementById("filterStreamsUnplayable")?.checked;
      if(unplayableOnly){
        src = src.filter(d => (d.status || "public") === "public");
      }
      return src;
    },
    hikigatariCheckboxId: "filterStreamsHikigatari",
    searchInputId: "searchStreams",
    exactId: "exactMatchStreams",
    caseId: "caseSensitiveStreams",
    sortSelectId: "sortStreamsOrder",
    containerId: "streamsContainer",
    countId: "streamsCount",
    countLabel: "配信数",
    emptyMessage: "該当する結果がありません"
  });
}

function renderBookmarks(){
  renderStreamList({
    getSrc: () => {
      let src = data.filter(d => bookmarkedIds.has(d.videoId));
      const unplayableOnly = document.getElementById("filterBookmarksUnplayable")?.checked;
      if(unplayableOnly){
        src = src.filter(d => (d.status || "public") === "public");
      }
      return src;
    },
    hikigatariCheckboxId: "filterBookmarksHikigatari",
    searchInputId: "searchBookmarks",
    exactId: "exactMatchBookmarks",
    caseId: "caseSensitiveBookmarks",
    sortSelectId: "sortBookmarksOrder",
    containerId: "bookmarksContainer",
    countId: "bookmarksCount",
    countLabel: "ブックマーク数",
    emptyMessage: "まだブックマークがありません。配信一覧から☆ブックマークを押して追加できます"
  });
}

function showTab(id,btn){
  document.querySelectorAll(".section").forEach(el=>el.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  document.querySelectorAll(".tab-button").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  renderSummary();
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

let currentUsername = null;
let lastRenderedAuthState = "__unset__";

function renderAuthArea(user){
  if(user === lastRenderedAuthState){
    return;
  }
  lastRenderedAuthState = user;
  currentUsername = user;

  document.querySelector(".auth-hint-static")?.classList.toggle("hidden", !!user);

  const el = document.getElementById("authArea");

  if(user){
    el.innerHTML = `
      <button id="authTrigger" class="auth-trigger">👤 ${user}</button>
      <div id="authPanel" class="auth-panel hidden">
        <button id="authClose" class="auth-close">×</button>
        <button id="openSettingsBtn">設定</button>
        <button class="auth-switch" onclick="openPrivacyModal()">プライバシーポリシー</button>
        <button id="logoutBtn">ログアウト</button>
      </div>
    `;
    document.getElementById("logoutBtn").addEventListener("click", () => {
      window.vsongAuth.logOut();
    });

    document.getElementById("openSettingsBtn").addEventListener("click", () => {
      document.getElementById("authPanel").classList.add("hidden");
      openSettingsModal();
    });

    document.getElementById("authTrigger").addEventListener("click", () => {
      document.getElementById("authPanel").classList.toggle("hidden");
    });

    document.getElementById("authClose").addEventListener("click", () => {
      document.getElementById("authPanel").classList.add("hidden");
    });
  }else{
    renderAuthPanelBody(el, "login");
  }
}

function markLoggedIn(){
  if(!currentUsername){
    currentUsername = "…";
  }
}
window.markLoggedIn = markLoggedIn;

function renderAuthPanelBody(el, mode){
  const isSignup = mode === "signup";

  el.innerHTML = `
    <button id="authTrigger" class="auth-trigger">ログイン</button>
    <div id="authPanel" class="auth-panel hidden">
      <button id="authClose" class="auth-close">×</button>
      <div class="auth-panel-title">${isSignup ? "新規登録" : "ログイン"}</div>
      <input id="authUsername" placeholder="ユーザー名">
      <div class="auth-password-row">
        <input id="authPassword" type="password" placeholder="パスワード">
        <button id="authTogglePw" type="button" class="auth-toggle-pw">👁</button>
      </div>
      ${isSignup ? `<span class="auth-note">パスワードは6文字以上で設定してください</span>` : ""}
      ${isSignup ? `
      <input id="authEmail" type="email" placeholder="メールアドレス(任意)">
      <span class="auth-note">パスワードを忘れた際の再発行に使えます。後から登録はできません</span>
      ` : ""}
      <button id="authSubmit">${isSignup ? "登録する" : "ログイン"}</button>
      <button id="authSwitch" class="auth-switch">${isSignup ? "ログインはこちら" : "はじめての方はこちら(新規登録)"}</button>
      ${!isSignup ? `<button id="authForgotPw" class="auth-switch">パスワードを忘れた方はこちら</button>` : ""}
      <button class="auth-switch" onclick="openPrivacyModal()">プライバシーポリシー</button>
      <span id="authError" class="auth-error"></span>
    </div>
  `;

  document.getElementById("authTogglePw").addEventListener("click", () => {
    const pwInput = document.getElementById("authPassword");
    pwInput.type = pwInput.type === "password" ? "text" : "password";
  });

  document.getElementById("authTrigger").addEventListener("click", () => {
    document.getElementById("authHint")?.remove();
    const panel = document.getElementById("authPanel");
    panel.classList.toggle("hidden");
    document.querySelector(".auth-hint-static")?.classList.toggle("hidden", !panel.classList.contains("hidden"));
  });

  document.getElementById("authClose").addEventListener("click", () => {
    document.getElementById("authPanel").classList.add("hidden");
    document.querySelector(".auth-hint-static")?.classList.remove("hidden");
  });

  document.getElementById("authSwitch").addEventListener("click", () => {
    renderAuthPanelBody(el, isSignup ? "login" : "signup");
    document.getElementById("authPanel").classList.remove("hidden");
  });

  document.getElementById("authForgotPw")?.addEventListener("click", async () => {
    const username = document.getElementById("authUsername").value.trim();
    const errorEl = document.getElementById("authError");

    if(!username){
      errorEl.textContent = "ユーザー名を入力してから押してください";
      return;
    }

    try{
      await window.vsongAccount.sendPasswordReset(username);
      errorEl.textContent = "";
      errorEl.style.color = "#4ade80";
      errorEl.textContent = "登録済みのメールアドレスに再設定用のメールを送りました";
    }catch(e){
      errorEl.style.color = "";
      errorEl.textContent = e.message || "エラーが発生しました";
    }
  });

  document.getElementById("authSubmit").addEventListener("click", async () => {
    const username = document.getElementById("authUsername").value.trim();
    const password = document.getElementById("authPassword").value;
    const errorEl = document.getElementById("authError");

    if(!username || !password){
      errorEl.textContent = "ユーザー名とパスワードを両方入力してください";
      return;
    }

    try{
      if(isSignup){
        const email = document.getElementById("authEmail").value.trim();
        await window.vsongAuth.signUp(username, password, email || null);
      }else{
        await window.vsongAuth.logIn(username, password);
      }
      renderAuthArea(username);
      renderAll();
    }catch(e){
      errorEl.textContent = e.message || "エラーが発生しました";
    }
  });
}

function showProtectedTab(id, btn){
  if(!currentUsername){
    const panel = document.getElementById("authPanel");
    panel.classList.remove("hidden");
    document.querySelector(".auth-hint-static")?.classList.add("hidden");

    let hint = document.getElementById("authHint");
    if(!hint){
      hint = document.createElement("div");
      hint.id = "authHint";
      hint.className = "auth-hint";
      panel.prepend(hint);
    }
    hint.textContent = "ログインするとブックマーク・プレイリストが使えます";
    return;
  }
  showTab(id, btn);
}

function handleLogout(){
  stopPlaylistPlayback();

  const protectedIds = ["bookmarks", "playlists"];
  const current = protectedIds.find(id => !document.getElementById(id).classList.contains("hidden"));

  if(!current){
    return;
  }

  const songsBtn = document.querySelector('.tab-button[onclick*="\'songs\'"]');
  showTab("songs", songsBtn);
}

window.vsongAuthReady = window.vsongAuth
  ? Promise.resolve()
  : new Promise(resolve => {
      window.addEventListener("vsong-auth-ready", resolve, { once: true });
    });

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

  if(type === "count" || type === "date"){
    document.getElementById("sortSongsOrder").value = "desc";
  }else{
    document.getElementById("sortSongsOrder").value = "asc";
  }

  renderSongs();
});

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
  document.getElementById("exactMatchSongs").checked = false;
  document.getElementById("caseSensitiveSongs").checked = false;
  renderSongs();
});

document.getElementById("clearStreams").addEventListener("click", ()=>{
  document.getElementById("searchStreams").value = "";
  document.getElementById("exactMatchStreams").checked = false;
  document.getElementById("caseSensitiveStreams").checked = false;
  renderStreams();
});

document.getElementById("clearArtists").addEventListener("click", ()=>{
  document.getElementById("searchArtists").value = "";
  document.getElementById("exactMatchArtists").checked = false;
  document.getElementById("caseSensitiveArtists").checked = false;
  renderArtists();
});

document.getElementById("exactMatchSongs").addEventListener("change", renderSongs);
document.getElementById("caseSensitiveSongs").addEventListener("change", renderSongs);

document.getElementById("exactMatchStreams").addEventListener("change", renderStreams);
document.getElementById("caseSensitiveStreams").addEventListener("change", renderStreams);

document.getElementById("exactMatchArtists").addEventListener("change", renderArtists);
document.getElementById("caseSensitiveArtists").addEventListener("change", renderArtists);

document.getElementById("filterStreamsHikigatari").addEventListener("change", renderAll);
document.getElementById("filterHikigatari").addEventListener("change", renderAll);

document.getElementById("filterStreamsUnplayable")?.addEventListener("change", renderAll);
document.getElementById("filterUnplayable")?.addEventListener("change", renderAll);

document.getElementById("searchBookmarks").addEventListener("input", debounce(renderBookmarks));
document.getElementById("sortBookmarksOrder").addEventListener("change", renderBookmarks);
document.getElementById("exactMatchBookmarks").addEventListener("change", renderBookmarks);
document.getElementById("caseSensitiveBookmarks").addEventListener("change", renderBookmarks);
document.getElementById("filterBookmarksHikigatari").addEventListener("change", renderBookmarks);
document.getElementById("filterBookmarksUnplayable").addEventListener("change", renderBookmarks);

document.getElementById("clearBookmarks").addEventListener("click", ()=>{
  document.getElementById("searchBookmarks").value = "";
  document.getElementById("exactMatchBookmarks").checked = false;
  document.getElementById("caseSensitiveBookmarks").checked = false;
  renderBookmarks();
});

let expandedPlaylistId = null;
let unsubPlaylistSongs = null;
let nowPlayingKey = null;

function renderPlaylistAccordion(){
  const el = document.getElementById("playlistAccordion");

  el.innerHTML = myPlaylists.map(p => `
    <div class="playlist-accordion-header ${p.id === expandedPlaylistId ? "active" : ""}" data-id="${p.id}">
      <span class="playlist-accordion-name" data-id="${p.id}">${escapeHtml(p.name)}<span class="playlist-count" data-count-id="${p.id}"></span></span>
      <div class="playlist-accordion-actions">
        <button class="playlist-rename-btn" data-id="${p.id}" title="名前を変更">✎</button>
        <button class="playlist-delete-btn" data-id="${p.id}" title="削除">🗑</button>
        <span class="playlist-accordion-chevron">${p.id === expandedPlaylistId ? "▾" : "▸"}</span>
      </div>
    </div>
    <div class="playlist-accordion-body ${p.id === expandedPlaylistId ? "" : "hidden"}" data-body-id="${p.id}"></div>
  `).join("");

  el.querySelectorAll(".playlist-accordion-header").forEach(headerEl => {
    headerEl.addEventListener("click", () => togglePlaylistExpand(headerEl.dataset.id));
  });

  el.querySelectorAll(".playlist-rename-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const playlist = myPlaylists.find(p => p.id === btn.dataset.id);
      const newName = prompt("新しい名前を入力してください", playlist.name);
      if(!newName || newName === playlist.name) return;

      const uid = window.vsongAuth.auth.currentUser.uid;
      await window.vsongPlaylists.renamePlaylist(uid, btn.dataset.id, newName);
    });
  });

  el.querySelectorAll(".playlist-delete-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const playlist = myPlaylists.find(p => p.id === btn.dataset.id);
      if(!confirm(`「${playlist.name}」を削除しますか？中の曲もすべて削除されます。`)) return;

      const uid = window.vsongAuth.auth.currentUser.uid;
      await window.vsongPlaylists.deletePlaylist(uid, btn.dataset.id);

      if(currentPlaylistId === btn.dataset.id){
        stopPlaylistPlayback();
      }

      if(expandedPlaylistId === btn.dataset.id){
        expandedPlaylistId = null;
      }
      renderPlaylistAccordion();
    });
  });

  if(expandedPlaylistId){
    renderPlaylistSongs(expandedPlaylistId);
  }
}

function togglePlaylistExpand(id){
  expandedPlaylistId = (expandedPlaylistId === id) ? null : id;
  renderPlaylistAccordion();
}

const PLAY_ICON_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
const PAUSE_ICON_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';

function renderPlaylistSongPlayButton(item){
  const status = item.status || "public";
  if(status !== "public"){
    return renderPlayButton(item);
  }
  return `<button class="playlist-play-in-app-btn" data-key="${item.key}" data-video-id="${item.videoId}" data-time="${item.time}" data-end-time="${item.endTime || ""}" data-title="${escapeHtml(item.title)}" data-artist="${escapeHtml(item.artist)}" data-note="${escapeHtml(item.note || "")}" title="再生">${PLAY_ICON_SVG}</button>`;
}

function renderPlaylistSongs(playlistId){
  const el = document.querySelector(`.playlist-accordion-body[data-body-id="${playlistId}"]`);
  if(!el) return;

  unsubPlaylistSongs?.();

  const uid = window.vsongAuth.auth.currentUser.uid;

  unsubPlaylistSongs = window.vsongPlaylists.watchPlaylistSongs(uid, playlistId, allSongs => {
    const countEl = document.querySelector(`.playlist-count[data-count-id="${playlistId}"]`);
    if(countEl) countEl.textContent = `(${allSongs.length}曲)`;

    const songs = allSongs.filter(s => {
      const live = data.find(d => d.videoId === s.videoId && d.time === s.time);
      return (live?.status || "public") === "public";
    });

    if(playlistId === currentPlaylistId){
      const eligibleKeys = songs
        .filter(s => {
          const live = data.find(d => d.videoId === s.videoId && d.time === s.time);
          return live?.endTime;
        })
        .map(s => s.key);

      reconcilePlaylistQueue(eligibleKeys);
    }

    if(songs.length === 0){
      el.innerHTML = `<p class="playlist-empty-hint">${allSongs.length === 0 ? "まだ曲がありません。曲一覧・配信一覧の＋ボタンから追加できます" : "視聴可能な曲がありません(非公開になった曲は自動的に非表示になっています)"}</p>`;
      return;
    }

    el.innerHTML = `
      <div class="playlist-song-header">
        <span></span>
        <span></span>
        <span></span>
        <span class="playlist-song-header-info">曲名 / アーティスト</span>
        <span class="playlist-song-header-date">配信日</span>
        <span class="playlist-song-header-duration">長さ</span>
        <span class="playlist-song-header-remove"></span>
      </div>
      <div class="playlist-accordion-body-scroll">
    ` + songs.map((s, i) => {
      const live = data.find(d => d.videoId === s.videoId && d.time === s.time);
      const status = live?.status || "public";
      const videoDate = live?.date;
      const endTime = live?.endTime || "";

      return `
      <div class="playlist-song-row ${s.key === nowPlayingKey ? "now-playing" : ""}" draggable="true" data-key="${s.key}">
        <span class="playlist-drag-handle" title="ドラッグして並べ替え">⠿</span>
        <div class="playlist-song-reorder">
          <button class="playlist-move-up" data-key="${s.key}" ${i === 0 ? "disabled" : ""}>▲</button>
          <button class="playlist-move-down" data-key="${s.key}" ${i === songs.length - 1 ? "disabled" : ""}>▼</button>
        </div>
        <span class="num">${renderPlaylistSongPlayButton({key: s.key, videoId: s.videoId, time: s.time, endTime, status, title: s.title, artist: s.artist, note: s.note})}</span>
        <div class="playlist-song-info">
          <div class="playlist-song-title">${escapeHtml(s.title)}${s.note === "弾き語り" ? "（弾き語り）" : ""}</div>
          <div class="playlist-song-artist">${escapeHtml(s.artist)}</div>
        </div>
        <div class="playlist-song-date">${videoDate ? formatDate(videoDate) : ""}</div>
        <div class="playlist-song-duration">${endTime ? formatSeekTime(ytTimeToSeconds(endTime) - ytTimeToSeconds(s.time)) : "-"}</div>
        <button class="playlist-song-remove" data-key="${s.key}" data-title="${escapeHtml(s.title)}" data-artist="${escapeHtml(s.artist)}" data-video-id="${s.videoId}" data-time="${s.time}" title="削除">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
        </button>
      </div>
    `;
    }).join("") + `</div>`;

    const keys = songs.map(s => s.key);

    async function applyReorder(newKeys){
      await window.vsongPlaylists.reorderPlaylistSongs(uid, playlistId, newKeys);
    }

    el.querySelectorAll(".playlist-move-up").forEach(btn => {
      btn.addEventListener("click", () => {
        const i = keys.indexOf(btn.dataset.key);
        if(i <= 0) return;
        const newKeys = [...keys];
        [newKeys[i - 1], newKeys[i]] = [newKeys[i], newKeys[i - 1]];
        applyReorder(newKeys);
      });
    });

    el.querySelectorAll(".playlist-move-down").forEach(btn => {
      btn.addEventListener("click", () => {
        const i = keys.indexOf(btn.dataset.key);
        if(i === -1 || i >= keys.length - 1) return;
        const newKeys = [...keys];
        [newKeys[i + 1], newKeys[i]] = [newKeys[i], newKeys[i + 1]];
        applyReorder(newKeys);
      });
    });

    el.querySelectorAll(".playlist-song-remove").forEach(btn => {
      btn.addEventListener("click", async () => {
        if(!confirm(`「${btn.dataset.title}」をリストから削除しますか？`)) return;

        if(btn.dataset.key === nowPlayingKey){
          stopPlaylistPlayback();
        }

        await window.vsongPlaylists.removeSongFromPlaylist(
          uid, playlistId, btn.dataset.title, btn.dataset.artist, btn.dataset.videoId, btn.dataset.time
        );
      });
    });

    let dragSrcKey = null;

    el.querySelectorAll(".playlist-song-row").forEach(row => {
      row.addEventListener("dragstart", () => {
        dragSrcKey = row.dataset.key;
        setTimeout(() => row.classList.add("dragging"), 0);
      });

      row.addEventListener("dragend", () => {
        row.classList.remove("dragging");
        el.querySelectorAll(".playlist-song-row").forEach(r => r.classList.remove("drag-over-top", "drag-over-bottom"));
      });

      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        if(row.dataset.key === dragSrcKey) return;

        const rect = row.getBoundingClientRect();
        const isTopHalf = (e.clientY - rect.top) < rect.height / 2;

        el.querySelectorAll(".playlist-song-row").forEach(r => r.classList.remove("drag-over-top", "drag-over-bottom"));
        row.classList.add(isTopHalf ? "drag-over-top" : "drag-over-bottom");
      });

      row.addEventListener("dragleave", () => {
        row.classList.remove("drag-over-top", "drag-over-bottom");
      });

      row.addEventListener("drop", (e) => {
        e.preventDefault();
        const targetKey = row.dataset.key;
        row.classList.remove("drag-over-top", "drag-over-bottom");
        if(dragSrcKey === targetKey) return;

        const rect = row.getBoundingClientRect();
        const isTopHalf = (e.clientY - rect.top) < rect.height / 2;

        const newKeys = keys.filter(k => k !== dragSrcKey);
        let targetIndex = newKeys.indexOf(targetKey);
        if(!isTopHalf) targetIndex += 1;
        newKeys.splice(targetIndex, 0, dragSrcKey);
        applyReorder(newKeys);
      });
    });
  });
}

document.getElementById("newPlaylistBtn").addEventListener("click", async () => {
  const name = prompt("新しいリスト名を入力してください");
  if(!name) return;

  const uid = window.vsongAuth.auth.currentUser.uid;
  const newId = await window.vsongPlaylists.createPlaylist(uid, name);
  expandedPlaylistId = newId;
});

function openSettingsModal(){
  document.getElementById("settingsDeleteMsg").textContent = "";

  const hasRecoveryEmail = !window.vsongAuth.auth.currentUser.email.endsWith("@vsong-list.internal");
  document.getElementById("settingsEmailStatus").textContent = hasRecoveryEmail
    ? `登録済み: ${window.vsongAuth.auth.currentUser.email}`
    : "未登録";

  document.getElementById("settingsModal").classList.remove("hidden");
}

function closeSettingsModal(){
  document.getElementById("settingsModal").classList.add("hidden");
}

document.getElementById("settingsDeleteBtn").addEventListener("click", async () => {
  const msg = document.getElementById("settingsDeleteMsg");

  if(!confirm("本当にアカウントを削除しますか？ブックマーク・リストなど全てのデータが完全に削除され、元に戻せません。")){
    return;
  }

  try{
    await window.vsongAccount.deleteAccount();
    closeSettingsModal();
  }catch(e){
    msg.textContent = e.message || "エラーが発生しました";
  }
});

function openPrivacyModal(){
  document.getElementById("privacyModal").classList.remove("hidden");
}

function closePrivacyModal(){
  document.getElementById("privacyModal").classList.add("hidden");
}

let ytPlayer = null;
let ytPlayerReady = false;
let pendingPlaylistPlay = null;

let queueKeys = [];
let isShuffleOn = false;
let repeatMode = "off"; // "off" | "all" | "one"
let playlistSeekTimer = null;
let currentSongStartSec = 0;
let currentSongEndSec = null;
let currentPlaylistId = null;

function onYouTubeIframeAPIReady(){
  ytPlayer = new YT.Player("playlistPlayerVideo", {
    height: "100%",
    width: "100%",
    playerVars: { autoplay: 1, playsinline: 1, controls: 0 },
    events: {
      onReady: () => {
        ytPlayerReady = true;
        if(pendingPlaylistPlay){
          const req = pendingPlaylistPlay;
          pendingPlaylistPlay = null;
          playlistPlayVideo(req.videoId, req.startSeconds, req.endSeconds);
        }
      },
      onStateChange: onPlaylistPlayerStateChange
    }
  });
}

function playlistPlayVideo(videoId, startSeconds, endSeconds){
  if(!ytPlayerReady){
    pendingPlaylistPlay = { videoId, startSeconds, endSeconds };
    return;
  }

  const opts = { videoId, startSeconds: startSeconds || 0 };
  if(endSeconds){
    opts.endSeconds = endSeconds;
  }

  ytPlayer.loadVideoById(opts);
}

function ytTimeToSeconds(timeStr){
  const parts = timeStr.split(":").map(Number);
  return parts.reduce((acc, v) => acc * 60 + v, 0);
}

function formatSeekTime(sec){
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function ytTestEnd(videoId, endTimeStr, previewSeconds = 8){
  const endSec = ytTimeToSeconds(endTimeStr);
  const startSec = Math.max(0, endSec - previewSeconds);
  playlistPlayVideo(videoId, startSec, endSec);
}

function shuffleArray(arr){
  const a = arr.slice();
  for(let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function collectPlaylistSongsFromDOM(bodyEl){
  return Array.from(bodyEl.querySelectorAll(".playlist-play-in-app-btn")).map(b => ({
    key: b.dataset.key,
    videoId: b.dataset.videoId,
    time: b.dataset.time,
    endTime: b.dataset.endTime,
    title: b.dataset.title,
    artist: b.dataset.artist,
    note: b.dataset.note || ""
  }));
}

function startPlaylistSong(song){
  const startSec = ytTimeToSeconds(song.time);
  const endSec = song.endTime ? ytTimeToSeconds(song.endTime) : null;

  currentSongStartSec = startSec;
  currentSongEndSec = endSec;

  const seekEl = document.getElementById("playlistSeek");
  const songLength = endSec != null ? (endSec - startSec) : 100;
  seekEl.max = songLength;
  seekEl.value = 0;

  document.getElementById("playlistElapsed").textContent = "0:00";
  document.getElementById("playlistDuration").textContent = formatSeekTime(songLength);

  playlistPlayVideo(song.videoId, startSec, endSec);

  document.getElementById("playlistNowTitle").textContent = song.title + (song.note === "弾き語り" ? "（弾き語り）" : "");
  document.getElementById("playlistNowArtist").textContent = song.artist;

  document.querySelectorAll(".playlist-play-in-app-btn").forEach(b => {
    b.innerHTML = PLAY_ICON_SVG;
  });

  nowPlayingKey = song.key;
  document.querySelectorAll(".playlist-song-row").forEach(r => r.classList.toggle("now-playing", r.dataset.key === nowPlayingKey));

  updatePlaylistControlsEnabled(true);
}

function playPlaylistSongFrom(btn){
  const clickedKey = btn.dataset.key;

  if(clickedKey === nowPlayingKey && ytPlayer){
    const state = ytPlayer.getPlayerState();
    if(state === YT.PlayerState.PLAYING){
      ytPlayer.pauseVideo();
    }else{
      ytPlayer.playVideo();
    }
    return;
  }

  const body = btn.closest(".playlist-accordion-body");
  currentPlaylistId = body.dataset.bodyId;
  const allSongs = collectPlaylistSongsFromDOM(body);
  const eligibleBase = allSongs.filter(s => s.endTime);

  const clickedSong = eligibleBase.find(s => s.key === clickedKey);

  if(!clickedSong){
    queueKeys = [];
    const clicked = allSongs.find(s => s.key === clickedKey);
    if(clicked) startPlaylistSong(clicked);
    return;
  }

  if(isShuffleOn){
    const rest = eligibleBase.filter(s => s.key !== clickedKey).map(s => s.key);
    queueKeys = [clickedKey, ...shuffleArray(rest)];
  }else{
    queueKeys = eligibleBase.map(s => s.key);
  }

  startPlaylistSong(clickedSong);
}

function getPlaylistSongByKey(key){
  const body = document.querySelector(`.playlist-accordion-body[data-body-id="${currentPlaylistId}"]`);
  if(!body) return null;
  return collectPlaylistSongsFromDOM(body).find(s => s.key === key) || null;
}

function playlistNext(){
  if(queueKeys.length === 0) return;

  if(repeatMode === "one"){
    const song = getPlaylistSongByKey(nowPlayingKey);
    if(song) startPlaylistSong(song);
    return;
  }

  let idx = queueKeys.indexOf(nowPlayingKey);
  idx++;
  if(idx >= queueKeys.length){
    if(repeatMode !== "all") return;
    idx = 0;
  }

  const song = getPlaylistSongByKey(queueKeys[idx]);
  if(song) startPlaylistSong(song);
}

function playlistPrev(){
  if(queueKeys.length === 0) return;

  let idx = queueKeys.indexOf(nowPlayingKey);
  idx--;
  if(idx < 0){
    if(repeatMode !== "all") return;
    idx = queueKeys.length - 1;
  }

  const song = getPlaylistSongByKey(queueKeys[idx]);
  if(song) startPlaylistSong(song);
}

function updatePlaylistPlayIcon(isPlaying){
  const bottomBtn = document.getElementById("playlistPlayPauseBtn");
  bottomBtn.innerHTML = isPlaying ? PAUSE_ICON_SVG : PLAY_ICON_SVG;

  if(nowPlayingKey){
    const rowBtn = document.querySelector(`.playlist-play-in-app-btn[data-key="${nowPlayingKey}"]`);
    if(rowBtn){
      rowBtn.innerHTML = isPlaying ? PAUSE_ICON_SVG : PLAY_ICON_SVG;
    }
  }
}

function startPlaylistSeekTimer(){
  clearInterval(playlistSeekTimer);
  playlistSeekTimer = setInterval(() => {
    if(!ytPlayer || typeof ytPlayer.getCurrentTime !== "function") return;
    const seekEl = document.getElementById("playlistSeek");
    if(document.activeElement === seekEl) return;

    const songLength = (currentSongEndSec != null)
      ? currentSongEndSec - currentSongStartSec
      : (ytPlayer.getDuration() || 0) - currentSongStartSec;

    const current = (ytPlayer.getCurrentTime() || 0) - currentSongStartSec;

    if(songLength > 0){
      seekEl.max = songLength;
      seekEl.value = Math.max(0, current);
      document.getElementById("playlistElapsed").textContent = formatSeekTime(Math.max(0, current));
    }
  }, 500);
}

function stopPlaylistSeekTimer(){
  clearInterval(playlistSeekTimer);
}

function stopPlaylistPlayback(){
  if(ytPlayer && typeof ytPlayer.stopVideo === "function"){
    ytPlayer.stopVideo();
  }

  queueKeys = [];
  nowPlayingKey = null;
  currentPlaylistId = null;
  currentSongStartSec = 0;
  currentSongEndSec = null;

  document.getElementById("playlistNowTitle").textContent = "再生する曲を選んでください";
  document.getElementById("playlistNowArtist").textContent = "";
  document.getElementById("playlistElapsed").textContent = "0:00";
  document.getElementById("playlistDuration").textContent = "0:00";

  const seekEl = document.getElementById("playlistSeek");
  seekEl.value = 0;
  seekEl.max = 100;

  updatePlaylistPlayIcon(false);
  stopPlaylistSeekTimer();

  document.querySelectorAll(".playlist-song-row").forEach(r => r.classList.remove("now-playing"));

  updatePlaylistControlsEnabled(false);
}

function updatePlaylistControlsEnabled(enabled){
  ["playlistPlayPauseBtn", "playlistNextBtn", "playlistPrevBtn", "playlistBack10Btn", "playlistFwd10Btn", "playlistSeek", "playlistShuffleBtn", "playlistRepeatBtn"].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.disabled = !enabled;
  });
}

function reconcilePlaylistQueue(currentKeys){
  if(!isShuffleOn){
    queueKeys = currentKeys;
    return;
  }

  const idx = queueKeys.indexOf(nowPlayingKey);
  const before = idx >= 0 ? queueKeys.slice(0, idx + 1).filter(k => currentKeys.includes(k)) : [];
  let after = queueKeys.slice(idx + 1).filter(k => currentKeys.includes(k));

  const known = new Set(queueKeys);
  const newKeys = currentKeys.filter(k => !known.has(k));

  newKeys.forEach(k => {
    const pos = Math.floor(Math.random() * (after.length + 1));
    after.splice(pos, 0, k);
  });

  queueKeys = before.concat(after);
}

let endedAdvancePending = false;

function onPlaylistPlayerStateChange(event){
  if(event.data === YT.PlayerState.PLAYING){
    updatePlaylistPlayIcon(true);
    startPlaylistSeekTimer();
    endedAdvancePending = false;
  }

  if(event.data === YT.PlayerState.PAUSED){
    updatePlaylistPlayIcon(false);
    stopPlaylistSeekTimer();
  }

  if(event.data === YT.PlayerState.ENDED){
    updatePlaylistPlayIcon(false);
    stopPlaylistSeekTimer();

    if(endedAdvancePending) return;
    endedAdvancePending = true;

    setTimeout(() => {
      playlistNext();
    }, 500);
  }
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".playlist-play-in-app-btn");
  if(!btn) return;
  playPlaylistSongFrom(btn);
});

document.getElementById("playlistPlayPauseBtn").addEventListener("click", () => {
  if(!ytPlayer) return;

  const state = ytPlayer.getPlayerState();
  if(state === YT.PlayerState.PLAYING){
    ytPlayer.pauseVideo();
  }else{
    ytPlayer.playVideo();
  }
});

document.getElementById("playlistNextBtn").addEventListener("click", playlistNext);
document.getElementById("playlistPrevBtn").addEventListener("click", playlistPrev);

document.getElementById("playlistShuffleBtn").addEventListener("click", (e) => {
  isShuffleOn = !isShuffleOn;
  e.currentTarget.classList.toggle("active", isShuffleOn);

  if(queueKeys.length === 0) return;

  const idx = queueKeys.indexOf(nowPlayingKey);
  const played = idx >= 0 ? queueKeys.slice(0, idx + 1) : [];
  const playedSet = new Set(played);

  let remaining;

  if(isShuffleOn){
    remaining = shuffleArray(queueKeys.slice(idx + 1));
  }else{
    const body = document.querySelector(`.playlist-accordion-body[data-body-id="${currentPlaylistId}"]`);
    const naturalOrder = body ? collectPlaylistSongsFromDOM(body).filter(s => s.endTime).map(s => s.key) : queueKeys;
    remaining = naturalOrder.filter(k => !playedSet.has(k));
  }

  queueKeys = played.concat(remaining);
});

const REPEAT_ONE_ICON_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/><text x="12" y="15" font-size="9" fill="currentColor" stroke="none" text-anchor="middle">1</text></svg>';

const REPEAT_ALL_ICON_SVG = document.getElementById("playlistRepeatBtn").innerHTML;

document.getElementById("playlistRepeatBtn").addEventListener("click", (e) => {
  if(repeatMode === "off"){
    repeatMode = "all";
  }else if(repeatMode === "all"){
    repeatMode = "one";
  }else{
    repeatMode = "off";
  }

  e.currentTarget.classList.toggle("active", repeatMode !== "off");
  e.currentTarget.innerHTML = repeatMode === "one" ? REPEAT_ONE_ICON_SVG : REPEAT_ALL_ICON_SVG;
  e.currentTarget.title = repeatMode === "off" ? "ループ" : (repeatMode === "all" ? "全曲ループ" : "1曲ループ");
});

document.getElementById("playlistSeek").addEventListener("change", (e) => {
  if(!ytPlayer) return;
  const target = Number(e.target.value);
  ytPlayer.seekTo(currentSongStartSec + target, true);
  e.target.value = target;
  e.target.blur();
  document.getElementById("playlistElapsed").textContent = formatSeekTime(target);
});

document.getElementById("playlistBack10Btn").addEventListener("click", () => {
  if(!ytPlayer) return;
  const target = Math.max(currentSongStartSec, ytPlayer.getCurrentTime() - 10);
  ytPlayer.seekTo(target, true);
});

document.getElementById("playlistFwd10Btn").addEventListener("click", () => {
  if(!ytPlayer) return;
  const maxTime = currentSongEndSec != null ? currentSongEndSec : (ytPlayer.getDuration() || Infinity);
  const target = Math.min(maxTime, ytPlayer.getCurrentTime() + 10);
  ytPlayer.seekTo(target, true);
});

updatePlaylistControlsEnabled(false);
