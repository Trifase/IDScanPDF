/**
 * IDScanPDF - Privacy-First Local ID Scanner & PDF Compiler
 * Written in Vanilla JavaScript. Zero servers, completely local.
 */

// Application State
const state = {
  originals: [],         // { id, name, size, img }
  activeOriginalId: null, // Selected original image ID for cropping
  
  processedCards: [],    // { id, dataUrl, widthRatio, heightRatio, w_px, h_px }
  imageCache: {},        // cardId -> HTMLImageElement (for quick filter rendering)
  
  placedCards: [],       // { id, cardId, pageIndex, x, y, w, h, rotation, filter, threshold }
  activePlacedCardId: null,
  
  pagesCount: 1,         // Count of A4 sheets in workspace
  aspectRatioLocked: true,
  
  // Crop zoom settings
  cropZoom: 1.0,
  cropFitWidth: 0,
  cropFitHeight: 0,
  
  // Grid layout status tracker
  isGridAutoActive: false
};

// Handle Corners for Cropping (Normalized 0..1 coordinates)
let cropHandles = [
  { x: 0.1, y: 0.1 }, // TL
  { x: 0.9, y: 0.1 }, // TR
  { x: 0.9, y: 0.9 }, // BR
  { x: 0.1, y: 0.9 }  // BL
];

// Document Constants
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

// DOM Elements
const elements = {
  // Navigation Tabs
  tabBtnCrop: document.getElementById('tab-btn-crop'),
  tabBtnCompiler: document.getElementById('tab-btn-compiler'),
  cropPanel: document.getElementById('crop-panel'),
  compilerPanel: document.getElementById('compiler-panel'),
  
  // Upload
  fileInput: document.getElementById('file-input'),
  uploadDropzone: document.getElementById('upload-dropzone'),
  queueList: document.getElementById('queue-list'),
  galleryGrid: document.getElementById('gallery-grid'),
  galleryEmptyMsg: document.getElementById('gallery-empty-msg'),
  sidebarUploadSection: document.getElementById('sidebar-upload-section'),
  sidebarQueueSection: document.getElementById('sidebar-queue-section'),
  sidebarGallerySection: document.getElementById('sidebar-gallery-section'),
  
  // Crop Editor
  cropViewport: document.getElementById('crop-viewport'),
  cropEmptyNotice: document.getElementById('crop-empty-notice'),
  cropContainer: document.getElementById('crop-container'),
  cropCanvas: document.getElementById('crop-canvas'),
  handlesSvg: document.getElementById('handles-svg'),
  cropRatioPreset: document.getElementById('crop-ratio-preset'),
  cropCustomInputs: document.getElementById('crop-custom-ratio-inputs'),
  cropRatioW: document.getElementById('crop-ratio-w'),
  cropRatioH: document.getElementById('crop-ratio-h'),
  btnCropRotateCCW: document.getElementById('btn-crop-rotate-ccw'),
  btnSaveCrop: document.getElementById('btn-save-crop'),
  cropZoomSlider: document.getElementById('crop-zoom-slider'),
  cropZoomVal: document.getElementById('crop-zoom-val'),
  btnCropZoomIn: document.getElementById('btn-crop-zoom-in'),
  btnCropZoomOut: document.getElementById('btn-crop-zoom-out'),
  cropRoundCorners: document.getElementById('crop-round-corners'),
  
  // Magnifier
  magnifierLens: document.getElementById('magnifier-lens'),
  magnifierCanvas: document.getElementById('magnifier-canvas'),
  
  // Compiler Workspace
  compilerWorkspace: document.getElementById('compiler-workspace'),
  compilerEmptyNotice: document.getElementById('compiler-empty-notice'),
  pagesContainer: document.getElementById('pages-container'),
  btnAddPage: document.getElementById('btn-add-page'),
  toggleGrid: document.getElementById('toggle-grid'),
  btnClearWorkspace: document.getElementById('btn-clear-workspace'),
  
  // Inspector
  inspectorCardSection: document.getElementById('inspector-card-section'),
  inspectorCardEmpty: document.getElementById('inspector-card-empty'),
  cardPropWidth: document.getElementById('card-prop-width'),
  cardPropHeight: document.getElementById('card-prop-height'),
  btnAspectLock: document.getElementById('btn-aspect-lock'),
  cardPropX: document.getElementById('card-prop-x'),
  cardPropY: document.getElementById('card-prop-y'),
  btnCardRotateCCW: document.getElementById('btn-card-rotate-ccw'),
  btnCardRotateCW: document.getElementById('btn-card-rotate-cw'),
  filterBtnColor: document.getElementById('filter-btn-color'),
  filterBtnGrayscale: document.getElementById('filter-btn-grayscale'),
  filterBtnPhotocopy: document.getElementById('filter-btn-photocopy'),
  thresholdContainer: document.getElementById('threshold-container'),
  thresholdVal: document.getElementById('threshold-val'),
  photocopySlider: document.getElementById('photocopy-threshold-slider'),
  cardPropBrightness: document.getElementById('card-prop-brightness'),
  brightnessVal: document.getElementById('brightness-val'),
  cardPropContrast: document.getElementById('card-prop-contrast'),
  contrastVal: document.getElementById('contrast-val'),
  cardPropCornerRadius: document.getElementById('card-prop-corner-radius'),
  cornerRadiusVal: document.getElementById('corner-radius-val'),
  btnLayerForward: document.getElementById('btn-layer-forward'),
  btnLayerBackward: document.getElementById('btn-layer-backward'),
  btnDeletePlacedCard: document.getElementById('btn-delete-placed-card'),
  
  // Alignments
  btnAlignCenter: document.getElementById('btn-align-center'),
  btnAlignGrid: document.getElementById('btn-align-grid'),
  btnAlignTopCard: document.getElementById('btn-align-top-card'),
  btnAlignBottomCard: document.getElementById('btn-align-bottom-card'),
  
  // Export
  pdfFilename: document.getElementById('pdf-filename'),
  btnDownloadPdf: document.getElementById('btn-download-pdf'),
  btnDownloadJpeg: document.getElementById('btn-download-jpeg'),
  
  // Modal
  customRatioModal: document.getElementById('custom-ratio-modal'),
  modalRatioW: document.getElementById('modal-ratio-w'),
  modalRatioH: document.getElementById('modal-ratio-h'),
  btnApplyModal: document.getElementById('btn-apply-modal'),
  btnCancelModal: document.getElementById('btn-cancel-modal'),
  btnCloseModal: document.getElementById('btn-close-modal'),
  toastContainer: document.getElementById('toast-container')
};

// Global variables for Editor viewport offset & scale
let editorOffset = { x: 0, y: 0, w: 0, h: 0 };

/* ==========================================================================
   UI Toast Notification System
   ========================================================================== */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = '';
  if (type === 'success') {
    icon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width: 16px; height: 16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>`;
  } else if (type === 'error') {
    icon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width: 16px; height: 16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>`;
  } else {
    icon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width: 16px; height: 16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 111.063.852l-.708 2.836a.75.75 0 001.063.852l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>`;
  }
  
  toast.innerHTML = `${icon}<span>${message}</span>`;
  elements.toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'toast-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/* ==========================================================================
   Navigation Tabs
   ========================================================================== */
function setupTabs() {
  const tabs = [elements.tabBtnCrop, elements.tabBtnCompiler];
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const targetId = tab.getAttribute('data-target');
      if (targetId === 'crop-panel') {
        elements.cropPanel.classList.add('active');
        elements.compilerPanel.classList.remove('active');
        updateSidebarVisibility('crop');
        renderCropEditor();
      } else {
        elements.cropPanel.classList.remove('active');
        elements.compilerPanel.classList.add('active');
        updateSidebarVisibility('compiler');
        renderWorkspace();
      }
    });
  });
}

function updateSidebarVisibility(activeTab) {
  if (activeTab === 'crop') {
    elements.sidebarUploadSection.style.display = 'block';
    elements.sidebarQueueSection.style.display = 'block';
    elements.sidebarGallerySection.style.display = 'none';
  } else {
    elements.sidebarUploadSection.style.display = 'none';
    elements.sidebarQueueSection.style.display = 'none';
    elements.sidebarGallerySection.style.display = 'block';
  }
}

/* ==========================================================================
   Upload & Queue Handling
   ========================================================================== */
function setupUpload() {
  // Dropzone click
  elements.uploadDropzone.addEventListener('click', () => {
    elements.fileInput.click();
  });
  
  // File change
  elements.fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
  });
  
  // Drag over
  elements.uploadDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.uploadDropzone.classList.add('dragover');
  });
  
  elements.uploadDropzone.addEventListener('dragleave', () => {
    elements.uploadDropzone.classList.remove('dragover');
  });
  
  elements.uploadDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.uploadDropzone.classList.remove('dragover');
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  });
}

function handleFiles(files) {
  let loadedCount = 0;
  Array.from(files).forEach(file => {
    if (!file.type.startsWith('image/')) {
      showToast(`${file.name} is not an image!`, 'error');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const id = 'orig_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        const name = file.name;
        const size = (file.size / 1024).toFixed(1) + ' KB';
        
        state.originals.push({ id, name, size, img });
        
        // Select the newly uploaded file as active
        state.activeOriginalId = id;
        
        loadedCount++;
        if (loadedCount === files.length) {
          showToast(`Successfully uploaded ${files.length} file(s)`, 'success');
        }
        
        updateQueueList();
        renderCropEditor();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function updateQueueList() {
  elements.queueList.innerHTML = '';
  
  if (state.originals.length === 0) {
    elements.queueList.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 12px; border: 1px dashed var(--border-light); border-radius: 8px;">
        No photos uploaded yet
      </div>
    `;
    return;
  }
  
  state.originals.forEach(item => {
    const activeClass = item.id === state.activeOriginalId ? 'active' : '';
    const itemEl = document.createElement('div');
    itemEl.className = `queue-item ${activeClass}`;
    itemEl.innerHTML = `
      <img src="${item.img.src}" class="queue-thumb" alt="Thumbnail">
      <div class="queue-info">
        <div class="queue-name">${item.name}</div>
        <div class="queue-size">${item.size}</div>
      </div>
      <button class="btn-remove btn-delete-original" data-id="${item.id}" title="Remove upload">✕</button>
    `;
    
    // Select item
    itemEl.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-delete-original')) return;
      state.activeOriginalId = item.id;
      updateQueueList();
      resetHandles();
      renderCropEditor();
    });
    
    // Delete item
    itemEl.querySelector('.btn-delete-original').addEventListener('click', (e) => {
      e.stopPropagation();
      state.originals = state.originals.filter(orig => orig.id !== item.id);
      if (state.activeOriginalId === item.id) {
        state.activeOriginalId = state.originals.length > 0 ? state.originals[state.originals.length - 1].id : null;
      }
      updateQueueList();
      resetHandles();
      renderCropEditor();
      showToast('Image removed from upload queue', 'info');
    });
    
    elements.queueList.appendChild(itemEl);
  });
}

