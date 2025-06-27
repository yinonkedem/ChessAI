# ♟️ Chess AI – Play, Learn, Evolve

A full-stack **chess playground powered by Stockfish** – built to help players *and* engineers push the limits of the 64-square universe. Play against a world-class engine, sculpt bespoke positions, or request laser-accurate hints in a single click. Deployed in minutes, designed for years of AI-driven evolution.

---

## ✨ Why this project matters

* **Instant grand-master moves** – Stockfish 16 runs server-side for speed, fairness, and the option to crank depth without melting the browser.
* **Custom-mode sandbox** – Drag pieces anywhere, recreate famous games, or test wild novelties. Hit *Start* and the engine fights back from *your* position.
* **Hint instead of hand-holding** – Tap *Get Hint* to receive the single best move, then decide whether to follow master advice or blaze your own trail.
* **Cloud native from day 0** – FastAPI back end lives on **Render**; React front end ships via **Vercel** for worldwide edge delivery.
* **AI career showcase** – Clean architecture, typed code, CI/CD, containerisation and an ambitious roadmap (see below) demonstrate real-world AI software craft.

---

## 🚀 Live demo

| Front end | Back-end API |
|-----------|--------------|
| **https://yinon-chess-ai.vercel.app/** | **https://yinonchessai.onrender.com/docs** |

*(Both services spin up cold-start containers; the first request may take a few seconds.)*

---

## 🧩 Stack & architecture

| Layer | Tech                                | Highlights |
|-------|-------------------------------------|------------|
| **Front end** | React 18, Node.js, Tailwind CSS     | Web-worker offloads board logic; state managed with Zustand; fully responsive |
| **Engine service** | FastAPI, python-chess, Stockfish 16 | Dockerised; async REST endpoint `/engine/best-move` streams UCI |
| **CI/CD** | GitHub Actions                      | Lint ➜ unit tests ➜ Docker build ➜ deploy to Render/Vercel |
| **Dev ops** | Docker + docker-compose             | One-command spin-up for local hacking |
| **Testing** | React Testing Library, Pytest       | Protects game logic and REST contract |

