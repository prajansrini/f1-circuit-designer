# F1 Circuit Designer 🏎️

![HTML5 Canvas](https://img.shields.io/badge/HTML5-Canvas-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![Vanilla JS](https://img.shields.io/badge/Vanilla_JS-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)

A powerful, browser-based 2D vector graphic editor and track design application built specifically for creating, styling, and analyzing custom motorsport circuits.

With a rich suite of drawing tools, advanced mathematical spline interpolation, and an intuitive UI, **F1 Circuit Designer** empowers motorsport enthusiasts to draft professional-grade track layouts, configure technical sectors, and export gorgeous, high-resolution SVG track maps.


[Try it live here!](https://prajansrini.github.io/f1-circuit-designer/)

---

## ✨ Complete Feature Breakdown

### 🖌️ Circuit Drafting & Geometry Tools
- **Draw Tool:** Freehand draw your track layout on the grid. Automatically converts raw mouse input into a smoothed, continuous geometric path.
- **Node Tool:** Fine-tune corner angles and straightaways by dragging, snapping, and modifying the bezier-like control points. Uses Catmull-Rom spline mathematics to prevent overlapping tight corners.
- **Width Tool:** Dynamically thicken or narrow specific sections of the track. Create tight chicanes, wide hairpin entries, or standard straights with smooth width interpolation.
- **Scale Tool:** Precisely scale the entire circuit geometry up or down to match real-world measurement constraints.
- **Eraser Tool:** Easily remove specific segments or nodes from the track path.

### 🏁 Professional Motorsport Decorators
- **Sector Tool:** Paint and define Sector 1, Sector 2, and Sector 3 directly onto the track geometry for timing analysis.
- **Turn Index Tool:** Automatically generate or manually place sequential corner numbers (T1, T2, T3) along the racing line.
- **Pit Lane Tool:** Draw a pit lane that intelligently snaps and blends into the main circuit geometry at both entry and exit.
- **Surface Painter Tool:** Paint custom surfaces alongside the track. Add vibrant runoff areas, realistic kerbs, or different tarmac styles to distinct corners.
- **Zone Tool (DRS & 2026 Aero):** Define DRS activation zones and the upcoming 2026 active-aero "Straight Mode" zones directly onto the straights.
- **Garage Tool:** Place starting grid slots and pit garages into your paddock area.

### 🎨 UI & Workspace Management
- **Split-Screen Workspace:** Work on the raw, grid-based editor on the left while instantly seeing a beautifully styled, polished version of the track in the Live Preview on the right.
- **Bridge & Overpass Engine:** The engine automatically detects track intersections and smartly renders overpasses and bridges, allowing for complex Figure-8 style tracks like Suzuka.
- **Multi-Project Tabs:** Open, edit, and switch between multiple track layouts simultaneously within the browser without losing progress.
- **Save/Load System:** Serialize complex track geometry and metadata into JSON to save locally or share with other track designers.
- **Undo/Redo Stack:** A robust history system allows you to revert node movements, surface paints, and drawing mistakes.

### 📸 High-Resolution SVG Exporting
- Export your finished circuit as a beautifully styled, infinitely scalable Vector Graphic (`.svg`).
- Interactive Export Modal: Adjust the background color, track line color, and text colors prior to export.
- Click and drag the track name, legend, and UI elements to position them perfectly before saving.
- Perfect for creating Wikipedia-style track maps, graphic design assets, or concept portfolios.

### 🏎️ Built-In Hotlap Simulator
- Validate your circuit geometry by deploying an AI point-mass car onto the track.
- Analyzes corner radii to calculate true-to-life apex speeds and braking points.
- Features a strict **2026 Technical Regulations** mode that mathematically simulates a 400 kW ICE and 350 kW MGU-K hybrid energy recovery/deployment system (with BOOST and OVERTAKE modes).
- Includes a live telemetry HUD showing real-time Battery SOC, G-forces, and Sector timing.

---

## 🚀 Setup & Installation

This project is built purely with Vanilla JavaScript, HTML5 Canvas, and CSS3. There are no heavy frameworks, Webpack configurations, or NPM dependencies required to run the core app!

1. **Clone the repository**
   ```bash
   git clone https://github.com/prajansrini/f1-circuit-designer.git
   cd f1-circuit-designer
   ```

2. **Run a local development server**
   Because the app utilizes ES6 Modules and fetches local JSON resources, it must be served over HTTP/HTTPS, not directly from the file system (`file://`).
   
   If you have Python installed:
   ```bash
   python3 -m http.server 8080
   ```
   *Alternatively, you can use the Live Server extension in VS Code, or Node's `http-server`.*

3. **Open in Browser**
   Navigate to `http://localhost:8080` in your preferred modern web browser.

---

## 📂 Architecture & Project Structure

The codebase is heavily modularized to separate application state, canvas rendering, and mathematical calculations:

```text
├── index.html                 # Main application entry point & glassmorphism UI layout
├── index.css                  # Custom styling, dark mode themes, and CSS grids
├── js/
│   ├── app.js                 # Application state, project tabs, and event wiring
│   ├── canvas-renderer.js     # Heavy-lifting HTML5 Canvas drawing (Grid, Splines, Intersections)
│   ├── circuit-data.js        # Core data structure, JSON serialization, and Undo/Redo stack
│   ├── tools.js               # Polymorphic tool implementations (Draw, Select, Node, Zone, etc.)
│   ├── preview-renderer.js    # Clean, styled map rendering without editor UI overlays
│   ├── svg-exporter.js        # Mathematical logic for converting canvas paths to SVG markup
│   ├── ui-manager.js          # Properties panel updates and DOM state management
│   └── hotlap-simulator.js    # Bonus feature: Kinematic physics engine for track validation
└── resources/                 # Example track JSONs (e.g., Ovals, Technical Circuits)
```

---

## 📜 License

This project is open-source and available under the [MIT License](LICENSE). 

*Disclaimer: This is a fan-made application and is not affiliated with, endorsed by, or sponsored by Formula One World Championship Limited or the FIA.*