/* ==========================================================================
   Perspective Crop & Warping Editor
   ========================================================================== */
function resetHandles() {
  cropHandles = [
    { x: 0.1, y: 0.1 },
    { x: 0.9, y: 0.1 },
    { x: 0.9, y: 0.9 },
    { x: 0.1, y: 0.9 }
  ];
}

function renderCropEditor() {
  const activeOrig = state.originals.find(item => item.id === state.activeOriginalId);
  
  if (!activeOrig) {
    elements.cropEmptyNotice.style.display = 'flex';
    elements.cropContainer.style.display = 'none';
    return;
  }
  
  elements.cropEmptyNotice.style.display = 'none';
  elements.cropContainer.style.display = 'block';
  
  const viewport = elements.cropViewport;
  const canvas = elements.cropCanvas;
  const ctx = canvas.getContext('2d');
  const img = activeOrig.img;
  
  // Set canvas display dimensions to match viewport container
  const padding = 40;
  const maxW = viewport.clientWidth - padding;
  const maxH = viewport.clientHeight - padding;
  
  let scale = Math.min(maxW / img.width, maxH / img.height);
  
  // Fit dimensions
  state.cropFitWidth = img.width * scale;
  state.cropFitHeight = img.height * scale;
  
  // Reset zoom to 1.0 when loading a new image
  state.cropZoom = 1.0;
  if (elements.cropZoomSlider) {
    elements.cropZoomSlider.value = 1.0;
  }
  if (elements.cropZoomVal) {
    elements.cropZoomVal.textContent = '100%';
  }
  
  // Set canvas drawing resolution (fits original aspect perfectly)
  canvas.width = state.cropFitWidth;
  canvas.height = state.cropFitHeight;
  
  // Draw original image onto screen canvas at fit dimensions
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  
  // Reset container style width/height to fit dimensions
  elements.cropContainer.style.width = `${state.cropFitWidth}px`;
  elements.cropContainer.style.height = `${state.cropFitHeight}px`;
  
  // Align container vertically
  updateCropContainerPosition();
  
  // Track offsets for handle positioning
  editorOffset = {
    x: 0,
    y: 0,
    w: state.cropFitWidth,
    h: state.cropFitHeight,
    scale: scale
  };
  
  updateCropOverlay();
}

function updateCropContainerPosition() {
  const viewport = elements.cropViewport;
  const container = elements.cropContainer;
  if (!container || container.style.display === 'none') return;
  
  const vh = viewport.clientHeight;
  const ch = parseFloat(container.style.height) || 0;
  
  const marginTop = Math.max(0, (vh - ch - 40) / 2);
  container.style.marginTop = `${marginTop}px`;
}

function applyCropZoom() {
  const z = state.cropZoom;
  const container = elements.cropContainer;
  if (!container || container.style.display === 'none') return;
  
  // Set style dimensions
  const w = state.cropFitWidth * z;
  const h = state.cropFitHeight * z;
  container.style.width = `${w}px`;
  container.style.height = `${h}px`;
  
  // Center vertically
  updateCropContainerPosition();
  
  // Update editorOffset dimensions
  // Find fit scale
  const activeOrig = state.originals.find(item => item.id === state.activeOriginalId);
  if (!activeOrig) return;
  const img = activeOrig.img;
  
  const viewport = elements.cropViewport;
  const padding = 40;
  const maxW = viewport.clientWidth - padding;
  const maxH = viewport.clientHeight - padding;
  const fitScale = Math.min(maxW / img.width, maxH / img.height);
  
  editorOffset.w = w;
  editorOffset.h = h;
  editorOffset.scale = fitScale * z;
  
  updateCropOverlay();
}

function updateCropOverlay() {
  const w = editorOffset.w;
  const h = editorOffset.h;
  const ox = editorOffset.x;
  const oy = editorOffset.y;
  
  // Positions of handles in pixels on canvas
  const pxCoords = cropHandles.map(pt => ({
    x: ox + pt.x * w,
    y: oy + pt.y * h
  }));
  
  // Position handle DOM elements
  pxCoords.forEach((pt, i) => {
    const handleEl = document.getElementById(`handle-${i}`);
    if (handleEl) {
      handleEl.style.left = `${pt.x}px`;
      handleEl.style.top = `${pt.y}px`;
    }
  });
  
  // Position SVG lines
  const lines = [
    { el: document.getElementById('line-0-1'), p1: pxCoords[0], p2: pxCoords[1] },
    { el: document.getElementById('line-1-2'), p1: pxCoords[1], p2: pxCoords[2] },
    { el: document.getElementById('line-2-3'), p1: pxCoords[2], p2: pxCoords[3] },
    { el: document.getElementById('line-3-0'), p1: pxCoords[3], p2: pxCoords[0] }
  ];
  
  lines.forEach(line => {
    if (line.el) {
      line.el.setAttribute('x1', line.p1.x);
      line.el.setAttribute('y1', line.p1.y);
      line.el.setAttribute('x2', line.p2.x);
      line.el.setAttribute('y2', line.p2.y);
    }
  });
}

function setupHandlesDrag() {
  const handles = [
    document.getElementById('handle-0'),
    document.getElementById('handle-1'),
    document.getElementById('handle-2'),
    document.getElementById('handle-3')
  ];
  
  handles.forEach((handleEl, i) => {
    const handleStartDrag = (e) => {
      e.preventDefault();
      
      const activeOrig = state.originals.find(item => item.id === state.activeOriginalId);
      if (!activeOrig) return;
      const img = activeOrig.img;
      
      handleEl.classList.add('active');
      elements.magnifierLens.style.display = 'block';
      
      const onMove = (moveEvent) => {
        const containerRect = elements.cropContainer.getBoundingClientRect();
        
        let clientX = moveEvent.clientX;
        let clientY = moveEvent.clientY;
        
        if (moveEvent.touches && moveEvent.touches.length > 0) {
          clientX = moveEvent.touches[0].clientX;
          clientY = moveEvent.touches[0].clientY;
        }
        
        // Relative mouse position inside crop container
        const mx = clientX - containerRect.left;
        const my = clientY - containerRect.top;
        
        // Normalize mouse coordinates based on canvas size
        let rx = mx / editorOffset.w;
        let ry = my / editorOffset.h;
        
        // Clamp to image dimensions
        rx = Math.max(0, Math.min(1, rx));
        ry = Math.max(0, Math.min(1, ry));
        
        // Update handle position
        cropHandles[i].x = rx;
        cropHandles[i].y = ry;
        
        updateCropOverlay();
        
        // Position Magnifier Lens
        const lensW = 160;
        const lensH = 160;
        let lensX = mx + 20;
        let lensY = my - 170;
        
        // Clamp lens inside container
        if (lensX + lensW > containerRect.width) {
          lensX = mx - lensW - 20;
        }
        if (lensY < 0) {
          lensY = my + 20;
        }
        
        elements.magnifierLens.style.left = `${lensX}px`;
        elements.magnifierLens.style.top = `${lensY}px`;
        
        // Draw Magnifier
        const magCanvas = elements.magnifierCanvas;
        const magCtx = magCanvas.getContext('2d');
        const srcX = rx * img.width;
        const srcY = ry * img.height;
        
        magCtx.fillStyle = '#0f172a';
        magCtx.fillRect(0, 0, lensW, lensH);
        
        // Calculate the slice width dynamically based on the editor zoom level
        // Lens is 160px wide. For a 2.5x zoom on screen, target region is 64px wide.
        const srcSliceSize = Math.max(10, Math.min(Math.min(img.width, img.height), 64 / editorOffset.scale));
        
        magCtx.drawImage(
          img,
          srcX - srcSliceSize / 2, srcY - srcSliceSize / 2, srcSliceSize, srcSliceSize,
          0, 0, lensW, lensH
        );
      };
      
      const onEnd = () => {
        handleEl.classList.remove('active');
        elements.magnifierLens.style.display = 'none';
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onEnd);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onEnd);
      };
      
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onEnd);
    };
    
    handleEl.addEventListener('mousedown', handleStartDrag);
    handleEl.addEventListener('touchstart', handleStartDrag, { passive: false });
  });
}

