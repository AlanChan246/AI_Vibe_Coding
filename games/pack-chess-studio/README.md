# 3D Gomoku (8×8×8)

Vanilla HTML/CSS/JavaScript **three-dimensional Gomoku** on an **8×8×8** cube: **Dog vs Cat**, **five in a row** along any straight line — including **depth** and **3D diagonals** (13 direction families).

Placing a piece plays a short **synthesized dog bark** (dog) or **cat-like meow** (cat) via the Web Audio API—no sound files required; the audio context unlocks after your first tap or click on the board or **New game**.

The **cube is drawn in perspective** on the canvas: **lattice dots**, a **wireframe hull**, **depth-sorted** dog/cat pieces, and a **translucent highlight plane** for the chosen Z slice. **Drag** on the board to **orbit** the camera; **click** the **front-most** cell under the cursor (within the pick radius) to play. **◀ / ▶** change only the **highlighted depth** (visual aid). The **board is drawn on an HTML canvas** (wood texture, hover preview on empty cells).

Choose **Two players** or **vs Computer** (you play Dog; Cat is a simple 3D heuristic AI). Player stats use the key `gomoku_3d_v1` in `localStorage` (separate from any older 2D saves).

## Run

- Open `index.html` in a modern browser (double-click or drag into the window), or
- From this folder: `npx --yes serve .` then visit the URL shown.

## Street Brawl (fighting game)

A separate **canvas fighting game** lives in **`street-fighter/`**: open `street-fighter/index.html` for local **1v1** (keyboard) or toggle **vs CPU**. Movement, jump, crouch, punch/kick, health bars, round timer, and K.O. / time-over outcomes.

## Balloon Zoo (kids)

A separate mini-game lives in **`balloon-game/`**: open `balloon-game/index.html` in your browser (inflate → numbered twists → cartoon balloon animals, with Web Audio “happy sounds”).

## Stats

Enter names for Dog and Cat (defaults: Dog / Cat). Wins, losses, and draws are stored per name on this device. The leaderboard sorts players by wins.
