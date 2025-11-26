// waveVisualizer.js
// Robust waveform visualizer for local or remote audio.
// - Auto-injects a canvas into the #callModalContainer when available
// - Supports MediaStream or HTMLAudioElement (srcObject)
// - Exposes start/stop helpers and auto-starts when remoteAudio has a stream

(function () {
  'use strict';

  const CANVAS_ID = 'audioWaveCanvas';
  let audioCtx = null;
  let analyser = null;
  let dataArray = null;
  let bufferLength = 0;
  let sourceNode = null;
  let animationId = null;
  let canvas = null;
  let canvasCtx = null;

  function ensureCanvas() {
    if (canvas) return canvas;
    const container = document.getElementById('callModalContainer') || document.body;
    canvas = document.getElementById(CANVAS_ID);
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = CANVAS_ID;
      // style it to sit inside call modal nicely
      canvas.style.width = '260px';
      canvas.style.height = '60px';
      canvas.style.borderRadius = '12px';
      canvas.style.marginTop = '12px';
      canvas.style.background = 'linear-gradient(90deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))';
      canvas.style.boxSizing = 'border-box';
      canvas.className = 'drop-shadow-silver';
      // try to place it inside the call modal if it exists
      const callModal = document.querySelector('#callModalContainer .call-modal');
      if (callModal) {
        // insert before actions if possible
        const actions = callModal.querySelector('.call-actions');
        if (actions) callModal.insertBefore(canvas, actions);
        else callModal.appendChild(canvas);
      } else {
        container.appendChild(canvas);
      }
    }
    canvasCtx = canvas.getContext('2d');
    return canvas;
  }

  function setupAnalyser() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      // Resume context if suspended (required for user interaction-first security model)
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(err => console.warn('AudioContext resume failed:', err));
      }
      if (!analyser) {
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048; // good default for waveform
        analyser.smoothingTimeConstant = 0.75; // a bit of smoothing
        bufferLength = analyser.fftSize;
        dataArray = new Uint8Array(bufferLength);
      }
    } catch (e) {
      console.error('waveVisualizer: setupAnalyser failed', e);
      throw e;
    }
  }

  function resizeCanvas() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = parseInt(canvas.style.width) || canvas.clientWidth || 260;
    const h = parseInt(canvas.style.height) || canvas.clientHeight || 60;
    canvas.width = Math.max(1, w * dpr);
    canvas.height = Math.max(1, h * dpr);
    canvasCtx.scale(dpr, dpr);
  }

  function drawWave() {
    if (!analyser || !canvasCtx) return;
    analyser.getByteTimeDomainData(dataArray);
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    // draw background bar
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvasCtx.fillStyle = 'rgba(255,255,255,0.02)';
    canvasCtx.fillRect(0, 0, width, height);
    // draw waveform
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = 'rgba(6,182,212,0.95)';
    canvasCtx.beginPath();
    const sliceWidth = width * 1.0 / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0; // 0..2
      const y = (v * height) / 2;
      if (i === 0) canvasCtx.moveTo(x, y);
      else canvasCtx.lineTo(x, y);
      x += sliceWidth;
    }
    canvasCtx.lineTo(width, height / 2);
    canvasCtx.stroke();
    animationId = requestAnimationFrame(drawWave);
  }

  function startFromMediaStream(stream) {
    try {
      ensureCanvas();
      setupAnalyser();
      stopVisualizer();
      sourceNode = audioCtx.createMediaStreamSource(stream);
      sourceNode.connect(analyser);
      analyser.connect(audioCtx.destination); // avoid silent context in some browsers
      resizeCanvas();
      drawWave();
    } catch (e) {
      console.warn('waveVisualizer: failed to start from MediaStream', e);
    }
  }

  function startFromMediaElement(audioEl) {
    try {
      ensureCanvas();
      setupAnalyser();
      stopVisualizer();
      // resume audio context on user gesture if suspended
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      // createMediaElementSource may throw if cross-origin without CORS — catch
      sourceNode = audioCtx.createMediaElementSource(audioEl);
      sourceNode.connect(analyser);
      // Note: do NOT connect analyser to destination unless needed; many browsers require a destination
      analyser.connect(audioCtx.destination);
      resizeCanvas();
      drawWave();
    } catch (e) {
      console.warn('waveVisualizer: failed to start from MediaElement', e);
      // fallback: if audioEl has srcObject (MediaStream) then try that
      if (audioEl && audioEl.srcObject instanceof MediaStream) {
        startFromMediaStream(audioEl.srcObject);
      }
    }
  }

  function stopVisualizer() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    try {
      if (sourceNode) {
        try { sourceNode.disconnect(); } catch (e) {}
        sourceNode = null;
      }
      if (analyser) {
        try { analyser.disconnect(); } catch (e) {}
      }
      // Do not close audioCtx; reuse it across sessions (closing may lock output)
    } catch (e) {
      // ignore
    }
    if (canvasCtx) {
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // Auto-start behavior: monitor #remoteAudio for a srcObject and play state
  function tryAutoStart() {
    const remoteAudio = document.getElementById('remoteAudio');
    if (!remoteAudio) return;
    // if srcObject is present and has tracks, start
    if (remoteAudio.srcObject instanceof MediaStream) {
      const ms = remoteAudio.srcObject;
      if (ms.getAudioTracks().length > 0) {
        startFromMediaStream(ms);
        return;
      }
    }
    // else, if audio element plays and has src, try media element source
    remoteAudio.addEventListener('play', () => {
      if (remoteAudio.srcObject) startFromMediaElement(remoteAudio);
    });

    // Observe changes to srcObject using a poller with faster detection and timeout
    let checks = 0;
    const iv = setInterval(() => {
      try {
        if (remoteAudio.srcObject instanceof MediaStream && remoteAudio.srcObject.getAudioTracks().length > 0) {
          startFromMediaStream(remoteAudio.srcObject);
          clearInterval(iv);
        }
      } catch (e) {
        // ignore transient errors
      }
      checks++;
      if (checks > 30) clearInterval(iv); // stop after ~30 checks (~30s)
    }, 500);
  }

  // Expose to window for manual control
  window.waveVisualizer = {
    startFromMediaStream,
    startFromMediaElement,
    stopVisualizer,
  };

  // Wait for DOM ready to inject canvas and attach auto-start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(tryAutoStart, 200));
  } else {
    setTimeout(tryAutoStart, 200);
  }
})();