function setupCropControls() {
  // Preset select
  elements.cropRatioPreset.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'custom') {
      elements.customRatioModal.classList.add('active');
    } else {
      elements.cropCustomInputs.style.display = 'none';
    }
  });
  
  // Modal buttons
  elements.btnApplyModal.addEventListener('click', () => {
    const w = parseFloat(elements.modalRatioW.value);
    const h = parseFloat(elements.modalRatioH.value);
    
    if (w > 0 && h > 0) {
      elements.cropRatioPreset.value = 'custom';
      elements.cropRatioW.value = w;
      elements.cropRatioH.value = h;
      elements.cropCustomInputs.style.display = 'flex';
      elements.customRatioModal.classList.remove('active');
      showToast(`Applied custom ratio ${w}:${h}`, 'success');
    } else {
      showToast('Please enter valid width/height values', 'error');
    }
  });
  
  const closeModal = () => elements.customRatioModal.classList.remove('active');
  elements.btnCancelModal.addEventListener('click', closeModal);
  elements.btnCloseModal.addEventListener('click', closeModal);
  
  // Rotate original CCW
  elements.btnCropRotateCCW.addEventListener('click', () => {
    const activeOrig = state.originals.find(item => item.id === state.activeOriginalId);
    if (!activeOrig) return;
    
    // Rotate image 90 degrees CW offscreen
    const rotatedCanvas = document.createElement('canvas');
    rotatedCanvas.width = activeOrig.img.height;
    rotatedCanvas.height = activeOrig.img.width;
    const ctx = rotatedCanvas.getContext('2d');
    ctx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(activeOrig.img, -activeOrig.img.width / 2, -activeOrig.img.height / 2);
    
    const newImg = new Image();
    newImg.onload = () => {
      activeOrig.img = newImg;
      resetHandles();
      renderCropEditor();
      showToast('Image rotated clockwise', 'success');
    };
    newImg.src = rotatedCanvas.toDataURL('image/jpeg', 0.95);
  });
  
  // Crop action
  elements.btnSaveCrop.addEventListener('click', () => {
    const activeOrig = state.originals.find(item => item.id === state.activeOriginalId);
    if (!activeOrig) return;
    
    const img = activeOrig.img;
    
    // Find average width and height from quadrilateral dimensions to determine orientation
    const p0 = cropHandles[0], p1 = cropHandles[1], p2 = cropHandles[2], p3 = cropHandles[3];
    const w1 = Math.hypot((p1.x - p0.x) * img.width, (p1.y - p0.y) * img.height);
    const w2 = Math.hypot((p2.x - p3.x) * img.width, (p2.y - p3.y) * img.height);
    const h1 = Math.hypot((p3.x - p0.x) * img.width, (p3.y - p0.y) * img.height);
    const h2 = Math.hypot((p2.x - p1.x) * img.width, (p2.y - p1.y) * img.height);
    
    const avgW = (w1 + w2) / 2;
    const avgH = (h1 + h2) / 2;
    const isPortrait = avgH > avgW;

    // Calculate aspect ratio
    let ratio = 1.0;
    const preset = elements.cropRatioPreset.value;
    
    if (preset === 'auto') {
      ratio = avgW / avgH;
    } else if (preset === 'custom') {
      const w = parseFloat(elements.cropRatioW.value);
      const h = parseFloat(elements.cropRatioH.value);
      const customRatio = w / h;
      const isCustomPortrait = customRatio < 1.0;
      // Auto-orient custom ratio to match the handles' orientation
      if (isPortrait !== isCustomPortrait) {
        ratio = 1.0 / customRatio;
      } else {
        ratio = customRatio;
      }
    } else {
      const presetRatio = parseFloat(preset);
      const isPresetPortrait = presetRatio < 1.0;
      // Auto-orient preset ratio to match the handles' orientation (e.g. landscape 1.58 -> portrait 0.63)
      if (isPortrait !== isPresetPortrait) {
        ratio = 1.0 / presetRatio;
      } else {
        ratio = presetRatio;
      }
    }
    
    // Perform Perspective Warp
    showToast('Warping image perspective...', 'info');
    setTimeout(() => {
      try {
        const roundCorners = elements.cropRoundCorners.checked;
        const croppedDataUrl = performWarpPerspective(img, cropHandles, ratio, roundCorners);
        
        const cardId = 'card_' + Date.now();
        const cardImg = new Image();
        cardImg.onload = () => {
          state.imageCache[cardId] = cardImg;
          
          state.processedCards.push({
            id: cardId,
            dataUrl: croppedDataUrl,
            widthRatio: ratio >= 1 ? ratio : 1,
            heightRatio: ratio >= 1 ? 1 : 1 / ratio,
            aspectRatio: ratio,
            name: activeOrig.name
          });
          
          updateProcessedGallery();
          showToast('Card successfully warped and saved to gallery!', 'success');
          
          // Switch to layout tab
          elements.tabBtnCompiler.click();
        };
        cardImg.src = croppedDataUrl;
        
      } catch (err) {
        console.error(err);
        showToast('Error warping perspective! Make sure points are not degenerate.', 'error');
      }
    }, 100);
  });

  // Zoom slider input
  elements.cropZoomSlider.addEventListener('input', (e) => {
    state.cropZoom = parseFloat(e.target.value);
    elements.cropZoomVal.textContent = Math.round(state.cropZoom * 100) + '%';
    applyCropZoom();
  });
  
  // Zoom In button
  elements.btnCropZoomIn.addEventListener('click', () => {
    let z = Math.min(4.0, state.cropZoom + 0.25);
    state.cropZoom = z;
    elements.cropZoomSlider.value = z;
    elements.cropZoomVal.textContent = Math.round(z * 100) + '%';
    applyCropZoom();
  });
  
  // Zoom Out button
  elements.btnCropZoomOut.addEventListener('click', () => {
    let z = Math.max(1.0, state.cropZoom - 0.25);
    state.cropZoom = z;
    elements.cropZoomSlider.value = z;
    elements.cropZoomVal.textContent = Math.round(z * 100) + '%';
    applyCropZoom();
  });
}

