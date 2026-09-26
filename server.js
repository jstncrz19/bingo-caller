// Local dev server for the bingo caller.
//
//   node server.js            -> http://localhost:8080  (live reload on)
//
// GitHub Pages serves the static files directly, so this file is a local-only
// tool and is never part of the deployed site.
//
// Live reload uses Server-Sent Events, so there is no build step and no npm
// dependency. CSS edits are swapped in place (the game keeps running); JS/HTML
// edits trigger a full reload.

const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = process.env.PORT || 8080;
const liveReload = process.env.LIVE_RELOAD !== "0";

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".json": "application/json",
  ".md": "text/markdown; charset=utf-8",
};

// Injected into every HTML response. Keeps the page in sync with disk without
// a manual refresh. CSS is applied by swapping the <link> href, so an in-
// progress game is not lost while you restyle.
const reloadClient = `
<script>
(function () {
  if (window.__liveReload) return;
  window.__liveReload = true;
  var src = new EventSource("/__livereload");
  // The server sends unnamed events ("data: ..."), which the browser delivers
  // as type "message". Listening for "change" here would never fire.
  src.addEventListener("message", function (e) {
    var data = {};
    try { data = JSON.parse(e.data); } catch (err) {}
    if (data.type === "css" && data.file) {
      var links = document.querySelectorAll('link[rel="stylesheet"]');
      for (var i = 0; i < links.length; i++) {
        if (links[i].href.indexOf(data.file) === -1) continue;
        var next = links[i].cloneNode();
        next.href = data.file + "?live=" + Date.now();
        next.addEventListener("load", function () { console.log("[live reload] css " + data.file); });
        next.addEventListener("error", function () { location.reload(); });
        links[i].parentNode.replaceChild(next, links[i]);
      }
      return;
    }
    console.log("[live reload] reloading (" + (data.file || "change") + ")");
    location.reload();
  });
  src.addEventListener("open", function () { console.log("[live reload] watching for changes"); });
})();
</script>
`;

function injectReload(html) {
  if (!liveReload || html.includes("__liveReload")) return html;
  // Before </head> when possible so it does not disturb </body>-relative markup.
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, reloadClient + "\n</head>");
  return reloadClient + html;
}

// ---------------------------------------------------------------- live reload
const clients = new Set();

function broadcast(payload) {
  const line = "data: " + JSON.stringify(payload) + "\n\n";
  for (const res of clients) {
    try { res.write(line); } catch (e) { clients.delete(res); }
  }
}

// Only the files that affect what the browser renders. audio/ is deliberately
// excluded: regenerating 75 WAVs should not trigger reloads.
const watchedDirs = ["css", "js", "icons"];
const watchedFiles = ["index.html", "cards.html", "version.json"];
let debounce = null;

function scheduleChange(rel) {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    broadcast({ type: path.extname(rel) === ".css" ? "css" : "full", file: "/" + rel.split(path.sep).join("/") });
  }, 120);
}

for (const dir of watchedDirs) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) continue;
  try {
    fs.watch(abs, { recursive: true }, (_event, filename) => {
      if (!filename) return scheduleChange(path.join(dir, ""));
      scheduleChange(path.join(dir, filename.toString()));
    });
  } catch (e) {
    console.warn("live reload: cannot watch " + dir + " (" + e.message + ")");
  }
}

for (const file of watchedFiles) {
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) continue;
  try {
    fs.watch(abs, () => scheduleChange(file));
  } catch (e) {
    console.warn("live reload: cannot watch " + file + " (" + e.message + ")");
  }
}

// ---------------------------------------------------------------------- server
http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);

    if (urlPath === "/__livereload") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      });
      res.write("retry: 1000\n\n");
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }

    let file = path.join(root, urlPath === "/" ? "index.html" : urlPath);
    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const ext = path.extname(file);
      const headers = {
        "Content-Type": types[ext] || "application/octet-stream",
        // index.html references css/js with a ?v= build stamp. Without no-store
        // the browser can keep serving the stamped copy after you edit the file.
        "Cache-Control": "no-store, must-revalidate",
      };

      if (ext === ".html") {
        const html = injectReload(data.toString("utf8"));
        res.writeHead(200, headers);
        res.end(html);
        return;
      }

      res.writeHead(200, headers);
      res.end(data);
    });
  })
  .listen(port, () => {
    console.log(`Bingo caller running at http://localhost:${port}`);
    if (liveReload) console.log("Live reload is on - edit css/styles.css and the browser updates itself.");
    else console.log("Live reload is off (LIVE_RELOAD=0).");
  });
