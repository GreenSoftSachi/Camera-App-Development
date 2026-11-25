(() => {
  const video = document.getElementById('cameraVideo');
  const canvas = document.getElementById('previewCanvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const viewfinderStage = document.getElementById('viewfinderStage');
  const gridOverlay = document.getElementById('gridOverlay');
  const focusReticle = document.getElementById('focusReticle');
  const focusTag = document.getElementById('focusTag');
  const countdownOverlay = document.getElementById('countdownOverlay');
  const flashOverlay = document.getElementById('flashOverlay');
  const statusPill = document.getElementById('statusPill');
  const statusText = document.getElementById('statusText');
  const demoBadge = document.getElementById('demoBadge');
  const retryCameraBtn = document.getElementById('retryCameraBtn');

  // Top bar buttons & labels
  const flashBtn = document.getElementById('flashBtn');
  const flashLabel = document.getElementById('flashLabel');
  const hdrBtn = document.getElementById('hdrBtn');
  const hdrLabel = document.getElementById('hdrLabel');
  const awbBtn = document.getElementById('awbBtn');
  const awbLabel = document.getElementById('awbLabel');
  const afModeBtn = document.getElementById('afModeBtn');
  const afLabel = document.getElementById('afLabel');
  const timerBtn = document.getElementById('timerBtn');
  const timerLabel = document.getElementById('timerLabel');
  const gridBtn = document.getElementById('gridBtn');
  const gridLabel = document.getElementById('gridLabel');
  const ispToggleBtn = document.getElementById('ispToggleBtn');

  // Telemetry
  const evReadout = document.getElementById('evReadout');
  const awbReadout = document.getElementById('awbReadout');
  const afReadout = document.getElementById('afReadout');
  const ispReadout = document.getElementById('ispReadout');

  // ISP Panel & Sliders
  const ispPanel = document.getElementById('ispPanel');
  const presetBalancedBtn = document.getElementById('presetBalancedBtn');
  const presetRawBtn = document.getElementById('presetRawBtn');

  const ctrlEv = document.getElementById('ctrlEv');
  const ctrlHdr = document.getElementById('ctrlHdr');
  const ctrlContrast = document.getElementById('ctrlContrast');
  const ctrlSharpness = document.getElementById('ctrlSharpness');
  const ctrlMfnr = document.getElementById('ctrlMfnr');
  const ctrlTemp = document.getElementById('ctrlTemp');
  const ctrlTint = document.getElementById('ctrlTint');
  const ctrlFocus = document.getElementById('ctrlFocus');

  const valEv = document.getElementById('valEv');
  const valHdr = document.getElementById('valHdr');
  const valContrast = document.getElementById('valContrast');
  const valSharpness = document.getElementById('valSharpness');
  const valMfnr = document.getElementById('valMfnr');
  const valTemp = document.getElementById('valTemp');
  const valTint = document.getElementById('valTint');
  const valFocus = document.getElementById('valFocus');

  // Bottom controls
  const modeButtons = document.querySelectorAll('.mode-btn');
  const zoomButtons = document.querySelectorAll('.zoom-btn');
  const shutterBtn = document.getElementById('shutterBtn');
  const switchCamBtn = document.getElementById('switchCamBtn');
  const galleryBtn = document.getElementById('galleryBtn');
  const lastThumbImg = document.getElementById('lastThumbImg');
  const thumbPlaceholder = document.getElementById('thumbPlaceholder');

  // Gallery modal
  const galleryModal = document.getElementById('galleryModal');
  const closeGalleryBtn = document.getElementById('closeGalleryBtn');
  const galleryGrid = document.getElementById('galleryGrid');
  const emptyGalleryMsg = document.getElementById('emptyGalleryMsg');

  // State
  const flashModes = ['Auto', 'On', 'Off', 'Torch'];
  const hdrModes = ['On', 'Auto', 'Off'];
  const awbPresets = [
    { name: 'Auto', temp: 5200, tint: 4 },
    { name: 'Indoor', temp: 4600, tint: 8 },
    { name: 'Daylight', temp: 5600, tint: 0 },
    { name: 'Fluorescent', temp: 4200, tint: 14 },
  ];
  const afModes = ['AF-C', 'AF-S', 'Macro'];
  const timerModes = [0, 3, 10];

  const state = {
    mode: 'Capture',
    facingMode: 'environment',
    zoom: 1,
    flashIdx: 0,
    hdrIdx: 0,
    awbIdx: 0,
    afIdx: 0,
    timerIdx: 0,
    gridOn: false,
    ispOpen: false,
    usingDemoScene: false,
    stream: null,
    isRecording: false,
    mediaRecorder: null,
    recordedChunks: [],
    recordStart: 0,
    recordTimerId: null,
    timelapseTimerId: null,
    timelapseCount: 0,
    mediaItems: [],
    isp: {
      ev: -0.2,
      hdr: 65,
      contrast: 112,
      sharpness: 35,
      mfnr: 40,
      temp: 5200,
      tint: 4,
      manualFocus: 0,
    },
  };

  // Offscreen buffer for pixel-level highlight recovery & AWB tint
  const workCanvas = document.createElement('canvas');
  const workCtx = workCanvas.getContext('2d', { willReadFrequently: true });

  function syncSlidersToState() {
    ctrlEv.value = state.isp.ev;
    ctrlHdr.value = state.isp.hdr;
    ctrlContrast.value = state.isp.contrast;
    ctrlSharpness.value = state.isp.sharpness;
    ctrlMfnr.value = state.isp.mfnr;
    ctrlTemp.value = state.isp.temp;
    ctrlTint.value = state.isp.tint;
    ctrlFocus.value = state.isp.manualFocus;

    valEv.textContent = (state.isp.ev >= 0 ? '+' : '') + Number(state.isp.ev).toFixed(1);
    valHdr.textContent = `${state.isp.hdr}%`;
    valContrast.textContent = `${state.isp.contrast}%`;
    valSharpness.textContent = `${state.isp.sharpness}%`;
    valMfnr.textContent = `${state.isp.mfnr}%`;
    valTemp.textContent = `${state.isp.temp}K`;
    valTint.textContent = (state.isp.tint >= 0 ? '+' : '') + state.isp.tint;
    valFocus.textContent = state.isp.manualFocus === 0 ? 'Auto' : `${state.isp.manualFocus}%`;

    evReadout.textContent = `EV ${valEv.textContent}`;
    awbReadout.textContent = `AWB ${state.isp.temp}K`;
    afReadout.textContent = state.isp.manualFocus > 0 ? `MF ${state.isp.manualFocus}%` : `AF: ${afModes[state.afIdx]}`;
    const hdrLabelText = hdrModes[state.hdrIdx] !== 'Off' ? 'HDR' : 'SDR';
    const mfnrText = state.isp.mfnr > 0 ? ' + MFNR' : '';
    ispReadout.textContent = `${hdrLabelText}${mfnrText}`;
  }

  async function startCamera() {
    if (state.stream) {
      state.stream.getTracks().forEach((t) => t.stop());
      state.stream = null;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      enableDemoScene();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: state.facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      state.stream = stream;
      state.usingDemoScene = false;
      demoBadge.classList.add('hidden');
      video.srcObject = stream;
      await video.play();
    } catch {
      enableDemoScene();
    }
  }

  function enableDemoScene() {
    state.usingDemoScene = true;
    demoBadge.classList.remove('hidden');
  }

  // Draw a realistic bright indoor scene (glass window, reflective floor, document) when no webcam is present
  function drawSimulatedIndoorScene(targetCtx, w, h, t) {
    // Wall & ceiling gradient
    const wallGrad = targetCtx.createLinearGradient(0, 0, 0, h * 0.68);
    wallGrad.addColorStop(0, '#d8e0d8'); // slight greenish indoor cast before AWB fix
    wallGrad.addColorStop(1, '#eef2ec');
    targetCtx.fillStyle = wallGrad;
    targetCtx.fillRect(0, 0, w, h * 0.68);

    // Bright indoor window (simulates severe highlight clipping if HDR/AE not tuned)
    const winX = w * 0.56;
    const winY = h * 0.14;
    const winW = w * 0.34;
    const winH = h * 0.34;
    const winGrad = targetCtx.createLinearGradient(winX, winY, winX + winW, winY + winH);
    winGrad.addColorStop(0, '#ffffff');
    winGrad.addColorStop(0.55, '#f6fbff');
    winGrad.addColorStop(1, '#dce9f5');
    targetCtx.fillStyle = winGrad;
    targetCtx.fillRect(winX, winY, winW, winH);

    // Window mullions
    targetCtx.strokeStyle = '#9aa5b1';
    targetCtx.lineWidth = 4;
    targetCtx.strokeRect(winX, winY, winW, winH);
    targetCtx.beginPath();
    targetCtx.moveTo(winX + winW / 2, winY);
    targetCtx.lineTo(winX + winW / 2, winY + winH);
    targetCtx.stroke();

    // Reflective polished floor
    const floorGrad = targetCtx.createLinearGradient(0, h * 0.68, 0, h);
    floorGrad.addColorStop(0, '#c7ccd1');
    floorGrad.addColorStop(0.4, '#e5e9ed');
    floorGrad.addColorStop(1, '#98a2ad');
    targetCtx.fillStyle = floorGrad;
    targetCtx.fillRect(0, h * 0.68, w, h * 0.32);

    // Specular reflection on floor from window
    targetCtx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    targetCtx.beginPath();
    targetCtx.moveTo(winX, h * 0.68);
    targetCtx.lineTo(winX + winW, h * 0.68);
    targetCtx.lineTo(winX + winW + 40, h);
    targetCtx.lineTo(winX - 25, h);
    targetCtx.closePath();
    targetCtx.fill();

    // Desk & document card (for AF / sharpness / macro test)
    const deskY = h * 0.54;
    targetCtx.fillStyle = '#5c4b3b';
    targetCtx.fillRect(w * 0.08, deskY, w * 0.42, h * 0.16);

    // White paper document on desk
    targetCtx.fillStyle = '#f8fafc';
    targetCtx.fillRect(w * 0.13, deskY + 14, w * 0.24, h * 0.11);
    targetCtx.fillStyle = '#1e293b';
    targetCtx.font = 'bold 12px sans-serif';
    targetCtx.fillText('AF CHART', w * 0.15, deskY + 34);
    targetCtx.fillStyle = '#475569';
    targetCtx.fillRect(w * 0.15, deskY + 42, w * 0.18, 3);
    targetCtx.fillRect(w * 0.15, deskY + 50, w * 0.14, 3);

    // Subtle moving indoor plant / light shimmer
    const sway = Math.sin(t * 0.0015) * 4;
    targetCtx.fillStyle = '#3f6212';
    targetCtx.beginPath();
    targetCtx.ellipse(w * 0.44 + sway, deskY - 8, 18, 28, -0.2, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.fillStyle = '#4d7c0f';
    targetCtx.beginPath();
    targetCtx.ellipse(w * 0.46 - sway * 0.6, deskY - 14, 14, 24, 0.35, 0, Math.PI * 2);
    targetCtx.fill();
  }

  // Apply ISP-style processing: AE exposure, HDR highlight compression, Contrast, AWB Temp/Tint, Portrait blur
  function renderFrame(timestamp) {
    const rect = viewfinderStage.getBoundingClientRect();
    const targetW = Math.max(360, Math.round(rect.width));
    const targetH = Math.max(640, Math.round(rect.height));

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    // Use smaller work buffer for fast per-pixel HDR + AWB processing
    const procW = 360;
    const procH = Math.round((targetH / targetW) * procW);
    if (workCanvas.width !== procW || workCanvas.height !== procH) {
      workCanvas.width = procW;
      workCanvas.height = procH;
    }

    workCtx.save();
    workCtx.clearRect(0, 0, procW, procH);

    // Zoom transform
    const z = state.zoom;
    workCtx.translate(procW / 2, procH / 2);
    workCtx.scale(z, z);
    if (state.facingMode === 'user' && !state.usingDemoScene) {
      workCtx.scale(-1, 1);
    }
    workCtx.translate(-procW / 2, -procH / 2);

    if (!state.usingDemoScene && video.readyState >= 2) {
      const vw = video.videoWidth || procW;
      const vh = video.videoHeight || procH;
      const scale = Math.max(procW / vw, procH / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      workCtx.drawImage(video, (procW - dw) / 2, (procH - dh) / 2, dw, dh);
    } else {
      drawSimulatedIndoorScene(workCtx, procW, procH, timestamp);
    }
    workCtx.restore();

    // Pixel-level ISP pass: AE/EV, HDR Highlight Recovery, Contrast, AWB Temp/Tint
    const imgData = workCtx.getImageData(0, 0, procW, procH);
    const d = imgData.data;

    const evGain = Math.pow(2, state.isp.ev * 0.65);
    const hdrStrength = hdrModes[state.hdrIdx] === 'Off' ? 0 : state.isp.hdr / 100;
    const contrastFactor = state.isp.contrast / 100;
    const tempShift = (state.isp.temp - 5200) / 2200; // positive = warmer
    const tintShift = state.isp.tint / 30; // positive = magenta (cancels green cast)

    const rMult = 1 + tempShift * 0.16 + tintShift * 0.08;
    const gMult = 1 - tintShift * 0.12;
    const bMult = 1 - tempShift * 0.18 + tintShift * 0.06;

    for (let i = 0; i < d.length; i += 4) {
      let r = d[i] * evGain * rMult;
      let g = d[i + 1] * evGain * gMult;
      let b = d[i + 2] * evGain * bMult;

      // HDR Highlight Recovery: soft-knee compression above 185
      if (hdrStrength > 0) {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (lum > 185) {
          const excess = (lum - 185) / 70;
          const compress = 1 - hdrStrength * 0.34 * Math.min(1.4, excess);
          r *= compress;
          g *= compress;
          b *= compress;
        }
      }

      // Contrast curve around midpoint 128
      r = (r - 128) * contrastFactor + 128;
      g = (g - 128) * contrastFactor + 128;
      b = (b - 128) * contrastFactor + 128;

      d[i] = r < 0 ? 0 : r > 255 ? 255 : r;
      d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
      d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }

    workCtx.putImageData(imgData, 0, 0);

    // Draw processed buffer to main viewfinder canvas
    ctx.save();
    ctx.clearRect(0, 0, targetW, targetH);

    // Subtle blur if manual focus is off-center or portrait mode vignette
    if (state.mode === 'Portrait') {
      ctx.filter = 'saturate(1.06)';
    } else if (state.isp.sharpness > 55) {
      ctx.filter = 'contrast(1.03)';
    } else {
      ctx.filter = 'none';
    }

    ctx.drawImage(workCanvas, 0, 0, targetW, targetH);
    ctx.restore();

    // Panorama guide line
    if (state.mode === 'Panorama') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 212, 59, 0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(24, targetH / 2);
      ctx.lineTo(targetW - 24, targetH / 2);
      ctx.stroke();
      ctx.restore();
    }

    requestAnimationFrame(renderFrame);
  }

  // Trigger Rear Flash Synchronization effect
  async function triggerFlashIfNeeded() {
    const mode = flashModes[state.flashIdx];
    if (mode === 'On' || mode === 'Auto') {
      flashOverlay.classList.add('firing');
      await new Promise((r) => setTimeout(r, 110));
      flashOverlay.classList.remove('firing');
    }
  }

  function addMediaToGallery(url, type, label) {
    state.mediaItems.unshift({ url, type, label, time: new Date().toLocaleTimeString() });
    thumbPlaceholder.classList.add('hidden');
    lastThumbImg.classList.remove('hidden');
    if (type === 'image') {
      lastThumbImg.src = url;
    }
    renderGallery();
  }

  function renderGallery() {
    if (state.mediaItems.length === 0) {
      emptyGalleryMsg.classList.remove('hidden');
      return;
    }
    emptyGalleryMsg.classList.add('hidden');
    galleryGrid.innerHTML = '';

    state.mediaItems.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'media-card';

      if (item.type === 'image') {
        const img = document.createElement('img');
        img.src = item.url;
        img.alt = item.label;
        card.appendChild(img);
      } else {
        const vid = document.createElement('video');
        vid.src = item.url;
        vid.controls = true;
        card.appendChild(vid);
      }

      const meta = document.createElement('div');
      meta.className = 'media-card-meta';
      meta.innerHTML = `<span>${item.label} • ${item.time}</span>`;
      const dl = document.createElement('a');
      dl.href = item.url;
      dl.download = `procam-${idx + 1}.${item.type === 'image' ? 'png' : 'webm'}`;
      dl.textContent = 'Save';
      meta.appendChild(dl);

      card.appendChild(meta);
      galleryGrid.appendChild(card);
    });
  }

  async function capturePhoto() {
    const timerSec = timerModes[state.timerIdx];
    if (timerSec > 0) {
      countdownOverlay.classList.add('visible');
      for (let s = timerSec; s >= 1; s--) {
        countdownOverlay.textContent = s;
        await new Promise((r) => setTimeout(r, 1000));
      }
      countdownOverlay.classList.remove('visible');
    }

    await triggerFlashIfNeeded();
    const dataUrl = canvas.toDataURL('image/png');
    addMediaToGallery(dataUrl, 'image', state.mode);
  }

  function formatDuration(ms) {
    const sec = Math.floor(ms / 1000);
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function toggleVideoRecording() {
    if (state.isRecording) {
      state.isRecording = false;
      shutterBtn.classList.remove('recording');
      statusPill.classList.add('hidden');
      clearInterval(state.recordTimerId);
      clearInterval(state.timelapseTimerId);

      if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
        state.mediaRecorder.stop();
      }
      return;
    }

    state.isRecording = true;
    shutterBtn.classList.add('recording');
    statusPill.classList.remove('hidden');
    state.recordStart = Date.now();

    if (state.mode === 'Time lapse') {
      state.timelapseCount = 0;
      statusText.textContent = 'TL 0 frames';
      state.timelapseTimerId = setInterval(() => {
        state.timelapseCount += 1;
        statusText.textContent = `TL ${state.timelapseCount} frames`;
      }, 600);
    } else {
      statusText.textContent = '00:00';
      state.recordTimerId = setInterval(() => {
        statusText.textContent = formatDuration(Date.now() - state.recordStart);
      }, 250);
    }

    if (canvas.captureStream && typeof MediaRecorder !== 'undefined') {
      const stream = canvas.captureStream(state.mode === 'Time lapse' ? 6 : 30);
      state.recordedChunks = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) state.recordedChunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(state.recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        addMediaToGallery(url, 'video', state.mode);
      };
      recorder.start();
      state.mediaRecorder = recorder;
    }
  }

  // Event Listeners
  viewfinderStage.addEventListener('click', (e) => {
    const rect = viewfinderStage.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    focusReticle.style.left = `${x}px`;
    focusReticle.style.top = `${y}px`;
    focusTag.textContent = `${afModes[state.afIdx]} LOCKED`;
    focusReticle.classList.add('active');
    clearTimeout(focusReticle._hideTimer);
    focusReticle._hideTimer = setTimeout(() => {
      focusReticle.classList.remove('active');
    }, 1500);
  });

  flashBtn.addEventListener('click', () => {
    state.flashIdx = (state.flashIdx + 1) % flashModes.length;
    const mode = flashModes[state.flashIdx];
    flashLabel.textContent = mode;
    flashBtn.classList.toggle('active', mode !== 'Off');
    flashOverlay.style.opacity = mode === 'Torch' ? '0.22' : '';
  });

  hdrBtn.addEventListener('click', () => {
    state.hdrIdx = (state.hdrIdx + 1) % hdrModes.length;
    const mode = hdrModes[state.hdrIdx];
    hdrLabel.textContent = mode;
    hdrBtn.classList.toggle('active', mode !== 'Off');
    syncSlidersToState();
  });

  awbBtn.addEventListener('click', () => {
    state.awbIdx = (state.awbIdx + 1) % awbPresets.length;
    const preset = awbPresets[state.awbIdx];
    awbLabel.textContent = preset.name;
    state.isp.temp = preset.temp;
    state.isp.tint = preset.tint;
    awbBtn.classList.toggle('active', preset.name !== 'Auto');
    syncSlidersToState();
  });

  afModeBtn.addEventListener('click', () => {
    state.afIdx = (state.afIdx + 1) % afModes.length;
    afLabel.textContent = afModes[state.afIdx];
    afModeBtn.classList.toggle('active', afModes[state.afIdx] === 'Macro');
    syncSlidersToState();
  });

  timerBtn.addEventListener('click', () => {
    state.timerIdx = (state.timerIdx + 1) % timerModes.length;
    const t = timerModes[state.timerIdx];
    timerLabel.textContent = t === 0 ? 'Off' : `${t}s`;
    timerBtn.classList.toggle('active', t > 0);
  });

  gridBtn.addEventListener('click', () => {
    state.gridOn = !state.gridOn;
    gridLabel.textContent = state.gridOn ? 'On' : 'Off';
    gridOverlay.classList.toggle('visible', state.gridOn);
    gridBtn.classList.toggle('active', state.gridOn);
  });

  ispToggleBtn.addEventListener('click', () => {
    state.ispOpen = !state.ispOpen;
    ispPanel.classList.toggle('hidden', !state.ispOpen);
    ispToggleBtn.classList.toggle('active', state.ispOpen);
  });

  // ISP Slider bindings
  const sliderBindings = [
    [ctrlEv, 'ev', parseFloat],
    [ctrlHdr, 'hdr', parseInt],
    [ctrlContrast, 'contrast', parseInt],
    [ctrlSharpness, 'sharpness', parseInt],
    [ctrlMfnr, 'mfnr', parseInt],
    [ctrlTemp, 'temp', parseInt],
    [ctrlTint, 'tint', parseInt],
    [ctrlFocus, 'manualFocus', parseInt],
  ];

  sliderBindings.forEach(([el, key, parser]) => {
    el.addEventListener('input', () => {
      state.isp[key] = parser(el.value, 10);
      syncSlidersToState();
    });
  });

  presetBalancedBtn.addEventListener('click', () => {
    state.isp = { ev: -0.2, hdr: 65, contrast: 112, sharpness: 35, mfnr: 40, temp: 5200, tint: 4, manualFocus: 0 };
    syncSlidersToState();
  });

  presetRawBtn.addEventListener('click', () => {
    state.isp = { ev: 0.4, hdr: 0, contrast: 92, sharpness: 0, mfnr: 0, temp: 5000, tint: -8, manualFocus: 0 };
    syncSlidersToState();
  });

  // Mode selection
  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.isRecording) return;
      modeButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.mode = btn.dataset.mode;

      const isVideoLike = state.mode === 'Video' || state.mode === 'Time lapse';
      shutterBtn.classList.toggle('video-mode', isVideoLike);

      // Automatically open ISP panel in Pro mode
      if (state.mode === 'Pro') {
        state.ispOpen = true;
        ispPanel.classList.remove('hidden');
        ispToggleBtn.classList.add('active');
      }
    });
  });

  // Zoom selection
  zoomButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      zoomButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.zoom = parseFloat(btn.dataset.zoom);
    });
  });

  // Shutter
  shutterBtn.addEventListener('click', () => {
    if (state.mode === 'Video' || state.mode === 'Time lapse') {
      toggleVideoRecording();
    } else {
      capturePhoto();
    }
  });

  switchCamBtn.addEventListener('click', () => {
    state.facingMode = state.facingMode === 'environment' ? 'user' : 'environment';
    startCamera();
  });

  retryCameraBtn.addEventListener('click', startCamera);

  galleryBtn.addEventListener('click', () => galleryModal.classList.remove('hidden'));
  closeGalleryBtn.addEventListener('click', () => galleryModal.classList.add('hidden'));

  // Init
  syncSlidersToState();
  startCamera();
  requestAnimationFrame(renderFrame);
})();