function performWarpPerspective(img, handles, aspect, roundCorners = false) {
  const w0 = handles[0].x * img.width, y0 = handles[0].y * img.height;
  const w1 = handles[1].x * img.width, y1 = handles[1].y * img.height;
  const w2 = handles[2].x * img.width, y2 = handles[2].y * img.height;
  const w3 = handles[3].x * img.width, y3 = handles[3].y * img.height;
  
  // Output Resolution estimation
  const sW1 = Math.hypot(w1 - w0, y1 - y0);
  const sW2 = Math.hypot(w2 - w3, y2 - y3);
  const sH1 = Math.hypot(w3 - w0, y3 - y0);
  const sH2 = Math.hypot(w2 - w1, y2 - y1);
  const avgW = Math.round((sW1 + sW2) / 2);
  const avgH = Math.round((sH1 + sH2) / 2);
  
  let destW = avgW;
  let destH = Math.round(destW / aspect);
  
  // Sanity check dimensions preserving aspect ratio!
  const maxDimension = 10000; // Cap resolution at 10000px to keep original cropped card resolution while avoiding browser memory crashes
  if (destW > maxDimension || destH > maxDimension) {
    const scale = maxDimension / Math.max(destW, destH);
    destW = Math.round(destW * scale);
    destH = Math.round(destH * scale);
  }
  
  destW = Math.max(100, destW);
  destH = Math.max(100, destH);
  
  // Set up 2D destination canvas
  const destCanvas = document.createElement('canvas');
  destCanvas.width = destW;
  destCanvas.height = destH;
  const destCtx = destCanvas.getContext('2d');
  const destImgData = destCtx.createImageData(destW, destH);
  const destPixels = destImgData.data;
  
  // Extract source pixels
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = img.width;
  srcCanvas.height = img.height;
  const srcCtx = srcCanvas.getContext('2d');
  srcCtx.drawImage(img, 0, 0);
  const srcImgData = srcCtx.getImageData(0, 0, img.width, img.height);
  const srcPixels = srcImgData.data;
  
  // Solve for Homography Matrix mapping unit dest coordinates [0..destW]x[0..destH] back to source quadrilateral [w0,y0]..[w3,y3]
  // analytical 2x2 solver for projection parameters
  const dx1 = w1 - w2;
  const dx2 = w3 - w2;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  
  const sx = w0 - w1 + w2 - w3;
  const sy = y0 - y1 + y2 - y3;
  
  let h00, h01, h02, h10, h11, h12, h20, h21;
  
  if (Math.abs(sx) < 1e-5 && Math.abs(sy) < 1e-5) {
    // Parallelogram Affine transform
    h20 = 0; h21 = 0;
    h00 = (w1 - w0) / destW;
    h01 = (w3 - w0) / destH;
    h02 = w0;
    h10 = (y1 - y0) / destW;
    h11 = (y3 - y0) / destH;
    h12 = y0;
  } else {
    const det = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(det) < 1e-5) {
      // Fallback simple scale-fit if determinant is degenerate
      h20 = 0; h21 = 0;
      h00 = (w1 - w0) / destW; h01 = (w3 - w0) / destH; h02 = w0;
      h10 = (y1 - y0) / destW; h11 = (y3 - y0) / destH; h12 = y0;
    } else {
      const g0 = (sx * dy2 - sy * dx2) / det;
      const g1 = (dx1 * sy - dy1 * sx) / det;
      
      h20 = g0 / destW;
      h21 = g1 / destH;
      h00 = (w1 - w0 + g0 * w1) / destW;
      h01 = (w3 - w0 + g1 * w3) / destH;
      h02 = w0;
      h10 = (y1 - y0 + g0 * y1) / destW;
      h11 = (y3 - y0 + g1 * y3) / destH;
      h12 = y0;
    }
  }
  
  // Warp pixel loop
  for (let yPrime = 0; yPrime < destH; yPrime++) {
    for (let xPrime = 0; xPrime < destW; xPrime++) {
      const den = h20 * xPrime + h21 * yPrime + 1;
      
      if (Math.abs(den) > 1e-8) {
        const srcX = (h00 * xPrime + h01 * yPrime + h02) / den;
        const srcY = (h10 * xPrime + h11 * yPrime + h12) / den;
        
        if (srcX >= 0 && srcX < img.width && srcY >= 0 && srcY < img.height) {
          // Bilinear sampling
          const px = bilinearSample(srcPixels, srcX, srcY, img.width, img.height);
          const destIdx = (yPrime * destW + xPrime) * 4;
          destPixels[destIdx] = px[0];
          destPixels[destIdx + 1] = px[1];
          destPixels[destIdx + 2] = px[2];
          destPixels[destIdx + 3] = px[3];
        }
      }
    }
  }
  
  destCtx.putImageData(destImgData, 0, 0);
  
  if (roundCorners) {
    const radius = Math.min(destW, destH) * 0.06;
    
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = destW;
    maskCanvas.height = destH;
    const mCtx = maskCanvas.getContext('2d');
    
    mCtx.fillStyle = '#000000';
    mCtx.beginPath();
    mCtx.moveTo(radius, 0);
    mCtx.lineTo(destW - radius, 0);
    mCtx.quadraticCurveTo(destW, 0, destW, radius);
    mCtx.lineTo(destW, destH - radius);
    mCtx.quadraticCurveTo(destW, destH, destW - radius, destH);
    mCtx.lineTo(radius, destH);
    mCtx.quadraticCurveTo(0, destH, 0, destH - radius);
    mCtx.lineTo(0, radius);
    mCtx.quadraticCurveTo(0, 0, radius, 0);
    mCtx.closePath();
    mCtx.fill();
    
    destCtx.globalCompositeOperation = 'destination-in';
    destCtx.drawImage(maskCanvas, 0, 0);
    destCtx.globalCompositeOperation = 'source-over';
  }
  
  return destCanvas.toDataURL('image/png');
}

function bilinearSample(pixels, x, y, width, height) {
  let x0 = Math.floor(x);
  let x1 = Math.min(width - 1, x0 + 1);
  let y0 = Math.floor(y);
  let y1 = Math.min(height - 1, y0 + 1);
  
  x0 = Math.max(0, x0);
  y0 = Math.max(0, y0);
  
  const dx = x - x0;
  const dy = y - y0;
  
  const idx00 = (y0 * width + x0) * 4;
  const idx10 = (y0 * width + x1) * 4;
  const idx01 = (y1 * width + x0) * 4;
  const idx11 = (y1 * width + x1) * 4;
  
  const w00 = (1 - dx) * (1 - dy);
  const w10 = dx * (1 - dy);
  const w01 = (1 - dx) * dy;
  const w11 = dx * dy;
  
  const r = pixels[idx00] * w00 + pixels[idx10] * w10 + pixels[idx01] * w01 + pixels[idx11] * w11;
  const g = pixels[idx00 + 1] * w00 + pixels[idx10 + 1] * w10 + pixels[idx01 + 1] * w01 + pixels[idx11 + 1] * w11;
  const b = pixels[idx00 + 2] * w00 + pixels[idx10 + 2] * w10 + pixels[idx01 + 2] * w01 + pixels[idx11 + 2] * w11;
  const a = pixels[idx00 + 3] * w00 + pixels[idx10 + 3] * w10 + pixels[idx01 + 3] * w01 + pixels[idx11 + 3] * w11;
  
  return [r, g, b, a];
}

/* ==========================================================================
   Processed Gallery List
   ========================================================================== */
function updateProcessedGallery() {
  elements.galleryGrid.innerHTML = '';
  
  if (state.processedCards.length === 0) {
    elements.galleryGrid.appendChild(elements.galleryEmptyMsg);
    elements.galleryEmptyMsg.style.display = 'block';
    return;
  }
  
  elements.galleryEmptyMsg.style.display = 'none';
  
  state.processedCards.forEach(card => {
    const itemEl = document.createElement('div');
    itemEl.className = 'gallery-item';
    itemEl.style.setProperty('aspect-ratio', `${card.aspectRatio} / 1`); // Dynamically match thumbnail container aspect ratio to warped card ratio
    itemEl.setAttribute('draggable', 'true');
    itemEl.setAttribute('data-id', card.id);
    itemEl.innerHTML = `
      <img src="${card.dataUrl}" alt="Cropped Card" id="gallery-card-img-${card.id}">
      <div class="gallery-item-actions">
        <button class="gallery-action-btn btn-add-to-page" data-id="${card.id}" title="Place on current A4 Page">+</button>
        <button class="gallery-action-btn btn-download-card" data-id="${card.id}" title="Download cropped card as JPEG">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width: 12px; height: 12px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        </button>
        <button class="gallery-action-btn btn-delete-card" data-id="${card.id}" title="Delete card">✕</button>
      </div>
    `;
    
    // HTML5 Drag Start
    itemEl.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', card.id);
      e.dataTransfer.effectAllowed = 'copy';
    });
    
    // Add by click
    itemEl.querySelector('.btn-add-to-page').addEventListener('click', (e) => {
      e.stopPropagation();
      addCardToActivePage(card.id);
    });
    
    // Download by click
    itemEl.querySelector('.btn-download-card').addEventListener('click', (e) => {
      e.stopPropagation();
      downloadCardAsJpeg(card.id);
    });
    
    // Delete by click
    itemEl.querySelector('.btn-delete-card').addEventListener('click', (e) => {
      e.stopPropagation();
      
      // Remove from placed cards
      state.placedCards = state.placedCards.filter(c => c.cardId !== card.id);
      state.processedCards = state.processedCards.filter(c => c.id !== card.id);
      delete state.imageCache[card.id];
      
      if (state.activePlacedCardId && !state.placedCards.some(c => c.id === state.activePlacedCardId)) {
        state.activePlacedCardId = null;
      }
      
      updateProcessedGallery();
      renderWorkspace();
      showToast('Card deleted from library', 'info');
    });
    
    elements.galleryGrid.appendChild(itemEl);
  });
}

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

function downloadCardAsJpeg(cardId) {
  const card = state.processedCards.find(c => c.id === cardId);
  if (!card) return;
  
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    
    // Fill white background for JPEG rendering
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw cropped card onto canvas
    ctx.drawImage(img, 0, 0);
    
    // Convert canvas to high-res JPEG
    const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    
    // Strip original name extension to name download
    let baseName = 'cropped_card';
    if (card.name) {
      baseName = card.name;
      const lastDot = baseName.lastIndexOf('.');
      if (lastDot !== -1) {
        baseName = baseName.slice(0, lastDot);
      }
    }
    
    downloadDataUrl(jpegDataUrl, `${baseName}_cropped.jpg`);
    showToast('Cropped card downloaded as JPEG!', 'success');
  };
  img.onerror = () => {
    showToast('Error generating JPEG download!', 'error');
  };
  img.src = card.dataUrl;
}

/* ==========================================================================
   A4 Page Compiler Workspace
   ========================================================================== */
