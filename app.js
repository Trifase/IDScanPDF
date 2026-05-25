/**
 * IDScanPDF - Privacy-First Local ID Scanner & PDF Compiler
 * Written in Vanilla JavaScript. Zero servers, completely local.
 */

// Application State
const state = {
  originals: [],         // { id, name, size, img }
  activeOriginalId: null, // Selected original image ID for cropping
  
  processedCards: [],    // { id, dataUrl, widthRatio, heightRatio, w_px, h_px, filter, threshold, brightness, contrast, temperature, tint }
  activeProcessedCardId: null, // Selected processed card ID for enhancing
  imageCache: {},        // cardId -> HTMLImageElement (for quick filter rendering)
  
  placedCards: [],       // { id, cardId, pageIndex, x, y, w, h, rotation, cornerRadius }
  activePlacedCardId: null,
  
  pagesCount: 1,         // Count of A4 sheets in workspace
  aspectRatioLocked: true,
  
  // Crop zoom settings
  cropZoom: 1.0,
  cropFitWidth: 0,
  cropFitHeight: 0,
  
  // Grid layout status tracker
  isGridAutoActive: false,
  
  // White balance eyedropper mode tracker
  wbPickerActive: false
};

// Handle Corners for Cropping (Normalized 0..1 coordinates)
let cropHandles = [
  { x: 0.1, y: 0.1 }, // TL
  { x: 0.9, y: 0.1 }, // TR
  { x: 0.9, y: 0.9 }, // BR
  { x: 0.1, y: 0.9 }  // BL
];

// Visual Enhancer Undo History Stack
const enhancerHistory = [];

// Document Constants
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

// DOM Elements
const elements = {
  // Navigation Tabs
  tabBtnCrop: document.getElementById('tab-btn-crop'),
  tabBtnEnhancer: document.getElementById('tab-btn-enhancer'),
  tabBtnCompiler: document.getElementById('tab-btn-compiler'),
  cropPanel: document.getElementById('crop-panel'),
  enhancerPanel: document.getElementById('enhancer-panel'),
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
  btnCropAutodetect: document.getElementById('btn-crop-autodetect'),
  
  // Enhancer Panel Elements
  enhancerCardNameLabel: document.getElementById('enhancer-card-name-label'),
  btnEnhancerPlace: document.getElementById('btn-enhancer-place'),
  enhancerViewport: document.getElementById('enhancer-viewport'),
  enhancerEmptyNotice: document.getElementById('enhancer-empty-notice'),
  enhancerContainer: document.getElementById('enhancer-container'),
  enhancerCanvas: document.getElementById('enhancer-canvas'),
  enhancerInspector: document.getElementById('enhancer-inspector'),
  
  enhancerFilterBtnColor: document.getElementById('enhancer-filter-btn-color'),
  enhancerFilterBtnGrayscale: document.getElementById('enhancer-filter-btn-grayscale'),
  enhancerFilterBtnPhotocopy: document.getElementById('enhancer-filter-btn-photocopy'),
  enhancerThresholdContainer: document.getElementById('enhancer-threshold-container'),
  enhancerThresholdNum: document.getElementById('enhancer-threshold-num'),
  enhancerPhotocopySlider: document.getElementById('enhancer-photocopy-threshold-slider'),
  
  enhancerBrightness: document.getElementById('enhancer-brightness'),
  enhancerBrightnessNum: document.getElementById('enhancer-brightness-num'),
  enhancerContrast: document.getElementById('enhancer-contrast'),
  enhancerContrastNum: document.getElementById('enhancer-contrast-num'),
  enhancerTemp: document.getElementById('enhancer-temp'),
  enhancerTempNum: document.getElementById('enhancer-temp-num'),
  enhancerTint: document.getElementById('enhancer-tint'),
  enhancerTintNum: document.getElementById('enhancer-tint-num'),
  enhancerSharpness: document.getElementById('enhancer-sharpness'),
  enhancerSharpnessNum: document.getElementById('enhancer-sharpness-num'),
  btnEnhancerWBPicker: document.getElementById('btn-enhancer-wb-picker'),
  btnEnhancerUndo: document.getElementById('btn-enhancer-undo'),
  btnEnhancerDownloadJpeg: document.getElementById('btn-enhancer-download-jpeg'),
  btnEnhancerDownloadPng: document.getElementById('btn-enhancer-download-png'),
  
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
  const tabs = [elements.tabBtnCrop, elements.tabBtnEnhancer, elements.tabBtnCompiler];
  tabs.forEach(tab => {
    if (!tab) return;
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        if (t) t.classList.remove('active');
      });
      tab.classList.add('active');
      
      const targetId = tab.getAttribute('data-target');
      if (targetId !== 'enhancer-panel') {
        setWBPickerActive(false);
      }
      
      if (targetId === 'crop-panel') {
        elements.cropPanel.classList.add('active');
        elements.enhancerPanel.classList.remove('active');
        elements.compilerPanel.classList.remove('active');
        updateSidebarVisibility('crop');
        renderCropEditor();
      } else if (targetId === 'enhancer-panel') {
        elements.cropPanel.classList.remove('active');
        elements.enhancerPanel.classList.add('active');
        elements.compilerPanel.classList.remove('active');
        updateSidebarVisibility('compiler');
        renderEnhancerEditor();
      } else {
        elements.cropPanel.classList.remove('active');
        elements.enhancerPanel.classList.remove('active');
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
        
        // Auto-detect crop handles immediately on load
        const detectedHandles = detectCardCorners(img);
        state.originals.push({ id, name, size, img, handles: detectedHandles });
        
        // Select the newly uploaded file as active
        state.activeOriginalId = id;
        
        loadedCount++;
        if (loadedCount === files.length) {
          showToast(`Successfully uploaded ${files.length} file(s)`, 'success');
        }
        
        updateQueueList();
        resetHandles(state.originals.find(orig => orig.id === id));
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
      resetHandles(item);
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
      const activeOrig = state.originals.find(orig => orig.id === state.activeOriginalId);
      resetHandles(activeOrig);
      renderCropEditor();
      showToast('Image removed from upload queue', 'info');
    });
    
    elements.queueList.appendChild(itemEl);
  });
}

