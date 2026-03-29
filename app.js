let data = [];

const STORAGE_KEY = "tableTheme";

function getTheme(){
  const saved = localStorage.getItem(STORAGE_KEY);
  if(saved) return saved;

  if(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches){
    return "dark";
  }

  return "light";
}

function applyTheme(){
  const theme = getTheme();

  document.getElementById("songsTable").classList.toggle("light", theme === "light");
  document.getElementById("artistsTable").classList.toggle("light", theme === "light");

  document.body.classList.toggle("streams-light", theme === "light");
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
  document.getElementById("themeToggleArtists").checked = isLight;
  document.getElementById("themeToggleStreams").checked = isLight;
}

fetch("data.json")
  .then(r => r.json())
  .then(j => {
    data = j;
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

/* 以下既存そのまま */

document.getElementById("themeToggleSongs").addEventListener("change", toggleTheme);
document.getElementById("themeToggleArtists").addEventListener("change", toggleTheme);
document.getElementById("themeToggleStreams").addEventListener("change", toggleTheme);