function addCardToActivePage(cardId, dropX_mm = null, dropY_mm = null) {
  const card = state.processedCards.find(c => c.id === cardId);
  if (!card) return;
  
  // Determine placement target page
  const pageIndex = 0; // default to page 0
  
  // Set default physical ID dimensions based on aspect ratio
  const aspect = card.aspectRatio;
  let defaultW, defaultH;
  
  if (Math.abs(aspect - 1.585) <= 0.1) {
    // Landscape ID-1 Card (Credit / Driver License)
    defaultW = 85.6;
    defaultH = 54.0;
  } else if (Math.abs(aspect - 0.631) <= 0.1) {
    // Portrait ID-1 Card (Credit / Driver License)
    defaultW = 54.0;
    defaultH = 85.6;
  } else if (Math.abs(aspect - 0.707) <= 0.05) {
    // Portrait A4 Page Ratio
    defaultW = 100.0;
    defaultH = defaultW / aspect;
  } else if (Math.abs(aspect - 1.414) <= 0.05) {
    // Landscape A4 Page Ratio
    defaultW = 140.0;
    defaultH = defaultW / aspect;
  } else {
    // Custom aspect ratios: default to 85mm width and calculate height
    defaultW = 85.0;
    defaultH = defaultW / aspect;
    if (defaultH > 140) {
      defaultH = 140;
      defaultW = defaultH * aspect;
    }
  }
  
  // Positioning coordinates
  let x = (A4_WIDTH_MM - defaultW) / 2;
  let y = (A4_HEIGHT_MM - defaultH) / 2;
  
  if (dropX_mm !== null && dropY_mm !== null) {
    x = dropX_mm - defaultW / 2;
    y = dropY_mm - defaultH / 2;
  }
  
  // Clamp boundaries
  x = Math.max(0, Math.min(A4_WIDTH_MM - defaultW, x));
  y = Math.max(0, Math.min(A4_HEIGHT_MM - defaultH, y));
  
  const placedId = 'placed_' + Date.now();
  state.placedCards.push({
    id: placedId,
    cardId: cardId,
    pageIndex: pageIndex,
    x: parseFloat(x.toFixed(1)),
    y: parseFloat(y.toFixed(1)),
    w: parseFloat(defaultW.toFixed(1)),
    h: parseFloat(defaultH.toFixed(1)),
    rotation: 0,
    filter: 'color',
    threshold: 128,
    brightness: 100,
    contrast: 100,
    cornerRadius: (Math.abs(aspect - 1.585) <= 0.1 || Math.abs(aspect - 0.631) <= 0.1) ? 3.0 : 0.0
  });
  
  state.activePlacedCardId = placedId;
  
  renderWorkspace();
  showToast('Placed image onto page', 'success');
}

function renderWorkspace() {
  const container = elements.pagesContainer;
  container.innerHTML = '';
  
  if (state.pagesCount === 0) {
    elements.compilerEmptyNotice.style.display = 'flex';
    return;
  }
  elements.compilerEmptyNotice.style.display = 'none';
  
  // We'll generate pages
  for (let i = 0; i < state.pagesCount; i++) {
    const pageContainer = document.createElement('div');
    pageContainer.className = 'a4-page-container';
    pageContainer.setAttribute('data-index', i);
    
    // Page layout elements
    const deleteBtn = state.pagesCount > 1 
      ? `<button class="btn-delete-page" data-index="${i}">✕ Delete Page</button>` 
      : ``;
      
    pageContainer.innerHTML = `
      <div class="page-number-label">
        <span>A4 Sheet - Page ${i + 1}</span>
        ${deleteBtn}
      </div>
      <div class="a4-page ${elements.toggleGrid.checked ? 'grid-enabled' : ''}" id="a4-page-${i}" data-index="${i}">
        <!-- Placed cards list -->
      </div>
    `;
    
    const pageEl = pageContainer.querySelector('.a4-page');
    
    // Drag Over
    pageEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      pageEl.classList.add('drag-target');
    });
    
    // Drag Leave
    pageEl.addEventListener('dragleave', () => {
      pageEl.classList.remove('drag-target');
    });
    
    // Drag Drop
    pageEl.addEventListener('drop', (e) => {
      e.preventDefault();
      pageEl.classList.remove('drag-target');
      
      const cardId = e.dataTransfer.getData('text/plain');
      if (cardId) {
        const rect = pageEl.getBoundingClientRect();
        const dropX_px = e.clientX - rect.left;
        const dropY_px = e.clientY - rect.top;
        
        // Convert to millimeters
        const dropX_mm = dropX_px * (A4_WIDTH_MM / rect.width);
        const dropY_mm = dropY_px * (A4_HEIGHT_MM / rect.height);
        
        addCardToActivePage(cardId, dropX_mm, dropY_mm);
      }
    });
    
    // Click page to deselect items
    pageEl.addEventListener('click', (e) => {
      if (e.target.classList.contains('a4-page')) {
        state.activePlacedCardId = null;
        renderWorkspace();
      }
    });
    
    // Delete page handler
    if (state.pagesCount > 1) {
      pageContainer.querySelector('.btn-delete-page').addEventListener('click', () => {
        // Remove page and its placed cards
        state.placedCards = state.placedCards.filter(c => c.pageIndex !== i);
        
        // Adjust remaining page indices
        state.placedCards.forEach(c => {
          if (c.pageIndex > i) {
            c.pageIndex--;
          }
        });
        
        state.pagesCount--;
        renderWorkspace();
        showToast(`Page ${i + 1} deleted`, 'info');
      });
    }
    
    container.appendChild(pageContainer);
    
    // Add placed cards to page
    renderCardsOnPage(i, pageEl);
  }
  
  updateInspectorPanel();
}

function renderCardsOnPage(pageIndex, pageEl) {
  const cards = state.placedCards.filter(c => c.pageIndex === pageIndex);
  
  cards.forEach(placed => {
    const cardObj = state.processedCards.find(c => c.id === placed.cardId);
    if (!cardObj) return;
    
    const cardEl = document.createElement('div');
    const selectedClass = placed.id === state.activePlacedCardId ? 'selected' : '';
    cardEl.className = `placed-card ${selectedClass}`;
    cardEl.setAttribute('data-id', placed.id);
    
    // Physical size coordinates mapped to percentage style
    cardEl.style.left = `${(placed.x / A4_WIDTH_MM) * 100}%`;
    cardEl.style.top = `${(placed.y / A4_HEIGHT_MM) * 100}%`;
    cardEl.style.width = `${(placed.w / A4_WIDTH_MM) * 100}%`;
    cardEl.style.height = `${(placed.h / A4_HEIGHT_MM) * 100}%`;
    
    // Set custom generated rotated/filtered pixel image
    const imageCached = state.imageCache[placed.cardId];
    const displaySrc = getFilteredImage(
      imageCached,
      placed.filter,
      placed.threshold,
      placed.rotation,
      placed.brightness,
      placed.contrast,
      placed.cornerRadius,
      placed.w
    );
    
    cardEl.innerHTML = `
      <img src="${displaySrc}" alt="Placed Card ID">
      ${selectedClass ? `
        <div class="card-resize-handle se" data-handle="se"></div>
      ` : ''}
    `;
    
    // Select card on click
    cardEl.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('card-resize-handle')) return;
      e.stopPropagation();
      state.activePlacedCardId = placed.id;
      renderWorkspace();
      // Query the newly generated DOM elements to prevent detached node width=0 scale errors
      const newPageEl = document.getElementById(`a4-page-${placed.pageIndex}`);
      const newCardEl = newPageEl.querySelector(`.placed-card[data-id="${placed.id}"]`);
      setupCardDragging(e, placed, newPageEl, newCardEl);
    });
    
    cardEl.addEventListener('touchstart', (e) => {
      if (e.target.classList.contains('card-resize-handle')) return;
      e.stopPropagation();
      state.activePlacedCardId = placed.id;
      renderWorkspace();
      const newPageEl = document.getElementById(`a4-page-${placed.pageIndex}`);
      const newCardEl = newPageEl.querySelector(`.placed-card[data-id="${placed.id}"]`);
      setupCardDragging(e, placed, newPageEl, newCardEl);
    }, { passive: false });
    
    // Setup resize handle
    if (selectedClass) {
      const resizeHandle = cardEl.querySelector('.card-resize-handle.se');
      if (resizeHandle) {
        resizeHandle.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          const activePageEl = document.getElementById(`a4-page-${placed.pageIndex}`);
          setupCardResizing(e, placed, activePageEl);
        });
        resizeHandle.addEventListener('touchstart', (e) => {
          e.stopPropagation();
          const activePageEl = document.getElementById(`a4-page-${placed.pageIndex}`);
          setupCardResizing(e, placed, activePageEl);
        }, { passive: false });
      }
    }
    
    pageEl.appendChild(cardEl);
  });
}

