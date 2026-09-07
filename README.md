# Evergarden Font Manager

A lightweight, local-first font manager and typography studio built for creative professionals and developers.

Evergarden Font Manager provides high-performance local font intelligence: scanning system and custom directories, extracting rich OpenType typography metadata, categorizing typefaces, and rendering live previews with comprehensive OpenType feature controls. All data stays 100% offline on your device in a local SQLite database.

---

## Features

- ⚡ **Ultra-Lightweight & Fast**: Powered by **Tauri v2 + Rust** with an ~11.9 MB standalone portable Windows executable (no installer bloat, no background services).
- 🔍 **Instant Font Library & Search**: Real-time scanning and filesystem watching with fuzzy search across font families, categories, weights, and styles.
- 🎨 **Font Pairing Studio**: Interactive dual-font typography canvas with business card and branding specimen previews, live customizable text, and instant pairing shuffle.
- 🔠 **Deep OpenType Feature Exploration**:
  - Full detection and toggle controls for **Ligatures** (`liga`, `dlig`, `hlig`, `calt`, `clig`), **Stylistic Sets** (`ss01`–`ss20`), **Character Variants** (`cv01`–`cv99`), **Numbers & Fractions** (`lnum`, `onum`, `pnum`, `tnum`, `frac`, `zero`, `ordn`), **Small Caps** (`smcp`, `c2sc`), and **Spacing** (`kern`, `cpsp`).
  - Interactive on/off comparison previews with tailored specimen pangrams.
- 📐 **Detailed Typeface Inspector**:
  - **Specimen View**: Live custom preview text across arbitrary font sizes, line heights, and letter spacing.
  - **Glyphs Matrix**: Unicode character set map and glyph coverage browser.
  - **Waterfall Preview**: Multi-step cascading font scale specimen.
  - **Font Metadata & Pairing Suggestions**: File paths, UPM, PostScript names, weight, style variants, and local/Google Fonts pairing suggestions.
- 🪟 **Refined Frameless Interface**:
  - Streamlined `h-14` landing header with custom circular aspect-square window controls.
  - Floating frosted-glass indexing status pill in the bottom-right corner.
  - Contextual UI: Clean canvas experience in Font Detail and Font Pairing views.
  - Native right-click context menu suppressed for a clean app experience.
- 🔒 **Privacy-First & Offline**: Zero telemetry, zero external database dependencies.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Core & Backend** | Rust, [Tauri v2](https://v2.tauri.app/), `ttf-parser` (SFNT/OpenType parsing), `rusqlite` (bundled SQLite3), `notify` (filesystem watching) |
| **Frontend Framework** | React 19, TypeScript, Vite 7 |
| **Styling & UI** | Tailwind CSS v4, `@base-ui/react`, `@radix-ui/react`, `@remixicon/react` |
| **Virtualization** | `react-window` |

---

## Getting Started

### Prerequisites

- **Node.js**: v20 or higher
- **Package Manager**: [pnpm](https://pnpm.io/) (`pnpm v10+`)
- **Rust Toolchain**: `rustc` and `cargo` ([rustup.rs](https://rustup.rs/))
- **Windows Build Tools**: C++ build tools for Visual Studio / MSVC

### Installation

```bash
# Clone the repository
git clone https://github.com/thevioletto/evergarden-font-manager.git
cd evergarden-font-manager

# Install dependencies
pnpm install
```

### Development

```bash
# Start Tauri development mode (launches Rust backend + Vite dev server)
pnpm dev

# Run Vite frontend dev server only
pnpm dev:react
```

### Icon Generation

Runtime and app icons are generated automatically from `assets/icon-1024.png`:

```bash
pnpm icons
```

### Production Build (Standalone Portable Executable)

```bash
# Compiles the optimized standalone Windows portable binary
pnpm build
```

The output executable will be generated at:
```
src-tauri/target/release/evergarden-font-manager.exe
```

---

## Release Pipeline

Automated GitHub Actions workflow (`.github/workflows/release-win.yml`) builds and publishes the standalone portable Windows executable upon git tag creation:

```bash
git tag v0.1.1
git push origin v0.1.1
```

---

## License

MIT License © [Manju Madhav V A](https://github.com/thevioletto)
