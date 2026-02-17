# Freemind Viewer

A modern, web-based viewer for Freemind (.mm) files.

## Features
- **Modern UI**: Clean design with vibrant colors.
- **Interactive**: Zoom, pan, and collapsible nodes.
- **Drag & Drop**: Easily upload your `.mm` files.
- **Links Support**: Clickable links within mind map nodes.

## How to use
1. Install dependencies:
   ```bash
   npm install
   ```
2. Run locally:
   ```bash
   npm run dev
   ```
3. Build for production:
   ```bash
   npm run build
   ```

## Hosting
To host your files:
1. Place your `.mm` files in the `public/` directory (or host them elsewhere with CORS enabled).
2. Access specifically hosted files via URL parameter: `/?url=filename.mm` (e.g. `http://localhost:5173/?url=demo.mm`).
3. Or simply open the app and upload the file from your computer.

## Technologies
- React + Vite
- D3.js (Layout & Logic)
- Framer Motion (Animations)
- Lucide React (Icons)