function getFilteredImage(imgElement, filterType, threshold, rotation = 0, brightness = 100, contrast = 100, cornerRadiusMm = 0, placedWidthMm = 85.6) {
  if (!imgElement) return '';
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // Swap width/height if rotated 90 or 270
  const isRotated90 = (rotation === 90 || rotation === 270);
  const w = isRotated90 ? imgElement.height : imgElement.width;
  const h = isRotated90 ? imgElement.width : imgElement.height;
  
  canvas.width = w;
  canvas.height = h;
  
  // Draw rotated source
  ctx.translate(w / 2, h / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(imgElement, -imgElement.width / 2, -imgElement.height / 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform
  
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  
  // Calculate brightness and contrast factors once
  const bOffset = (brightness - 100) * 1.5; // range: -75 to +75
  const cVal = (contrast - 100) * 1.2;     // range: -60 to +60
  const cFactor = (259 * (cVal + 255)) / (255 * (259 - cVal));
  
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    
    // 1. Apply Brightness & Contrast
    let r_adjusted = cFactor * (r + bOffset - 128) + 128;
    let g_adjusted = cFactor * (g + bOffset - 128) + 128;
    let b_adjusted = cFactor * (b + bOffset - 128) + 128;
    
    // Clamp values
    r = Math.max(0, Math.min(255, r_adjusted));
    g = Math.max(0, Math.min(255, g_adjusted));
    b = Math.max(0, Math.min(255, b_adjusted));
    
    // 2. Apply Grayscale or Photocopy filters if needed
    if (filterType === 'grayscale') {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      data[i] = data[i+1] = data[i+2] = gray;
    } else if (filterType === 'photocopy') {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const val = gray > threshold ? 255 : 0;
      data[i] = data[i+1] = data[i+2] = val;
    } else {
      // Color mode - just save adjusted RGB values
      data[i] = r;
      data[i+1] = g;
      data[i+2] = b;
    }
  }
  
  ctx.putImageData(imgData, 0, 0);
  
  if (cornerRadiusMm > 0) {
    const roundCanvas = document.createElement('canvas');
    roundCanvas.width = w;
    roundCanvas.height = h;
    const rCtx = roundCanvas.getContext('2d');
    
    const pxPerMm = w / placedWidthMm;
    const rPx = Math.min(cornerRadiusMm * pxPerMm, Math.min(w, h) / 2);
    
    rCtx.beginPath();
    rCtx.moveTo(rPx, 0);
    rCtx.lineTo(w - rPx, 0);
    rCtx.quadraticCurveTo(w, 0, w, rPx);
    rCtx.lineTo(w, h - rPx);
    rCtx.quadraticCurveTo(w, h, w - rPx, h);
    rCtx.lineTo(rPx, h);
    rCtx.quadraticCurveTo(0, h, 0, h - rPx);
    rCtx.lineTo(0, rPx);
    rCtx.quadraticCurveTo(0, 0, rPx, 0);
    rCtx.closePath();
    rCtx.clip();
    
    rCtx.drawImage(canvas, 0, 0);
    return roundCanvas.toDataURL('image/png');
  }
  
  return canvas.toDataURL('image/png');
}

/* ==========================================================================
   Placed Card Drag & Drop / Resize Operations (A4 Page compiler)
   ========================================================================== */
function setupCardDragging(e, placed, pageEl, cardEl) {
  e.preventDefault();
  state.isGridAutoActive = false;
  
  const rect = pageEl.getBoundingClientRect();
  const scale = rect.width / A4_WIDTH_MM; // pixels per millimeter
  
  let startX = e.clientX;
  let startY = e.clientY;
  if (e.touches && e.touches.length > 0) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }
  
  const initialX = placed.x;
  const initialY = placed.y;
  
  const onMove = (moveEvent) => {
    let clientX = moveEvent.clientX;
    let clientY = moveEvent.clientY;
    if (moveEvent.touches && moveEvent.touches.length > 0) {
      clientX = moveEvent.touches[0].clientX;
      clientY = moveEvent.touches[0].clientY;
    }
    
    // Millimeter deltas
    const dx = (clientX - startX) / scale;
    const dy = (clientY - startY) / scale;
    
    let newX = initialX + dx;
    let newY = initialY + dy;
    
    // Page Grid snap
    const isSnapping = elements.toggleGrid.checked;
    if (isSnapping) {
      newX = Math.round(newX / 2) * 2; // snap to nearest 2mm
      newY = Math.round(newY / 2) * 2;
    }
    
    // Loose boundary limits
    newX = Math.max(-placed.w + 10, Math.min(A4_WIDTH_MM - 10, newX));
    newY = Math.max(-placed.h + 10, Math.min(A4_HEIGHT_MM - 10, newY));
    
    placed.x = parseFloat(newX.toFixed(1));
    placed.y = parseFloat(newY.toFixed(1));
    
    // Live update element styles
    cardEl.style.left = `${(placed.x / A4_WIDTH_MM) * 100}%`;
    cardEl.style.top = `${(placed.y / A4_HEIGHT_MM) * 100}%`;
    
    // Sync inspector inputs without complete workspace reload
    elements.cardPropX.value = placed.x;
    elements.cardPropY.value = placed.y;
  };
  
  const onEnd = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onEnd);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend', onEnd);
    renderWorkspace(); // Reload workspace completely on drag-end
  };
  
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onEnd);
}

function setupCardResizing(e, placed, pageEl) {
  e.preventDefault();
  
  const rect = pageEl.getBoundingClientRect();
  const scale = rect.width / A4_WIDTH_MM;
  
  let startX = e.clientX;
  let startY = e.clientY;
  if (e.touches && e.touches.length > 0) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }
  
  const initialW = placed.w;
  const initialH = placed.h;
  
  // Find source card aspect ratio
  const sourceCard = state.processedCards.find(c => c.id === placed.cardId);
  const aspect = sourceCard ? sourceCard.aspectRatio : (initialW / initialH);
  
  const onMove = (moveEvent) => {
    let clientX = moveEvent.clientX;
    let clientY = moveEvent.clientY;
    if (moveEvent.touches && moveEvent.touches.length > 0) {
      clientX = moveEvent.touches[0].clientX;
      clientY = moveEvent.touches[0].clientY;
    }
    
    const dx = (clientX - startX) / scale;
    
    let newW = initialW + dx;
    newW = Math.max(10, Math.min(A4_WIDTH_MM, newW));
    
    let newH;
    if (state.aspectRatioLocked) {
      newH = newW / aspect;
    } else {
      const dy = (clientY - startY) / scale;
      newH = initialH + dy;
      newH = Math.max(10, Math.min(A4_HEIGHT_MM, newH));
    }
    
    placed.w = parseFloat(newW.toFixed(1));
    placed.h = parseFloat(newH.toFixed(1));
    
    // Live reload inspector values
    elements.cardPropWidth.value = placed.w;
    elements.cardPropHeight.value = placed.h;
    
    const cardEl = pageEl.querySelector(`.placed-card[data-id="${placed.id}"]`);
    if (cardEl) {
      cardEl.style.width = `${(placed.w / A4_WIDTH_MM) * 100}%`;
      cardEl.style.height = `${(placed.h / A4_HEIGHT_MM) * 100}%`;
    }
  };
  
  const onEnd = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onEnd);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend', onEnd);
    renderWorkspace();
  };
  
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onEnd);
}

/* ==========================================================================
   Card Properties Inspector Panel Control logic
   ========================================================================== */
