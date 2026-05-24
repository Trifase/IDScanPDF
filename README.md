# IDScanPDF - Privacy-First Local ID Scanner & A4 PDF Compiler

A professional, 100% client-side web application designed to scan, warp, crop, filter, and arrange ID cards, receipts, or documents onto A4 sheets to export as high-quality PDFs or JPEGs.

Running entirely in the browser using vanilla JavaScript and HTML5 APIs, it requires **zero servers, zero backend connections, and zero tracking**—perfect for processing sensitive identity documents securely.

---

## 🚀 Key Features

### 🔒 100% Privacy-First (Local Execution)
- All image warping, pixel filtering, layout compilation, and exports occur locally in the client browser.
- Uses HTML5 `FileReader` and local canvas operations so data never leaves your device.
- No backend servers, no analytics, and no external tracking APIs.

### 📐 Projective Homography & Crop Warp Editor
- **Corner Handles Dragging**: Move four corner handles on the image to define precise boundaries.
- **Corner Magnifier Lens**: Displays a circular sub-pixel magnifier lens (2.5x visual zoom) showing the original uncompressed source photo pixels around the active handle for pixel-perfect adjustments.
- **Automatic Orientation Inversion**: Auto-detects portrait/landscape orientations of crop regions to swap presets automatically (e.g. ID-1 card landscape `1.58` aspect ratio -> portrait `0.63` aspect ratio).
- **Auto-Round Corners (Crop-Time)**: Checkbox to automatically mask card corners by 6% (standard ISO radius) using transparent alpha channels to block background clutter.
- **Ratio Presets**: Quick options for ID-1 cards (85.6mm x 54.0mm), A4 pages, Square (1:1), free aspect, and Custom numeric ratios.
- **Editor Zoom & Pan**: Zoom the editing area from 100% to 400% with scrollbars to inspect fine details on high-resolution camera uploads.

### 🎛️ Image Processing Filters & Adjustments
- **Filters**: Color, Grayscale, and Photocopy (high-contrast monochrome B&W thresholding).
- **Brightness & Contrast Sliders**: Fine-tune parameters (50% to 150%) across all modes in real-time. Adjusting brightness and contrast in Photocopy mode clears background shadows before thresholding.
- **Corner Rounding Slider**: Dynamically round card corners (0mm to 10mm) in the layout compiler.

### 📄 Interactive A4 Compile Workspace
- **Drag-and-Drop Page Layout**: Drag cropped cards directly from the gallery library onto virtual A4 sheets ($210\text{mm} \times 297\text{mm}$).
- **Multiple Page Sheets**: Add, delete, and manage multiple sheets easily.
- **Precise Millimeter Positioning**: Cards are sized, dragged, and aligned using real physical dimensions.
- **Millimeter Grid & Ruler**: Translucent millimetric grid with visual snap guides.
- **Auto-Arrangement Controls**: Align Center, ID Card Top-Half, ID Card Bottom-Half, and Auto-Grid arrangement (automatically aligns multiple cards in columns).
- **Layer & Depth Reordering**: Move cards forwards (over other layers) or backwards (under other layers) in depth. When Grid Layout is active, moving cards forwards/backwards instantly swaps their grid order.

### 📥 High-Resolution Exports (90% Quality)
- **PDF Export**: Generates A4 PDF documents with precise physical millimeter scaling using `jsPDF` at **100 pixels per cm** (254 DPI, i.e., $2100 \times 2970$ pixels) and **90% quality**.
- **Page JPEG Export**: Converts A4 compiler sheets into high-resolution `.jpg` downloads.
- **Single Card Download**: Hover over any cropped card in the gallery queue to download it directly as a full-resolution JPEG with corners cleanly filled with a white background.

---

## 🛠️ File Structure

- **`index.html`**: Structured semantic markup, glassmorphic dark-theme controls, and inline SVG assets. Imports `jsPDF` locally via a CDN.
- **`style.css`**: Professional UI styling containing dark-theme parameters, flex grids, responsive panels, glassmorphic headers, and repeating linear millimeter grid rules.
- **`app.js`**: Core javascript application containing the 2x2 projective homography solver, bilinear pixel sampling kernel, magnifier canvas zoom math, monochrome filter thresholding, drag-and-drop coordinates tracker, and export compilers.

---

## 🚀 How to Run

No installations, compile setups, or local servers are required!

1. Download or clone this repository.
2. Double-click `index.html` (or drag it into your web browser) to launch the app.
3. Upload ID card photos, crop them, arrange them on the A4 page compiler, and download your high-quality PDF/JPEGs.