/* ==========================================================================
   Perspective Crop & Warping Editor
   ========================================================================== */
function resetHandles(originalItem = null) {
  if (originalItem && originalItem.handles) {
    cropHandles = JSON.parse(JSON.stringify(originalItem.handles));
  } else {
    cropHandles = [
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.9, y: 0.9 },
      { x: 0.1, y: 0.9 }
    ];
  }
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
        
        // Draw adjacent dashed connector lines inside the magnifier as visual guides
        const adjIndices = [(i + 1) % 4, (i + 3) % 4];
        magCtx.strokeStyle = '#6366f1';
        magCtx.lineWidth = 2.5;
        magCtx.setLineDash([6, 4]);
        
        adjIndices.forEach(adjIdx => {
          const adjX = cropHandles[adjIdx].x * img.width;
          const adjY = cropHandles[adjIdx].y * img.height;
          
          const dx = adjX - srcX;
          const dy = adjY - srcY;
          
          const destX = lensW / 2 + dx * (lensW / srcSliceSize);
          const destY = lensH / 2 + dy * (lensH / srcSliceSize);
          
          magCtx.beginPath();
          magCtx.moveTo(lensW / 2, lensH / 2);
          magCtx.lineTo(destX, destY);
          magCtx.stroke();
        });
        magCtx.setLineDash([]);
      };
      
      const onEnd = () => {
        handleEl.classList.remove('active');
        elements.magnifierLens.style.display = 'none';
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onEnd);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onEnd);
        
        const activeOrig = state.originals.find(item => item.id === state.activeOriginalId);
        if (activeOrig) {
          activeOrig.handles = JSON.parse(JSON.stringify(cropHandles));
        }
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
      // Re-run card detection on rotated photo
      activeOrig.handles = detectCardCorners(newImg);
      resetHandles(activeOrig);
      renderCropEditor();
      showToast('Image rotated clockwise', 'success');
    };
    newImg.src = rotatedCanvas.toDataURL('image/jpeg', 0.95);
  });

  // Auto-Detect Card Corners click handler
  elements.btnCropAutodetect.addEventListener('click', () => {
    const activeOrig = state.originals.find(item => item.id === state.activeOriginalId);
    if (!activeOrig) {
      showToast('Please upload an image first', 'error');
      return;
    }
    
    showToast('Detecting card boundaries...', 'info');
    setTimeout(() => {
      const detected = detectCardCorners(activeOrig.img);
      activeOrig.handles = detected;
      resetHandles(activeOrig);
      renderCropEditor();
      showToast('Card corners successfully auto-detected!', 'success');
    }, 100);
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
            name: activeOrig.name,
            filter: 'color',
            threshold: 128,
            brightness: 100,
            contrast: 100,
            temperature: 0,
            tint: 0,
            sharpness: 0
          });
          
          state.activeProcessedCardId = cardId;
          updateProcessedGallery();
          showToast('Card successfully warped and saved to gallery!', 'success');
          
          // Switch to Enhancer tab
          elements.tabBtnEnhancer.click();
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
    const activeClass = card.id === state.activeProcessedCardId ? 'active' : '';
    itemEl.className = `gallery-item ${activeClass}`;
    itemEl.style.setProperty('aspect-ratio', `${card.aspectRatio} / 1`); // Dynamically match thumbnail container aspect ratio to warped card ratio
    itemEl.setAttribute('draggable', 'true');
    itemEl.setAttribute('data-id', card.id);
    
    // Get thumbnail display source with filters applied
    const cachedImg = state.imageCache[card.id];
    let displaySrc = card.dataUrl;
    if (cachedImg) {
      displaySrc = getFilteredImage(
        cachedImg,
        card.filter || 'color',
        card.threshold !== undefined ? card.threshold : 128,
        0, // no rotation
        card.brightness !== undefined ? card.brightness : 100,
        card.contrast !== undefined ? card.contrast : 100,
        0, // no corner rounding
        cachedImg.width,
        card.temperature || 0,
        card.tint || 0,
        card.sharpness || 0
      );
    }
    
    itemEl.innerHTML = `
      <img src="${displaySrc}" alt="Cropped Card" id="gallery-card-img-${card.id}">
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
    
    // Select by click
    itemEl.addEventListener('click', (e) => {
      if (e.target.closest('.gallery-item-actions')) return;
      state.activeProcessedCardId = card.id;
      updateProcessedGallery();
      
      // If tabBtnEnhancer is present, switch tab, else render enhancer editor directly
      if (elements.tabBtnEnhancer) {
        elements.tabBtnEnhancer.click();
      } else {
        renderEnhancerEditor();
      }
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
      if (state.activeProcessedCardId === card.id) {
        state.activeProcessedCardId = state.processedCards.length > 0 ? state.processedCards[state.processedCards.length - 1].id : null;
      }
      
      updateProcessedGallery();
      renderWorkspace();
      renderEnhancerEditor();
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

function downloadCardEnhanced(cardId, format = 'jpeg') {
  const card = state.processedCards.find(c => c.id === cardId);
  if (!card) return;
  
  const cachedImg = state.imageCache[cardId];
  if (!cachedImg) return;
  
  const canvas = document.createElement('canvas');
  canvas.width = cachedImg.width;
  canvas.height = cachedImg.height;
  const ctx = canvas.getContext('2d');
  
  if (format === 'jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  
  const filteredUrl = getFilteredImage(
    cachedImg,
    card.filter || 'color',
    card.threshold !== undefined ? card.threshold : 128,
    0, // no rotation
    card.brightness !== undefined ? card.brightness : 100,
    card.contrast !== undefined ? card.contrast : 100,
    0, // no corner rounding
    cachedImg.width,
    card.temperature || 0,
    card.tint || 0,
    card.sharpness || 0
  );
  
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0);
    
    let dataUrl;
    let extension;
    if (format === 'png') {
      dataUrl = canvas.toDataURL('image/png');
      extension = 'png';
    } else {
      dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      extension = 'jpg';
    }
    
    let baseName = 'cropped_card';
    if (card.name) {
      baseName = card.name;
      const lastDot = baseName.lastIndexOf('.');
      if (lastDot !== -1) {
        baseName = baseName.slice(0, lastDot);
      }
    }
    
    downloadDataUrl(dataUrl, `${baseName}_enhanced.${extension}`);
    showToast(`Card downloaded as ${format.toUpperCase()}!`, 'success');
  };
  img.src = filteredUrl;
}

function downloadCardAsJpeg(cardId) {
  downloadCardEnhanced(cardId, 'jpeg');
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
      cardObj.filter || 'color',
      cardObj.threshold !== undefined ? cardObj.threshold : 128,
      placed.rotation,
      cardObj.brightness !== undefined ? cardObj.brightness : 100,
      cardObj.contrast !== undefined ? cardObj.contrast : 100,
      placed.cornerRadius,
      placed.w,
      cardObj.temperature || 0,
      cardObj.tint || 0,
      cardObj.sharpness || 0
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

function applyFiltersToPixelArray(data, width, height, filterType, threshold, brightness, contrast, temperature, tint, sharpness = 0) {
  width = Math.round(width);
  height = Math.round(height);
  
  // 1. First, apply sharpness if set
  if (sharpness !== 0) {
    const src = new Uint8ClampedArray(data);
    const s = sharpness / 100; // scale 0..1 range
    const w4 = width * 4;
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) {
          const idx = i + c;
          const val = src[idx] * (1 + 4 * s)
                    - s * (src[idx - 4] + src[idx + 4] + src[idx - w4] + src[idx + w4]);
          data[idx] = Math.max(0, Math.min(255, val));
        }
      }
    }
  }

  // 2. Now apply brightness, contrast, white balance offsets
  const bOffset = (brightness - 100) * 1.5; // range: -75 to +75
  const cVal = (contrast - 100) * 1.2;     // range: -60 to +60
  const cFactor = (259 * (cVal + 255)) / (255 * (259 - cVal));
  
  // Temperature shifts Red (+) and Blue (-) channels
  const rTemp = temperature * 0.6;
  const bTemp = -temperature * 0.6;
  
  // Tint shifts Green channel (+) relative to Red/Blue (-)
  const gTint = tint * 0.6;
  const rTint = -tint * 0.3;
  const bTint = -tint * 0.3;
  
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    
    // Apply White Balance & Brightness offsets
    let r_adj = r + bOffset + rTemp + rTint;
    let g_adj = g + bOffset + gTint;
    let b_adj = b + bOffset + bTemp + bTint;
    
    // Apply Contrast
    let r_contrast = cFactor * (r_adj - 128) + 128;
    let g_contrast = cFactor * (g_adj - 128) + 128;
    let b_contrast = cFactor * (b_adj - 128) + 128;
    
    // Clamp values
    r = Math.max(0, Math.min(255, r_contrast));
    g = Math.max(0, Math.min(255, g_contrast));
    b = Math.max(0, Math.min(255, b_contrast));
    
    // Apply Grayscale or Photocopy filters if needed
    if (filterType === 'grayscale') {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      data[i] = data[i+1] = data[i+2] = gray;
    } else if (filterType === 'photocopy') {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const val = gray >= threshold ? 255 : 0;
      data[i] = data[i+1] = data[i+2] = val;
    } else {
      // Color mode - just save adjusted RGB values
      data[i] = r;
      data[i+1] = g;
      data[i+2] = b;
    }
  }
}

function getFilteredImage(imgElement, filterType, threshold, rotation = 0, brightness = 100, contrast = 100, cornerRadiusMm = 0, placedWidthMm = 85.6, temperature = 0, tint = 0, sharpness = 0) {
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
  applyFiltersToPixelArray(imgData.data, w, h, filterType, threshold, brightness, contrast, temperature, tint, sharpness);
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
        const cardObj = state.processedCards.find(c => c.id === activePlaced.cardId);
        if (cardObj) {
          const imageCached = state.imageCache[activePlaced.cardId];
          const displaySrc = getFilteredImage(
            imageCached,
            cardObj.filter || 'color',
            cardObj.threshold !== undefined ? cardObj.threshold : 128,
            activePlaced.rotation,
            cardObj.brightness !== undefined ? cardObj.brightness : 100,
            cardObj.contrast !== undefined ? cardObj.contrast : 100,
            activePlaced.cornerRadius,
            activePlaced.w,
            cardObj.temperature || 0,
            cardObj.tint || 0,
            cardObj.sharpness || 0
          );
          cardEl.querySelector('img').src = displaySrc;
        }
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
   Visual Enhancer Undo/Redo Engine
   ========================================================================== */
function pushToEnhancerHistory() {
  const activeCard = state.processedCards.find(c => c.id === state.activeProcessedCardId);
  if (!activeCard) return;

  const snapshot = {
    cardId: activeCard.id,
    filter: activeCard.filter || 'color',
    threshold: activeCard.threshold !== undefined ? activeCard.threshold : 128,
    brightness: activeCard.brightness !== undefined ? activeCard.brightness : 100,
    contrast: activeCard.contrast !== undefined ? activeCard.contrast : 100,
    temperature: activeCard.temperature !== undefined ? activeCard.temperature : 0,
    tint: activeCard.tint !== undefined ? activeCard.tint : 0,
    sharpness: activeCard.sharpness !== undefined ? activeCard.sharpness : 0
  };

  enhancerHistory.push(snapshot);
  if (enhancerHistory.length > 50) {
    enhancerHistory.shift();
  }

  updateUndoButtonState();
}

function updateUndoButtonState() {
  if (elements.btnEnhancerUndo) {
    elements.btnEnhancerUndo.disabled = enhancerHistory.length === 0;
  }
}

function triggerEnhancerUndo() {
  if (enhancerHistory.length === 0) return;

  const snapshot = enhancerHistory.pop();
  const card = state.processedCards.find(c => c.id === snapshot.cardId);
  if (card) {
    card.filter = snapshot.filter;
    card.threshold = snapshot.threshold;
    card.brightness = snapshot.brightness;
    card.contrast = snapshot.contrast;
    card.temperature = snapshot.temperature;
    card.tint = snapshot.tint;
    card.sharpness = snapshot.sharpness !== undefined ? snapshot.sharpness : 0;

    if (state.activeProcessedCardId !== card.id) {
      state.activeProcessedCardId = card.id;
      // Re-render and select the card
      const items = document.querySelectorAll('.gallery-item');
      items.forEach(item => {
        if (item.getAttribute('data-id') === card.id) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });
      renderEnhancerEditor();
    } else {
      updateEnhancerInspectorValues(card);
      renderEnhancerCanvas();
    }

    syncCardVisuals(card.id);
  }

  updateUndoButtonState();
  showToast('Undo applied', 'success');
}

/* ==========================================================================
   Document Enhancer Dashboard control logic
   ========================================================================== */
function setWBPickerActive(active) {
  state.wbPickerActive = active;
  const btn = elements.btnEnhancerWBPicker;
  const canvas = elements.enhancerCanvas;
  if (!btn) return;
  
  if (active) {
    btn.classList.add('active');
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 12px; height: 12px;">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25V9m10.5 0a2.25 2.25 0 012.25 2.25v7.5A2.25 2.25 0 0118.75 21H5.25a2.25 2.25 0 01-2.25-2.25v-7.5A2.25 2.25 0 015.25 9m13.5 0H5.25" />
      </svg>
      <span>Click Pixel...</span>
    `;
    if (canvas) canvas.style.cursor = 'crosshair';
  } else {
    btn.classList.remove('active');
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 12px; height: 12px;">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 4.5l3.75 3.75M18 6.75L9 15.75H5.25v-3.75L14.25 3A2.121 2.121 0 1118 6.75z" />
      </svg>
      <span>Pick Pixel</span>
    `;
    if (canvas) canvas.style.cursor = '';
  }
}

function renderEnhancerEditor() {
  setWBPickerActive(false);
  const activeCard = state.processedCards.find(c => c.id === state.activeProcessedCardId);
  
  if (!activeCard) {
    elements.enhancerEmptyNotice.style.display = 'flex';
    elements.enhancerContainer.style.display = 'none';
    elements.enhancerCardNameLabel.textContent = 'No card selected';
    elements.enhancerInspector.style.display = 'none';
    return;
  }
  
  elements.enhancerEmptyNotice.style.display = 'none';
  elements.enhancerContainer.style.display = 'block';
  elements.enhancerInspector.style.display = 'flex';
  elements.enhancerCardNameLabel.textContent = activeCard.name || 'Cropped Card';
  
  updateEnhancerInspectorValues(activeCard);
  renderEnhancerCanvas();
}

function updateEnhancerInspectorValues(card) {
  const filters = ['color', 'grayscale', 'photocopy'];
  filters.forEach(f => {
    const btn = document.getElementById(`enhancer-filter-btn-${f}`);
    if (btn) {
      if (card.filter === f) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  });
  
  if (card.filter === 'photocopy') {
    elements.enhancerThresholdContainer.classList.add('active');
    const thresholdVal = card.threshold !== undefined ? card.threshold : 128;
    elements.enhancerPhotocopySlider.value = thresholdVal;
    if (elements.enhancerThresholdNum) {
      elements.enhancerThresholdNum.value = thresholdVal;
    }
  } else {
    elements.enhancerThresholdContainer.classList.remove('active');
  }
  
  const brightnessVal = card.brightness !== undefined ? card.brightness : 100;
  elements.enhancerBrightness.value = brightnessVal;
  if (elements.enhancerBrightnessNum) {
    elements.enhancerBrightnessNum.value = brightnessVal;
  }
  
  const contrastVal = card.contrast !== undefined ? card.contrast : 100;
  elements.enhancerContrast.value = contrastVal;
  if (elements.enhancerContrastNum) {
    elements.enhancerContrastNum.value = contrastVal;
  }
  
  const tempVal = card.temperature !== undefined ? card.temperature : 0;
  elements.enhancerTemp.value = tempVal;
  if (elements.enhancerTempNum) {
    elements.enhancerTempNum.value = tempVal;
  }
  
  const tintVal = card.tint !== undefined ? card.tint : 0;
  elements.enhancerTint.value = tintVal;
  if (elements.enhancerTintNum) {
    elements.enhancerTintNum.value = tintVal;
  }
  
  const sharpnessVal = card.sharpness !== undefined ? card.sharpness : 0;
  elements.enhancerSharpness.value = sharpnessVal;
  if (elements.enhancerSharpnessNum) {
    elements.enhancerSharpnessNum.value = sharpnessVal;
  }
}

function renderEnhancerCanvas() {
  const activeCard = state.processedCards.find(c => c.id === state.activeProcessedCardId);
  if (!activeCard) return;
  
  const canvas = elements.enhancerCanvas;
  const ctx = canvas.getContext('2d');
  const img = state.imageCache[activeCard.id];
  
  if (!img) return;
  
  const viewport = elements.enhancerViewport;
  const padding = 40;
  const maxW = viewport.clientWidth - padding;
  const maxH = viewport.clientHeight - padding;
  
  const scale = Math.min(maxW / img.width, maxH / img.height);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  
  canvas.width = w;
  canvas.height = h;
  
  elements.enhancerContainer.style.width = `${w}px`;
  elements.enhancerContainer.style.height = `${h}px`;
  
  // Align vertically
  const vh = viewport.clientHeight;
  const marginTop = Math.max(0, (vh - h - 40) / 2);
  elements.enhancerContainer.style.marginTop = `${marginTop}px`;
  
  // Draw the original raw card image onto preview canvas synchronously
  ctx.drawImage(img, 0, 0, w, h);
  
  // Apply visual adjustments directly on screen pixels in-place for 60fps performance
  const imgData = ctx.getImageData(0, 0, w, h);
  applyFiltersToPixelArray(
    imgData.data,
    w,
    h,
    activeCard.filter || 'color',
    activeCard.threshold !== undefined ? activeCard.threshold : 128,
    activeCard.brightness !== undefined ? activeCard.brightness : 100,
    activeCard.contrast !== undefined ? activeCard.contrast : 100,
    activeCard.temperature || 0,
    activeCard.tint || 0,
    activeCard.sharpness || 0
  );
  
  ctx.putImageData(imgData, 0, 0);
}

function syncCardVisuals(cardId) {
  const card = state.processedCards.find(c => c.id === cardId);
  if (!card) return;
  
  const cachedImg = state.imageCache[cardId];
  if (!cachedImg) return;
  
  // 1. Update Gallery Thumbnail
  const imgEl = document.getElementById(`gallery-card-img-${cardId}`);
  if (imgEl) {
    const filteredUrl = getFilteredImage(
      cachedImg,
      card.filter || 'color',
      card.threshold !== undefined ? card.threshold : 128,
      0, // no rotation
      card.brightness !== undefined ? card.brightness : 100,
      card.contrast !== undefined ? card.contrast : 100,
      0, // no corner rounding
      cachedImg.width,
      card.temperature || 0,
      card.tint || 0,
      card.sharpness || 0
    );
    imgEl.src = filteredUrl;
  }
  
  // 2. Update Placed Cards on A4 compiler sheets
  state.placedCards.forEach(placed => {
    if (placed.cardId === cardId) {
      const pageEl = document.getElementById(`a4-page-${placed.pageIndex}`);
      if (pageEl) {
        const cardEl = pageEl.querySelector(`.placed-card[data-id="${placed.id}"]`);
        if (cardEl) {
          const displaySrc = getFilteredImage(
            cachedImg,
            card.filter || 'color',
            card.threshold !== undefined ? card.threshold : 128,
            placed.rotation,
            card.brightness !== undefined ? card.brightness : 100,
            card.contrast !== undefined ? card.contrast : 100,
            placed.cornerRadius,
            placed.w,
            card.temperature || 0,
            card.tint || 0,
            card.sharpness || 0
          );
          cardEl.querySelector('img').src = displaySrc;
        }
      }
    }
  });
}

function setupEnhancerControls() {
  // Filters Click Events
  const filters = ['color', 'grayscale', 'photocopy'];
  filters.forEach(f => {
    const btn = document.getElementById(`enhancer-filter-btn-${f}`);
    if (btn) {
      btn.addEventListener('click', () => {
        const activeCard = state.processedCards.find(c => c.id === state.activeProcessedCardId);
        if (!activeCard) return;
        if (activeCard.filter === f) return; // avoid duplicate history if clicking the active one
        
        pushToEnhancerHistory();
        activeCard.filter = f;
        updateEnhancerInspectorValues(activeCard);
        renderEnhancerCanvas();
        syncCardVisuals(activeCard.id);
      });
    }
  });
  
  // Undo Button Event
  if (elements.btnEnhancerUndo) {
    elements.btnEnhancerUndo.addEventListener('click', triggerEnhancerUndo);
  }
  
  // Helper for sliders and number inputs to split input and change events with bi-directional syncing
  const setupSliderAndNumInput = (sliderEl, numInputEl, stateField) => {
    if (!sliderEl || !numInputEl) return;
    
    let isDragging = false;
    let isTyping = false;
    
    // SLIDER EVENTS
    sliderEl.addEventListener('mousedown', () => {
      pushToEnhancerHistory();
      isDragging = true;
    });
    
    sliderEl.addEventListener('touchstart', () => {
      pushToEnhancerHistory();
      isDragging = true;
    });
    
    sliderEl.addEventListener('keydown', (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) {
        pushToEnhancerHistory();
      }
    });
    
    sliderEl.addEventListener('input', (e) => {
      const activeCard = state.processedCards.find(c => c.id === state.activeProcessedCardId);
      if (!activeCard) return;
      
      const val = parseFloat(e.target.value);
      activeCard[stateField] = val;
      numInputEl.value = val;
      
      // Update screen synchronously (fast, 60fps, no black flashing)
      renderEnhancerCanvas();
    });
    
    sliderEl.addEventListener('change', (e) => {
      const activeCard = state.processedCards.find(c => c.id === state.activeProcessedCardId);
      if (!activeCard) return;
      
      isDragging = false;
      // Sync gallery thumbnails and A4 sheets only when slider dragging is finished
      syncCardVisuals(activeCard.id);
    });
    
    // NUMBER INPUT EVENTS
    numInputEl.addEventListener('focus', () => {
      if (!isTyping) {
        pushToEnhancerHistory();
        isTyping = true;
      }
    });
    
    numInputEl.addEventListener('blur', () => {
      isTyping = false;
    });
    
    numInputEl.addEventListener('input', (e) => {
      const activeCard = state.processedCards.find(c => c.id === state.activeProcessedCardId);
      if (!activeCard) return;
      
      let val = parseFloat(e.target.value);
      if (isNaN(val)) return;
      
      // Clamp values dynamically on typing
      const min = parseFloat(numInputEl.min);
      const max = parseFloat(numInputEl.max);
      if (val < min) val = min;
      if (val > max) val = max;
      
      activeCard[stateField] = val;
      sliderEl.value = val;
      
      renderEnhancerCanvas();
    });
    
    numInputEl.addEventListener('change', (e) => {
      const activeCard = state.processedCards.find(c => c.id === state.activeProcessedCardId);
      if (!activeCard) return;
      
      // Clamp on blur / commit
      let val = parseFloat(e.target.value);
      if (isNaN(val)) {
        val = activeCard[stateField] !== undefined ? activeCard[stateField] : (stateField === 'brightness' || stateField === 'contrast' ? 100 : (stateField === 'threshold' ? 128 : 0));
      }
      const min = parseFloat(numInputEl.min);
      const max = parseFloat(numInputEl.max);
      if (val < min) val = min;
      if (val > max) val = max;
      e.target.value = val;
      
      syncCardVisuals(activeCard.id);
    });
  };
  
  setupSliderAndNumInput(elements.enhancerPhotocopySlider, elements.enhancerThresholdNum, 'threshold');
  setupSliderAndNumInput(elements.enhancerBrightness, elements.enhancerBrightnessNum, 'brightness');
  setupSliderAndNumInput(elements.enhancerContrast, elements.enhancerContrastNum, 'contrast');
  setupSliderAndNumInput(elements.enhancerTemp, elements.enhancerTempNum, 'temperature');
  setupSliderAndNumInput(elements.enhancerTint, elements.enhancerTintNum, 'tint');
  setupSliderAndNumInput(elements.enhancerSharpness, elements.enhancerSharpnessNum, 'sharpness');

  // Reset Buttons Event bindings
  const bindResetButton = (btnId, sliderEl, numInputEl, defaultValue, stateField) => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener('click', () => {
        const activeCard = state.processedCards.find(c => c.id === state.activeProcessedCardId);
        if (!activeCard) return;
        
        const currentVal = activeCard[stateField] !== undefined ? activeCard[stateField] : defaultValue;
        if (currentVal === defaultValue) return;
        
        pushToEnhancerHistory();
        activeCard[stateField] = defaultValue;
        if (sliderEl) sliderEl.value = defaultValue;
        if (numInputEl) numInputEl.value = defaultValue;
        
        renderEnhancerCanvas();
        syncCardVisuals(activeCard.id);
      });
    }
  };
  
  bindResetButton('btn-enhancer-threshold-reset', elements.enhancerPhotocopySlider, elements.enhancerThresholdNum, 128, 'threshold');
  bindResetButton('btn-enhancer-brightness-reset', elements.enhancerBrightness, elements.enhancerBrightnessNum, 100, 'brightness');
  bindResetButton('btn-enhancer-contrast-reset', elements.enhancerContrast, elements.enhancerContrastNum, 100, 'contrast');
  bindResetButton('btn-enhancer-temp-reset', elements.enhancerTemp, elements.enhancerTempNum, 0, 'temperature');
  bindResetButton('btn-enhancer-tint-reset', elements.enhancerTint, elements.enhancerTintNum, 0, 'tint');
  bindResetButton('btn-enhancer-sharpness-reset', elements.enhancerSharpness, elements.enhancerSharpnessNum, 0, 'sharpness');

  // WB Picker Click Event
  if (elements.btnEnhancerWBPicker) {
    elements.btnEnhancerWBPicker.addEventListener('click', () => {
      const activeCard = state.processedCards.find(c => c.id === state.activeProcessedCardId);
      if (!activeCard) return;
      setWBPickerActive(!state.wbPickerActive);
    });
  }

  // Canvas Click Event for WB sampling
  if (elements.enhancerCanvas) {
    elements.enhancerCanvas.addEventListener('click', (e) => {
      if (!state.wbPickerActive) return;
      
      const activeCard = state.processedCards.find(c => c.id === state.activeProcessedCardId);
      if (!activeCard) return;
      
      const img = state.imageCache[activeCard.id];
      if (!img) return;
      
      const rect = elements.enhancerCanvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      
      // Map to canvas coordinate space
      const canvasX = (clickX / rect.width) * elements.enhancerCanvas.width;
      const canvasY = (clickY / rect.height) * elements.enhancerCanvas.height;
      
      // Map to original image dimensions
      const imgX = (canvasX / elements.enhancerCanvas.width) * img.width;
      const imgY = (canvasY / elements.enhancerCanvas.height) * img.height;
      
      // Create offscreen canvas to sample raw pixel color
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 1;
      tempCanvas.height = 1;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(img, Math.floor(imgX), Math.floor(imgY), 1, 1, 0, 0, 1, 1);
      const pixel = tempCtx.getImageData(0, 0, 1, 1).data;
      const r = pixel[0];
      const g = pixel[1];
      const b = pixel[2];
      
      // Calibrate temp and tint to make pixel neutral
      let temp = Math.round((b - r) / 1.2);
      let tint = Math.round((r + b - 2 * g) / 1.8);
      
      // Clamp to valid range [-50, 50]
      temp = Math.max(-50, Math.min(50, temp));
      tint = Math.max(-50, Math.min(50, tint));
      
      // Record history snapshot before applying calibration
      pushToEnhancerHistory();
      
      activeCard.temperature = temp;
      activeCard.tint = tint;
      
      // Update UI and re-render
      updateEnhancerInspectorValues(activeCard);
      renderEnhancerCanvas();
      syncCardVisuals(activeCard.id);
      
      setWBPickerActive(false);
      showToast(`White Balance calibrated: Temp = ${temp}, Tint = ${tint}`, 'success');
    });
  }

  // Ctrl+Z global shortcut inside visual enhancer
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      const isEnhancerActive = elements.enhancerPanel && elements.enhancerPanel.classList.contains('active');
      if (isEnhancerActive && enhancerHistory.length > 0) {
        e.preventDefault();
        triggerEnhancerUndo();
      }
    }
  });

  // Export card JPEG
  elements.btnEnhancerDownloadJpeg.addEventListener('click', () => {
    if (state.activeProcessedCardId) {
      downloadCardEnhanced(state.activeProcessedCardId, 'jpeg');
    }
  });

  // Export card PNG
  elements.btnEnhancerDownloadPng.addEventListener('click', () => {
    if (state.activeProcessedCardId) {
      downloadCardEnhanced(state.activeProcessedCardId, 'png');
    }
  });

  // Place on A4 Canvas
  elements.btnEnhancerPlace.addEventListener('click', () => {
    if (state.activeProcessedCardId) {
      addCardToActivePage(state.activeProcessedCardId);
      elements.tabBtnCompiler.click();
    }
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
        cardObj.filter || 'color',
        cardObj.threshold !== undefined ? cardObj.threshold : 128,
        placed.rotation,
        cardObj.brightness !== undefined ? cardObj.brightness : 100,
        cardObj.contrast !== undefined ? cardObj.contrast : 100,
        placed.cornerRadius,
        placed.w,
        cardObj.temperature || 0,
        cardObj.tint || 0,
        cardObj.sharpness || 0
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
  setupEnhancerControls();
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

/* ==========================================================================
   Edge-Detection Card Boundary Auto-Detection (Vanilla JS Math)
   ========================================================================== */
function detectCardCorners(img) {
  const canvas = document.createElement('canvas');
  const size = 150; // Downscale to 150x150 for noise tolerance and instant execution
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, size, size);
  
  let imgData;
  try {
    imgData = ctx.getImageData(0, 0, size, size);
  } catch (e) {
    console.error("Local canvas tainted or security error reading pixels", e);
    return [
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.9, y: 0.9 },
      { x: 0.1, y: 0.9 }
    ];
  }
  
  const data = imgData.data;
  const gray = new Uint8Array(size * size);
  const grad = new Float32Array(size * size);
  
  // Grayscale conversion
  for (let i = 0; i < size * size; i++) {
    const idx = i * 4;
    gray[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
  }
  
  // Compute horizontal & vertical gradients (Sobel filter approximation)
  let maxGrad = 0;
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const idx = y * size + x;
      const dx = (
        -gray[idx - size - 1] + gray[idx - size + 1]
        - 2 * gray[idx - 1] + 2 * gray[idx + 1]
        - gray[idx + size - 1] + gray[idx + size + 1]
      );
      const dy = (
        -gray[idx - size - 1] - 2 * gray[idx - size] - gray[idx - size + 1]
        + gray[idx + size - 1] + 2 * gray[idx + size] + gray[idx + size + 1]
      );
      
      const val = Math.hypot(dx, dy);
      grad[idx] = val;
      if (val > maxGrad) {
        maxGrad = val;
      }
    }
  }
  
  // Simple Box Blur on gradients to reduce single-pixel contrast noise
  const smoothGrad = new Float32Array(size * size);
  for (let y = 2; y < size - 2; y++) {
    for (let x = 2; x < size - 2; x++) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          sum += grad[(y + ky) * size + (x + kx)];
        }
      }
      smoothGrad[y * size + x] = sum / 9;
    }
  }
  
  const center = size / 2;
  const globalThreshold = maxGrad * 0.15; // Noise gate
  
  const corners = [
    { startX: 0, startY: 0 },               // TL
    { startX: size - 1, startY: 0 },        // TR
    { startX: size - 1, startY: size - 1 }, // BR
    { startX: 0, startY: size - 1 }         // BL
  ];
  
  const detected = [];
  
  corners.forEach((c, idx) => {
    // Scan outward from the center towards the corner c
    const dx = c.startX - center;
    const dy = c.startY - center;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    const stepX = dx / steps;
    const stepY = dy / steps;
    
    let peakVal = 0;
    let peakIdx = -1;
    
    // Ignore first 18% of path to skip inner card text, stop at 92% to avoid photo borders
    const startStep = Math.round(steps * 0.18);
    const endStep = Math.round(steps * 0.92);
    
    // First pass: search outward from the center for the first local peak exceeding threshold
    for (let step = startStep; step <= endStep; step++) {
      const curX = Math.round(center + step * stepX);
      const curY = Math.round(center + step * stepY);
      const gVal = smoothGrad[curY * size + curX];
      
      if (gVal > globalThreshold) {
        // Check if local peak
        const prevX = Math.round(center + (step - 1) * stepX);
        const prevY = Math.round(center + (step - 1) * stepY);
        const nextX = Math.round(center + (step + 1) * stepX);
        const nextY = Math.round(center + (step + 1) * stepY);
        const prevVal = smoothGrad[prevY * size + prevX];
        const nextVal = smoothGrad[nextY * size + nextX];
        
        if (gVal >= prevVal && gVal >= nextVal) {
          peakIdx = step;
          peakVal = gVal;
          break; // Found first card boundary edge outward from center!
        }
      }
    }
    
    // Fallback: if no local peak exceeded threshold, use the absolute maximum peak along the ray
    if (peakIdx === -1) {
      for (let step = startStep; step <= endStep; step++) {
        const curX = Math.round(center + step * stepX);
        const curY = Math.round(center + step * stepY);
        const gVal = smoothGrad[curY * size + curX];
        
        if (gVal > peakVal) {
          peakVal = gVal;
          peakIdx = step;
        }
      }
    }
    
    if (peakIdx !== -1 && peakVal > globalThreshold) {
      const bestX = Math.round(center + peakIdx * stepX);
      const bestY = Math.round(center + peakIdx * stepY);
      detected.push({
        x: parseFloat((bestX / size).toFixed(3)),
        y: parseFloat((bestY / size).toFixed(3))
      });
    } else {
      // Fallback standard coordinates
      if (idx === 0) detected.push({ x: 0.1, y: 0.1 });
      else if (idx === 1) detected.push({ x: 0.9, y: 0.1 });
      else if (idx === 2) detected.push({ x: 0.9, y: 0.9 });
      else detected.push({ x: 0.1, y: 0.9 });
    }
  });
  
  return detected;
}
