# pi-ui

A clean, mobile-first web dashboard for the **Pi coding agent** ecosystem.

Inspired by Claude Code Desktop and pipane, pi-ui gives you a beautiful, responsive interface to monitor and control your Pi coding agents from anywhere — especially from your phone.

## ✨ Features (MVP)

- **Mobile-first design** — Full-screen chat experience on phones with a clean sessions modal
- **Light theme** (dark mode coming later)
- **Sessions list** with status indicators (thinking, connected, idle)
- **Real-time style chat** with visible tool calls
- **Model selector** per session
- **Create / stop sessions** directly from the UI
- **Automatic session switching** via sidebar (desktop) or modal (mobile)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- pnpm or npm

### Installation

```bash
git clone https://github.com/claidler/pi-ui.git
cd pi-ui
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build

```bash
npm run build
```

## 🧱 Tech Stack

- **SvelteKit** (Svelte 5 runes)
- **Tailwind CSS**
- **TypeScript**
- Designed to work as a pure frontend (talks to Pi agents via WebSocket)

## 📱 Mobile Experience

- No persistent sidebar on mobile
- Tap the list icon to open a full-screen sessions modal
- Chat stays full screen and usable on phones
- Input bar stays docked at the bottom

## 🗺️ Roadmap

- [ ] Dark mode
- [ ] Real WebSocket connection to Pi coding agent
- [ ] Auto-discovery of agents
- [ ] Secure remote access (Tailscale / Cloudflare Tunnel integration)
- [ ] Push notifications
- [ ] File browser & code review tools

## 🤝 Contributing

This is currently a personal project, but contributions and ideas are welcome!

## License

MIT © [Chris Laidler](https://github.com/claidler)

---

**Built for the Pi coding agent community.**