function updateInspectorPanel() {
  const activePlaced = state.placedCards.find(c => c.id === state.activePlacedCardId);
  
  if (!activePlaced) {
    elements.inspectorCardSection.style.display = 'none';
    elements.inspectorCardEmpty.style.display = 'block';
    return;
  }
  
  elements.inspectorCardSection.style.display = 'block';
  elements.inspectorCardEmpty.style.display = 'none';
  
  // Set numeric inputs
  elements.cardPropWidth.value = activePlaced.w;
  elements.cardPropHeight.value = activePlaced.h;
  elements.cardPropX.value = activePlaced.x;
  elements.cardPropY.value = activePlaced.y;
  
  // Aspect Lock indicator
  if (state.aspectRatioLocked) {
    elements.btnAspectLock.classList.add('locked');
  } else {
    elements.btnAspectLock.classList.remove('locked');
  }
  
  // Active Filter modes buttons
  const filters = ['color', 'grayscale', 'photocopy'];
  filters.forEach(f => {
    const btn = document.getElementById(`filter-btn-${f}`);
    if (btn) {
      if (activePlaced.filter === f) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  });
  
  // Photocopy slider visibility
  if (activePlaced.filter === 'photocopy') {
    elements.thresholdContainer.classList.add('active');
    elements.photocopySlider.value = activePlaced.threshold;
    elements.thresholdVal.textContent = activePlaced.threshold;
  } else {
    elements.thresholdContainer.classList.remove('active');
  }
  
  // Set Brightness & Contrast slider values
  elements.cardPropBrightness.value = activePlaced.brightness || 100;
  elements.brightnessVal.textContent = (activePlaced.brightness || 100) + '%';
  elements.cardPropContrast.value = activePlaced.contrast || 100;
  elements.contrastVal.textContent = (activePlaced.contrast || 100) + '%';
  elements.cardPropCornerRadius.value = activePlaced.cornerRadius || 0;
  elements.cornerRadiusVal.textContent = (activePlaced.cornerRadius || 0) + 'mm';
}

function setupInspectorControls() {
  // Sync width inputs
  elements.cardPropWidth.addEventListener('input', (e) => {
    const activePlaced = state.placedCards.find(c => c.id === state.activePlacedCardId);
    if (!activePlaced) return;
    
    const w = parseFloat(e.target.value);
    if (w > 0) {
      const sourceCard = state.processedCards.find(c => c.id === activePlaced.cardId);
      const aspect = sourceCard ? sourceCard.aspectRatio : (activePlaced.w / activePlaced.h);
      
      activePlaced.w = w;
      if (state.aspectRatioLocked) {
        activePlaced.h = parseFloat((w / aspect).toFixed(1));
        elements.cardPropHeight.value = activePlaced.h;
      }
      renderWorkspace();
    }
  });
  
  // Sync height inputs
  elements.cardPropHeight.addEventListener('input', (e) => {
    const activePlaced = state.placedCards.find(c => c.id === state.activePlacedCardId);
    if (!activePlaced) return;
    
    const h = parseFloat(e.target.value);
    if (h > 0) {
      const sourceCard = state.processedCards.find(c => c.id === activePlaced.cardId);
      const aspect = sourceCard ? sourceCard.aspectRatio : (activePlaced.w / activePlaced.h);
      
      activePlaced.h = h;
      if (state.aspectRatioLocked) {
        activePlaced.w = parseFloat((h * aspect).toFixed(1));
        elements.cardPropWidth.value = activePlaced.w;
      }
      renderWorkspace();
    }
  });
  
  // Aspect Lock Toggle
  elements.btnAspectLock.addEventListener('click', () => {
    state.aspectRatioLocked = !state.aspectRatioLocked;
    elements.btnAspectLock.classList.toggle('locked', state.aspectRatioLocked);
    showToast(state.aspectRatioLocked ? 'Aspect Ratio Locked' : 'Aspect Ratio Unlocked', 'info');
  });
  
  // Sync X/Y positions
  elements.cardPropX.addEventListener('input', (e) => {
    const activePlaced = state.placedCards.find(c => c.id === state.activePlacedCardId);
    if (!activePlaced) return;
    const x = parseFloat(e.target.value);
    if (!isNaN(x)) {
      activePlaced.x = x;
      renderWorkspace();
    }
  });
  
  elements.cardPropY.addEventListener('input', (e) => {
    const activePlaced = state.placedCards.find(c => c.id === state.activePlacedCardId);
    if (!activePlaced) return;
    const y = parseFloat(e.target.value);
    if (!isNaN(y)) {
      activePlaced.y = y;
      renderWorkspace();
    }
  });
  
  // Rotations
  elements.btnCardRotateCW.addEventListener('click', () => {
    const activePlaced = state.placedCards.find(c => c.id === state.activePlacedCardId);
    if (!activePlaced) return;
    
    activePlaced.rotation = (activePlaced.rotation + 90) % 360;
    
    // Swap width/height to adapt bounding dimensions naturally!
    const temp = activePlaced.w;
    activePlaced.w = activePlaced.h;
    activePlaced.h = temp;
    
    renderWorkspace();
  });
  
  elements.btnCardRotateCCW.addEventListener('click', () => {
    const activePlaced = state.placedCards.find(c => c.id === state.activePlacedCardId);
    if (!activePlaced) return;
    
    activePlaced.rotation = (activePlaced.rotation + 270) % 360;
    
    const temp = activePlaced.w;
    activePlaced.w = activePlaced.h;
    activePlaced.h = temp;
    
    renderWorkspace();
  });
  
  // Filters Click Events
  const filters = ['color', 'grayscale', 'photocopy'];
  filters.forEach(f => {
    const btn = document.getElementById(`filter-btn-${f}`);
    if (btn) {
      btn.addEventListener('click', () => {
        const activePlaced = state.placedCards.find(c => c.id === state.activePlacedCardId);
        if (!activePlaced) return;
        
        activePlaced.filter = f;
        renderWorkspace();
      });
    }
  });
  
  // Photocopy threshold slider
  elements.photocopySlider.addEventListener('input', (e) => {
    const activePlaced = state.placedCards.find(c => c.id === state.activePlacedCardId);
    if (!activePlaced) return;
    
    const val = parseInt(e.target.value);
    activePlaced.threshold = val;
    elements.thresholdVal.textContent = val;
    
    // Trigger live render update of A4 card image
    const pageEl = document.getElementById(`a4-page-${activePlaced.pageIndex}`);
    if (pageEl) {
      const cardEl = pageEl.querySelector(`.placed-card[data-id="${activePlaced.id}"]`);
      if (cardEl) {
        const imageCached = state.imageCache[activePlaced.cardId];
        const displaySrc = getFilteredImage(
          imageCached,
          activePlaced.filter,
          activePlaced.threshold,
          activePlaced.rotation,
          activePlaced.brightness,
          activePlaced.contrast,
          activePlaced.cornerRadius,
          activePlaced.w
        );
        cardEl.querySelector('img').src = displaySrc;
      }
    }
  });

  // Brightness slider
  elements.cardPropBrightness.addEventListener('input', (e) => {
    const activePlaced = state.placedCards.find(c => c.id === state.activePlacedCardId);
    if (!activePlaced) return;
    
    const val = parseInt(e.target.value);
    activePlaced.brightness = val;
    elements.brightnessVal.textContent = val + '%';
    
    // Live update card image
    const pageEl = document.getElementById(`a4-page-${activePlaced.pageIndex}`);
    if (pageEl) {
      const cardEl = pageEl.querySelector(`.placed-card[data-id="${activePlaced.id}"]`);
      if (cardEl) {
        const imageCached = state.imageCache[activePlaced.cardId];
        const displaySrc = getFilteredImage(
          imageCached,
          activePlaced.filter,
          activePlaced.threshold,
          activePlaced.rotation,
          activePlaced.brightness,
          activePlaced.contrast,
          activePlaced.cornerRadius,
          activePlaced.w
        );
        cardEl.querySelector('img').src = displaySrc;
      }
    }
  });

  // Contrast slider
  elements.cardPropContrast.addEventListener('input', (e) => {
    const activePlaced = state.placedCards.find(c => c.id === state.activePlacedCardId);
    if (!activePlaced) return;
    
    const val = parseInt(e.target.value);
    activePlaced.contrast = val;
    elements.contrastVal.textContent = val + '%';
    
    // Live update card image
    const pageEl = document.getElementById(`a4-page-${activePlaced.pageIndex}`);
    if (pageEl) {
      const cardEl = pageEl.querySelector(`.placed-card[data-id="${activePlaced.id}"]`);
      if (cardEl) {
        const imageCached = state.imageCache[activePlaced.cardId];
        const displaySrc = getFilteredImage(
          imageCached,
          activePlaced.filter,
          activePlaced.threshold,
          activePlaced.rotation,
          activePlaced.brightness,
          activePlaced.contrast,
          activePlaced.cornerRadius,
          activePlaced.w
        );
        cardEl.querySelector('img').src = displaySrc;
      }
    }
  });

  // Corner Rounding slider
  elements.cardPropCornerRadius.addEventListener('input', (e) => {
    const activePlaced = state.placedCards.find(c => c.id === state.activePlacedCardId);
    if (!activePlaced) return;
    
    const val = parseFloat(e.target.value);
    activePlaced.cornerRadius = val;
    elements.cornerRadiusVal.textContent = val + 'mm';
    
    // Live update card image
    const pageEl = document.getElementById(`a4-page-${activePlaced.pageIndex}`);
    if (pageEl) {
      const cardEl = pageEl.querySelector(`.placed-card[data-id="${activePlaced.id}"]`);
      if (cardEl) {
        const imageCached = state.imageCache[activePlaced.cardId];
        const displaySrc = getFilteredImage(
          imageCached,
          activePlaced.filter,
          activePlaced.threshold,
          activePlaced.rotation,
          activePlaced.brightness,
          activePlaced.contrast,
          activePlaced.cornerRadius,
          activePlaced.w
        );
        cardEl.querySelector('img').src = displaySrc;
      }
    }
  });
  
  // Arrange Layer Depth / Order
  elements.btnLayerForward.addEventListener('click', () => {
    const idx = state.placedCards.findIndex(c => c.id === state.activePlacedCardId);
    if (idx !== -1 && idx < state.placedCards.length - 1) {
      // Swap index forward (over / right)
      const temp = state.placedCards[idx];
      state.placedCards[idx] = state.placedCards[idx + 1];
      state.placedCards[idx + 1] = temp;
      
      if (state.isGridAutoActive) {
        reapplyGridLayout();
        showToast('Moved card order later (Right / Down in grid)', 'success');
      } else {
        renderWorkspace();
        showToast('Moved card order forward (Over other layers)', 'success');
      }
    }
  });
  
  elements.btnLayerBackward.addEventListener('click', () => {
    const idx = state.placedCards.findIndex(c => c.id === state.activePlacedCardId);
    if (idx > 0) {
      // Swap index backward (under / left)
      const temp = state.placedCards[idx];
      state.placedCards[idx] = state.placedCards[idx - 1];
      state.placedCards[idx - 1] = temp;
      
      if (state.isGridAutoActive) {
        reapplyGridLayout();
        showToast('Moved card order earlier (Left / Up in grid)', 'success');
      } else {
        renderWorkspace();
        showToast('Moved card order backward (Under other layers)', 'success');
      }
    }
  });
  
  // Delete placed card
  elements.btnDeletePlacedCard.addEventListener('click', () => {
    const activePlaced = state.placedCards.find(c => c.id === state.activePlacedCardId);
    if (!activePlaced) return;
    
    state.placedCards = state.placedCards.filter(c => c.id !== activePlaced.id);
    state.activePlacedCardId = null;
    renderWorkspace();
    showToast('Card removed from page layout', 'info');
  });
}

/* ==========================================================================
   Page Alignments & Automations (Auto Grid Layout)
   ========================================================================== */
function setupAlignments() {
  // Center horizontally
  elements.btnAlignCenter.addEventListener('click', () => {
    const activePlaced = state.placedCards.find(c => c.id === state.activePlacedCardId);
    if (!activePlaced) {
      showToast('Select an image on the page first', 'info');
      return;
    }
    
    activePlaced.x = parseFloat(((A4_WIDTH_MM - activePlaced.w) / 2).toFixed(1));
    renderWorkspace();
    showToast('Centered horizontally', 'success');
  });
  
  // ID card Top half
  elements.btnAlignTopCard.addEventListener('click', () => {
    const activePlaced = state.placedCards.find(c => c.id === state.activePlacedCardId);
    if (!activePlaced) {
      showToast('Select an image on the page first', 'info');
      return;
    }
    
    activePlaced.x = parseFloat(((A4_WIDTH_MM - activePlaced.w) / 2).toFixed(1));
    activePlaced.y = 25.0; // standard margin
    renderWorkspace();
    showToast('Placed in top ID card layout', 'success');
  });
  
  // ID card Bottom half
  elements.btnAlignBottomCard.addEventListener('click', () => {
    const activePlaced = state.placedCards.find(c => c.id === state.activePlacedCardId);
    if (!activePlaced) {
      showToast('Select an image on the page first', 'info');
      return;
    }
    
    activePlaced.x = parseFloat(((A4_WIDTH_MM - activePlaced.w) / 2).toFixed(1));
    activePlaced.y = 150.0; // standard half-A4 margin
    renderWorkspace();
    showToast('Placed in bottom ID card layout', 'success');
  });
  
  // Auto-Grid Arrangement
  elements.btnAlignGrid.addEventListener('click', () => {
    // Layout all cards on the active page (or page 0)
    const pageIdx = 0;
    const cards = state.placedCards.filter(c => c.pageIndex === pageIdx);
    
    if (cards.length === 0) {
      showToast('No images placed on this A4 page to arrange', 'error');
      return;
    }
    
    state.isGridAutoActive = true;
    reapplyGridLayout();
    showToast('Aligned all cards to A4 layout grid', 'success');
  });
}

function reapplyGridLayout() {
  const pageIdx = 0;
  const cards = state.placedCards.filter(c => c.pageIndex === pageIdx);
  if (cards.length === 0) return;
  
  const marginX = 15;
  const marginY = 20;
  const gapX = 10;
  const gapY = 12;
  
  let currentX = marginX;
  let currentY = marginY;
  
  cards.forEach((card, idx) => {
    card.x = parseFloat(currentX.toFixed(1));
    card.y = parseFloat(currentY.toFixed(1));
    
    // Advance to next slot (2 columns grid layout)
    if (idx % 2 === 0) {
      currentX += card.w + gapX;
      if (currentX + card.w > A4_WIDTH_MM) {
        currentX = marginX;
        currentY += card.h + gapY;
      }
    } else {
      currentX = marginX;
      currentY += card.h + gapY;
    }
  });
  
  renderWorkspace();
}

/* ==========================================================================
   Workspace Management Toolbar
   ========================================================================== */
function setupWorkspaceControls() {
  // Add Page
  elements.btnAddPage.addEventListener('click', () => {
    state.pagesCount++;
    renderWorkspace();
    showToast(`Added A4 Page ${state.pagesCount}`, 'success');
  });
  
  // Grid Checkbox toggle
  elements.toggleGrid.addEventListener('change', () => {
    renderWorkspace();
  });
  
  // Clear workspace
  elements.btnClearWorkspace.addEventListener('click', () => {
    if (state.placedCards.length === 0 && state.pagesCount === 1) return;
    
    if (confirm('Are you sure you want to clear all pages and placed images?')) {
      state.placedCards = [];
      state.activePlacedCardId = null;
      state.pagesCount = 1;
      renderWorkspace();
      showToast('Workspace cleared', 'info');
    }
  });
}

/* ==========================================================================
   PDF Generation & Local Download Trigger
   ========================================================================== */
function setupPDFExport() {
  elements.btnDownloadPdf.addEventListener('click', () => {
    if (state.placedCards.length === 0) {
      showToast('Please place at least one image on A4 page layout first!', 'error');
      return;
    }
    
    showToast('Compiling document pages...', 'info');
    
    setTimeout(async () => {
      try {
        const { jsPDF } = window.jspdf;
        
        // Initialize jsPDF document (portrait, mm, a4)
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });
        
        // Loop over pages
        for (let i = 0; i < state.pagesCount; i++) {
          if (i > 0) {
            doc.addPage();
          }
          
          // Render page to canvas at 100 px/cm (254 DPI)
          const canvas = await renderPageToCanvas(i);
          // Convert canvas to JPEG at 90% quality
          const pageDataUrl = canvas.toDataURL('image/jpeg', 0.90);
          
          // Embed the full page image into jsPDF using precise A4 dimensions (210 x 297 mm)
          doc.addImage(
            pageDataUrl,
            'JPEG',
            0,
            0,
            210,
            297,
            undefined,
            'FAST'
          );
        }
        
        // Trigger local client browser download
        let filename = elements.pdfFilename.value.trim();
        if (!filename) filename = 'ID_Cards_Compile';
        
        // Strip other extensions if typed by user
        if (filename.endsWith('.pdf')) filename = filename.slice(0, -4);
        if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) filename = filename.slice(0, filename.lastIndexOf('.'));
        
        filename += '.pdf';
        
        doc.save(filename);
        showToast('PDF Document generated and downloaded successfully!', 'success');
        
      } catch (err) {
        console.error(err);
        showToast('Failed to compile PDF! Check console log details.', 'error');
      }
    }, 200);
  });
}

