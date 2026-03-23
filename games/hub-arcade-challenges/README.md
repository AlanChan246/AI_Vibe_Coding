# The Alvin Chan expirenement — Web Game

Play in a **browser over HTTP** (recommended). Opening `index.html` directly as a file sometimes blocks scripts; serving the folder fixes that.

## Run locally

**Option A — Node (best)**  
Install [Node.js](https://nodejs.org), then in this folder:

```bash
npm install
npm start
```

Open **http://localhost:3000**.

**Option B — Windows**  
Double-click **`run-web.bat`** (uses local `serve` if you ran `npm install`, else `npx serve`, else Python’s HTTP server on port 3000).

**Option C — Python only**

```bash
python -m http.server 3000
```

Then open **http://localhost:3000**.

## Host online

This is static HTML/CSS/JS. Upload the **whole project folder** (except `node_modules` if you use a host that installs deps) to:

- [Netlify](https://www.netlify.com/) — drag-and-drop the folder, or connect Git; `netlify.toml` is included.
- [GitHub Pages](https://pages.github.com/) — publish the repo root as the site root.
- [Cloudflare Pages](https://pages.cloudflare.com/) — same idea, static publish.

Keep `index.html` at the site root and preserve the `css/` and `js/` paths.
