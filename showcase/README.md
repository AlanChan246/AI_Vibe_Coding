# 作品展示入口（showcase）

## 目錄結構（整理後）

所有同學作品集中在 **`games/`**，採小寫 **kebab-case** 英文資料夾名，方便維護與 GitHub URL。

| 路徑 | 說明 |
|------|------|
| `games/hub-arcade-board/` | 原 `11/` · 多遊戲大廳 |
| `games/hub-board-games/` | 原 `New folder/` · 桌遊大廳 |
| `games/hub-casual/` | 原 `yg/` · 休閒大廳 |
| `games/hub-arcade-challenges/` | 原 `jayden lee npc expirement/` |
| `games/game-block-lab/` | 原 `fiveinarow/` 資料夾 · Block Lab（類 Minecraft 3D 建造） |
| `games/game-gomoku-five-in-row/` | 原 `67/` |
| `games/game-hurdles-run/` | 原 `hurdles running game/` |
| `games/game-subway-train/` | 原 `subwaytrain/` |
| `games/game-minesweeper/` | 原 `mines-game/` |
| `games/game-snake/` | 原 `貪食蛇/` |
| `games/pack-cc-mini/` | 原 `CC/` |
| `games/pack-chess-studio/` | 原 `Chess/` |

## 展示方式建議

| 方式 | 說明 |
|------|------|
| **離線本機（主推）** | 在「工作坊資料夾根目錄」啟動靜態伺服器，現場不依賴網路。 |
| **上線託管（可選）** | 將**整個工作坊資料夾**上傳至 GitHub Pages、Netlify、Cloudflare Pages 等，根目錄即網站根；網址為 `…/showcase/`。場地 Wi‑Fi 需穩定。 |

## 用 GitHub Pages 變成「一條連結給所有人」

可以。重點是：**整個工作坊資料夾的內容**要成為網站的根目錄（含 `showcase/`、`games/` 等），相對連結即可正常運作。

1. 在 [GitHub](https://github.com) 建立一個**新倉庫**（例如 `vibe-coding-showcase`），可設為 **Public**（免費 Pages 最省事；私人倉庫的 Pages 需視你的 GitHub 方案而定）。
2. 在本機工作坊**根目錄**初始化並推送（路徑請改成你的）：

```bash
cd ~/Desktop/學友社\ 青年\ AI\ Vibe\ Coding\ 工作坊
git init
git add .
git commit -m "Add workshop games and showcase"
git branch -M main
git remote add origin https://github.com/你的帳號/倉庫名.git
git push -u origin main
```

3. 到 GitHub 該倉庫：**Settings → Pages**。
4. **Build and deployment**：Source 選 **Deploy from a branch**，Branch 選 **`main`**，資料夾選 **`/ (root)`**，儲存。
5. 約 1～2 分鐘後，網站網址會是：

   - **展示頁：** `https://你的帳號.github.io/倉庫名/showcase/`
   - **捷徑：** 根目錄 `index.html` 會轉到 `showcase/`，也可分享：  
     `https://你的帳號.github.io/倉庫名/`

**若你曾用舊路徑（如根目錄的 `11/`、`Chess/`）分享過連結，改版後書籤會失效，請改用 `games/…` 新路徑。**

之後每次改檔：`git add` → `git commit` → `git push`，Pages 會自動更新。

**注意：** 現場完全靠這條連結時，**必須有網路**；若同學作品裡有寫死 `localhost` 或只適合 `file://` 的資源，在網上可能失效，上架後請用該 GitHub 網址實際點一輪測試。

## 如何開啟（本機）

1. 進入**工作坊根目錄**（須看到 `games/`、`showcase/` 等資料夾）。
2. 在終端機執行（埠號可自改）：

```bash
python3 -m http.server 8765
```

3. 瀏覽器開啟：<http://127.0.0.1:8765/showcase/>

**請勿**只用雙擊 `showcase/index.html`（`file://` 網址常導致腳本或模組無法載入）。

### 出現 `404 /showcase/`？

代表 **Python 不是在「工作坊根目錄」啟動的**。終端機若顯示 `~`（家目錄），請先切換目錄再開伺服器，例如：

```bash
cd ~/Desktop/學友社\ 青年\ AI\ Vibe\ Coding\ 工作坊
ls showcase
ls games
python3 -m http.server 8765
```

`ls games` 應能看到 `hub-arcade-board`、`pack-chess-studio` 等資料夾。

### 一鍵啟動（macOS）

- **建議：** 在 Finder 進入工作坊資料夾，雙擊根目錄的 `START-SHOWCASE.command`（若被系統阻擋，請「右鍵 → 開啟」允許一次）。
- 或雙擊 `showcase/start-showcase.command`（效果相同）。

### Windows（PowerShell）

在**工作坊根目錄**執行：

```powershell
python -m http.server 8765
```

然後用瀏覽器開啟 `http://127.0.0.1:8765/showcase/`。

或使用 `showcase/start-showcase.ps1`。

## 作品進入點盤點（給同工核對）

| 路徑 | 進入檔 | 需 build？ | 後端？ |
|------|--------|------------|--------|
| `showcase/` | `index.html` | 否 | 否 |
| `games/hub-arcade-board/` | `index.html`；格鬥為 `fighter.html` | 否 | 否 |
| `games/hub-board-games/` | `index.html` | 否 | 否 |
| `games/hub-casual/` | `index.html` | 否 | 否 |
| `games/hub-arcade-challenges/` | `index.html` | 否 | 否 |
| `games/game-block-lab/` | `index.html` | 否 | 否 |
| `games/game-gomoku-five-in-row/` | `index.html` | 否 | 否 |
| `games/game-hurdles-run/` | `index.html` | 否 | 否 |
| `games/game-subway-train/` | `index.html` | 否 | 否 |
| `games/game-minesweeper/` | `index.html` | 否 | 否 |
| `games/game-snake/` | `index.html` | 否 | 否 |
| `games/pack-cc-mini/` | `index.html`；RPG 為 `luminara.html` | 否 | 否 |
| `games/pack-chess-studio/` | `index.html`（3D 五子棋） | 否 | 否 |
| `games/pack-chess-studio/street-fighter/` | `index.html` | 否 | 否 |
| `games/pack-chess-studio/balloon-game/` | `index.html` | 否 | 否 |
| `games/pack-chess-studio/uci-points-race/web/` | `index.html` | 否 | 否（邏輯在瀏覽器） |
