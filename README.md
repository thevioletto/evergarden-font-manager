# Evergarden Font Manager

Evergarden Font Manager is a local-first desktop application for Windows designed to organize, inspect, and preview fonts installed on your computer or stored in custom directories.

It uses a high-performance Rust backend powered by Tauri v2 to parse font binaries directly and cache metadata in a local SQLite database. This allows large font libraries (thousands of fonts) to load instantly and search smoothly without memory overhead or background services.

---

## What It Does

- **Local Font Library**: Automatically scans standard Windows font directories (`C:\Windows\Fonts` and user font locations) as well as custom user-added folders. A background filesystem watcher detects newly added or removed font files in real-time.
- **OpenType Feature Inspection**: Parses OpenType layout tables (`GSUB` and `GPOS`) directly from font binaries to detect supported typography features:
  - Ligatures (standard, discretionary, historical, contextual)
  - Stylistic Sets (`ss01` through `ss20`)
  - Character Variants (`cv01` through `cv99`)
  - Numeric variants (lining, oldstyle, proportional, tabular, fractions, slashed zero)
  - Small capitals and uppercase-to-small-caps
  - Kerning and capital spacing
  - Side-by-side on/off comparison previews with tailored pangrams and sample text.
- **Font Pairing Studio**: A side-by-side typography canvas to test pairing combinations (such as heading and body typefaces) against realistic specimens like branding cards and article paragraphs, complete with live editable text and a pairing shuffle tool.
- **Typeface Inspector**: In-depth inspection views for any font family:
  - **Specimen**: Custom preview text with adjustable font size, line height, and letter spacing.
  - **Glyphs Matrix**: Unicode character map and glyph coverage browser.
  - **Waterfall**: Multi-step scale specimen previewing legibility at cascading font sizes.
  - **Metadata**: Detailed font attributes including PostScript name, units per em (UPM), file paths, weight, and style variations.
- **Standalone Portable Binary**: Builds into a single lightweight executable (~12 MB) that runs directly without an installation wizard or registry pollution.

---

## Architecture & How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    React 19 Frontend                        │
│   (Vite 7, Tailwind CSS v4, Virtualized List / Canvas)      │
└──────────────────────────────┬──────────────────────────────┘
                               │ Tauri IPC / Asset Protocol
┌──────────────────────────────▼──────────────────────────────┐
│                     Rust Core (Tauri v2)                    │
│                                                             │
│  • ttf-parser        — Direct OpenType/TrueType binary read │
│  • SQLite (rusqlite) — Local metadata indexing and caching  │
│  • notify            — Filesystem watching for live updates │
│  • Asset Protocol    — Zero-copy local font streaming       │
└─────────────────────────────────────────────────────────────┘
```

### Backend (Rust + Tauri v2)

- **Binary Parsing (`ttf-parser`)**: Reads font files (`.ttf`, `.otf`, `.woff2`) to extract font family names, styles, weights, Unicode coverage, and OpenType lookup tables without relying on system font APIs.
- **Local Indexing (`rusqlite`)**: Stores parsed font metadata in a local SQLite database. Searches, filtering, and tag lookups query this index directly, eliminating the need to re-read font files on every startup.
- **Filesystem Watcher (`notify`)**: Monitors indexed font folders for file creation, modification, and deletion events, updating the database incrementally.
- **Asset Streaming**: Local font files are streamed to the webview using Tauri v2's native asset protocol (`convertFileSrc`), ensuring correct MIME types and fast memory-mapped font rendering.

### Frontend (React 19 + TypeScript + Vite 7)

- **Virtualized Rendering (`react-window`)**: Virtualizes the font grid so only visible font cards are rendered into the DOM, maintaining 60fps scrolling even with thousands of installed typefaces.
- **Dynamic Font Loading**: Fonts are dynamically registered into document stylesheets via CSS `@font-face` rules on demand as they scroll into view.

---

## Getting Started

### Prerequisites

- **Node.js**: v20 or higher
- **pnpm**: v10 or higher (`npm install -g pnpm`)
- **Rust Toolchain**: `rustc` and `cargo` (install via [rustup.rs](https://rustup.rs/))
- **Windows C++ Build Tools**: Visual Studio C++ build tools / MSVC toolchain

### Installation & Development

```bash
# Clone repository
git clone https://github.com/thevioletto/evergarden-font-manager.git
cd evergarden-font-manager

# Install frontend dependencies
pnpm install

# Start desktop app in development mode (Rust backend + Vite frontend)
pnpm dev
```

To run only the Vite frontend dev server (without the desktop window):

```bash
pnpm dev:react
```

### Building the Portable Executable

To compile the standalone Windows portable binary:

```bash
pnpm build
```

The output executable will be generated at:

```
src-tauri/target/release/evergarden-font-manager.exe
```

---

## Available Scripts

| Command            | Description                                                                    |
| ------------------ | ------------------------------------------------------------------------------ |
| `pnpm dev`         | Starts Tauri development mode with hot-reloading for frontend and backend      |
| `pnpm dev:react`   | Runs Vite frontend server in browser                                           |
| `pnpm build`       | Builds the optimized release portable `.exe` binary                            |
| `pnpm build:react` | Compiles the production React frontend bundle                                  |
| `pnpm icons`       | Generates application icons from `assets/icon-1024.png` into `src-tauri/icons` |
| `pnpm lint`        | Runs ESLint check across all TypeScript/React source files                     |
| `pnpm format`      | Formats all source files using Prettier                                        |

---

## Contributing

All active development takes place on the **`dev`** branch. Contributions, bug reports, and pull requests are welcome.

1. Fork the repository.
2. Create a feature branch off `dev`:
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feat/your-feature-name
   ```
3. Make your changes and test them locally (`pnpm dev`).
4. Ensure linting and frontend compilation pass:
   ```bash
   pnpm lint
   pnpm build:react
   ```
5. Commit your changes with clear, descriptive commit messages.
6. Open a Pull Request against the **`dev`** branch.

---

## License

This project is licensed under the [MIT License](LICENSE).
