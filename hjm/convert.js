const fs = require("fs");
const https = require("https");

const API_KEY = process.env.YOUTUBE_API_KEY;
const text = fs.readFileSync("songs.txt", "utf-8");
const lines = text.split(/\r?\n/);

let videoId = "";
let videoInfo = null;
const results = [];

function extractVideoId(url) {
  const patterns = [
    /[?&]v=([^&]+)/,
    /youtu\.be\/([^?&/]+)/,
    /youtube\.com\/live\/([^?&/]+)/,
    /youtube\.com\/embed\/([^?&/]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return "";
}

function fetchVideoInfo(videoId) {
  return new Promise((resolve, reject) => {
    if (!API_KEY) {
      reject(new Error("Missing YOUTUBE_API_KEY"));
      return;
    }

    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&id=${videoId}&key=${API_KEY}`;

    https.get(url, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const json = JSON.parse(data);

          if (!json.items || json.items.length === 0) {
            reject(new Error(`Invalid videoId: ${videoId}`));
            return;
          }

          const item = json.items[0];

          resolve({
            title: item.snippet.title,
            date:
              item.liveStreamingDetails?.actualStartTime
              || item.snippet.publishedAt
          });
        } catch (error) {
          reject(error);
        }
      });
    }).on("error", reject);
  });
}

function parseSongLine(line) {
  const timeMatch = line.match(/^(\d{1,2}:\d{2}:\d{2})\s+(.*)$/);
  if (!timeMatch) return null;

  const time = timeMatch[1];
  const rest = timeMatch[2];
  const separator = " / ";
  const idx = rest.lastIndexOf(separator);

  if (idx === -1) {
    return {
      time,
      title: rest.trim(),
      artist: ""
    };
  }

  return {
    time,
    title: rest.slice(0, idx).trim(),
    artist: rest.slice(idx + separator.length).trim()
  };
}

(async () => {
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("video:")) {
      const url = line.replace(/^video:\s*/, "");
      videoId = extractVideoId(url);
      videoInfo = await fetchVideoInfo(videoId);
      continue;
    }

    const parsed = parseSongLine(line);
    if (!parsed || !videoId || !videoInfo) continue;

    results.push({
      title: parsed.title,
      artist: parsed.artist,
      videoId,
      videoTitle: videoInfo.title,
      date: videoInfo.date,
      time: parsed.time
    });
  }

  fs.writeFileSync("data.json", JSON.stringify(results, null, 2));
})();