function setupJPEGExport() {
  elements.btnDownloadJpeg.addEventListener('click', () => {
    if (state.placedCards.length === 0) {
      showToast('Please place at least one image on A4 page layout first!', 'error');
      return;
    }
    
    showToast('Generating JPEG image pages...', 'info');
    
    setTimeout(async () => {
      try {
        for (let i = 0; i < state.pagesCount; i++) {
          const canvas = await renderPageToCanvas(i);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.90);
          
          // Trigger download
          const link = document.createElement('a');
          let baseName = elements.pdfFilename.value.trim();
          if (!baseName) baseName = 'ID_Cards_Compile';
          
          // Strip extension if user typed it
          if (baseName.endsWith('.pdf')) baseName = baseName.slice(0, -4);
          if (baseName.endsWith('.jpg') || baseName.endsWith('.jpeg')) baseName = baseName.slice(0, baseName.lastIndexOf('.'));
          
          link.download = `${baseName}_Page_${i + 1}.jpg`;
          link.href = dataUrl;
          link.click();
        }
        
        showToast('JPEG Image pages generated and downloaded successfully!', 'success');
      } catch (err) {
        console.error(err);
        showToast('Failed to generate JPEGs! Check console log details.', 'error');
      }
    }, 200);
  });
}

function renderPageToCanvas(pageIndex) {
  return new Promise((resolve, reject) => {
    // 254 DPI / 100 pixels per cm A4 is 2100 x 2970
    const canvas = document.createElement('canvas');
    canvas.width = 2100;
    canvas.height = 2970;
    const ctx = canvas.getContext('2d');
    
    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const pageCards = state.placedCards.filter(c => c.pageIndex === pageIndex);
    const pxPerMm = 10; // Exactly 10 pixels per mm (100 pixels per cm)
    
    if (pageCards.length === 0) {
      resolve(canvas);
      return;
    }
    
    let loadedCount = 0;
    
    pageCards.forEach(placed => {
      const cardObj = state.processedCards.find(c => c.id === placed.cardId);
      if (!cardObj) {
        loadedCount++;
        if (loadedCount === pageCards.length) resolve(canvas);
        return;
      }
      
      const cachedImg = state.imageCache[placed.cardId];
      const filteredDataUrl = getFilteredImage(
        cachedImg,
        placed.filter,
        placed.threshold,
        placed.rotation,
        placed.brightness,
        placed.contrast,
        placed.cornerRadius,
        placed.w
      );
      
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(
          img,
          placed.x * pxPerMm,
          placed.y * pxPerMm,
          placed.w * pxPerMm,
          placed.h * pxPerMm
        );
        loadedCount++;
        if (loadedCount === pageCards.length) {
          resolve(canvas);
        }
      };
      img.onerror = (e) => {
        console.error("Failed to load placed image on canvas render", e);
        loadedCount++;
        if (loadedCount === pageCards.length) {
          resolve(canvas);
        }
      };
      img.src = filteredDataUrl;
    });
  });
}

/* ==========================================================================
   Application Entry Point initialization
   ========================================================================== */
window.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupUpload();
  setupHandlesDrag();
  setupCropControls();
  setupInspectorControls();
  setupAlignments();
  setupWorkspaceControls();
  setupPDFExport();
  setupJPEGExport();
  
  // Initial renders
  updateQueueList();
  updateProcessedGallery();
  updateSidebarVisibility('crop');
  renderWorkspace();
  
  // Resize handler
  window.addEventListener('resize', () => {
    updateCropContainerPosition();
  });
  
  showToast('App loaded. Secure, local scan compiler ready.', 'success');
});
