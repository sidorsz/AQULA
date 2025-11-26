let messagesList = [];
      let adminMessagesList = [];
      let isChatInitialized = false;
      let supabaseChannels = [];
      let eventListeners = [];
      let onlineUsers = [];
      let latencyInterval;
      let presenceInterval = null;
      let lastChatTime = {};
      let lastMediaTime = {};
      let directMessages = {};
      let hasDirectMessagesTable = false;
      let hasDirectMessagesIsRead = false;
      let dmPollInterval = null;
      let currentReplyTo = null; // Menyimpan data pesan yang sedang direply
      // prevent multiple realtime subscriptions
      let dmRealtimeInitialized = false;
      // simple send locks to avoid duplicate sends per conversation
      const dmSendLocks = {};
      // column mapping for direct_messages table (some DBs use recipient_id)
      let dmSenderCol = 'sender_id';
      let dmReceiverCol = 'receiver_id';
      let hasFollowsTable = false;
      


      
       // =============================================
// == KODE BARU: WEBTRC P2P VOICE CALL
// =============================================

let peerConnection = null;
let localStream = null;
let remoteStream = null;
let callChannel = null;
let callTargetUserId = null;
let callRoomId = null;
let turnServers = null; // Cache untuk kredensial TURN
// apakah pengguna saat ini adalah penginisiasi panggilan (caller)
let callInitiator = false;
// flag untuk menekan notifikasi/hangup outgoing ketika kita sedang memproses incoming reject/cancel
let _suppressHangNotify = false;
// Ringtone audio (WebAudio) state
let ringtoneCtx = null;
let ringtoneOsc = null;
let ringtoneGain = null;
let ringtoneTimer = null;

function playRingtone(type = 'incoming') {
  try {
    stopAllRingtones();
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ringtoneCtx = new AudioCtx();
    ringtoneOsc = ringtoneCtx.createOscillator();
    ringtoneGain = ringtoneCtx.createGain();
    ringtoneOsc.type = 'sine';
    ringtoneOsc.frequency.value = type === 'incoming' ? 880 : 660;
    ringtoneGain.gain.value = 0.0001;
    ringtoneOsc.connect(ringtoneGain);
    ringtoneGain.connect(ringtoneCtx.destination);
    ringtoneOsc.start();

    // simple pulsing pattern
    let on = true;
    ringtoneTimer = setInterval(() => {
      try {
        ringtoneGain.gain.cancelScheduledValues(ringtoneCtx.currentTime);
        ringtoneGain.gain.setValueAtTime(on ? 0.18 : 0.0001, ringtoneCtx.currentTime);
        on = !on;
      } catch (e) {
        // ignore
      }
    }, 600);
  } catch (e) {
    console.warn('playRingtone error', e);
  }
}

// Helper: slugify display name untuk dipakai di room id signaling
function slugifyName(name) {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

// Global handler: click on DM images to open lightbox
document.addEventListener('click', (e) => {
  const img = e.target.closest && e.target.closest('.dm-image-wrap img');
  if (!img) return;
  const src = img.getAttribute('data-src') || img.src;
  if (!src) return;
  // create simple lightbox
  const lb = document.createElement('div');
  lb.style.position = 'fixed'; lb.style.inset = '0'; lb.style.display = 'flex'; lb.style.alignItems = 'center'; lb.style.justifyContent = 'center'; lb.style.background = 'rgba(0,0,0,0.85)'; lb.style.zIndex = 99999;
  lb.innerHTML = `<img src="${src}" style="max-width:90%; max-height:90%; border-radius:8px; box-shadow:0 10px 40px rgba(0,0,0,0.6)"/>`;
  lb.addEventListener('click', () => lb.remove());
  document.body.appendChild(lb);
});

// DM audio play handler (delegated) with toggle play/pause and single global player
let _dmAudioPlayer = null;
let _dmPlayingButton = null;
document.addEventListener('click', async (e) => {
  const btn = e.target.closest && e.target.closest('.dm-audio-play');
  if (!btn) return;
  const src = btn.getAttribute('data-src');
  if (!src) return;
  try {
    const icon = btn.querySelector('i');

    // If clicking the same button that's currently playing -> toggle pause/play
    if (_dmAudioPlayer && _dmPlayingButton === btn) {
      if (_dmAudioPlayer.paused) {
        _dmAudioPlayer.play().catch(err => console.warn('Audio resume failed:', err));
        if (icon) { icon.setAttribute('data-lucide', 'pause'); }
      } else {
        _dmAudioPlayer.pause();
        if (icon) { icon.setAttribute('data-lucide', 'play'); }
      }
      try { if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons(); } catch(e){}
      return;
    }

    // Stop previous player and restore its icon
    if (_dmAudioPlayer) {
      try { _dmAudioPlayer.pause(); } catch (e) {}
      if (_dmPlayingButton) {
        const prevIcon = _dmPlayingButton.querySelector('i');
        if (prevIcon) { prevIcon.setAttribute('data-lucide', 'play'); }
        try { if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons(); } catch(e){}
      }
      _dmAudioPlayer = null;
      _dmPlayingButton = null;
    }

    // Create new audio and play
    _dmAudioPlayer = new Audio(src);
    _dmPlayingButton = btn;
    _dmAudioPlayer.play().catch(err => console.warn('Audio play failed:', err));
    if (icon) { icon.setAttribute('data-lucide', 'pause'); try { if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons(); } catch(e){} }

    _dmAudioPlayer.onended = () => {
      if (icon) { icon.setAttribute('data-lucide', 'play'); try { if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons(); } catch(e){} }
      _dmAudioPlayer = null;
      _dmPlayingButton = null;
    };
  } catch (err) {
    console.error('Failed to play DM audio:', err);
  }
});

function stopAllRingtones() {
  try {
    if (ringtoneTimer) { clearInterval(ringtoneTimer); ringtoneTimer = null; }
    if (ringtoneOsc) { try { ringtoneOsc.stop(); } catch (e) {} ringtoneOsc.disconnect(); ringtoneOsc = null; }
    if (ringtoneGain) { try { ringtoneGain.disconnect(); } catch (e) {} ringtoneGain = null; }
    if (ringtoneCtx) { try { ringtoneCtx.close(); } catch (e) {} ringtoneCtx = null; }
  } catch (e) {
    console.warn('stopAllRingtones error', e);
  }
}

// [BARU] Nada disconnect/call-end (short beep pattern seperti WhatsApp)
function playDisconnectTone() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.value = 800; // Frekuensi medium
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    // Pola beep: 200ms beep, 100ms diam, 200ms beep
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.15, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0, ctx.currentTime + 0.5);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
    
    ctx.close();
  } catch (e) {
    console.warn('playDisconnectTone error', e);
  }
}

/**
 * [BARU] 1. Ambil Kredensial STUN/TURN
 * Mengambil kredensial dari server Node.js kita, yang bertindak sebagai proxy
 * ke Metered.ca (atau fallback ke STUN Google jika gagal).
 */
async function getTurnServers() {
  // Jika sudah ada di cache, langsung kembalikan
  if (turnServers) return turnServers;
  
  try {
    // PENTING: Pastikan server Node.js Anda berjalan di port 5500
    // Jika Anda menggunakan hosting, ganti 'http://localhost:5500' dengan URL server Anda
    const response = await fetch('http://localhost:5500/get-turn-credentials'); 
    
    if (!response.ok) {
        throw new Error('Gagal mengambil kredensial dari server proxy');
    }
    
    const iceServers = await response.json();
    
    // Cek apakah server kita mengembalikan fallback (Google)
    if (iceServers.length > 0 && iceServers[0].urls.includes('google')) {
       console.warn('Menggunakan STUN publik (fallback). Pastikan server Node.js Anda berjalan dan .env sudah diatur.');
    } else {
       console.log('Sukses mengambil kredensial STUN/TURN dari Metered.ca.');
    }
    
    turnServers = iceServers; // Simpan ke cache
    return turnServers;

  } catch (error) {
    console.error('Error mengambil TURN credentials:', error.message);
    showToast('Warning', 'Gagal mengambil server TURN, panggilan mungkin gagal.', 'warning');
    // Fallback terakhir jika server Node.js kita mati
    turnServers = [{ urls: 'stun:stun.l.google.com:19302' }];
    return turnServers;
  }
}

/**
 * [BARU] 2. Buat UI Modal Call
 * Menampilkan modal panggilan dengan status: outgoing, incoming, atau active.
 */
function createCallUI(state, userName, avatarUrl) {
  // Remove old video container to avoid stacking when switching from video to voice
  document.getElementById('videoCallContainer')?.remove();
  document.getElementById('videoFloatingBubble')?.remove();

  // Ensure callModalContainer exists, create if not
  let container = document.getElementById('callModalContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'callModalContainer';
    container.className = 'fixed inset-0 z-[99] flex items-center justify-center pointer-events-none';
    container.style.display = 'none';
    document.body.appendChild(container);
    console.log('[DEBUG CALL] Created missing callModalContainer');
  }
  let actionsHtml = '';

  // Tentukan tombol berdasarkan status panggilan
  if (state === 'outgoing') {
    actionsHtml = `
      <button id="hangUpBtn" class="call-btn call-btn-decline" data-tooltip="Hang Up">
        <i data-lucide="phone-off"></i>
      </button>
    `;
  } else if (state === 'incoming') {
    actionsHtml = `
      <button id="acceptCallBtn" class="call-btn call-btn-accept" data-tooltip="Accept">
        <i data-lucide="phone"></i>
      </button>
      <button id="declineCallBtn" class="call-btn call-btn-decline" data-tooltip="Decline">
        <i data-lucide="phone-off"></i>
      </button>
    `;
  } else if (state === 'active') {
    actionsHtml = `
      <button id="muteBtn" class="call-btn call-btn-mute" data-tooltip="Mute" title="Toggle Microphone">
        <i data-lucide="mic"></i>
      </button>
      <button id="volumeBtn" class="call-btn call-btn-volume" data-tooltip="Volume" title="Toggle Speaker Volume">
        <i data-lucide="volume-2"></i>
      </button>
      <button id="hangUpBtn" class="call-btn call-btn-decline" data-tooltip="Hang Up" title="End Call">
        <i data-lucide="phone-off"></i>
      </button>
    `;
  }

  // unified follow modal moved to top-level (see above)

  const callStatus = 
    state === 'outgoing' ? 'Calling...' :
    state === 'incoming' ? 'Incoming Call...' :
    'On Call';
    
  // Logika avatar default jika URL tidak ada atau error
  const avatarImg = (avatarUrl && avatarUrl !== '/default-avatar.png')
    ? `<img src="${avatarUrl}" alt="${userName}" onerror="this.onerror=null;this.src='/default-avatar.png'">`
    : `<div class="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-white text-4xl font-bold">
         ${(userName || 'A')[0].toUpperCase()}
       </div>`;

  // Wave animation untuk visual audio (tampil saat incoming/active)
  const waveHtml = (state === 'incoming' || state === 'active') ? `
    <div class="call-wave">
      <div class="call-wave-bar"></div>
      <div class="call-wave-bar"></div>
      <div class="call-wave-bar"></div>
      <div class="call-wave-bar"></div>
      <div class="call-wave-bar"></div>
    </div>
  ` : '';

  // Render HTML modal
  container.innerHTML = `
    <div class="call-modal">
      <div class="call-avatar">
        ${avatarImg}
      </div>
      <div class="call-name">${sanitizeHTML(userName) || 'Unknown User'}</div>
      ${waveHtml}
      <div class="call-status">${callStatus}</div>
      <div class="call-actions">
        ${actionsHtml}
      </div>
    </div>
  `;
  
  lucide.createIcons(); // Render ikon
  // Pastikan modal benar-benar terlihat: beberapa browser/HTML memiliki inline style display:none
  try {
    container.style.display = 'flex';
    container.style.pointerEvents = 'auto';
    container.classList.add('show'); // Tampilkan modal dengan animasi
  } catch (e) {
    console.warn('Could not show call modal container:', e);
  }
  // Tambahkan event listener untuk tombol-tombol baru (safe attach - cek eksistensi elemen)
  if (state === 'outgoing') {
    const hangEl = document.getElementById('hangUpBtn');
    if (hangEl) hangEl.addEventListener('click', hangUp); else console.warn('hangUpBtn not found (outgoing)');
  } else if (state === 'incoming') {
    const acceptEl = document.getElementById('acceptCallBtn');
    const declineEl = document.getElementById('declineCallBtn');
    if (acceptEl) acceptEl.addEventListener('click', answerCall); else console.warn('acceptCallBtn not found');
    if (declineEl) declineEl.addEventListener('click', hangUp); else console.warn('declineCallBtn not found');
  } else if (state === 'active') {
    const hangEl = document.getElementById('hangUpBtn');
    const muteEl = document.getElementById('muteBtn');
    const volEl = document.getElementById('volumeBtn');
    if (hangEl) hangEl.addEventListener('click', hangUp); else console.warn('hangUpBtn not found (active)');
    if (muteEl) muteEl.addEventListener('click', toggleMute); else console.warn('muteBtn not found');
    if (volEl) volEl.addEventListener('click', toggleVolume); else console.warn('volumeBtn not found');
  }
}

// Utility: safely replace/insert button icon and render via lucide
function updateButtonIcon(button, iconName) {
  if (!button) return;
  try {
    // Find existing icon element (i tag or svg or element with data-lucide)
    const existing = button.querySelector('i, svg, [data-lucide]');
    const i = document.createElement('i');
    i.setAttribute('data-lucide', iconName);
    // Preserve basic aria/tooltip if exists
    if (existing) {
      existing.replaceWith(i);
    } else {
      // insert as first child
      button.insertBefore(i, button.firstChild);
    }
    // Re-render lucide icons (safe to call repeatedly)
    if (window.lucide && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }
  } catch (e) {
    console.warn('updateButtonIcon failed', e);
  }
}

/**
 * [BARU] 3. Fungsi Utama: Memulai Panggilan (Caller)
 */
async function startCall(targetUserId, targetUserName, targetAvatarUrl) {
  if (!window.currentUser?.id) {
    showToast('Error', 'Please login to start a call', 'error');
    return;
  }
  if (peerConnection) {
    showToast('Info', 'You are already in a call', 'info');
    return;
  }

  // Clean up any leftover video UI
  document.getElementById('videoCallContainer')?.remove();
  document.getElementById('videoFloatingBubble')?.remove();
  try { if (__callTimerInterval) { clearInterval(__callTimerInterval); __callTimerInterval = null; } } catch(e) {}

  console.log(`Starting call to ${targetUserId}...`);
  console.log('[DEBUG VOICE CALL] startCall triggered, cleaning video UI');
  callTargetUserId = targetUserId;
  // Buat ID room yang unik untuk panggilan ini — gunakan nama user saja (tidak menampilkan id raw)
  const callerName = window.currentUser?.full_name || window.currentUser?.username || null;
  const calleeName = targetUserName || null;
  const callerSlug = slugifyName(callerName) || `anon${Math.random().toString(36).slice(2,8)}`;
  const calleeSlug = slugifyName(calleeName) || `anon${Math.random().toString(36).slice(2,8)}`;
  // tambahkan timestamp supaya unik, tanpa menyertakan ID user yang sensitif
  callRoomId = `call_${callerSlug}_${calleeSlug}_${Date.now()}`;

  // Jika nama/avatar tidak diberikan (mis. dipanggil hanya dengan ID), ambil dari DB
  try {
    if (!targetUserName || !targetAvatarUrl) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', targetUserId)
        .single();
      if (!error && profile) {
        targetUserName = targetUserName || profile.full_name || 'Anonymous';
        targetAvatarUrl = targetAvatarUrl || (profile.avatar_url ? await getAvatarUrl(profile.avatar_url) : '/default-avatar.png');
      }
    }
  } catch (e) {
    console.warn('Could not fetch profile for call UI:', e);
  }

  // Tampilkan UI "Calling..."
  createCallUI('outgoing', targetUserName, targetAvatarUrl);
  // Mark that we initiated this call (used later to decide DM cancel vs reject)
  callInitiator = true;
  // Putar nada dering outgoing sampai panggilan terhubung atau dibatalkan
  try { playRingtone('outgoing'); } catch (e) { console.warn('Could not play outgoing ringtone', e); }

  try {
    // 1. Ambil izin & stream audio lokal
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    // 2. Kirim "dering" ke target user melalui DM
    // Ini adalah pesan sinyal rahasia kita.
    await sendDirectMessage(targetUserId, `__VOICE_CALL_OFFER__:${callRoomId}`);
    console.log('Call offer DM sent.');

    // 3. Mulai join ke channel signaling (sebagai Caller)
    await joinSignalingChannel(callRoomId, true); // true = isCaller

  } catch (err) {
    console.error('Error starting call:', err);
    if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        showToast('Error', 'Microphone not found.', 'destructive');
    } else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        showToast('Error', 'Microphone permission denied.', 'destructive');
    } else {
        showToast('Error', 'Failed to start call.', 'error');
    }
    hangUp(); // Bersihkan jika gagal
  }
}

/**
 * [BARU] 4. Fungsi Utama: Menerima Panggilan (Callee)
 * Fungsi ini dipanggil oleh handler DM realtime saat pesan `__VOICE_CALL_OFFER__` diterima.
 */
async function receiveCall(callerId, receivedRoomId) {
  // Jika sudah ada panggilan, kirim sinyal 'busy' (opsional, untuk saat ini abaikan)
  console.log('[DEBUG VOICE CALL] receiveCall STARTED', { callerId, receivedRoomId, hasPeerConnection: !!peerConnection });
  if (peerConnection) {
    console.warn('Already in a call, ignoring new call from ' + callerId);
    // TODO: Kirim sinyal 'busy' kembali ke callerId
    return;
  }

  const allowed = await checkCallPrivacy(callerId);
  if (!allowed) { console.log('[DEBUG VOICE CALL] Call blocked by privacy'); return; }

  console.log('[DEBUG VOICE CALL] Creating voice call UI for incoming call from:', callerId);
  callRoomId = receivedRoomId;
  callTargetUserId = callerId;
  
  // Ambil profil si penelepon untuk ditampilkan di UI
  console.log('[DEBUG VOICE CALL] Fetching caller profile...');
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', callerId)
    .single();
    
  if (error) {
    console.error('[DEBUG VOICE CALL] Failed to get caller profile', error);
    hangUp(); // Gagal, tutup
    return;
  }
  console.log('[DEBUG VOICE CALL] Got caller profile:', profile.full_name);
  
  // Ambil URL avatar yang aman
  const avatarUrl = profile.avatar_url ? await getAvatarUrl(profile.avatar_url) : null;
  
  // Tampilkan UI "Incoming Call..."
  console.log('[DEBUG VOICE CALL] Creating voice call UI for incoming state');
  // I am callee, not the initiator
  callInitiator = false;
  createCallUI('incoming', profile.full_name, avatarUrl);
  console.log('[DEBUG VOICE CALL] Voice call UI created, now playing ringtone');
  // Putar nada dering incoming sampai dijawab atau dibatalkan
  try { playRingtone('incoming'); } catch (e) { console.warn('Could not play incoming ringtone', e); }
  console.log('[DEBUG VOICE CALL] receiveCall COMPLETED');
}

// [MODIFIKASI] 5. Fungsi Utama: Menjawab Panggilan (Callee)
async function answerCall() {
  console.log('[DEBUG VOICE CALL] answerCall STARTED');
  if (!callRoomId || !callTargetUserId) {
    console.error('[DEBUG VOICE CALL] Call details not found, cannot answer.');
    return;
  }
  
  // Hentikan nada dering masuk
  stopAllRingtones();
  console.log('[DEBUG VOICE CALL] Ringtone stopped, getting media stream...');

  try {
    // 1. Ambil media (audio) - dengan error handling yang lebih baik
    console.log('Requesting audio permission...');
    localStream = await navigator.mediaDevices.getUserMedia({ 
      audio: { 
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true 
      }, 
      video: false 
    });
    console.log('Audio stream obtained, tracks:', localStream.getTracks().length);
    
    // 2. Mulai join ke channel signaling (sebagai Callee)
    await joinSignalingChannel(callRoomId, false); // false = isCaller
    
    // 3. [BARU] Tunggu sebentar untuk memastikan channel sudah subscribe, kemudian kirim "im-ready"
    // Ini penting agar sender/receiver siap sebelum pesan dikirim
    setTimeout(() => {
      if (callChannel) {
        console.log('Sending "im-ready" signal to caller...');
        callChannel.send({
            type: 'broadcast',
            event: 'im-ready',
            payload: {},
        });
        console.log('"im-ready" signal sent');
      } else {
        console.error('callChannel not available when trying to send im-ready');
      }
    }, 500); // Tunggu 500ms untuk memastikan channel ready
    
  } catch (err) {
    console.error('Error answering call:', err);
    showToast('Error', 'Failed to answer call. Check permissions.', 'error');
    hangUp(); // Bersihkan jika gagal
  }
}


// ------------------ VIDEO CALL FEATURES ------------------
// Start a one-to-one video call (caller)
async function startVideoCall(targetUserId, targetUserName, targetAvatarUrl) {
  console.log('[DEBUG VIDEO CALL] startVideoCall called', { targetUserId, isCalling: !!peerConnection });
  if (!window.currentUser?.id) { showToast('Error', 'Please login to start a video call', 'error'); return; }
  if (peerConnection) { showToast('Info', 'You are already in a call', 'info'); return; }

  // Clean up any leftover voice UI
  const oldContainer = document.getElementById('callModalContainer');
  if (oldContainer) { oldContainer.style.display = 'none'; oldContainer.innerHTML = ''; console.log('[DEBUG VIDEO CALL] Cleaned up voice call container'); }
  document.getElementById('videoFloatingBubble')?.remove();
  try { if (__callTimerInterval) { clearInterval(__callTimerInterval); __callTimerInterval = null; } } catch(e) {}

  callTargetUserId = targetUserId;
  const callerName = window.currentUser?.full_name || window.currentUser?.username || null;
  const calleeName = targetUserName || null;
  const calleeSlug = slugifyName(calleeName) || `user_${(callTargetUserId || '').substring(0, 6)}`;

  // Kita HANYA perlu nama penerima + timestamp agar unik.
  // Ini akan menghasilkan ID seperti: "malga_1763419703979"
  callRoomId = `${calleeSlug}_${Date.now()}`;
  // fetch profile if needed
  try {
    if (!targetUserName || !targetAvatarUrl) {
      const { data: profile, error } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', targetUserId).single();
      if (!error && profile) {
        targetUserName = targetUserName || profile.full_name || 'Anonymous';
        targetAvatarUrl = targetAvatarUrl || (profile.avatar_url ? await getAvatarUrl(profile.avatar_url) : '/default-avatar.png');
      }
    }
  } catch (e) { console.warn('Could not fetch callee profile for video call', e); }

  // create UI
  createVideoCallUI('outgoing', targetUserName, targetAvatarUrl);
  // Mark that we are the initiator of this video call
  callInitiator = true;
  try { playRingtone('outgoing'); } catch(e) { console.warn('Could not play outgoing ringtone', e); }

  try {
    // request camera + mic
    localStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
    // attach local preview to pip if exists
    const localVid = document.getElementById('localVideo');
    if (localVid) { localVid.srcObject = localStream; localVid.muted = true; localVid.playsInline = true; try{ localVid.play().catch(()=>{}); }catch(e){} }

    // send DM offer
    await sendDirectMessage(targetUserId, `__VIDEO_CALL_OFFER__:${callRoomId}`);
    console.log('Video call offer DM sent.');

    // join signaling
    await joinSignalingChannel(callRoomId, true);
  } catch (err) {
    console.error('Error starting video call:', err);
    showToast('Error', 'Failed to start video call: ' + (err.message||err), 'error');
    hangUp();
  }
}

// Receive video call (callee)
async function receiveVideoCall(callerId, receivedRoomId) {
  console.log('[DEBUG VIDEO] receiveVideoCall STARTED', { callerId, receivedRoomId, hasPeerConnection: !!peerConnection });
  if (peerConnection) { console.warn('Already in a call, ignoring video call from', callerId); return; }
  const allowed = await checkCallPrivacy(callerId);
  if (!allowed) { console.log('[DEBUG VIDEO] Call blocked by privacy'); return; }
  callRoomId = receivedRoomId; callTargetUserId = callerId;
  console.log('[DEBUG VIDEO] Fetching caller profile...');
  const { data: profile, error } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', callerId).single();
  if (error) { console.error('[DEBUG VIDEO] Failed to get caller profile', error); hangUp(); return; }
  console.log('[DEBUG VIDEO] Got profile:', profile.full_name);
  const avatarUrl = profile.avatar_url ? await getAvatarUrl(profile.avatar_url) : null;
  console.log('[DEBUG VIDEO] Calling createVideoCallUI("incoming", ...)', profile.full_name, avatarUrl);
  // I am callee; mark as not initiator
  callInitiator = false;
  createVideoCallUI('incoming', profile.full_name, avatarUrl);
  console.log('[DEBUG VIDEO] createVideoCallUI completed, now playing ringtone');
  try { playRingtone('incoming'); } catch(e) { console.warn('Could not play incoming ringtone', e); }
  console.log('[DEBUG VIDEO] receiveVideoCall COMPLETED');
}

// Answer video call (Callee)
async function answerVideoCall() {
  console.log('[DEBUG VIDEO CALL] answerVideoCall STARTED');
  if (!callRoomId || !callTargetUserId) { console.error('[DEBUG VIDEO CALL] No video call details'); return; }
  stopAllRingtones();
  console.log('[DEBUG VIDEO CALL] Getting video stream...');
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
    console.log('[DEBUG VIDEO CALL] Video stream acquired, attaching to local video element');
    const localVid = document.getElementById('localVideo'); if (localVid) { localVid.srcObject = localStream; localVid.muted = true; localVid.playsInline = true; try{ localVid.play().catch(()=>{}); }catch(e){} }
    console.log('[DEBUG VIDEO CALL] Joining signaling channel as callee...');
    await joinSignalingChannel(callRoomId, false);
    setTimeout(() => { if (callChannel) { console.log('[DEBUG VIDEO CALL] Sending im-ready signal'); callChannel.send({ type: 'broadcast', event: 'im-ready', payload: {} }); } }, 500);
    console.log('[DEBUG VIDEO CALL] answerVideoCall COMPLETED');
  } catch (err) {
    console.error('[DEBUG VIDEO CALL] Error answering video call:', err); showToast('Error', 'Failed to answer video call', 'error'); hangUp();
  }
}

// Create Video Call UI
// Create Video Call UI (FIXED RE-RENDER ISSUE)
function createVideoCallUI(state, name, avatarUrl) {
  console.log('[DEBUG VIDEO CALL] createVideoCallUI called with state:', state);
  
  // Cek apakah container sudah ada
  let container = document.getElementById('videoCallContainer');
  
  // Jika container sudah ada dan kita masuk ke state 'active' (saat ontrack),
  // JANGAN hapus container lama agar transisi mulus, KECUALI jika sebelumnya tidak ada video tag.
  // Namun, untuk memastikan bug hilang, kita akan hapus container lama HANYA JIKA state != active
  // atau jika kita mau rebuild layout.
  
  // Sembunyikan modal suara lama
  const oldVoiceContainer = document.getElementById('callModalContainer');
  if (oldVoiceContainer) { oldVoiceContainer.style.display = 'none'; oldVoiceContainer.innerHTML = ''; }
  document.getElementById('videoFloatingBubble')?.remove();

  // Jika container sudah ada, kita cek apakah perlu rebuild total?
  // Untuk amannya sesuai request "perbaiki": Kita rebuild, TAPI di fungsi ontrack (di atas) 
  // kita sudah pastikan createVideoCallUI dipanggil SEBELUM attach stream.
  // Jadi kode di bawah ini aman untuk me-remove container lama.
  
  if (container) container.remove(); 

  const html = `
    <div id="videoCallContainer" class="fixed inset-0 z-[9999] flex items-center justify-center p-4" style="pointer-events:auto;">
      <div id="videoBackdrop" class="fixed inset-0 bg-black/90 backdrop-blur-sm"></div>
      
      <div class="relative w-full max-w-md md:max-w-3xl h-[85vh] bg-gray-900 rounded-2xl overflow-hidden flex flex-col border border-slate-700 shadow-2xl">
        
        <video id="remoteVideo" class="w-full h-full object-cover bg-black" autoplay playsinline></video>

        <div id="localPip" class="absolute right-4 bottom-24 w-28 h-36 md:w-32 md:h-48 rounded-xl overflow-hidden bg-slate-800 border border-slate-600 shadow-lg z-20 transition-all duration-200">
          <video id="localVideo" class="w-full h-full object-cover transform -scale-x-100" autoplay muted playsinline></video>
        </div>

        <div class="absolute top-0 left-0 right-0 p-4 z-20 bg-gradient-to-b from-black/60 to-transparent">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full overflow-hidden bg-slate-800 border border-white/20">
              ${avatarUrl ? `<img src="${avatarUrl}" class="w-full h-full object-cover" onerror="this.onerror=null;this.src='/default-avatar.png'">` : '<div class="w-full h-full flex items-center justify-center text-white font-bold">'+(name?name[0]:'?')+'</div>'}
            </div>
            <div>
               <div class="font-bold text-white text-shadow-sm">${sanitizeHTML(name||'User')}</div>
               <div id="videoCallTimer" class="text-xs text-cyan-300 font-mono flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                  ${state === 'active' ? '00:00' : (state === 'incoming' ? 'Incoming Video...' : 'Calling...')}
               </div>
            </div>
          </div>
        </div>

        <div class="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30 flex items-center gap-4 px-6 py-3 bg-slate-900/80 backdrop-blur-md rounded-full border border-white/10 shadow-lg">
          
          ${state === 'incoming' ? `
             <button id="videoDeclineBtn" class="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/50 transition-transform hover:scale-110">
                <i data-lucide="phone-off" class="h-6 w-6"></i>
             </button>
             <div class="w-4"></div>
             <button id="videoAcceptBtn" class="p-4 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-900/50 transition-transform hover:scale-110 animate-bounce">
                <i data-lucide="video" class="h-6 w-6"></i>
             </button>
          ` : `
             <button id="videoMicBtn" class="p-3 rounded-full bg-slate-700/50 hover:bg-slate-600 text-white transition-colors" title="Mute">
                <i data-lucide="mic" class="h-5 w-5"></i>
             </button>
             <button id="videoCamBtn" class="p-3 rounded-full bg-slate-700/50 hover:bg-slate-600 text-white transition-colors" title="Camera">
                <i data-lucide="video" class="h-5 w-5"></i>
             </button>
             <button id="videoSwitchCamBtn" class="p-3 rounded-full bg-slate-700/50 hover:bg-slate-600 text-white transition-colors" title="Flip Camera">
                <i data-lucide="refresh-cw" class="h-5 w-5"></i>
             </button>
             <button id="videoEndBtn" class="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg transition-transform hover:scale-105" title="End Call">
                <i data-lucide="phone-off" class="h-6 w-6"></i>
             </button>
          `}
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);
  lucide.createIcons();

  // Re-attach local stream to PIP if available
  if (localStream) {
      const localVid = document.getElementById('localVideo');
      if (localVid) {
          localVid.srcObject = localStream;
          localVid.muted = true;
      }
  }

  // Setup Event Listeners
  if (state === 'incoming') {
      document.getElementById('videoAcceptBtn')?.addEventListener('click', () => { 
          // Ubah tampilan loading sebentar
          const btn = document.getElementById('videoAcceptBtn');
          if(btn) btn.innerHTML = '<i data-lucide="loader" class="h-6 w-6 animate-spin"></i>';
          lucide.createIcons();
          answerVideoCall(); 
      });
      document.getElementById('videoDeclineBtn')?.addEventListener('click', hangUp);
  } else {
      document.getElementById('videoEndBtn')?.addEventListener('click', hangUp);
      document.getElementById('videoMicBtn')?.addEventListener('click', toggleMic);
      document.getElementById('videoCamBtn')?.addEventListener('click', toggleCam);
      document.getElementById('videoSwitchCamBtn')?.addEventListener('click', switchCamera);
  }

  if (state === 'active') {
      startCallTimer('videoCallTimer');
  }
}

// Toggle mic for video call (reuse existing audio track toggling)
function toggleMic() {
  if (!localStream) return; const t = localStream.getAudioTracks()[0]; if (!t) return; t.enabled = !t.enabled; const btn = document.getElementById('videoMicBtn'); updateButtonIcon(btn, t.enabled ? 'mic' : 'mic-off'); }

// Toggle camera (enable/disable video track)
function toggleCam() { if (!localStream) return; const v = localStream.getVideoTracks()[0]; if (!v) return; v.enabled = !v.enabled; const btn = document.getElementById('videoCamBtn'); updateButtonIcon(btn, v.enabled ? 'video' : 'video-off'); }

// Switch camera (mobile front/back)
async function switchCamera() {
  try {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    // Try to get list of devices and find another video device
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === 'videoinput');
    if (videoDevices.length < 2) { showToast('Info','No alternative camera found','info'); return; }
    // pick first device different from current
    const currentId = videoTrack.getSettings().deviceId;
    let next = videoDevices.find(d => d.deviceId !== currentId) || videoDevices[0];
    const newStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: next.deviceId } }, audio: false });
    const newTrack = newStream.getVideoTracks()[0];
    // replace track in localStream and peerConnection
    localStream.removeTrack(videoTrack); videoTrack.stop(); localStream.addTrack(newTrack);
    const sender = peerConnection && peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
    if (sender) { await sender.replaceTrack(newTrack); }
    // update local preview
    const localVid = document.getElementById('localVideo'); if (localVid) { localVid.srcObject = null; localVid.srcObject = localStream; try{ localVid.play().catch(()=>{}); }catch(e){} }
    showToast('Success','Camera switched','success');
  } catch (err) { console.error('switchCamera error', err); showToast('Error','Could not switch camera','error'); }
}

// Minimize to floating bubble
function minimizeVideoCall() {
  const cont = document.getElementById('videoCallContainer'); if (!cont) return; cont.style.display='none';
  if (document.getElementById('videoFloatingBubble')) return; const bubble = document.createElement('button'); bubble.id='videoFloatingBubble'; bubble.style.position='fixed'; bubble.style.right='14px'; bubble.style.bottom='14px'; bubble.style.width='64px'; bubble.style.height='64px'; bubble.style.borderRadius='999px'; bubble.style.zIndex='9999'; bubble.style.background='#25D366'; bubble.style.border='none'; bubble.innerHTML='<i data-lucide="video" class="h-5 w-5 text-white"></i>';
  document.body.appendChild(bubble); lucide.createIcons(); bubble.addEventListener('click', () => { document.getElementById('videoCallContainer')?.remove(); bubble.remove(); createVideoCallUI('active'); }); }

// Start call timer helper
let __callTimerInterval = null;
function startCallTimer(timerId) { try { const el = document.getElementById(timerId); if (!el) return; let start = Date.now(); if (__callTimerInterval) clearInterval(__callTimerInterval); __callTimerInterval = setInterval(() => { const s = Math.floor((Date.now()-start)/1000); const mm = Math.floor(s/60); const ss = s%60; el.innerText = `${mm}:${ss.toString().padStart(2,'0')}`; }, 1000); } catch(e) { console.warn('startCallTimer failed', e); } }











// [MODIFIKASI] 6. Fungsi Inti WebRTC: Join Channel Signaling
async function joinSignalingChannel(roomId, isCaller) {
  if (callChannel) {
    callChannel.unsubscribe(); // Bersihkan channel lama jika ada
  }

  // 1. Buat Peer Connection dengan server STUN/TURN
  console.log('Creating PeerConnection...');
  const iceServers = await getTurnServers();
  peerConnection = new RTCPeerConnection({ iceServers });

  // Monitor connection state
  peerConnection.onconnectionstatechange = () => {
    console.log('PeerConnection connectionState changed:', peerConnection.connectionState);
    if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
      // Jangan spam toast, cukup log
      console.warn('Connection unstable or disconnected.');
    }
  };

  // 2. Tambahkan track audio/video lokal ke koneksi
  if (localStream) {
    localStream.getTracks().forEach(track => {
      console.log('Adding local track:', track.kind, 'enabled:', track.enabled);
      peerConnection.addTrack(track, localStream);
    });
  }

  // 3. [PERBAIKAN UTAMA] Handle saat remote track diterima
  peerConnection.ontrack = (event) => {
    console.log('Got remote track, call connected!', event.track.kind);
    remoteStream = event.streams[0];

    // Hentikan nada dering segera
    stopAllRingtones();

    // A. UPDATE UI TERLEBIH DAHULU (Agar elemen Video/Audio tersedia di DOM)
    // Kita ambil nama/avatar dari modal yang sedang aktif (incoming/outgoing) sebelum di-refresh
    let targetName = 'User';
    let targetAvatar = null;
    const currentModal = document.getElementById('videoCallContainer') || document.getElementById('callModalContainer');
    
    if (currentModal) {
      try { targetName = currentModal.querySelector('.call-name')?.textContent || targetName; } catch(e){}
      try { targetAvatar = currentModal.querySelector('.call-avatar img')?.src || null; } catch(e){}
    }

    // Render UI 'Active' (Ini akan mereset DOM, makanya kita panggil duluan)
    // Cek apakah ini video call atau voice call
    const isVideoCall = event.track.kind === 'video' || document.getElementById('videoCallContainer');
    
    if (isVideoCall) {
      createVideoCallUI('active', targetName, targetAvatar);
    } else {
      createCallUI('active', targetName, targetAvatar);
    }

    // B. SETELAH UI SIAP, BARU TEMPEL STREAM KE ELEMEN BARU
    // Beri sedikit delay agar DOM benar-benar siap rendering
    setTimeout(() => {
        const remoteVideo = document.getElementById('remoteVideo');
        const remoteAudio = document.getElementById('remoteAudio');

        // Setup Audio
        if (remoteAudio) {
            remoteAudio.srcObject = remoteStream;
            remoteAudio.volume = 1;
            remoteAudio.play().catch(e => console.warn('Audio autoplay blocked:', e));
        }

        // Setup Video (Jika ada track video)
        if (remoteVideo && event.track.kind === 'video') {
            console.log('Attaching remote video stream...');
            remoteVideo.srcObject = remoteStream;
            remoteVideo.playsInline = true;
            remoteVideo.autoplay = true;
            remoteVideo.muted = false; // Remote video harus bersuara
            
            // Paksa play
            remoteVideo.play().catch(err => {
                console.warn('Video autoplay error:', err);
                // Fallback: tampilkan tombol play jika autoplay gagal
                showToast('Info', 'Tap to view video', 'info');
            });
        }

        // Start Visualizer (Safe Mode)
        try {
            if (window.waveVisualizer && typeof window.waveVisualizer.startFromMediaStream === 'function') {
                // Gunakan try-catch di dalam agar tidak merusak flow
                window.waveVisualizer.startFromMediaStream(remoteStream);
            }
        } catch (wvErr) {
            console.warn('Wave visualizer error ignored:', wvErr);
        }
    }, 100);
  };

  // 4. Setup Channel Supabase untuk signaling
  callChannel = supabase.channel(roomId, {
    config: {
      presence: { key: window.currentUser.id },
      broadcast: { self: false }, 
    },
  });

  // 5. Kirim ICE candidates ke peer
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      callChannel.send({
        type: 'broadcast',
        event: 'ice-candidate',
        payload: { candidate: event.candidate.toJSON() },
      });
    }
  };

  // 6. Dengarkan event dari channel
  callChannel
    .on('broadcast', { event: 'im-ready' }, async ({ payload }) => {
        if (isCaller) {
            console.log('[CALLER] Callee ready. Sending offer...');
            try {
              const offer = await peerConnection.createOffer();
              await peerConnection.setLocalDescription(offer);
              callChannel.send({ type: 'broadcast', event: 'offer', payload: { offer } });
            } catch (err) { console.error(err); }
        }
    })
    .on('broadcast', { event: 'offer' }, async ({ payload }) => {
      if (!isCaller) {
        console.log('[CALLEE] Received offer.');
        try {
          if (peerConnection.signalingState !== "stable") {
             // Jika terjadi tabrakan offer (glare), rollback atau abaikan
             console.warn('Signaling state not stable, ignoring dup offer');
             return;
          }
          await peerConnection.setRemoteDescription(payload.offer);
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          callChannel.send({ type: 'broadcast', event: 'answer', payload: { answer } });
        } catch (err) { console.error(err); }
      }
    })
    .on('broadcast', { event: 'answer' }, async ({ payload }) => {
      if (isCaller) {
        console.log('[CALLER] Received answer.');
        try {
          await peerConnection.setRemoteDescription(payload.answer);
        } catch (err) { console.error(err); }
      }
    })
    .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
      try {
        if (peerConnection && peerConnection.remoteDescription) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
        }
      } catch (err) { console.warn('ICE error', err); }
    })
    .on('broadcast', { event: 'hang-up' }, () => {
      showToast('Info', 'Call ended', 'info');
      stopAllRingtones(); 
      hangUp();
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Signaling subscribed.');
      }
    });
  
  supabaseChannels.push(callChannel);
}
















/**
 * [BARU] 7. Fungsi Utility: Tutup Panggilan (Hang Up)
 * Membersihkan semua koneksi dan stream.
 */
/**
 * [PERBAIKAN] 7. Fungsi Utility: Tutup Panggilan (Hang Up)
 * Membersihkan semua koneksi dan stream.
 */
async function hangUp() {
  console.log('Hanging up call...');
  
  // Stop any playing ringtones
  try { stopAllRingtones(); } catch(e) { }
  
  // Play disconnect tone
  try { 
    if (peerConnection && peerConnection.connectionState !== 'new') {
      playDisconnectTone(); 
    }
  } catch(e) { }
  
  // 1. Kirim Broadcast via Channel (Untuk kondisi jika user lain SUDAH menjawab/online di channel)
  if (callChannel) {
    try {
      callChannel.send({ type: 'broadcast', event: 'hang-up', payload: {} });
    } catch (e) { console.warn('hangUp: could not send hang-up signal', e); }
  }

  // 2. [PERBAIKAN UTAMA] Kirim DM Signal ke User Lain (PENTING!)
  // Kita kirim ini TANPA 'else'. Jadi walaupun channel aktif, kita tetap kirim DM
  // ini untuk memastikan UI lawan bicara tertutup jika mereka belum join channel (masih ringing).
  if (!_suppressHangNotify && callRoomId && callTargetUserId) {
    try {
      if (callInitiator) {
        // Saya penelpon, saya membatalkan -> Kirim CANCEL
        console.log('[HANGUP] Sending CANCEL DM to', callTargetUserId);
        await sendDirectMessage(callTargetUserId, `__CALL_CANCEL__:${callRoomId}`);
      } else {
        // Saya penerima, saya menolak -> Kirim REJECT
        console.log('[HANGUP] Sending REJECT DM to', callTargetUserId);
        await sendDirectMessage(callTargetUserId, `__CALL_REJECT__:${callRoomId}`);
      }
    } catch (e) { console.warn('hangUp: failed to send DM cancel/reject', e); }
  }
  
  // 3. Bersihkan Channel Supabase
  if (callChannel) {
    try { supabaseChannels = supabaseChannels.filter(ch => ch !== callChannel); } catch (e) { /* ignore */ }
    try { supabase.removeChannel(callChannel); } catch (e) { console.warn('hangUp: supabase.removeChannel failed', e); }
    callChannel = null;
  }
  
  // Tutup koneksi P2P
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  
  // Matikan stream audio lokal
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  
  // Hentikan stream audio remote
  if (remoteStream) {
    remoteStream.getTracks().forEach(track => track.stop());
    const remoteAudio = document.getElementById('remoteAudio');
    if (remoteAudio) {
      remoteAudio.pause();
      remoteAudio.srcObject = null;
    }
    remoteStream = null;
  }
  
  // Stop wave visualizer
  try {
    if (window.waveVisualizer && typeof window.waveVisualizer.stopVisualizer === 'function') {
      window.waveVisualizer.stopVisualizer();
    }
  } catch(e) { console.warn('Failed to stop wave visualizer:', e); }
  
  // Sembunyikan modal audio
  const modal = document.getElementById('callModalContainer');
  if (modal) {
    modal.classList.remove('show');
    try { modal.style.pointerEvents = 'none'; modal.style.display = 'none'; } catch(e) {}
    setTimeout(() => { try { modal.innerHTML = ''; } catch(e) {} }, 300);
  }

  // Sembunyikan modal video
  const vmodal = document.getElementById('videoCallContainer');
  if (vmodal) {
    try { vmodal.remove(); } catch(e) { console.warn('Could not remove video modal', e); }
  }

  // Remove floating bubble if exists
  const bubble = document.getElementById('videoFloatingBubble');
  if (bubble) try { bubble.remove(); } catch(e) {}

  // clear call timer
  try { if (__callTimerInterval) { clearInterval(__callTimerInterval); __callTimerInterval = null; } } catch(e) {}

  // Reset variabel state
  callTargetUserId = null;
  callRoomId = null;
  callInitiator = false; // Reset initiator status

  // Ensure DM realtime subscription is active after hangup
  try {
    setTimeout(() => {
      try { initDirectMessageRealtime(); } catch(e) { }
    }, 500);
  } catch(e) {}
}

/**
 * [BARU] 8. Fungsi Utility: Mute/Unmute
 */
async function toggleMute() {
  const muteBtn = document.getElementById('muteBtn');
  if (!muteBtn) {
    console.warn('toggleMute: muteBtn not found');
    return;
  }

  // If we don't have a local stream yet, try to request permission and attach
  if (!localStream) {
    try {
      showToast('Info', 'Requesting microphone permission...', 'info');
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      // If peerConnection exists, add tracks
      if (peerConnection) {
        localStream.getTracks().forEach(track => {
          try { peerConnection.addTrack(track, localStream); } catch (e) { console.warn('addTrack failed', e); }
        });
      }
    } catch (err) {
      console.error('toggleMute: failed to getUserMedia', err);
      showToast('Error', 'Could not access microphone', 'error');
      return;
    }
  }

  const audioTrack = localStream.getAudioTracks()[0];
  if (!audioTrack) {
    console.warn('toggleMute: no audio track available');
    showToast('Error', 'No audio track available', 'error');
    return;
  }

  if (audioTrack.enabled) {
    // Mute
    audioTrack.enabled = false;
    muteBtn.classList.add('muted');
    updateButtonIcon(muteBtn, 'mic-off');
    showToast('Info', 'Microphone Muted', 'info');
  } else {
    // Unmute
    audioTrack.enabled = true;
    muteBtn.classList.remove('muted');
    updateButtonIcon(muteBtn, 'mic');
    showToast('Info', 'Microphone On', 'info');
  }
}

/**
 * [BARU] 9. Fungsi Utility: Toggle Volume Speaker
 * Mengatur volume speaker untuk remote audio (untuk hearing yg keluar dari device)
 */
function toggleVolume() {
  const volumeBtn = document.getElementById('volumeBtn');
  const remoteAudio = document.getElementById('remoteAudio');

  if (!volumeBtn) {
    console.warn('toggleVolume: volumeBtn not found');
    return;
  }

  if (!remoteAudio) {
    console.warn('toggleVolume: remoteAudio element not ready');
    showToast('Info', 'Remote audio not available yet', 'info');
    return;
  }

  // Use muted property + volume for clarity
  if (remoteAudio.muted || remoteAudio.volume === 0) {
    remoteAudio.muted = false;
    remoteAudio.volume = 1.0;
    volumeBtn.classList.remove('muted');
    updateButtonIcon(volumeBtn, 'volume-2');
    showToast('Info', 'Speaker On', 'info');
  } else {
    remoteAudio.muted = true;
    remoteAudio.volume = 0;
    volumeBtn.classList.add('muted');
    updateButtonIcon(volumeBtn, 'volume-x');
    showToast('Info', 'Speaker Muted', 'info');
  }
}

// =============================================
// == AKHIR DARI KODE BARU WEBTRC
// =============================================













      const CHAT_COOLDOWN = 0 * 1000; // 1 detik
      const MEDIA_COOLDOWN = 0 * 30 * 1000; // 1 detik

      // Tambahkan ini di awal file Communications.js
document.addEventListener('click', function(e) {
  // Handle menu dots

// run schema detection and init realtime + UI helpers
checkDatabaseSchema().then(async () => {
  try { initDirectMessageRealtime(); } catch(e) { console.warn('initDirectMessageRealtime failed:', e); }
  try { createInboxShortcut(); } catch(e) { console.warn('createInboxShortcut failed:', e); }
  try { startDirectMessagePoll(); } catch(e) { console.warn('startDirectMessagePoll failed:', e); }
  try {
    // initialise inbox badge count based on unread messages
    const convs = await getConversations();
    const totalUnread = (convs || []).reduce((s, c) => s + (c.unread || 0), 0);
    if (totalUnread > 0) updateInboxBadge(totalUnread);
  } catch (e) {
    console.warn('Could not initialise inbox badge:', e);
  }
}).catch(e => console.warn('checkDatabaseSchema failed:', e));
  const menuBtn = e.target.closest('.menu-btn');
  const menuDropdown = menuBtn?.parentElement?.querySelector('.menu-dropdown');
  
  if (menuBtn && menuDropdown) {
    e.stopPropagation();
    // Tutup semua dropdown lain
    document.querySelectorAll('.menu-dropdown:not(.hidden)').forEach(dropdown => {
      if (dropdown !== menuDropdown) {
        dropdown.classList.add('hidden');
      }
    });
    menuDropdown.classList.toggle('hidden');
  } else if (!e.target.closest('.menu-dropdown')) {
    // Tutup semua dropdown jika klik di luar
    document.querySelectorAll('.menu-dropdown').forEach(dropdown => {
      dropdown.classList.add('hidden');
    });
  }
  
  // Handle profile clicks
  const userElement = e.target.closest('[data-user-id]');
  if (userElement) {
    const userId = userElement.dataset.userId;
    if (userId) {
      e.preventDefault();
      showUserProfilePopup(userId);
    }
  }
});

      // Check database schema support
      async function checkDatabaseSchema() {
        try {
          const { data: dmData, error: dmError } = await supabase
            .from('direct_messages')
            .select('id')
            .limit(1);
          hasDirectMessagesTable = !dmError;

          // detect is_read column support and which receiver column is used
          if (hasDirectMessagesTable) {
            try {
              // try standard receiver_id + is_read
              const { data: r, error: rErr } = await supabase
                .from('direct_messages')
                .select('receiver_id,is_read')
                .limit(1);
              if (!rErr) {
                hasDirectMessagesIsRead = 'is_read' in (r && r[0] ? r[0] : {});
                dmReceiverCol = 'receiver_id';
                dmSenderCol = 'sender_id';
              } else {
                // fallback try recipient_id
                const { data: r2, error: rErr2 } = await supabase
                  .from('direct_messages')
                  .select('recipient_id,is_read')
                  .limit(1);
                if (!rErr2) {
                  hasDirectMessagesIsRead = 'is_read' in (r2 && r2[0] ? r2[0] : {});
                  dmReceiverCol = 'recipient_id';
                  dmSenderCol = 'sender_id';
                } else {
                  hasDirectMessagesIsRead = false;
                }
              }
            } catch (e) {
              hasDirectMessagesIsRead = false;
            }
          }

          const { data: followData, error: followError } = await supabase
            .from('follows')
            .select('follower_id')
            .limit(1);
          hasFollowsTable = !followError;

          console.log('Schema support:', { hasDirectMessagesTable, hasFollowsTable });
        } catch (err) {
          console.error('Error checking schema:', err);
        }
      }

      // Direct Message Functions
      async function sendDirectMessage(receiverId, content, imageUrl = null, audioUrl = null, duration = null) {
            if (!content || (!content.trim() && !imageUrl && !audioUrl)) return;
            // prevent duplicate sends for same receiver for short period
            const lockKey = `${receiverId}:${content.slice(0,140)}`;
            if (dmSendLocks[lockKey]) {
              console.warn('Duplicate send prevented for', lockKey);
              return;
            }
            dmSendLocks[lockKey] = true;
            setTimeout(() => { delete dmSendLocks[lockKey]; }, 1500);
        
        try {
          if (hasDirectMessagesTable) {
            // build insert object using detected column names
            const insertObj = {};
            insertObj[dmSenderCol] = window.currentUser?.id;
            insertObj[dmReceiverCol] = receiverId;
            insertObj.content = content;
            if (imageUrl) insertObj.image_url = imageUrl;
            if (audioUrl) insertObj.audio_url = audioUrl;
            if (duration) insertObj.duration = duration;

            let data, error;
            try {
              const res = await supabase
                .from('direct_messages')
                .insert(insertObj)
                .select()
                .single();
              data = res.data; error = res.error;
            } catch (e) {
              console.error('sendDirectMessage: insert threw', e);
              throw e;
            }
            if (error) {
              // log more details when available
              try { console.error('sendDirectMessage: insert error details ->', JSON.stringify(error)); } catch(e){ console.error('sendDirectMessage: insert error ->', error); }
              throw error;
            }

            console.debug('sendDirectMessage: insert returned ->', data);

            // Add to local cache (dedupe by id)
            if (!directMessages[receiverId]) directMessages[receiverId] = [];
            if (!directMessages[receiverId].some(m => m.id === data.id)) {
              directMessages[receiverId].push(data);
            } else {
              console.debug('Message already present in cache, skipping push for', data.id);
            }

            // ensure uniqueness
            directMessages[receiverId] = Array.from(new Map((directMessages[receiverId] || []).map(m => [m.id, m])).values());

            updateDirectMessageUI(receiverId);
            // Update inbox UI so the conversation appears for the sender
            try { await refreshConversationsUI(); } catch(e) { console.warn('Could not refresh conversations after DM insert:', e); }
          } else {
            // Fallback to localStorage
            const message = {
              id: `local-${Date.now()}`,
              sender_id: window.currentUser?.id,
              receiver_id: receiverId,
              content: content,
              image_url: imageUrl || null,
              audio_url: audioUrl || null,
              duration: duration || null,
              created_at: new Date().toISOString()
            };
            
            const localMessages = JSON.parse(localStorage.getItem('directMessages') || '{}');
            if (!localMessages[receiverId]) localMessages[receiverId] = [];
            localMessages[receiverId].push(message);
            localStorage.setItem('directMessages', JSON.stringify(localMessages));
            
            if (!directMessages[receiverId]) directMessages[receiverId] = [];
            directMessages[receiverId].push(message);
            console.debug('sendDirectMessage: saved message locally and pushed to in-memory cache for', receiverId, message);
            
            updateDirectMessageUI(receiverId);
            // Update inbox UI for local fallback as well
            try { await refreshConversationsUI(); } catch(e) { console.warn('Could not refresh conversations after local DM:', e); }
            showToast('Info', 'Message saved locally - server storage not available', 'info');
          }
        } catch (err) {
          console.error('Error sending DM:', err);
          showToast('Error', 'Failed to send message', 'error');
        }
      }

     // Update follow button in UI
      function updateFollowButton(userId, isFollowing) {
        const btn = document.getElementById(`followBtn-${userId}`);
        if (!btn) return; // Tombol tidak ditemukan

        // 1. Cari DIV container di dalam tombol
        const container = btn.querySelector('div.flex'); 
        if (!container) {
          console.error('Tombol follow tidak memiliki DIV container!', btn);
          return; 
        }

        // 2. Ganti isi HTML container-nya
        if (isFollowing) {
          container.innerHTML = `
            <i data-lucide="user-check" class="h-4 w-4"></i>
            <span>Following</span>
          `;
        } else {
          container.innerHTML = `
            <i data-lucide="user-plus" class="h-4 w-4"></i>
            <span>Follow User</span>
          `;
        }

        // 3. Update Kelas (CSS) agar warnanya berubah
        const baseClasses = "w-full py-3.5 px-4 rounded-xl font-semibold transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]";
        
        if (isFollowing) {
          // Kelas untuk "Following" (abu-abu/slate)
          btn.className = `${baseClasses} bg-gradient-to-r from-slate-700 to-slate-800 text-slate-200 border border-slate-600/50 shadow-lg`;
        } else {
          // Kelas untuk "Follow User" (biru/cyan)
          btn.className = `${baseClasses} bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50`;
        }
        
        // 4. Render ulang ikon Lucide
        lucide.createIcons();
      }



      // Fungsi BARU untuk update angka follower di UI
      function updateFollowerCountUI(userId, change) { // change bisa +1 atau -1
        try {
          const countEl = document.getElementById(`profile-followers-count-${userId}`);
          if (countEl) {
            let currentCount = parseInt(countEl.textContent, 10);
            if (isNaN(currentCount)) currentCount = 0;
            
            const newCount = Math.max(0, currentCount + change); // Pastikan tidak di bawah 0
            countEl.textContent = newCount;
          }
        } catch(e) {
          console.warn('Could not update follower count UI', e);
        }
      }

      async function followUser(userId) {
        try {
          if (!window.currentUser?.id) {
            showToast('Error', 'Please login to follow users', 'error');
            return;
          }

          if (userId === window.currentUser.id) {
            showToast('Error', 'You cannot follow yourself', 'error');
            return;
          }

          // First update UI optimistically
          updateFollowButton(userId, true);
          updateFollowerCountUI(userId, 1); // <-- TAMBAHKAN INI (+1)

          if (hasFollowsTable) {
            const { error } = await supabase
              .from('follows')
              .insert({
                follower_id: window.currentUser.id,
                following_id: userId
              });

            if (error) {
              console.error('Error following user:', error);
              // Revert UI on error
              updateFollowButton(userId, false);
              updateFollowerCountUI(userId, -1); // <-- TAMBAHKAN INI (Batal, -1)
              
              if (error.code === '23505') { // Unique violation
                showToast('Info', 'You are already following this user', 'info');
              } else {
                showToast('Error', 'Could not follow user: ' + error.message, 'error');
              }
              return;
            }
            
            // Update followers_count in profiles table (ini tetap jalan)
            try {
              const { data: prof, error: profErr } = await supabase
                .from('profiles')
                .select('followers_count')
                .eq('id', userId)
                .single();
              if (!profErr && prof) {
                const newCount = (prof.followers_count || 0) + 1;
                await supabase.from('profiles').update({ followers_count: newCount }).eq('id', userId);
              }
            } catch (e) {
              console.warn('Could not update followers_count:', e);
            }

            showToast('Success', 'Successfully followed user', 'success');
          } else {
            try {
              const localFollows = JSON.parse(localStorage.getItem('follows') || '[]');
              
              // Check if already following
              if (localFollows.some(f => 
                f.follower_id === window.currentUser.id && 
                f.following_id === userId
              )) {
                showToast('Info', 'You are already following this user', 'info');
                return;
              }

              localFollows.push({
                follower_id: window.currentUser.id,
                following_id: userId,
                created_at: new Date().toISOString()
              });
              localStorage.setItem('follows', JSON.stringify(localFollows));
              
              showToast('Info', 'Follow saved locally - server storage not available', 'info');
            } catch (localErr) {
              console.error('Error saving follow locally:', localErr);
              // Revert UI on error
          updateFollowButton(userId, false);
          updateFollowerCountUI(userId, -1); // <-- TAMBAHKAN INI (Batal, -1)
          showToast('Error', 'Failed to follow user', 'error');
        }
      }
        } catch (err) {
          console.error('Error following user:', err);
          // Revert UI on error
          updateFollowButton(userId, false);
          showToast('Error', 'Failed to follow user', 'error');
        }
      }


      // FUNGSI BARU (FIXED): Mengambil daftar followers (orang yang follow user ini)
      async function getFollowers(userId) {
        if (!hasFollowsTable) return [];
        try {
          // 1. Ambil semua ID follower
          const { data: follows, error: followsError } = await supabase
            .from('follows')
            .select('follower_id') // Hanya ambil ID-nya
            .eq('following_id', userId);

          if (followsError) throw followsError;
          if (!follows || follows.length === 0) return [];

          // 2. Ubah jadi array [id1, id2, id3]
          const followerIds = follows.map(f => f.follower_id);

          // 3. Ambil semua profil yang ID-nya ada di array itu
          const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', followerIds); // Gunakan '.in()'

          if (profileError) throw profileError;
          return profiles; // Kembalikan daftar profil

        } catch (err) {
          console.error('Error fetching followers:', err);
          return [];
        }
      }

     // FUNGSI BARU (FIXED): Mengambil daftar following (orang yang di-follow user ini)
      async function getFollowing(userId) {
        if (!hasFollowsTable) return [];
        try {
          // 1. Ambil semua ID yang di-follow
          const { data: follows, error: followsError } = await supabase
            .from('follows')
            .select('following_id') // Hanya ambil ID-nya
            .eq('follower_id', userId);

          if (followsError) throw followsError;
          if (!follows || follows.length === 0) return [];

          // 2. Ubah jadi array [id1, id2, id3]
          const followingIds = follows.map(f => f.following_id);

          // 3. Ambil semua profil yang ID-nya ada di array itu
          const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', followingIds); // Gunakan '.in()'

          if (profileError) throw profileError;
          return profiles; // Kembalikan daftar profil

        } catch (err) {
          console.error('Error fetching following list:', err);
          return [];
        }
      }

      // FUNGSI BARU: Merender daftar user (followers/following) ke dalam container
      async function renderFollowList(containerId, userList, emptyMessage, showAll = false) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!userList || userList.length === 0) {
          container.innerHTML = `<p class="text-slate-400 text-xs text-center p-4">${emptyMessage}</p>`;
          return;
        }

        // Jika tidak diminta menampilkan semua, dan ada lebih dari 1 user,
        // tampilkan hanya preview (1 item) dan tombol "Lihat Semua".
        let toRender = userList;
        const isPreview = !showAll && Array.isArray(userList) && userList.length > 1;
        if (isPreview) toRender = userList.slice(0, 1);

        // Ambil semua URL avatar secara paralel
        const listHtml = await Promise.all(toRender.map(async (user) => {
          const avatarUrl = await getAvatarUrl(user.avatar_url);
          const name = user.full_name || 'Anonymous';
          
          // *** LOGIKA AVATAR BARU ***
          const avatarHTML = (avatarUrl && avatarUrl !== '/default-avatar.png')
              ? `<img src="${avatarUrl}" alt="${sanitizeHTML(name)}" class="w-full h-full object-cover" onerror="this.onerror=null;this.src='/default-avatar.png'">`
              : `<div class="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-white font-medium">
                   ${(name || 'A')[0].toUpperCase()}
                 </div>`;
          // *** AKHIR LOGIKA AVATAR BARU ***
          
          return `
            <div class="flex items-center justify-between p-2 rounded-lg hover:bg-slate-700/50">
                <div class="flex items-center gap-3">

                    <div class="h-9 w-9 rounded-full bg-slate-900 overflow-hidden flex items-center justify-center text-white flex-shrink-0">
                      ${avatarHTML}
                    </div>
                    <span class="text-sm text-slate-100 font-medium">${sanitizeHTML(name)}</span>
                </div>
                <button class="view-profile-btn text-xs bg-cyan-600/90 text-white px-2.5 py-1.5 rounded-md hover:bg-cyan-500 font-medium" data-user-id="${user.id}">View</button>
            </div>
          `;
        }));

        // Jika preview, tambahkan tombol "Lihat Semua" di bawah item
        if (isPreview) {
          container.innerHTML = `
            <div class="space-y-1">${listHtml.join('')}</div>
            <div class="pt-2">
              <button id="lihatSemuaBtn-${containerId}" class="w-full text-xs bg-slate-700/40 text-slate-200 px-3 py-2 rounded-md hover:bg-slate-700">Lihat Semua</button>
            </div>
          `;
        } else {
          container.innerHTML = `<div class="space-y-1">${listHtml.join('')}</div>`;
        }

        // Tambahkan event listener untuk tombol "View"
        container.querySelectorAll('.view-profile-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetUserId = e.currentTarget.dataset.userId;
            
            const currentModal = document.getElementById('profileModal');
            if (currentModal) currentModal.remove();
            
            showUserProfilePopup(targetUserId);
          });
        });

        // Jika kita berada di mode preview, tambahkan handler untuk tombol "Lihat Semua"
        if (!showAll && Array.isArray(userList) && userList.length > 1) {
          const lihatBtn = document.getElementById(`lihatSemuaBtn-${containerId}`);
          if (lihatBtn) {
            lihatBtn.addEventListener('click', async (e) => {
              e.preventDefault();
              // Render ulang daftar penuh
              await renderFollowList(containerId, userList, emptyMessage, true);
            });
          }
        }
      }

      async function unfollowUser(userId) {
        try {
          if (!window.currentUser?.id) {
            showToast('Error', 'Please login to unfollow users', 'error');
            return;
          }

          if (userId === window.currentUser.id) {
            showToast('Error', 'Invalid operation', 'error');
            return;
          }

          // First update UI optimistically
          updateFollowButton(userId, false);
          updateFollowerCountUI(userId, -1); // <-- TAMBAHKAN INI (-1)

          if (hasFollowsTable) {
            const { error } = await supabase
              .from('follows')
              .delete()
              .eq('follower_id', window.currentUser.id)
              .eq('following_id', userId);

            if (error) {
              console.error('Error unfollowing user:', error);
              // Revert UI on error
              updateFollowButton(userId, true);
              updateFollowerCountUI(userId, 1); // <-- TAMBAHKAN INI (Batal, +1)
              showToast('Error', 'Could not unfollow user: ' + error.message, 'error');
              return;
            }
            
            // Decrement followers_count in profiles table (ini tetap jalan)
            try {
              const { data: prof, error: profErr } = await supabase
                .from('profiles')
                .select('followers_count')
                .eq('id', userId)
                .single();
              if (!profErr && prof) {
                const newCount = Math.max(0, (prof.followers_count || 0) - 1);
                await supabase.from('profiles').update({ followers_count: newCount }).eq('id', userId);
              }
            } catch (e) {
              console.warn('Could not decrement followers_count:', e);
            }

            showToast('Success', 'Successfully unfollowed user', 'success');
          } else {

            try {
              const localFollows = JSON.parse(localStorage.getItem('follows') || '[]');
              
              // Check if actually following
              if (!localFollows.some(f => 
                f.follower_id === window.currentUser.id && 
                f.following_id === userId
              )) {
                showToast('Info', 'You are not following this user', 'info');
                return;
              }

              const filtered = localFollows.filter(f => 
                !(f.follower_id === window.currentUser.id && f.following_id === userId)
              );
              localStorage.setItem('follows', JSON.stringify(filtered));
              
              showToast('Info', 'Unfollow saved locally - server storage not available', 'info');
            } catch (localErr) {
              console.error('Error saving unfollow locally:', localErr);
              // Revert UI on error
              updateFollowButton(userId, true);
              showToast('Error', 'Could not save unfollow data locally', 'error');
            }
          }
        } catch (err) {
          console.error('Error unfollowing user:', err);
          // Revert UI on error
          updateFollowButton(userId, true);
          updateFollowerCountUI(userId, 1); // <-- TAMBAHKAN INI (Batal, +1)
          showToast('Error', 'Failed to unfollow user', 'error');
        }
      }


      
     async function isFollowing(userId) {
        try {
          if (hasFollowsTable) {
            
            // *** PERBAIKAN: Ganti .single() menjadi .maybeSingle() ***
            // .single() melempar error jika tidak ada data, .maybeSingle() tidak.
            const { data, error } = await supabase
              .from('follows')
              .select('follower_id')
              .eq('follower_id', window.currentUser?.id)
              .eq('following_id', userId)
              .maybeSingle(); // <-- GANTI KE INI

            // Jika ada error selain "data tidak ditemukan", baru lempar error
            if (error) throw error; 
            
            // Jika data ada (tidak null), berarti 'is following'
            return !!data; 
            
          } else {
            const localFollows = JSON.parse(localStorage.getItem('follows') || '[]');
            return localFollows.some(f => 
              f.follower_id === window.currentUser?.id && 
              f.following_id === userId
            );
          }
        } catch (err) {
          console.error('Error checking follow status:', err);
          return false;
        }
      }

      //sanitize HTML untuk mencegah XSS
      function sanitizeHTML(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
      }

     // Filter kata kasar
     const badWords = ["tolol", "bacot", "anjing", "asu", "fuckyou", "babi", "bapak kau", "bujang", "kontol", "memek", "perek", "jancuk"];
      function filterBadWords(content) {
        let filteredContent = content;
        let hasBadWord = false;
        const placeholder = "__BAD_WORD__"; // Placeholder untuk kata kasar

        // Ganti kata kasar dengan placeholder
        badWords.forEach(word => {
          const regex = new RegExp(`\\b${word}\\b`, 'gi');
          if (regex.test(filteredContent)) {
            hasBadWord = true;
            filteredContent = filteredContent.replace(regex, placeholder);
          }
        });

        if (hasBadWord) {
          showToast("Warning", "Rude words have been removed from your message!", "info");
        }

        return filteredContent;
      }

      // Format waktu relatif
      function timeAgo(date) {
        const now = new Date();
        const seconds = Math.floor((now - new Date(date)) / 1000);
        if (seconds < 60) return `${seconds} detik lalu`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} menit lalu`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} jam lalu`;
        return new Date(date).toLocaleDateString("id-ID");
      }

      // Validasi UUID
      function isValidUuid(uuid) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
      }

      // Normalisasi struktur likes
      function normalizeLikes(likes) {
        if (!Array.isArray(likes)) {
          return [];
        }
        return likes.filter(like => like && like.type && like.user_id && isValidUuid(like.user_id));
      }

      // Mendapatkan jumlah like per tipe
      function getLikesCount(likes, type) {
        return normalizeLikes(likes).filter(like => like.type === type).length;
      }

      // Fungsi untuk menambahkan satu pesan admin ke DOM
      async function appendAdminMessage(msg) {
        const adminMessages = document.getElementById("adminMessages");
        if (!adminMessages) return;

        const adminMessageEl = document.createElement("div");
        adminMessageEl.className = "mb-4 last:mb-0 bg-gradient-to-br from-slate-800/30 to-slate-900/20 border border-slate-700/40 rounded-xl p-4 text-slate-100 shadow-md animate-fade-in";
        adminMessageEl.setAttribute("data-admin-message-id", msg.id);

        const timestamp = new Date(msg.created_at).toLocaleString("id-ID", {
          hour: "numeric", minute: "numeric", hour12: true,
          day: "numeric", month: "short", year: "numeric"
        });

        const sanitizedContent = sanitizeHTML(msg.content);
adminMessageEl.innerHTML = `
  <div class="flex items-start gap-4 p-4 bg-gradient-to-br from-slate-900/40 to-slate-950/30 rounded-xl border border-slate-800/50 shadow-lg shadow-slate-900/20">
  <div class="flex-shrink-0 p-2.5 bg-gradient-to-br from-slate-700 to-slate-800 rounded-full shadow-md">
    <!-- SVG custom (disederhanakan & responsif) -->
    <svg 
      class="h-6 w-6 text-white"
      viewBox="0 0 128 128"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g>
        <ellipse cx="48.6" cy="19.3" rx="10.4" ry="10.4" transform="matrix(0.7071 -0.7071 0.7071 0.7071 0.5609 40.0092)" />
        <path d="M78,47.1c-0.1-0.6-0.3-1.2-0.6-1.7l10,8.4c0.3,0.2,0.6,0.3,0.9,0.3c0.4,0,0.8-0.2,1.1-0.5c0.5-0.6,0.4-1.5-0.2-2L70.5,35.9 c-0.6-0.5-1.5-0.4-2,0.2c-0.5,0.6-0.4,1.5,0.2,2l6,5c-0.5-0.2-1-0.3-1.5-0.3h-19L40.4,28.9c-2.3-2.3-6-2.3-8.3,0L9,54.3 c-1.2,1-2,2.7-2,4.4v54.9c0,3.6,2.9,6.5,6.5,6.5c3.6,0,6.5-2.9,6.5-6.5V68.9c0.9-0.3,1.7-0.5,2.6-1c6.2-3.9,9.9-8.6,15.4-14.1 c0.4-0.4,1.3-1.3,1.4-1.4c2.1-2.1,3.6-4.7,4.4-7.4l5.5,5.5c0.8,0.8,2,1.3,3.3,1.3h20.8C75.9,51.7,78,49.6,78,47.1z"/>
        <polygon points="97.8,58.6 123.2,38.5 118.5,32.6 63.7,76 68.4,81.9 91.7,63.4 91.7,116.2 76,116.2 76,120.1 113.4,120.1 113.4,116.2 97.8,116.2 "/>
      </g>
    </svg>
  </div>
    <div class="flex-1 space-y-2">
      <div class="flex items-center justify-between">
        <div class="font-medium text-white/90 text-lg flex items-center gap-2">
          <i data-lucide="verified" class="h-5 w-5 text-cyan-300"></i>
          <span class="bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 to-slate-200">Official Announcement</span>
        </div>
        <div class="text-xs text-cyan-200/80 flex items-center bg-slate-900/30 px-2 py-1 rounded-full">
          <i data-lucide="clock" class="h-3 w-3 mr-1.5"></i>
          <span>${timestamp}</span>
        </div>
      </div>
      <div class="pl-1 text-white/90 leading-relaxed text-base font-light space-y-2">
        ${sanitizedContent.split('\n').map(p => `<p class="flex items-start gap-2"><i data-lucide="chevron-right" class="h-4 w-4 mt-1 flex-shrink-0 text-cyan-300/80"></i><span>${p}</span></p>`).join('')}
      </div>
      <div class="pt-2 flex items-center gap-3 text-xs text-cyan-300/70">
        <div class="flex items-center">
          <i data-lucide="info" class="h-3 w-3 mr-1.5"></i>
          <span>Admin Team</span>
        </div>
        <a href="https://twitter.com/aqula_app " target="_blank" rel="noopener noreferrer" class="flex items-center">
          <i data-lucide="twitter" class="h-3 w-3 mr-1.5"></i>
          <span>@aqula_app</span>
        </a>
        <a href="https://www.youtube.com/@aqulaapp" target="_blank" rel="noopener noreferrer" class="flex items-center">
          <i data-lucide="youtube" class="h-3 w-3 mr-1.5 text-red-500"></i>
          <span>@aqulaapp</span>
        </a>
      </div>
    </div>
  </div>`;


        adminMessages.appendChild(adminMessageEl);
        lucide.createIcons();
      }

      // Fungsi untuk menambahkan satu pesan ke DOM
      // Fungsi untuk mendapatkan URL avatar yang valid
      async function getAvatarUrl(avatarPath) {
        if (!avatarPath) return '/default-avatar.png';
        try {
          // Cek apakah path sudah berupa URL lengkap
          if (avatarPath.startsWith('http')) {
            return avatarPath;
          }
          
          // Jika menggunakan Supabase Storage
          // Pastikan path tidak diawali slash
          let path = avatarPath;
          if (path.startsWith('/')) path = path.substring(1);
          // Jika path disimpan dengan folder 'avatars/...' hapus prefix itu
          if (path.startsWith('avatars/')) path = path.replace('avatars/', '');
          const { data } = await supabase.storage
            .from('avatars')
            .getPublicUrl(path);
            
          if (data?.publicUrl) {
            // Return the public URL with cache-busting param; the <img> tags include onerror fallback
            return `${data.publicUrl}?t=${Date.now()}`;
          }
          
          console.log('Avatar URL generated:', data?.publicUrl);
          return '/default-avatar.png';
        } catch (err) {
          console.error('Error getting avatar URL:', err);
          return '/default-avatar.png';
        }
      }

// Constant for Default Profile SVG (defined outside to be reusable)
const DEFAULT_PROFILE_SVG = `
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-full text-slate-400">
  <g stroke-width="0"></g>
  <g stroke-linecap="round" stroke-linejoin="round"></g>
  <g> 
    <path opacity="0.4" d="M12 22.01C17.5228 22.01 22 17.5329 22 12.01C22 6.48716 17.5228 2.01001 12 2.01001C6.47715 2.01001 2 6.48716 2 12.01C2 17.5329 6.47715 22.01 12 22.01Z" fill="currentColor"></path> 
    <path d="M12 6.93994C9.93 6.93994 8.25 8.61994 8.25 10.6899C8.25 12.7199 9.84 14.3699 11.95 14.4299C11.98 14.4299 12.02 14.4299 12.04 14.4299C12.06 14.4299 12.09 14.4299 12.11 14.4299C12.12 14.4299 12.13 14.4299 12.13 14.4299C14.15 14.3599 15.74 12.7199 15.75 10.6899C15.75 8.61994 14.07 6.93994 12 6.93994Z" fill="currentColor"></path> 
    <path d="M18.7807 19.36C17.0007 21 14.6207 22.01 12.0007 22.01C9.3807 22.01 7.0007 21 5.2207 19.36C5.4607 18.45 6.1107 17.62 7.0607 16.98C9.7907 15.16 14.2307 15.16 16.9407 16.98C17.9007 17.62 18.5407 18.45 18.7807 19.36Z" fill="currentColor"></path> 
  </g>
</svg>`;

// Unified Followers/Following modal with search (Instagram-like)
async function showUnifiedFollowModal(userId, initialTab = 'followers') {
  try {
    if (!userId) return;
    // Remove existing unified modal if present
    document.getElementById('unifiedFollowModal')?.remove();

    // Create basic modal HTML
    const modalHtml = `
      <div id="unifiedFollowModal" class="fixed inset-0 flex items-center justify-center z-[70] p-4">
        <div class="fixed inset-0 bg-black/50" id="unifiedFollowModalBackdrop"></div>
        <div class="relative w-full max-w-md z-10 bg-slate-900 rounded-xl border border-slate-700/60 shadow-2xl overflow-hidden">
          <div class="px-4 py-3 flex items-center justify-between border-b border-slate-700/40">
            <div class="flex items-center gap-3">
              <div class="text-lg font-semibold text-white">Followers & Following</div>
              <div id="unifiedFollowCounts" class="text-xs text-slate-400 ml-2"></div>
            </div>
            <button id="unifiedFollowClose" class="text-slate-300 hover:text-white p-2 rounded-md"><i data-lucide="x" class="h-4 w-4"></i></button>
          </div>

          <div class="px-4 py-3">
            <div class="flex items-center gap-2 mb-3">
              <div class="flex rounded-lg bg-slate-800/50 px-2 py-1 border border-slate-700/40 w-full">
                <input id="unifiedFollowSearch" placeholder="Search followers or following" class="bg-transparent outline-none text-sm text-slate-200 w-full" />
              </div>
            </div>

            <div class="mb-3">
              <div class="inline-flex bg-slate-800/40 rounded-md p-1" role="tablist">
                <button id="unifiedTabFollowers" class="unified-tab active text-sm px-3 py-1 rounded-md bg-transparent text-white">Followers</button>
                <button id="unifiedTabFollowing" class="unified-tab text-sm px-3 py-1 rounded-md text-slate-400">Following</button>
              </div>
            </div>

            <div id="unifiedFollowList" class="max-h-72 overflow-y-auto px-1 space-y-1 pb-3"></div>
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    lucide.createIcons();

    const modal = document.getElementById('unifiedFollowModal');
    const closeBtn = document.getElementById('unifiedFollowClose');
    const searchInput = document.getElementById('unifiedFollowSearch');
    const tabFollowers = document.getElementById('unifiedTabFollowers');
    const tabFollowing = document.getElementById('unifiedTabFollowing');
    const listEl = document.getElementById('unifiedFollowList');
    const countsEl = document.getElementById('unifiedFollowCounts');

    let followers = [];
    let following = [];
    let activeTab = initialTab === 'following' ? 'following' : 'followers';
    let searchTerm = '';
    let searchTimer = null;

    // Load both lists in background
    const loadBoth = async () => {
      try {
        followers = await getFollowers(userId).catch(() => []);
      } catch (e) { followers = []; }
      try {
        following = await getFollowing(userId).catch(() => []);
      } catch (e) { following = []; }
      countsEl.textContent = `${followers.length} / ${following.length}`;
      renderActiveList();
    };

    // Render helper
    async function renderActiveList() {
      listEl.innerHTML = '<div class="py-6 text-sm text-slate-400">Loading...</div>';
      const source = activeTab === 'following' ? following : followers;
      let filtered = source || [];
      if (searchTerm && searchTerm.trim().length > 0) {
        const q = searchTerm.trim().toLowerCase();
        filtered = filtered.filter(u => (u.username || '').toLowerCase().includes(q) || (u.full_name || '').toLowerCase().includes(q));
      }
      if (!filtered || filtered.length === 0) {
        listEl.innerHTML = `<div class="py-6 text-sm text-slate-400 text-center">No results</div>`;
        return;
      }

      const rows = await Promise.all(filtered.map(async (u) => {
        const avatarUrl = await getAvatarUrl(u.avatar_url).catch(() => '/default-avatar.png');
        const name = sanitizeHTML(u.full_name || u.username || 'User');

        // [UPDATE] Logic for Default SVG Avatar
        // Use escape for DEFAULT_PROFILE_SVG to be safe inside template literal
        const escapedSVG = DEFAULT_PROFILE_SVG.replace(/`/g, '\\`');
        
        const avatarHTML = (avatarUrl && avatarUrl !== '/default-avatar.png')
  ? `<img src="${avatarUrl}" class="w-full h-full object-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
     <div class="w-full h-full bg-slate-200 rounded-full flex items-center justify-center text-slate-500" style="display:none">${DEFAULT_PROFILE_SVG}</div>`
  : `<div class="w-full h-full">${DEFAULT_PROFILE_SVG}</div>`;

        return `
          <div class="flex items-center justify-between p-2 rounded-lg hover:bg-slate-700/40">
            <div class="flex items-center gap-3">
              <div class="h-9 w-9 rounded-full overflow-hidden bg-slate-800/50 flex items-center justify-center flex-shrink-0 border border-slate-700/50">
                ${avatarHTML}
              </div>
              <div class="flex flex-col">
                <button class="text-sm text-slate-100 view-profile-from-unified" data-user-id="${u.id}">${name}</button>
                <span class="text-xs text-slate-400">@${sanitizeHTML(u.username || (u.id || '').substring(0,8))}</span>
              </div>
            </div>
            <div>
              <button class="follow-toggle-btn text-xs px-3 py-1 rounded-md bg-cyan-600/90 text-white" data-user-id="${u.id}">...</button>
            </div>
          </div>`;
      }));

      listEl.innerHTML = `<div class="space-y-1">${rows.join('')}</div>`;
      lucide.createIcons();

      // Attach event handlers for view-profile
      listEl.querySelectorAll('.view-profile-from-unified').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const uid = e.currentTarget.dataset.userId;
          // Close only the unified modal, show the new profile
          document.getElementById('unifiedFollowModal')?.remove();
          showUserProfilePopup(uid);
        });
      });

      // For follow/unfollow buttons, set state then attach handler
      listEl.querySelectorAll('.follow-toggle-btn').forEach(async (btn) => {
        const uid = btn.dataset.userId;
        // Determine follow state
        try {
          const followed = await isFollowing(uid).catch(() => false);
          btn.textContent = followed ? 'Following' : 'Follow';
          btn.classList.toggle('bg-green-600', followed);
          btn.classList.toggle('bg-cyan-600/90', !followed);
        } catch (e) {
          btn.textContent = 'Follow';
        }
        btn.addEventListener('click', async (ev) => {
          ev.stopPropagation();
          try {
            await toggleFollow(uid);
          } catch (e) { console.warn('toggleFollow failed', e); }
          // refresh lists and counts
          await loadBoth();
        });
      });
    }

    // Tab handlers
    tabFollowers.addEventListener('click', (e) => { e.stopPropagation(); activeTab = 'followers'; tabFollowers.classList.add('text-white'); tabFollowers.classList.remove('text-slate-400'); tabFollowing.classList.remove('text-white'); tabFollowing.classList.add('text-slate-400'); renderActiveList(); });
    tabFollowing.addEventListener('click', (e) => { e.stopPropagation(); activeTab = 'following'; tabFollowing.classList.add('text-white'); tabFollowing.classList.remove('text-slate-400'); tabFollowers.classList.remove('text-white'); tabFollowers.classList.add('text-slate-400'); renderActiveList(); });

    closeBtn.addEventListener('click', () => document.getElementById('unifiedFollowModal')?.remove());
    document.getElementById('unifiedFollowModalBackdrop').addEventListener('click', () => document.getElementById('unifiedFollowModal')?.remove());

    // Search with debounce
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTerm = e.target.value || '';
      searchTimer = setTimeout(() => renderActiveList(), 200);
    });

    // Kick off initial load
    await loadBoth();
    // Set initial active tab visuals
    if (activeTab === 'following') { tabFollowing.click(); } else { tabFollowers.click(); }

  } catch (err) {
    console.error('showUnifiedFollowModal error:', err);
    showToast('Error', 'Could not open followers/following modal', 'error');
  }
}

// NEW FUNCTION: Render user list (followers/following) into container (Small list in Profile Modal)
async function renderFollowList(containerId, userList, emptyMessage, showAll = false) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!userList || userList.length === 0) {
    container.innerHTML = `<p class="text-slate-400 text-xs text-center p-4">${emptyMessage}</p>`;
    return;
  }

  let toRender = userList;
  const isPreview = !showAll && Array.isArray(userList) && userList.length > 1;
  if (isPreview) toRender = userList.slice(0, 1);

  const listHtml = await Promise.all(toRender.map(async (user) => {
    const avatarUrl = await getAvatarUrl(user.avatar_url);
    const name = user.full_name || 'Anonymous';
    
    // [UPDATE] Logic for Default SVG Avatar for small list
    const escapedSVG = DEFAULT_PROFILE_SVG.replace(/`/g, '\\`');
    const avatarHTML = (avatarUrl && avatarUrl !== '/default-avatar.png')
        ? `<img src="${avatarUrl}" alt="${sanitizeHTML(name)}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML=\`${escapedSVG}\`">`
        : DEFAULT_PROFILE_SVG;
    
    return `
      <div class="flex items-center justify-between p-2 rounded-lg hover:bg-slate-700/50">
          <div class="flex items-center gap-3">
              <div class="h-9 w-9 rounded-full bg-slate-800/50 overflow-hidden flex items-center justify-center flex-shrink-0 border border-slate-700/50">
                ${avatarHTML}
              </div>
              <span class="text-sm text-slate-100 font-medium">${sanitizeHTML(name)}</span>
          </div>
          <button class="view-profile-btn text-xs bg-cyan-600/90 text-white px-2.5 py-1.5 rounded-md hover:bg-cyan-500 font-medium" data-user-id="${user.id}">View</button>
      </div>
    `;
  }));

  if (isPreview) {
    container.innerHTML = `
      <div class="space-y-1">${listHtml.join('')}</div>
      <div class="pt-2">
        <button id="lihatSemuaBtn-${containerId}" class="w-full text-xs bg-slate-700/40 text-slate-200 px-3 py-2 rounded-md hover:bg-slate-700">Lihat Semua</button>
      </div>
    `;
  } else {
    container.innerHTML = `<div class="space-y-1">${listHtml.join('')}</div>`;
  }

  container.querySelectorAll('.view-profile-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetUserId = e.currentTarget.dataset.userId;
      const currentModal = document.getElementById('profileModal');
      if (currentModal) currentModal.remove();
      showUserProfilePopup(targetUserId);
    });
  });

  if (!showAll && Array.isArray(userList) && userList.length > 1) {
    const lihatBtn = document.getElementById(`lihatSemuaBtn-${containerId}`);
    if (lihatBtn) {
      lihatBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await renderFollowList(containerId, userList, emptyMessage, true);
      });
    }
  }
}

    // Show profile popup with Realtime Status Sync
// Show profile popup with Instant Loading, Fixed Date & Hybrid Status Check
// Show profile popup with Instant Loading, Fixed Date & Hybrid Status Check
async function showUserProfilePopup(userId) {
  if (!userId) return;

  const isSelfProfile = userId === window.currentUser?.id;

  // 1. TAMPILKAN MODAL SKELETON
  document.getElementById('profileModal')?.remove();

  const loadingHtml = `
    <div class="fixed inset-0 flex items-center justify-center z-50 p-4" id="profileModal" data-profile-user-id="${userId}">
      <div class="fixed inset-0 backdrop-blur-sm bg-black/40"></div>
      <div class="relative w-full max-w-sm z-10 animate-in fade-in zoom-in-95 duration-200">
        <div class="bg-slate-900/90 rounded-xl border border-slate-700/60 shadow-2xl overflow-hidden p-6 flex flex-col items-center">
           <div class="w-24 h-24 rounded-full bg-slate-800 animate-pulse mb-4 mt-8"></div>
           <div class="h-6 w-32 bg-slate-800 rounded animate-pulse mb-2"></div>
           <div class="h-4 w-24 bg-slate-800 rounded animate-pulse mb-6"></div>
           <div class="flex gap-4 w-full justify-center mb-6">
             <div class="h-16 w-20 bg-slate-800 rounded-xl animate-pulse"></div>
             <div class="h-16 w-20 bg-slate-800 rounded-xl animate-pulse"></div>
             <div class="h-16 w-20 bg-slate-800 rounded-xl animate-pulse"></div>
           </div>
           <div class="h-10 w-full bg-slate-800 rounded-lg animate-pulse mb-4"></div>
        </div>
        <button id="profileModalCloseLoading" class="absolute -top-12 right-0 text-slate-300 bg-slate-800/80 p-2 rounded-full border border-slate-700 hover:bg-slate-700">
          <i data-lucide="x" class="h-5 w-5"></i>
        </button>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', loadingHtml);
  lucide.createIcons();
  
  document.getElementById('profileModalCloseLoading')?.addEventListener('click', () => document.getElementById('profileModal')?.remove());

  try {
    // 2. AMBIL DATA DI BACKGROUND (Profile + Follow Status)
    const [profileRes, followersList, followingList, isFollowingRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      getFollowers(userId).catch(() => []),
      getFollowing(userId).catch(() => []),
      !isSelfProfile ? isFollowing(userId).catch(() => false) : Promise.resolve(false)
    ]);

    const profile = profileRes.data;
    if (!profile) throw new Error('Profile not found');

    const avatarUrl = await getAvatarUrl(profile.avatar_url);
    const followersCount = followersList.length;
    const followingCount = followingList.length;
    const amFollowing = isFollowingRes;

    const safeFullName = sanitizeHTML(profile.full_name || 'Anonymous');
    const safeUsername = sanitizeHTML(profile.username || (userId ? userId.substring(0, 8) : 'user'));
    const safeBio = sanitizeHTML(profile.bio || (isSelfProfile ? 'Click the edit button to add your bio!' : ''));

    // --- LOGIKA HYBRID ACTIVE STATUS (DATABASE + REALTIME) ---
    let isOnline = false;
    let lastSeenText = '';

    if (isSelfProfile) {
        isOnline = true;
    } else {
        // Cek 1: Realtime List (Paling Cepat)
        const realtimeOnline = Array.isArray(onlineUsers) && onlineUsers.some(u => String(u.user_id) === String(userId));
        
        // Cek 2: Database (Lebih Stabil, ada delay 30s)
        const dbOnline = profile.is_online === true;

        // Cek 3: Heartbeat Timestamp (Paling Akurat jika DB flag nyangkut)
        let recentActivity = false;
        if (profile.last_seen) {
            const diff = Date.now() - new Date(profile.last_seen).getTime();
            // Anggap online jika aktivitas < 2 menit yang lalu
            if (diff < 2 * 60 * 1000) { 
                recentActivity = true;
            }
        }

        // Putuskan status:
        // Online JIKA (Ada di Realtime) ATAU (DB bilang true DAN barusan aktif)
        isOnline = realtimeOnline || (dbOnline && recentActivity);
    }

    const statusDotClass = isOnline 
        ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' 
        : 'bg-slate-500';
    
    let statusText = 'Active now';
    if (!isOnline) {
        if (profile.last_seen) {
            const d = new Date(profile.last_seen);
            // Format: Last seen 14:30
            statusText = `Last seen ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        } else {
            statusText = 'Offline';
        }
    }

    // --- LOGIKA JOINED DATE ---
    let joinedText = ''; 
    let rawDate = profile.created_at;
    if (!rawDate && isSelfProfile && window.currentUser?.created_at) {
      rawDate = window.currentUser.created_at;
    }
    if (rawDate) {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        const dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        joinedText = `Joined ${dateStr}`;
      }
    }

    // 3. RENDER MODAL FINAL
    document.getElementById('profileModal')?.remove();

    // *** LOGIKA AVATAR (Updated with SVG) ***
    // Use escape for DEFAULT_PROFILE_SVG to be safe inside template literal
    const escapedSVG = DEFAULT_PROFILE_SVG.replace(/`/g, '\\`');
    const avatarHTML = (avatarUrl && avatarUrl !== '/default-avatar.png')
        ? `<img src="${avatarUrl}" alt="${safeFullName}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML=\`${escapedSVG}\`">`
        : `<div class="w-full h-full flex items-center justify-center bg-slate-800">${DEFAULT_PROFILE_SVG}</div>`;


    const modalHtml = `
      <div class="fixed inset-0 flex items-center justify-center z-50 p-4" id="profileModal" data-profile-user-id="${userId}">
        <div class="fixed inset-0 backdrop-blur-sm bg-black/40"></div>

        <div class="relative w-full max-w-sm z-10 animate-in fade-in zoom-in-95 duration-300">
          <button id="profileModalClose" class="absolute -top-12 right-0 text-slate-300 hover:text-white transition-all duration-300 bg-slate-800/80 backdrop-blur-md rounded-full p-2 z-20 hover:scale-110 border border-slate-700/60">
            <i data-lucide="x" class="h-5 w-5"></i>
          </button>
          ${isSelfProfile ? `<button id="profileModalSettings" class="absolute -top-12 right-12 text-slate-300 hover:text-white transition-all duration-300 bg-slate-800/80 backdrop-blur-md rounded-full p-2 z-20 hover:scale-110 border border-slate-700/60"><i data-lucide="settings" class="h-5 w-5"></i></button>` : ''}

          <div class="bg-gradient-to-br from-slate-800/90 to-slate-900/90 rounded-xl border border-slate-700/60 shadow-2xl overflow-hidden">
            <div class="h-24 bg-gradient-to-r from-teal-500/20 via-cyan-500/20 to-blue-500/20 relative">
              <div class="absolute -bottom-12 left-1/2 transform -translate-x-1/2">
                <div class="relative">
                  <div class="w-24 h-24 rounded-full p-1 shadow-2xl" style="background:linear-gradient(90deg,#14b8a6,#06b6d4);">
                    <div class="w-full h-full rounded-full bg-slate-900 p-1 overflow-hidden">
                      ${avatarHTML}
                    </div>
                  </div>
                  <div class="absolute -bottom-1 -right-1 bg-cyan-500 rounded-full border-2 border-slate-900 h-6 w-6 flex items-center justify-center">
                    <i data-lucide="badge-check" class="h-4 w-4 text-white"></i>
                  </div>
                </div>
              </div>
            </div>

            <div class="pt-16 pb-6 px-6 flex flex-col items-center">
              <div class="text-center mb-4 w-full">
                <h2 class="text-2xl font-bold text-slate-100 mb-1">${safeFullName}</h2>
                <p class="text-cyan-300 font-medium mb-2 text-center">@${safeUsername}</p>
                <p id="profile-bio-text" class="text-slate-400 text-sm leading-relaxed text-center">${safeBio}</p>
                ${isSelfProfile ? `<button id="profile-bio-edit-btn" class="mt-2 text-cyan-400 text-xs font-medium flex items-center justify-center mx-auto hover:text-cyan-300"><i data-lucide="edit-2" class="h-3 w-3 mr-1"></i> Edit Bio</button>` : ''}
                <div id="profile-bio-editor" class="hidden mt-2 text-left w-full">
                  <textarea id="profile-bio-input" class="w-full bg-slate-800 text-white rounded-lg p-2 text-sm border border-slate-700/50" rows="4">${sanitizeHTML(profile.bio || '')}</textarea>
                  <div class="flex justify-end gap-2 mt-2">
                    <button id="profile-bio-cancel" class="text-xs text-slate-300 px-3 py-1 rounded-lg hover:bg-slate-700">Cancel</button>
                    <button id="profile-bio-save" class="text-xs bg-cyan-600 text-white px-3 py-1 rounded-lg hover:bg-cyan-500 font-medium">Save</button>
                  </div>
                </div>
              </div>

              <div class="flex justify-center items-center gap-6 mb-6 bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50 w-full">
                <div class="text-center">
                  <div class="text-slate-100 font-bold text-xl">${profile.points || 0}</div>
                  <div class="text-cyan-300 text-xs font-medium mt-1">POINTS</div>
                </div>
                <div class="text-center">
                  <div id="profile-followers-count-${userId}" class="text-slate-100 font-bold text-xl">${followersCount}</div>
                  <div class="text-teal-300 text-xs font-medium mt-1">FOLLOWERS</div>
                </div>
                <div class="text-center">
                  <div class="text-slate-100 font-bold text-xl">${profile.booster || 'None'}</div>
                  <div class="text-blue-300 text-xs font-medium mt-1">BOOSTER</div>
                </div>
              </div>

              <div class="w-full mb-6 border-t border-slate-700/60 pt-4">
                <div class="flex mb-2 border-b border-slate-700/60">
                  ${isSelfProfile ? `<button id="show-inbox-btn" class="follow-tab-btn flex-1 pb-2 text-sm font-medium text-white border-b-2 border-cyan-400" data-target="inbox-list-container">Inbox</button>` : ''}
                  <button id="show-followers-btn" class="follow-tab-btn flex-1 pb-2 text-sm font-medium ${isSelfProfile ? 'text-slate-400 border-transparent' : 'text-white border-cyan-400'}" data-target="follower-list-container">Followers (${followersCount})</button>
                  <button id="show-following-btn" class="follow-tab-btn flex-1 pb-2 text-sm font-medium text-slate-400 border-b-2 border-transparent" data-target="following-list-container">Following (${followingCount})</button>
                </div>

                <div class="relative max-h-60 overflow-y-auto">
                  ${isSelfProfile ? `<div id="inbox-list-container" class="follow-list-content" data-loaded="false"></div>` : ''}
                  <div id="follower-list-container" class="follow-list-content ${isSelfProfile ? 'hidden' : ''}" data-loaded="false"></div>
                  <div id="following-list-container" class="follow-list-content hidden" data-loaded="false"></div>
                </div>
              </div>

              ${!isSelfProfile ? `
                <div class="space-y-3 w-full">
                  <button id="followBtn-${userId}" class="w-full py-3.5 px-4 rounded-xl font-semibold transition-all duration-300 ${amFollowing ? 'bg-gradient-to-r from-slate-700 to-slate-800 text-slate-200 border border-slate-600/50 shadow-lg' : 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-lg'}">
                    <div class="flex items-center justify-center space-x-2">
                      <i data-lucide="${amFollowing ? 'user-check' : 'user-plus'}" class="h-4 w-4"></i>
                      <span>${amFollowing ? 'Following' : 'Follow User'}</span>
                    </div>
                  </button>

                  <button id="sendMsgBtn-${userId}" class="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold shadow-lg transition-all duration-300">
                    <div class="flex items-center justify-center space-x-2">
                      <i data-lucide="send" class="h-4 w-4"></i>
                      <span>Send Message</span>
                    </div>
                  </button>
                </div>
              ` : ''}

            </div>

            <div class="bg-slate-800/50 border-t border-slate-700/60 px-6 py-4">
              <div class="flex justify-between text-xs text-slate-400">
                ${joinedText ? `<span>${joinedText}</span>` : '<span></span>'}
                
                <span id="profile-status-container" class="flex items-center">
                    <span class="status-dot w-2 h-2 ${statusDotClass} rounded-full mr-1.5 transition-all duration-300"></span>
                    <span class="status-text">${statusText}</span>
                </span>
              </div>
            </div>
          </div>
          <div class="absolute -z-10 top-1/4 -left-10 w-20 h-20 bg-cyan-400/10 rounded-full blur-xl"></div>
          <div class="absolute -z-10 bottom-1/4 -right-10 w-20 h-20 bg-blue-400/10 rounded-full blur-xl"></div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    lucide.createIcons();

    const modal = document.getElementById('profileModal');

    // close handlers
    document.getElementById('profileModalClose')?.addEventListener('click', () => modal.remove());
    document.getElementById('profileModalSettings')?.addEventListener('click', (e) => {
      e.stopPropagation();
      modal.remove();
      showProfileSettings(userId);
    });
    modal.querySelector('.fixed.inset-0.backdrop-blur-sm')?.addEventListener('click', () => modal.remove());

    // Bio & Actions
    if (isSelfProfile) {
      document.getElementById('profile-bio-edit-btn')?.addEventListener('click', () => toggleBioEditor(true));
      document.getElementById('profile-bio-cancel')?.addEventListener('click', () => toggleBioEditor(false));
      document.getElementById('profile-bio-save')?.addEventListener('click', saveProfileBio);
    } else {
      document.getElementById(`followBtn-${userId}`)?.addEventListener('click', async (e) => {
        e.preventDefault();
        await toggleFollow(userId);
        const el = document.getElementById(`profile-followers-count-${userId}`);
        if (el) {
          const current = parseInt(el.textContent || '0', 10) || 0;
          el.textContent = amFollowing ? Math.max(0, current - 1) : (current + 1);
        }
      });
      document.getElementById(`sendMsgBtn-${userId}`)?.addEventListener('click', () => {
        modal.remove();
        startDirectMessage(userId);
      });
    }

    // Tabs
    const tabs = modal.querySelectorAll('.follow-tab-btn');
    const lists = modal.querySelectorAll('.follow-list-content');
    const loadList = async (targetId) => {
      const target = document.getElementById(targetId);
      if (!target || target.dataset.loaded === 'true') return;
      target.innerHTML = `<p class="text-slate-400 text-xs text-center p-4">Loading...</p>`;
      target.dataset.loaded = 'true';
      try {
        if (targetId === 'follower-list-container') await renderFollowList(targetId, followersList, 'No followers yet.');
        else if (targetId === 'following-list-container') await renderFollowList(targetId, followingList, 'Not following anyone yet.');
        else if (targetId === 'inbox-list-container') {
           await renderConversations(targetId);
           try { const convs = await getConversations(); await Promise.all((convs||[]).map(c => markConversationRead(c.userId))); updateInboxBadge('clear'); } catch(e){}
        }
      } catch (err) { target.innerHTML = `<p class="text-rose-400 text-xs text-center p-4">Failed to load list.</p>`; }
    };
    tabs.forEach(tab => {
      tab.addEventListener('click', async (e) => {
        e.stopPropagation();
        const targetId = tab.dataset.target;
        if (['follower-list-container', 'following-list-container'].includes(targetId)) {
           await showUnifiedFollowModal(userId, targetId === 'follower-list-container' ? 'followers' : 'following');
           return;
        }
        tabs.forEach(t => { t.classList.remove('text-white', 'border-cyan-400'); t.classList.add('text-slate-400', 'border-transparent'); });
        tab.classList.add('text-white', 'border-cyan-400');
        tab.classList.remove('text-slate-400', 'border-transparent');
        lists.forEach(l => l.classList.add('hidden'));
        document.getElementById(targetId)?.classList.remove('hidden');
        await loadList(targetId);
      });
    });
    if (isSelfProfile) {
      const inboxTab = Array.from(tabs).find(t => t.dataset.target === 'inbox-list-container');
      if (inboxTab) inboxTab.click();
    }

  } catch (err) {
    console.error('Error showing profile:', err);
    document.getElementById('profileModal')?.remove();
    showToast('Error', 'Failed to load user profile', 'error');
  }


  

      
      // Show profile settings (privacy & protection) for current user
async function showProfileSettings(userId) {
  // 1. Validasi User
  if (!userId || userId !== window.currentUser?.id) {
    showToast('Error', 'You can only change your own settings', 'error');
    return;
  }

  // 2. Tampilkan Loading (Opsional, agar user tahu sistem sedang bekerja)
  // showToast('Loading...', 'Fetching preferences', 'info');

  // 3. Siapkan Default Settings
  let settings = { 
    call_privacy: 'everyone', 
    allowed_callers: [], 
    show_email: false, 
    show_phone: false, 
    extra_protection: false 
  };

  // 4. AMBIL DATA DULU DARI SUPABASE (AWAIT)
  // Kita ambil data sebelum render HTML agar UI (titik radio button) sesuai database
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', userId)
      .maybeSingle();

    if (!error && data && data.settings) {
      // Gabungkan default dengan data database
      settings = { ...settings, ...data.settings };
    } else if (error) {
      console.debug('Supabase fetch error (using local/default):', error.message);
    }
  } catch (e) {
    console.debug('Fetch error, fallback to local', e);
  }

  // Fallback: Cek LocalStorage jika Supabase gagal/kosong
  try {
    const local = localStorage.getItem('profile_settings_' + userId);
    if (local) {
      const parsed = JSON.parse(local);
      // Prioritaskan data local hanya jika data settings masih default (belum tertimpa supabase)
      settings = { ...settings, ...parsed };
    }
  } catch (e) { /* ignore */ }


  // 5. HAPUS MODAL LAMA & RENDER HTML BARU
  const modalId = 'profileSettingsModal';
  document.getElementById(modalId)?.remove();
  
  // Note: Tailwind classes + Custom Style tag untuk efek premium
  const html = `
    <div id="${modalId}" class="fixed inset-0 z-[60] flex items-center justify-center p-4 font-sans">
      <style>
        /* Custom Scrollbar & Animations */
        .settings-modal-scroll::-webkit-scrollbar { width: 6px; }
        .settings-modal-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
        .settings-modal-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .settings-modal-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        
        /* Custom Radio Card Styling Logic */
        .radio-card-input:checked + .radio-card-ui {
          border-color: #06b6d4; /* cyan-500 */
          background: linear-gradient(145deg, rgba(6,182,212,0.1) 0%, rgba(15, 23, 42, 0.4) 100%);
          box-shadow: 0 0 15px rgba(6,182,212,0.15);
        }
        .radio-card-input:checked + .radio-card-ui .check-circle {
          background-color: #06b6d4;
          border-color: #06b6d4;
        }
        .radio-card-input:checked + .radio-card-ui .check-icon { opacity: 1; }
        
        /* --- PERBAIKAN TOGGLE SWITCH --- */
        .toggle-checkbox {
            transform: translateX(0);
            transition: transform 0.3s ease-in-out, border-color 0.3s;
        }
        .toggle-checkbox:checked {
            transform: translateX(100%); 
            border-color: #06b6d4; 
        }
        .toggle-label {
            transition: background-color 0.3s ease-in-out;
        }
        .toggle-checkbox:checked + .toggle-label { 
            background-color: #06b6d4; 
        }
      </style>

      <div class="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300"></div>
      
      <div class="relative w-full max-w-lg bg-[#0f172a] rounded-3xl border border-slate-700/50 shadow-2xl shadow-cyan-900/20 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-300">
        
        <div class="px-8 py-6 border-b border-slate-700/50 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div class="p-3 rounded-2xl bg-slate-800/80 border border-slate-700 shadow-inner">
                <i data-lucide="sliders-horizontal" class="h-6 w-6 text-cyan-400"></i>
              </div>
              <div>
                <h3 class="text-2xl font-bold text-white tracking-tight">Preferences</h3>
                <p class="text-xs text-slate-400 font-medium uppercase tracking-wider mt-0.5">Privacy & Security</p>
              </div>
            </div>
            <button id="closeProfileSettings" class="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-200">
              <i data-lucide="x" class="h-6 w-6"></i>
            </button>
          </div>
        </div>

        <div class="p-8 overflow-y-auto settings-modal-scroll space-y-8">
          
          <div class="space-y-4">
            <div class="flex items-center gap-2 mb-2">
              <i data-lucide="phone" class="h-4 w-4 text-cyan-400"></i>
              <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Incoming Calls</span>
            </div>
            
            <div class="grid gap-3">
              <label class="cursor-pointer group">
                <input type="radio" name="call_privacy" value="everyone" class="hidden radio-card-input" ${settings.call_privacy === 'everyone' ? 'checked' : ''}>
                <div class="radio-card-ui p-4 rounded-2xl border border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/60 transition-all duration-200 flex items-center justify-between">
                  <div class="flex items-center gap-4">
                    <div class="p-2 rounded-xl bg-slate-800 text-emerald-400"><i data-lucide="globe" class="h-5 w-5"></i></div>
                    <div>
                      <div class="text-sm font-semibold text-white">Everyone</div>
                      <div class="text-xs text-slate-400">Anyone can call you</div>
                    </div>
                  </div>
                  <div class="check-circle w-5 h-5 rounded-full border-2 border-slate-600 flex items-center justify-center transition-colors">
                    <div class="check-icon w-2 h-2 bg-white rounded-full opacity-0 transition-opacity"></div>
                  </div>
                </div>
              </label>

              <label class="cursor-pointer group">
                <input type="radio" name="call_privacy" value="followers" class="hidden radio-card-input" ${settings.call_privacy === 'followers' ? 'checked' : ''}>
                <div class="radio-card-ui p-4 rounded-2xl border border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/60 transition-all duration-200 flex items-center justify-between">
                  <div class="flex items-center gap-4">
                    <div class="p-2 rounded-xl bg-slate-800 text-blue-400"><i data-lucide="users" class="h-5 w-5"></i></div>
                    <div>
                      <div class="text-sm font-semibold text-white">Followers</div>
                      <div class="text-xs text-slate-400">Only mutuals can call</div>
                    </div>
                  </div>
                  <div class="check-circle w-5 h-5 rounded-full border-2 border-slate-600 flex items-center justify-center transition-colors">
                    <div class="check-icon w-2 h-2 bg-white rounded-full opacity-0 transition-opacity"></div>
                  </div>
                </div>
              </label>

              <label class="cursor-pointer group">
                <input type="radio" name="call_privacy" value="following" class="hidden radio-card-input" ${settings.call_privacy === 'following' ? 'checked' : ''}>
                <div class="radio-card-ui p-4 rounded-2xl border border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/60 transition-all duration-200 flex items-center justify-between">
                  <div class="flex items-center gap-4">
                    <div class="p-2 rounded-xl bg-slate-800 text-violet-400"><i data-lucide="user-check" class="h-5 w-5"></i></div>
                    <div>
                      <div class="text-sm font-semibold text-white">People I Follow</div>
                      <div class="text-xs text-slate-400">Users you follow can call</div>
                    </div>
                  </div>
                  <div class="check-circle w-5 h-5 rounded-full border-2 border-slate-600 flex items-center justify-center transition-colors">
                    <div class="check-icon w-2 h-2 bg-white rounded-full opacity-0 transition-opacity"></div>
                  </div>
                </div>
              </label>

              <label class="cursor-pointer group">
                <input type="radio" name="call_privacy" value="nobody" class="hidden radio-card-input" ${settings.call_privacy === 'nobody' ? 'checked' : ''}>
                <div class="radio-card-ui p-4 rounded-2xl border border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/60 transition-all duration-200 flex items-center justify-between">
                  <div class="flex items-center gap-4">
                    <div class="p-2 rounded-xl bg-slate-800 text-rose-400"><i data-lucide="bell-off" class="h-5 w-5"></i></div>
                    <div>
                      <div class="text-sm font-semibold text-white">Nobody</div>
                      <div class="text-xs text-slate-400">Disable all calls</div>
                    </div>
                  </div>
                  <div class="check-circle w-5 h-5 rounded-full border-2 border-slate-600 flex items-center justify-center transition-colors">
                    <div class="check-icon w-2 h-2 bg-white rounded-full opacity-0 transition-opacity"></div>
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <i data-lucide="shield-check" class="h-4 w-4 text-purple-400"></i>
              <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Exceptions</span>
            </div>
            <div class="relative group">
              <div class="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl opacity-20 group-hover:opacity-40 transition duration-200 blur"></div>
              <div class="relative bg-slate-900 rounded-xl border border-slate-700/50 flex items-center p-1">
                <div class="pl-3 text-slate-500"><i data-lucide="user-plus" class="h-5 w-5"></i></div>
                <input id="allowedCallersInput" 
                       class="w-full bg-transparent text-white text-sm px-3 py-3 outline-none placeholder-slate-600 font-mono" 
                       placeholder="User IDs (comma separated)" 
                       value="${(settings.allowed_callers || []).join(', ')}" />
              </div>
            </div>
            <p class="text-[10px] text-slate-500 ml-1">Users listed here can bypass "Nobody" restriction.</p>
          </div>

          <div class="space-y-4 pt-2">
            <div class="flex items-center gap-2 mb-2">
              <i data-lucide="lock" class="h-4 w-4 text-amber-400"></i>
              <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Security & Visibility</span>
            </div>

            <div class="bg-slate-800/30 rounded-2xl border border-slate-700/50 divide-y divide-slate-700/50">
              
              <div class="p-4 flex items-center justify-between">
                <div>
                  <div class="text-sm font-medium text-slate-200">Enhanced Protection</div>
                  <div class="text-xs text-slate-500 mt-0.5">Strict filtering for your account</div>
                </div>
                <div class="relative inline-block w-12 h-6 align-middle select-none">
                  <input type="checkbox" name="toggle" id="extraProtectionToggle" class="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer left-0 top-0 border-slate-600" ${settings.extra_protection ? 'checked' : ''}/>
                  <label for="extraProtectionToggle" class="toggle-label block overflow-hidden h-6 rounded-full bg-slate-700 cursor-pointer"></label>
                </div>
              </div>

              <div class="p-4 flex items-center justify-between">
                <div>
                  <div class="text-sm font-medium text-slate-200">Public Email</div>
                  <div class="text-xs text-slate-500 mt-0.5">Display email on profile</div>
                </div>
                <div class="relative inline-block w-12 h-6 align-middle select-none">
                  <input type="checkbox" name="toggle" id="showEmailToggle" class="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer left-0 top-0 border-slate-600" ${settings.show_email ? 'checked' : ''}/>
                  <label for="showEmailToggle" class="toggle-label block overflow-hidden h-6 rounded-full bg-slate-700 cursor-pointer"></label>
                </div>
              </div>

              <div class="p-4 flex items-center justify-between">
                <div>
                  <div class="text-sm font-medium text-slate-200">Public Phone</div>
                  <div class="text-xs text-slate-500 mt-0.5">Display phone number</div>
                </div>
                <div class="relative inline-block w-12 h-6 align-middle select-none">
                  <input type="checkbox" name="toggle" id="showPhoneToggle" class="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer left-0 top-0 border-slate-600" ${settings.show_phone ? 'checked' : ''}/>
                  <label for="showPhoneToggle" class="toggle-label block overflow-hidden h-6 rounded-full bg-slate-700 cursor-pointer"></label>
                </div>
              </div>

            </div>
          </div>

        </div>

        <div class="px-8 py-5 bg-slate-900/80 border-t border-slate-700/50 backdrop-blur-md flex justify-end gap-3">
          <button id="cancelProfileSettingsBtn" class="px-6 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-slate-600 transition-all">
            Cancel
          </button>
          <button id="saveProfileSettingsBtn" class="px-8 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-lg shadow-cyan-900/20 hover:shadow-cyan-500/40 transform hover:-translate-y-0.5 transition-all flex items-center gap-2">
            <i data-lucide="save" class="h-4 w-4"></i>
            <span>Save Changes</span>
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', html);
  lucide.createIcons();

  // --- Event Listeners ---

  // Fungsi helper untuk tutup modal & refresh profile
  const closeAndRefresh = () => {
      document.getElementById(modalId)?.remove();
      showUserProfilePopup(userId);
  };

  document.getElementById('closeProfileSettings')?.addEventListener('click', closeAndRefresh);
  document.getElementById('cancelProfileSettingsBtn')?.addEventListener('click', closeAndRefresh);
  
  // --- LOGIKA SAVE YANG SUDAH DIPERBAIKI ---
  document.getElementById('saveProfileSettingsBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('saveProfileSettingsBtn');
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="h-4 w-4 animate-spin"></i><span>Saving...</span>`;
    lucide.createIcons();

    // 1. Ambil Value
    const callPrivacy = document.querySelector('input[name="call_privacy"]:checked')?.value || 'everyone';
    const extra = !!document.getElementById('extraProtectionToggle')?.checked;
    const showEmail = !!document.getElementById('showEmailToggle')?.checked;
    const showPhone = !!document.getElementById('showPhoneToggle')?.checked;
    
    // 2. FIX EXCEPTIONS: Hapus spasi, dan hapus string kosong agar array bersih
    const rawAllowed = document.getElementById('allowedCallersInput')?.value || '';
    const allowed = rawAllowed.split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0); 

    // 3. Buat Object Baru
    const newSettings = { 
        call_privacy: callPrivacy, 
        allowed_callers: allowed, 
        extra_protection: extra, 
        show_email: showEmail, 
        show_phone: showPhone 
    };

    // 4. Simpan ke Supabase
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .upsert(
            { user_id: userId, settings: newSettings },
            { onConflict: 'user_id' }
        )
        .select();

      if (error) {
        console.warn('Supabase update failed, using local fallback', error);
        localStorage.setItem('profile_settings_' + userId, JSON.stringify(newSettings));
        showToast('Saved Locally', 'Settings saved (server issue)', 'info');
      } else {
        // Update localstorage juga agar sinkron cepat
        localStorage.setItem('profile_settings_' + userId, JSON.stringify(newSettings));
        showToast('Success', 'Settings updated successfully', 'success');
      }
    } catch (e) {
      console.warn('Save error, fallback local', e);
      localStorage.setItem('profile_settings_' + userId, JSON.stringify(newSettings));
      showToast('Saved Locally', 'Error saving to server', 'info');
    }

    document.getElementById(modalId)?.remove();
    showUserProfilePopup(userId);
  });
      }
      }

      

      // Fungsi untuk menampilkan/menyembunyikan editor bio
      function toggleBioEditor(show) {
        try {
          const textEl = document.getElementById('profile-bio-text');
          const editBtn = document.getElementById('profile-bio-edit-btn');
          const editorEl = document.getElementById('profile-bio-editor');

          if (show) {
            // Sembunyikan teks bio dan tombol edit
            textEl.style.display = 'none';
            if (editBtn) editBtn.style.display = 'none';
            // Tampilkan editor
            editorEl.style.display = 'block';
            document.getElementById('profile-bio-input').focus();
          } else {
            // Tampilkan lagi teks bio dan tombol edit
            textEl.style.display = 'block';
            if (editBtn) editBtn.style.display = 'flex'; // Tombol edit menggunakan 'flex'
            // Sembunyikan editor
            editorEl.style.display = 'none';
          }
        } catch (e) {
          console.error('Error toggling bio editor:', e);
        }
      }

      // Fungsi untuk menyimpan bio baru ke Supabase
      async function saveProfileBio() {
        const input = document.getElementById('profile-bio-input');
        if (!input) return;
        
        const newBio = input.value;
        const currentUserId = window.currentUser?.id;

        if (!currentUserId) {
          showToast('Error', 'You must be logged in.', 'error');
          return;
        }

        try {
          const { data, error } = await supabase
            .from('profiles')
            .update({ bio: newBio })
            .eq('id', currentUserId)
            .select()
            .single();

          if (error) throw error;

          // Perbarui teks bio di UI
          const bioTextElement = document.getElementById('profile-bio-text');
          bioTextElement.innerText = newBio || 'Click the edit button to add your bio!';
          
          // Perbarui juga data profil di memori
          if (window.currentUser.profile) {
            window.currentUser.profile.bio = newBio;
          }
          
          toggleBioEditor(false); // Sembunyikan editor
          showToast('Success', 'Bio updated successfully!', 'success');

        } catch (err) {
          console.error('Error saving bio:', err);
          showToast('Error', 'Failed to save bio.', 'error');
        }
      }


      
      // Toggle follow status
      async function toggleFollow(userId) {
        const isCurrentlyFollowing = await isFollowing(userId);
        if (isCurrentlyFollowing) {
          await unfollowUser(userId);
        } else {
          await followUser(userId);
        }
      }

      // Check if incoming call should be allowed based on privacy settings
      async function checkCallPrivacy(callerId) {
        try {
          const me = window.currentUser?.id;
          if (!me) return true;
          let settings = { call_privacy: 'everyone', allowed_callers: [] };
          try {
            const { data, error } = await supabase.from('user_settings').select('settings').eq('user_id', me).maybeSingle();
            if (!error && data && data.settings) settings = Object.assign(settings, data.settings);
          } catch (e) {
            try {
              const local = localStorage.getItem('profile_settings_' + me);
              if (local) settings = Object.assign(settings, JSON.parse(local));
            } catch (err) { }
          }
          if (settings.call_privacy === 'nobody') { showToast('Blocked', 'Incoming calls disabled', 'info'); return false; }
          if (settings.call_privacy === 'followers') {
            try {
              const { data: follow, error } = await supabase.from('follows').select('id').eq('follower_id', callerId).eq('following_id', me).maybeSingle();
              if (error || !follow) { showToast('Blocked', 'Only followers can call', 'info'); return false; }
            } catch (e) { console.warn('Follower check error:', e); }
          }
          if (settings.call_privacy === 'everyone' && Array.isArray(settings.allowed_callers) && settings.allowed_callers.length > 0) {
            if (!settings.allowed_callers.includes(callerId)) { showToast('Blocked', 'Not on allowed list', 'info'); return false; }
          }
          return true;
        } catch (err) { console.error('Call privacy check error:', err); return true; }
      }

      // Start direct message
      function startDirectMessage(userId) {
        document.getElementById('profileModal')?.remove();
        showDirectMessageModal(userId);
      }

      // Voice recording state for DM
      let dmVoiceRecorder = null;
      let dmVoiceStream = null;
      let dmVoiceChunks = [];
      let dmVoiceStartTime = null;
      let dmVoiceTimerInterval = null;

      // Start DM voice recording
      async function startDMVoiceRecord(userId) {
        const voiceBtn = document.getElementById(`dmVoiceBtn-${userId}`);
        if (!voiceBtn) return;

        try {
          if (dmVoiceRecorder) {
            // Stop recording
            dmVoiceRecorder.stop();
            dmVoiceRecorder = null;
            if (dmVoiceTimerInterval) { clearInterval(dmVoiceTimerInterval); dmVoiceTimerInterval = null; }
            dmVoiceStartTime = null;
            voiceBtn.classList.remove('bg-red-600', 'animate-pulse');
            voiceBtn.classList.add('bg-slate-700/80');
            const timerDisplay = voiceBtn.parentElement?.querySelector('.voice-timer');
            if (timerDisplay) timerDisplay.remove();
            return;
          }

          // Start recording
          dmVoiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          dmVoiceChunks = [];
          
          const mediaRecorder = new MediaRecorder(dmVoiceStream, { mimeType: 'audio/webm' });
          dmVoiceRecorder = mediaRecorder;
          dmVoiceStartTime = Date.now();

          mediaRecorder.ondataavailable = (e) => {
            dmVoiceChunks.push(e.data);
          };

          mediaRecorder.onstop = async () => {
            try {
              const blob = new Blob(dmVoiceChunks, { type: 'audio/webm' });
              const duration = Math.round(blob.size / 16000); // Rough estimate

              // Upload to Supabase storage
              const filePath = `dm-audio/${userId}/${window.currentUser.id}/${Date.now()}.webm`;
              const { data: uploadData, error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, blob);

              if (uploadError) {
                console.error('Supabase audio upload error:', uploadError);
                throw uploadError;
              }

              // Get public URL
              const publicRes = await supabase.storage.from('avatars').getPublicUrl(filePath);
              const publicUrl = publicRes?.data?.publicUrl || publicRes?.publicUrl || null;
              if (!publicUrl) {
                console.error('Failed to get public URL for uploaded audio', publicRes);
                throw new Error('Failed to obtain public URL for audio');
              }

              // Send as message (audioUrl param)
              await sendDirectMessage(userId, '[Voice Message]', null, publicUrl, duration);
              await loadDirectMessages(userId);
              showToast('Success', 'Voice message sent', 'success');
            } catch (err) {
              console.error('Voice upload failed:', err);
              showToast('Error', 'Failed to send voice: ' + err.message, 'error');
            } finally {
              dmVoiceStream?.getTracks().forEach(track => track.stop());
              dmVoiceStream = null;
              dmVoiceChunks = [];
              if (dmVoiceTimerInterval) { clearInterval(dmVoiceTimerInterval); dmVoiceTimerInterval = null; }
              dmVoiceStartTime = null;
              voiceBtn.classList.remove('bg-red-600', 'animate-pulse');
              voiceBtn.classList.add('bg-slate-700/80');
              const timerDisplay = voiceBtn.parentElement?.querySelector('.voice-timer');
              if (timerDisplay) timerDisplay.remove();
            }
          };

          mediaRecorder.start();
          voiceBtn.classList.add('bg-red-600', 'animate-pulse');
          voiceBtn.classList.remove('bg-slate-700/80');
          
          // Setup timer display (mm:ss format above button)
          let timerDisplay = voiceBtn.parentElement?.querySelector('.voice-timer');
          if (!timerDisplay) {
            timerDisplay = document.createElement('span');
            timerDisplay.className = 'voice-timer text-xs absolute -top-8 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-2 py-1 rounded whitespace-nowrap font-mono';
            voiceBtn.parentElement.style.position = 'relative';
            voiceBtn.parentElement.appendChild(timerDisplay);
          }
          
          // Update timer every 100ms (mm:ss format)
          if (dmVoiceTimerInterval) clearInterval(dmVoiceTimerInterval);
          dmVoiceTimerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - dmVoiceStartTime) / 1000);
            const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
            const ss = String(elapsed % 60).padStart(2, '0');
            if (timerDisplay) timerDisplay.innerText = `🔴 ${mm}:${ss}`;
          }, 100);
          
          showToast('Info', 'Recording... Click again to stop', 'default');
        } catch (err) {
          console.error('Voice record error:', err);
          showToast('Error', 'Failed to access microphone: ' + err.message, 'error');
          dmVoiceRecorder = null;
          dmVoiceStream?.getTracks().forEach(track => track.stop());
          dmVoiceStream = null;
          if (dmVoiceTimerInterval) { clearInterval(dmVoiceTimerInterval); dmVoiceTimerInterval = null; }
          dmVoiceStartTime = null;
          voiceBtn.classList.remove('bg-red-600', 'animate-pulse');
          voiceBtn.classList.add('bg-slate-700/80');
          const timerDisplay = voiceBtn.parentElement?.querySelector('.voice-timer');
          if (timerDisplay) timerDisplay.remove();
        }
      }


      

async function showDirectMessageModal(userId) {
  try {
    const { data: user, error } = await supabase
      .from('profiles')
      .select('full_name, avatar_url') // <-- PERBAIKAN: 'username' dihapus dari sini
      .eq('id', userId)
      .single();

    if (error) throw error;

    // resolve avatar URL for header (use default on error)
    let userPublicAvatar = '/default-avatar.png';
    try { userPublicAvatar = user.avatar_url ? await getAvatarUrl(user.avatar_url) : '/default-avatar.png'; } catch(e) { userPublicAvatar = '/default-avatar.png'; }

    
    // *** LOGIKA AVATAR BARU (SVG FALLBACK) ***
    const name = user.full_name || 'Anonymous';
    // Use escape for DEFAULT_PROFILE_SVG to be safe inside template literal
   // Escape SVG untuk dipakai di dalam attribute (HTML + JS string)
function escapeForHTMLAttribute(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/`/g, '&#96;'); // backtick → entity
}

const safeSVG = escapeForHTMLAttribute(DEFAULT_PROFILE_SVG.trim());

const avatarHTML = (userPublicAvatar && userPublicAvatar !== '/default-avatar.png')
  ? `<img src="${userPublicAvatar}" alt="${name}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='${safeSVG}'">`
  : `<div class="w-full h-full flex items-center justify-center bg-slate-800">${DEFAULT_PROFILE_SVG}</div>`;
    // *** AKHIR LOGIKA AVATAR BARU ***


    // *** DESAIN ULANG MODAL DM ***
    const modalHtml = `
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm" id="dmModal">
        <div class="bg-gradient-to-br from-slate-800/90 to-slate-900/90 rounded-xl p-6 max-w-xl w-full mx-4 shadow-2xl shadow-cyan-500/10 border border-slate-700/60">
          <div class="relative">
            <div class="flex items-center justify-between mb-4 pb-4 border-b border-slate-700/60">
              <div class="flex items-center space-x-3 flex-1">
                <div class="w-10 h-10 rounded-full bg-slate-900 overflow-hidden flex items-center justify-center text-white flex-shrink-0 cursor-pointer" onclick="document.getElementById('dmModal').remove(); showUserProfilePopup('${userId}')">
                  ${avatarHTML}
                </div>
                <div>
                  <h3 class="font-semibold text-slate-100 cursor-pointer hover:text-cyan-400 transition-colors" onclick="document.getElementById('dmModal').remove(); showUserProfilePopup('${userId}')">${name}</h3>
                  <p class="text-xs text-slate-400/80">@${(userId || '').substring(0, 8)}</p>
                </div>
              </div>
              <div class="flex items-center space-x-2 flex-shrink-0">
                <button onclick="startCall('${userId}', '${name}', null)" 
                        class="p-2 bg-cyan-600/80 hover:bg-cyan-500 text-white rounded-lg flex items-center shadow-lg shadow-cyan-500/20 transition-all" 
                        title="Start voice call">
                  <i data-lucide="phone" class="h-4 w-4"></i>
                </button>
                <button onclick="startVideoCall('${userId}', '${name}', null)" 
                        class="p-2 bg-green-600/90 hover:bg-green-500 text-white rounded-lg flex items-center shadow-lg transition-all" 
                        title="Start video call">
                  <i data-lucide="video" class="h-4 w-4"></i>
                </button>
                <button class="p-2 text-slate-400 hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-700/50" 
                        onclick="document.getElementById('dmModal').remove()"
                        title="Close">
                  <i data-lucide="x" class="h-5 w-5"></i>
                </button>
              </div>
            </div>
            
            <div id="dmMessages-${userId}" class="h-96 overflow-y-auto mb-4 space-y-3 p-4 bg-slate-900/70 rounded-lg border border-slate-700/50 shadow-inner">
              </div>
            
            <div class="flex space-x-2 items-end">
              <input type="text" 
                      id="dmInput-${userId}"
                      placeholder="Type your message..." 
                      class="flex-1 bg-slate-800 text-white rounded-lg px-4 py-2 border border-slate-700/50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500">
              <input type="file" id="dmImageInput-${userId}" accept="image/*" class="hidden" />
              <button onclick="document.getElementById('dmImageInput-${userId}').click()" 
                      class="px-3 py-2 bg-slate-700/80 hover:bg-slate-600 text-white rounded-lg flex items-center transition-all" 
                      title="Send image">
                <i data-lucide="image" class="h-5 w-5"></i>
              </button>
              <button id="dmVoiceBtn-${userId}" onclick="startDMVoiceRecord('${userId}')"
                      class="px-3 py-2 bg-slate-700/80 hover:bg-slate-600 text-white rounded-lg flex items-center transition-all" 
                      title="Send voice message">
                <i data-lucide="mic" class="h-5 w-5"></i>
              </button>
              <button onclick="sendDM('${userId}')"
                      class="px-4 py-2 bg-cyan-600/90 hover:bg-cyan-500 text-white rounded-lg flex items-center shadow-lg shadow-cyan-500/20 transition-all">
                <i data-lucide="send" class="h-5 w-5"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    // *** DESAIN ULANG SELESAI ***
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    lucide.createIcons();
    
    // Load existing messages
    await loadDirectMessages(userId);
    // mark messages as read for this conversation (if supported)
    try { await markConversationRead(userId); } catch(e) { /* ignore */ }
    // ensure conversations UI is updated if inbox is open
    try { await refreshConversationsUI(); } catch(e) { /* ignore */ }
    
    // Setup image upload handler for DM
    const imageInput = document.getElementById(`dmImageInput-${userId}`);
    if (imageInput) {
      imageInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
          showToast('Error', 'Please select an image file', 'error');
          return;
        }
        
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
          showToast('Error', 'Image must be less than 5MB', 'error');
          return;
        }
        
        try {
          // Upload to Supabase storage
          const filePath = `dm-images/${userId}/${window.currentUser.id}/${Date.now()}_${file.name}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, file);

          if (uploadError) {
            console.error('Supabase storage upload error:', uploadError);
            throw uploadError;
          }

          // Get public URL
          const publicRes = await supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);
          const publicUrl = publicRes?.data?.publicUrl || publicRes?.publicUrl || null;
          if (!publicUrl) {
            console.error('Failed to get public URL for uploaded image', publicRes);
            throw new Error('Failed to obtain public URL');
          }

          // Send as message (imageUrl param)
          await sendDirectMessage(userId, '[Image]', publicUrl);
          await loadDirectMessages(userId);
          showToast('Success', 'Image sent', 'success');
        } catch (err) {
          console.error('Image upload failed:', err);
          showToast('Error', 'Failed to send image: ' + err.message, 'error');
        }
        e.target.value = ''; // Reset input
      });
    }
    
    // Setup typing indicator & Input focus
    const input = document.getElementById(`dmInput-${userId}`);
    let typingTimeout = null;
    const broadcastTyping = async (isTyping) => {
      try {
        const channel = supabase.channel(`dm-typing:${window.currentUser?.id}:${userId}`);
        channel.send({
          type: 'broadcast',
          event: isTyping ? 'user_typing' : 'user_stop_typing',
          payload: { userId: window.currentUser?.id, name: window.currentUser?.name }
        });
      } catch(e) { console.warn('Failed to broadcast typing:', e); }
    };
    
    input.addEventListener('input', async () => {
      if (!typingTimeout) {
        await broadcastTyping(true);
      }
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(async () => {
        await broadcastTyping(false);
        typingTimeout = null;
      }, 1000);
    });
    
    // Listen for typing events from receiver
    const typingIndicator = document.createElement('div');
    typingIndicator.id = `dmTyping-${userId}`;
    typingIndicator.className = 'text-xs text-slate-400 italic px-4 py-1 min-h-5';
    typingIndicator.style.display = 'none';
    document.getElementById(`dmMessages-${userId}`)?.parentElement?.appendChild(typingIndicator);
    
    const typingChannel = supabase.channel(`dm-typing:${userId}:${window.currentUser?.id}`);
    typingChannel
      .on('broadcast', { event: 'user_typing' }, (payload) => {
        if (typingIndicator) {
          typingIndicator.textContent = 'User is typing...';
          typingIndicator.style.display = 'block';
        }
      })
      .on('broadcast', { event: 'user_stop_typing' }, () => {
        if (typingIndicator) {
          typingIndicator.style.display = 'none';
        }
      })
      .subscribe();
    
    // Setup enter key handler
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendDM(userId);
      }
    });
    
    // Focus input
    input.focus();
  } catch (err) {
    console.error('Error showing DM modal:', err);
    showToast('Error', 'Failed to open chat', 'error');
  }
}
// Send direct message
async function sendDM(userId) {
  const input = document.getElementById(`dmInput-${userId}`);
  const content = input.value.trim();
  
  if (!content) return;
  
  // disable input & send button briefly to avoid duplicate sends
  const sendBtn = document.querySelector(`#dmModal button[onclick="sendDM('${userId}')"]`);
  try {
    input.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
    input.value = '';
    await sendDirectMessage(userId, content);
  } finally {
    input.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
  }
  // refresh inbox/conversations list so sender sees the conversation immediately
  try { await refreshConversationsUI(); } catch(e) { console.warn('Could not refresh conversations after send:', e); }
}

// Load direct messages
async function loadDirectMessages(userId) {
  try {
    // *** FIX: Cek in-memory cache dulu ***
    // Cache ini seharusnya sudah diisi oleh getConversations() / tryFetchConversationsFallback()
    if (directMessages[userId] && directMessages[userId].length > 0) {
      console.debug('loadDirectMessages (FIXED): using pre-populated cache for', userId);
      updateDirectMessageUI(userId); // Langsung render dari cache
      return; // Selesai
    }

    // Jika cache kosong, baru lakukan fetch
    if (hasDirectMessagesTable) {
      // 1. Coba kueri .or()
      const orExpr = `${dmSenderCol}.eq.${window.currentUser?.id},${dmReceiverCol}.eq.${window.currentUser?.id}`;
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(orExpr)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      console.debug('loadDirectMessages (FIXED): query orExpr=', orExpr, 'rows=', Array.isArray(data) ? data.length : data, 'error=', error || null);

      if (error) throw error;
      
      let filteredMessages = data.filter(m => 
        (m[dmSenderCol] === userId && m[dmReceiverCol] === window.currentUser?.id) ||
        (m[dmSenderCol] === window.currentUser?.id && m[dmReceiverCol] === userId)
      );

      // 2. *** FALLBACK: Jika kueri .or() gagal (RLS bug), coba kueri terpisah ***
      if (filteredMessages.length === 0 && !error) {
        console.warn('loadDirectMessages (FIXED): .or() query returned 0 rows, trying split fallback...');
        const me = window.currentUser.id;
        
        // Pesan yang SAYA kirim ke DIA
        const { data: sent, error: sentErr } = await supabase.from('direct_messages').select('*').eq(dmSenderCol, me).eq(dmReceiverCol, userId).is('deleted_at', null);
        
        // Pesan yang DIA kirim ke SAYA
        const { data: recv, error: recvErr } = await supabase.from('direct_messages').select('*').eq(dmSenderCol, userId).eq(dmReceiverCol, me).is('deleted_at', null);

        if (!sentErr && !recvErr) {
          const merged = (sent || []).concat(recv || []);
          merged.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          filteredMessages = merged;
          console.debug('loadDirectMessages (FIXED): fallback query got rows=', merged.length);
        }
      }
      // *** END FALLBACK ***
      
      directMessages[userId] = filteredMessages;

    } else {
      // Load from localStorage (fallback lama)
      const localMessages = JSON.parse(localStorage.getItem('directMessages') || '{}');
      directMessages[userId] = (localMessages[userId] || []).filter(m => !m.deleted_at);
    }
    
    updateDirectMessageUI(userId);
  } catch (err) {
    console.error('Error loading DMs:', err);
    showToast('Error', 'Failed to load messages', 'error');
  }
}
      // --- Conversations / Inbox helpers ---
      // Aggregate conversations (server if available, otherwise local cache)
      async function getConversations() {
        const me = window.currentUser?.id;
        if (!me) return [];

        const convMap = {};

        try {
          if (hasDirectMessagesTable) {
            
            // 1. Coba kueri .or() standar
            const orExpr = `${dmSenderCol}.eq.${me},${dmReceiverCol}.eq.${me}`;
            const { data: orData, error: orError } = await supabase
              .from('direct_messages')
              .select('*')
              .or(orExpr)
              .is('deleted_at', null)
              .order('created_at', { ascending: true });

            if (!orError && Array.isArray(orData) && orData.length > 0) {
              // Jika sukses, proses seperti biasa
              console.debug('getConversations (FINAL FIX): .or() query succeeded, rows=', orData.length);
              orData.forEach(m => {
                const other = m[dmSenderCol] === me ? m[dmReceiverCol] : m[dmSenderCol];
                if (!convMap[other]) convMap[other] = [];
                convMap[other].push(m);
              });

            } else {
              // 2. Kueri .or() GAGAL (kemungkinan RLS) atau kosong. Jalankan FALLBACK.
              console.warn('getConversations (FINAL FIX): .or() query failed or empty, running fallback queries...');
              
              // Ambil pesan yang SAYA TERIMA
              const { data: recvData, error: recvErr } = await supabase
                .from('direct_messages').select('*').eq(dmReceiverCol, me).is('deleted_at', null);
                
              // Ambil pesan yang SAYA KIRIM
              const { data: sendData, error: sendErr } = await supabase
                .from('direct_messages').select('*').eq(dmSenderCol, me).is('deleted_at', null);

              if (recvErr || sendErr) {
                 console.error('getConversations (FINAL FIX): Fallback queries failed.', recvErr, sendErr);
              } else {
                // Gabungkan hasil fallback
                const merged = (recvData || []).concat(sendData || []);
                console.debug('getConversations (FINAL FIX): Fallback queries succeeded, merged rows=', merged.length);
                
                merged.forEach(m => {
                  const other = m[dmSenderCol] === me ? m[dmReceiverCol] : m[dmSenderCol];
                  if (!convMap[other]) convMap[other] = [];
                  // Cek duplikat sebelum push
                  const exists = convMap[other].some(msg => msg.id === m.id);
                  if (!exists) {
                    convMap[other].push(m);
                  }
                });
              }
            }

            // 3. (PENTING) Selalu gabungkan dengan cache in-memory (dari realtime)
            Object.keys(directMessages || {}).forEach(otherId => {
              if (!convMap[otherId]) convMap[otherId] = [];
              const existingIds = new Set(convMap[otherId].map(m => m.id));
              (directMessages[otherId] || []).forEach(m => {
                if (m && m.id && !existingIds.has(m.id)) {
                  convMap[otherId].push(m);
                  existingIds.add(m.id);
                }
              });
            });

          } else {
            // 4. Fallback ke localStorage jika tabel tidak ada
            const local = JSON.parse(localStorage.getItem('directMessages') || '{}');
            Object.keys(local).forEach(k => {
              if (!convMap[k]) convMap[k] = [];
              convMap[k].push(...(local[k] || []).filter(m => !m.deleted_at));
            });
            // Gabungkan juga cache in-memory untuk localStorage
            Object.keys(directMessages || {}).forEach(otherId => {
              if (!convMap[otherId]) convMap[otherId] = [];
              const existingIds = new Set(convMap[otherId].map(m => m.id));
              (directMessages[otherId] || []).forEach(m => {
                if (m && m.id && !existingIds.has(m.id) && !m.deleted_at) {
                  convMap[otherId].push(m);
                  existingIds.add(m.id);
                }
              });
            });
          }
        } catch (err) {
          console.error('Error fetching conversations:', err);
        }

        // Build array dan urutkan
        const convs = Object.entries(convMap).map(([otherId, msgs]) => {
          if (!Array.isArray(msgs) || msgs.length === 0) return null;
          msgs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          const last = msgs[0];
          const unread = msgs.filter(m => (m[dmReceiverCol] === me || m.receiver_id === me) && m.is_read === false).length; 
          return { userId: otherId, lastMessage: last, messages: msgs, lastAt: last?.created_at || 0, unread };
        }).filter(Boolean) // Hapus entri yang null
          .sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));

        console.debug('getConversations (FINAL FIX): processed map into convs count=', convs.length);
        return convs;
      }

      
      // Render conversations list into a container element (adds Archive support)
      let _inboxShowArchived = false;
      async function renderConversations(containerId = 'profileConversations') {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '<div class="py-4 text-sm text-slate-400">Loading conversations...</div>';

        try {
          const me = window.currentUser?.id;
          const convs = await getConversations();
          if (!convs) {
            container.innerHTML = '<div class="py-4 text-sm text-slate-400">No conversations yet</div>';
            return;
          }

          // Fetch archived conversation ids for this user
          let archivedIds = [];
          try {
            if (me) {
              const { data: arch, error: archErr } = await supabase.from('archived_conversations').select('other_user_id').eq('user_id', me);
              if (!archErr && Array.isArray(arch)) archivedIds = arch.map(a => a.other_user_id);
            }
          } catch (e) { console.warn('Could not fetch archived list:', e); }

          // Partition conversations into active vs archived (based on other user id)
          const activeConvs = convs.filter(c => !archivedIds.includes(c.userId));
          const archivedConvs = convs.filter(c => archivedIds.includes(c.userId));

          // Preload profile avatars for all participants (active + archived)
          const ids = convs.map(c => c.userId).filter(Boolean);
          let profiles = [];
          try {
            const { data } = await supabase.from('profiles').select('id,full_name,avatar_url').in('id', ids);
            profiles = Array.isArray(data) ? data : [];
            await Promise.all(profiles.map(async (p) => {
              try { p._publicAvatar = p.avatar_url ? await getAvatarUrl(p.avatar_url) : '/default-avatar.png'; } catch (e) { p._publicAvatar = '/default-avatar.png'; }
            }));
          } catch (e) { console.warn('Could not load participant profiles for inbox:', e); }

          // Build HTML: show Archived toggle if archived exist
          let headerHtml = '';
          if (archivedConvs.length > 0) {
            headerHtml = `<div class="mb-3 flex items-center justify-between"><div class="text-sm text-slate-400">Conversations</div><button id="toggleArchivedBtn" class="text-xs text-slate-300 px-2 py-1 rounded bg-slate-800/40">Archived (${archivedConvs.length})</button></div>`;
          }

          const activeHtml = activeConvs.map(c => {
            const prof = profiles.find(p => p.id === c.userId) || {};
            const name = prof.full_name || c.userId.substring(0, 8);
            const avatarHTML = (prof._publicAvatar && prof._publicAvatar !== '/default-avatar.png') ? `<img src="${prof._publicAvatar}" alt="${sanitizeHTML(name)}" class="w-full h-full object-cover" onerror="this.onerror=null;this.src='/default-avatar.png'">` : `<div class="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-white text-lg font-bold">${(prof.full_name || 'A')[0].toUpperCase()}</div>`;
            const preview = sanitizeHTML((c.lastMessage && c.lastMessage.content) ? (c.lastMessage.content.length > 80 ? c.lastMessage.content.slice(0,80) + '...' : c.lastMessage.content) : '—');
            const time = c.lastAt ? timeAgo(c.lastAt) : '';
            const unreadBadge = c.unread ? `<span class="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">${c.unread}</span>` : '';

            return `
              <div class="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-800/40 rounded-lg conv-item-row">
                <button data-conv-user="${sanitizeHTML(c.userId)}" class="flex-1 text-left flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full bg-slate-900 overflow-hidden flex items-center justify-center text-white flex-shrink-0">${avatarHTML}</div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between"><div class="truncate font-medium text-white">${sanitizeHTML(name)}</div><div class="text-xs text-slate-400">${sanitizeHTML(time)}${unreadBadge}</div></div>
                    <div class="text-sm text-slate-400 truncate">${preview}</div>
                  </div>
                </button>
                <div class="flex items-center ml-2">
                  <button data-archive-target="${sanitizeHTML(c.userId)}" class="text-xs text-slate-300 px-2 py-1 rounded bg-slate-800/30">Archive</button>
                </div>
              </div>`;
          }).join('');

          const archivedHtml = archivedConvs.map(c => {
            const prof = profiles.find(p => p.id === c.userId) || {};
            const name = prof.full_name || c.userId.substring(0, 8);
            const avatarHTML = (prof._publicAvatar && prof._publicAvatar !== '/default-avatar.png') ? `<img src="${prof._publicAvatar}" alt="${sanitizeHTML(name)}" class="w-full h-full object-cover" onerror="this.onerror=null;this.src='/default-avatar.png'">` : `<div class="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-white text-lg font-bold">${(prof.full_name || 'A')[0].toUpperCase()}</div>`;
            const preview = sanitizeHTML((c.lastMessage && c.lastMessage.content) ? (c.lastMessage.content.length > 80 ? c.lastMessage.content.slice(0,80) + '...' : c.lastMessage.content) : '—');
            const time = c.lastAt ? timeAgo(c.lastAt) : '';
            return `
              <div class="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-800/40 rounded-lg archived-item-row">
                <button data-conv-user="${sanitizeHTML(c.userId)}" class="flex-1 text-left flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full bg-slate-900 overflow-hidden flex items-center justify-center text-white flex-shrink-0">${avatarHTML}</div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between"><div class="truncate font-medium text-white">${sanitizeHTML(name)}</div><div class="text-xs text-slate-400">${sanitizeHTML(time)}</div></div>
                    <div class="text-sm text-slate-400 truncate">${preview}</div>
                  </div>
                </button>
                <div class="flex items-center ml-2">
                  <button data-unarchive-target="${sanitizeHTML(c.userId)}" class="text-xs text-slate-300 px-2 py-1 rounded bg-slate-800/30">Unarchive</button>
                </div>
              </div>`;
          }).join('');

          // Render final HTML
          container.innerHTML = `${headerHtml}<div class="space-y-2">${activeHtml}</div><div id="archivedSection" style="display:${_inboxShowArchived ? 'block' : 'none'}; margin-top:10px"><div class="text-sm text-slate-400 mb-2">Archived</div><div class="space-y-2">${archivedHtml || '<div class="text-sm text-slate-400">No archived conversations</div>'}</div></div>`;

          // Update badge
          try { const totalUnread = (convs || []).reduce((s, c) => s + (c.unread || 0), 0); updateInboxBadge(totalUnread); } catch (e) { console.warn('Could not update inbox badge after renderConversations:', e); }

          // Attach listeners
          container.querySelectorAll('[data-conv-user]').forEach(btn => {
            btn.addEventListener('click', (e) => {
              const other = btn.dataset.convUser;
              if (other) { showDirectMessageModal(other); document.getElementById('profileModal')?.remove(); }
            });
          });

          // Archive buttons
          container.querySelectorAll('[data-archive-target]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              e.preventDefault(); const other = btn.getAttribute('data-archive-target'); if (!other) return; await archiveConversation(other); renderConversations(containerId);
            });
          });

          // Unarchive buttons
          container.querySelectorAll('[data-unarchive-target]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              e.preventDefault(); const other = btn.getAttribute('data-unarchive-target'); if (!other) return; await unarchiveConversation(other); renderConversations(containerId);
            });
          });

          // Toggle archived section
          const toggleBtn = document.getElementById('toggleArchivedBtn');
          if (toggleBtn) {
            toggleBtn.addEventListener('click', () => { _inboxShowArchived = !_inboxShowArchived; document.getElementById('archivedSection').style.display = _inboxShowArchived ? 'block' : 'none'; toggleBtn.innerText = `Archived (${archivedConvs.length})`; });
          }

        } catch (err) {
          console.error('Error rendering conversations:', err);
          container.innerHTML = '<div class="py-4 text-sm text-rose-400">Failed to load conversations</div>';
        }
      }
      
      // Refresh the conversations UI if inbox modal is open
      async function refreshConversationsUI() {
        if (document.getElementById('profileModal')) {
          await renderConversations('profileConversations');
        }
      }

      // Archive / Unarchive helpers
      async function archiveConversation(otherUserId) {
        try {
          const me = window.currentUser?.id;
          if (!me) throw new Error('Not authenticated');
          const payload = { user_id: me, other_user_id: otherUserId };
          const { data, error } = await supabase.from('archived_conversations').insert(payload).select();
          if (error) {
            // ignore duplicate conflict errors (if RLS prevents insert it will error)
            console.warn('archiveConversation error:', error);
            showToast('Error', 'Could not archive conversation', 'error');
            return false;
          }
          showToast('Archived', 'Conversation archived', 'success');
          return true;
        } catch (err) {
          console.error('archiveConversation failed:', err);
          showToast('Error', 'Failed to archive conversation', 'error');
          return false;
        }
      }

      async function unarchiveConversation(otherUserId) {
        try {
          const me = window.currentUser?.id;
          if (!me) throw new Error('Not authenticated');
          const { error } = await supabase.from('archived_conversations').delete().match({ user_id: me, other_user_id: otherUserId });
          if (error) {
            console.warn('unarchiveConversation error:', error);
            showToast('Error', 'Could not unarchive conversation', 'error');
            return false;
          }
          showToast('Unarchived', 'Conversation restored', 'success');
          return true;
        } catch (err) {
          console.error('unarchiveConversation failed:', err);
          showToast('Error', 'Failed to unarchive conversation', 'error');
          return false;
        }
      }

      // Create a floating Inbox shortcut button (bottom-right)
      function createInboxShortcut() {
        try {
          // avoid duplicate
          if (document.getElementById('inboxShortcutBtn')) return;
          const btn = document.createElement('button');
          btn.id = 'inboxShortcutBtn';
          btn.title = 'Inbox';
          
          // *** PERBAIKAN: Mengganti <i> dengan SVG baru yang sudah diperbaiki ***
          btn.innerHTML = `<svg class="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M8.5 17.5L5.5 20V15.5H2.46154C2.07391 15.5 1.70217 15.346 1.42807 15.0719C1.15398 14.7978 1 14.4261 1 14.0385V2.46154C1 2.07391 1.15398 1.70217 1.42807 1.42807C1.70217 1.15398 2.07391 1 2.46154 1H18.5385C18.9261 1 19.2978 1.15398 19.5719 1.42807C19.846 1.70217 20 2.07391 20 2.46154V6.8119" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M5 5H16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M5 9H10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M17 19C19.2091 19 21 17.2091 21 15C21 12.7909 19.2091 11 17 11C14.7909 11 13 12.7909 13 15C13 17.2091 14.7909 19 17 19Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M22 22C21.5167 21.3959 20.7962 20.8906 19.9155 20.5384C19.0348 20.1861 18.027 20 17 20C15.973 20 14.9652 20.1861 14.0845 20.5384C13.2038 20.8906 12.4833 21.3959 12 22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg><span id="inboxBadge" style="display:none; position:absolute; top:-6px; right:-6px; background:#ef4444; color:#fff; font-size:11px; padding:2px 6px; border-radius:999px;">0</span>`;
          
          btn.style.position = 'fixed';
          btn.style.right = '20px';
          btn.style.bottom = '20px';
          btn.style.width = '48px';
          btn.style.height = '48px';
          btn.style.borderRadius = '999px';
          btn.style.background = '#296888f0';
          btn.style.boxShadow = '0 6px 20px rgba(2,6,23,0.4)';
          btn.style.zIndex = '60';
          btn.style.border = 'none';
          btn.style.cursor = 'pointer';
          // Kita perlu 'flex' untuk memusatkan SVG di dalam tombol
          btn.style.display = 'flex';
          btn.style.alignItems = 'center';
          btn.style.justifyContent = 'center';
          
          document.body.appendChild(btn);
          // lucide.createIcons(); // Hapus baris ini karena kita tidak pakai Lucide lagi di sini

          btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!window.currentUser?.id) {
              showToast('Info', 'Please login to view your inbox', 'info');
              return;
            }
            // clear inbox badge when opening
            const badge = document.getElementById('inboxBadge');
            if (badge) { badge.style.display = 'none'; badge.innerText = '0'; }
            showUserProfilePopup(window.currentUser.id);
          });
        } catch (err) {
          console.error('Could not create inbox shortcut:', err);
        }
      }


      // Update inbox badge: delta or set
      function updateInboxBadge(deltaOrSet) {
        const badge = document.getElementById('inboxBadge');
        if (!badge) return;
        
        // If it's a non-negative number, SET it directly (don't add)
        if (typeof deltaOrSet === 'number' && deltaOrSet >= 0) {
          badge.innerText = String(deltaOrSet);
          badge.style.display = deltaOrSet > 0 ? 'inline-block' : 'none';
        }
        // If it's negative, add it (delta mode)
        else if (typeof deltaOrSet === 'number' && deltaOrSet < 0) {
          let current = parseInt(badge.innerText || '0', 10) || 0;
          current = Math.max(0, current + deltaOrSet);
          badge.innerText = String(current);
          badge.style.display = current > 0 ? 'inline-block' : 'none';
        }
        // If it's 'clear' string, reset to 0
        else if (deltaOrSet === 'clear') {
          badge.innerText = '0';
          badge.style.display = 'none';
        }
      }

      // Mark conversation messages as read (sets is_read=true for messages where
      // receiver is current user and sender is otherId). No-op if DB doesn't support is_read.
      async function markConversationRead(otherId) {
        try {
          const me = window.currentUser?.id;
          if (!me || !otherId) return;
          if (!hasDirectMessagesTable || !hasDirectMessagesIsRead) return;

          // *** PERBAIKAN: Hapus 'read_at' dari objek update ***
          const updateObj = { is_read: true }; 
          
          const { error } = await supabase
            .from('direct_messages')
            .update(updateObj)
            .eq(dmReceiverCol, me)
            .eq(dmSenderCol, otherId)
            .eq('is_read', false); // Hanya update yang belum dibaca

          if (error) {
             console.warn('Could not mark conversation read:', error.message || error);
          } else {
             console.debug('Marked conversation with', otherId, 'as read');
          }
        } catch (err) {
          console.error('Error marking conversation read:', err);
        }
      }

     // Initialize realtime subscription for direct messages so recipients
// receive incoming DMs immediately.
function initDirectMessageRealtime() {
  try {
    if (!hasDirectMessagesTable || !supabase) return;
    if (dmRealtimeInitialized) {
      console.debug('initDirectMessageRealtime: already initialized, skipping');
      return;
    }

    console.debug('initDirectMessageRealtime: starting subscription on direct_messages');
    // Subscribe to INSERT, UPDATE, DELETE events on direct_messages
    const subscription = supabase
      .channel('public:direct_messages')
      .on('postgres_changes', { 
        event: '*', // <-- Listen for INSERT, UPDATE, DELETE
        schema: 'public', 
        table: 'direct_messages' 
      }, 
      async (payload) => {
        try {
          console.debug('initDirectMessageRealtime: payload received ->', payload);
          const msg = payload.new || payload.old;
          const me = window.currentUser?.id;
          if (!me) return;

          const receiverVal = msg[dmReceiverCol];
          const senderVal = msg[dmSenderCol];

          if (typeof receiverVal === 'undefined' || typeof senderVal === 'undefined') {
            console.warn('Realtime DM payload missing expected columns - payload:', msg);
          }

          // =========================================================
          // [PENAMBAHAN PERMINTAAN] REALTIME READ RECEIPT
          // Jika ada UPDATE dan SAYA adalah PENGIRIM (Sender)
          // =========================================================
          if (payload.eventType === 'UPDATE' && senderVal === me) {
            const otherId = receiverVal; // Lawan bicara adalah penerima
            
            // Update cache lokal kita agar status is_read terbarui
            if (directMessages[otherId]) {
              const msgIndex = directMessages[otherId].findIndex(m => m.id === msg.id);
              if (msgIndex !== -1) {
                // Timpa pesan lama dengan data baru (yang is_read nya sudah true)
                directMessages[otherId][msgIndex] = msg;
                
                // Jika sedang membuka chat dengan orang tersebut, refresh UI langsung
                // Ini yang membuat centang berubah realtime
                if (document.getElementById(`dmMessages-${otherId}`)) {
                  console.log('Realtime read receipt received, updating UI for:', otherId);
                  updateDirectMessageUI(otherId);
                }
              }
            }
            return; // Selesai, jangan diproses sebagai pesan masuk atau delete
          }
          // =========================================================

          // Handle soft-delete: when message is updated with deleted_at timestamp
          if (payload.eventType === 'UPDATE' && msg.deleted_at) {
            console.debug('Message soft-deleted:', msg.id);
            const other = senderVal === me ? receiverVal : senderVal;
            if (directMessages[other]) {
              directMessages[other] = directMessages[other].filter(m => m.id !== msg.id);
              if (document.getElementById(`dmMessages-${other}`)) {
                updateDirectMessageUI(other);
              }
            }
            return;
          }

          // If I am the receiver, add to cache and notify
          if (receiverVal === me) {

            const contentStr = (payload.new && payload.new.content) || (payload.old && payload.old.content) || msg.content;

            // Cek apakah ini event INSERT baru.
            // Ini adalah perbaikan paling penting untuk mencegah "panggilan hantu" (zombie call)
            // dari pesan lama (backlog) saat realtime baru tersambung.
            const isInsert = payload.eventType === 'INSERT';

            // --- 1. Cek VIDEO CALL ---
            if (contentStr && contentStr.includes('__VIDEO_CALL_OFFER__:')) {
              if (isInsert) {
                // Ini adalah panggilan VIDEO BARU. Tampilkan modal.
                const partsV = contentStr.split('__VIDEO_CALL_OFFER__:');
                const callRoomIdV = (partsV[1] || '').trim().replace(/^:/, '');
                const callerIdV = senderVal;
                console.log(`[DEBUG VIDEO] Menerima event INSERT VIDEO call dari ${callerIdV}`);
                try { 
                  receiveVideoCall(callerIdV, callRoomIdV);
                } catch (e) { 
                  console.error('[ERROR VIDEO] Error invoking receiveVideoCall:', e); 
                }
              } else {
                // Ini adalah panggilan VIDEO LAMA (backlog). Abaikan agar tidak berdering lagi.
                console.debug('[DEBUG VIDEO] Mengabaikan backlog VIDEO call offer.');
              }
              return; // <-- PENTING: Baik itu panggilan baru atau lama, JANGAN tampilkan sebagai chat.
            }

            // --- 2. Cek VOICE CALL ---
            if (contentStr && contentStr.includes('__VOICE_CALL_OFFER__:')) {
              if (isInsert) {
                // Ini adalah panggilan VOICE BARU. Tampilkan modal.
                const parts = contentStr.split('__VOICE_CALL_OFFER__:');
                const callRoomId = (parts[1] || '').trim().replace(/^:/, '');
                const callerId = senderVal;
                console.log(`[DEBUG VOICE] Menerima event INSERT VOICE call dari ${callerId}`);
                try {
                  receiveCall(callerId, callRoomId);
                } catch (e) {
                  console.error('Error invoking receiveCall:', e);
                }
              } else {
                // Ini adalah panggilan VOICE LAMA (backlog). Abaikan.
                console.debug('[DEBUG VOICE] Mengabaikan backlog VOICE call offer.');
              }
              return; // <-- PENTING: Baik itu panggilan baru atau lama, JANGAN tampilkan sebagai chat.
            }

            // --- 3. Cek REJECT / CANCEL (notifikasi ketika salah satu pihak menolak/membatalkan) ---
            if (contentStr && (contentStr.includes('__CALL_REJECT__:') || contentStr.includes('__CALL_CANCEL__:'))) {
              if (isInsert) {
                const isReject = contentStr.includes('__CALL_REJECT__:');
                const partsR = isReject ? contentStr.split('__CALL_REJECT__:') : contentStr.split('__CALL_CANCEL__:');
                const callRoom = (partsR[1] || '').trim().replace(/^:/, '');
                const fromUser = senderVal;
                console.log('[DEBUG CALL] Received remote call cancel/reject from', fromUser, 'room', callRoom, 'isReject=', isReject);
                try {
                  // Stop ringing and clean up UI without re-notifying remote
                  _suppressHangNotify = true;
                  try { stopAllRingtones(); } catch(e) {}
                  if (isReject) showToast('Info', 'Call rejected', 'info'); else showToast('Info', 'Call cancelled', 'info');
                  try { hangUp(); } catch(e) { console.warn('hangUp after reject failed', e); }
                } finally { _suppressHangNotify = false; }
              } else {
                console.debug('[DEBUG CALL] Ignoring backlog cancel/reject');
              }
              return;
            }

            // --- 4. Pesan Biasa (Bukan Panggilan) ---
            const other = senderVal;
            if (!directMessages[other]) directMessages[other] = [];
            // avoid duplicates
            if (!directMessages[other].some(m => m.id === msg.id)) {
              directMessages[other].push(msg);
            } else {
              console.debug('Realtime: duplicate message ignored for', msg.id);
            }
            // ensure uniqueness map
            directMessages[other] = Array.from(new Map((directMessages[other] || []).map(m => [m.id, m])).values());

            // If DM modal for this sender is open, reload messages and mark read
            if (document.getElementById(`dmMessages-${other}`)) {
              loadDirectMessages(other);
              if (hasDirectMessagesIsRead) markConversationRead(other);
            }

            // refresh inbox if open
            refreshConversationsUI().catch(()=>{});

            // update inbox badge: calculate actual unread count instead of incrementing
            try {
              const convs = await getConversations();
              const actualUnread = convs.reduce((s, c) => s + (c.unread || 0), 0);
              updateInboxBadge(actualUnread);
            } catch(e) { console.warn('Failed to update badge with actual count:', e); }

            // Ambil nama profil sebelum tampilkan toast
            let senderName = senderVal.substring(0, 8); // Default ke ID yang dipotong
            try {
              const { data: profile, error } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', senderVal)
                .single();
                
              if (profile && profile.full_name) {
                senderName = profile.full_name; // Gunakan nama lengkap jika ada
              }
            } catch (profileError) {
              console.warn('Could not fetch sender profile for toast:', profileError);
            }
            
            // Tampilkan toast dengan nama
            showToast('Info', `New message from ${senderName}`, 'info');
          }
        } catch (e) {
          console.error('Realtime DM handler error:', e);
        }
      })
      .subscribe();

    // store channel reference to unsubscribe later if needed
    supabaseChannels.push(subscription);
    dmRealtimeInitialized = true;
  } catch (err) {
    console.error('Failed to init direct message realtime:', err);
  }
}







// ==========================================
// FITUR: KLIK GAMBAR UNTUK MEMPERBESAR (LIGHTBOX)
// ==========================================
document.addEventListener('click', (e) => {
  // Cek apakah elemen yang diklik memiliki class 'enlarge-image'
  if (e.target.classList.contains('enlarge-image')) {
    const src = e.target.getAttribute('src');
    if (!src) return;

    // Buat elemen modal/lightbox
    const lightbox = document.createElement('div');
    lightbox.id = 'global-lightbox';
    lightbox.style.position = 'fixed';
    lightbox.style.inset = '0';
    lightbox.style.zIndex = '99999';
    lightbox.style.backgroundColor = 'rgba(0, 0, 0, 0.9)'; // Latar hitam transparan
    lightbox.style.display = 'flex';
    lightbox.style.alignItems = 'center';
    lightbox.style.justifyContent = 'center';
    lightbox.style.cursor = 'zoom-out';
    lightbox.style.animation = 'fadeIn 0.2s ease-out';

    // Isi modal dengan gambar full
    lightbox.innerHTML = `
      <img src="${src}" style="max-width: 90vw; max-height: 90vh; object-fit: contain; border-radius: 8px; box-shadow: 0 0 20px rgba(0,0,0,0.5); transform: scale(0.9); transition: transform 0.2s;" onload="this.style.transform='scale(1)'"/>
      <button style="position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.2); border: none; color: white; padding: 10px; border-radius: 50%; cursor: pointer;">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    `;

    // Hapus modal jika diklik
    lightbox.addEventListener('click', () => {
      lightbox.remove();
    });

    document.body.appendChild(lightbox);
  }
});









      // Polling fallback: periodically refresh conversations if realtime or SELECT fails
      function startDirectMessagePoll(intervalMs = 8000) {
        try {
          if (dmPollInterval) return; // already running
          dmPollInterval = setInterval(async () => {
            try {
              if (!window.currentUser?.id) return;
              // try to refresh conversations and UI
              const convs = await getConversations();
              // if there are conversations, ensure UI is updated
              if (convs && convs.length > 0) {
                await refreshConversationsUI();
                const totalUnread = convs.reduce((s,c) => s + (c.unread || 0), 0);
                if (totalUnread > 0) updateInboxBadge(totalUnread);
              } else {
                // if no convs found, try an aggressive fallback query once
                await tryFetchConversationsFallback();
              }
            } catch (e) {
              // ignore transient poll errors
              // console.warn('DM poll iteration error:', e);
            }
          }, intervalMs);
          console.debug('startDirectMessagePoll: started with intervalMs=', intervalMs);
        } catch (err) {
          console.error('startDirectMessagePoll failed:', err);
        }
      }

      function stopDirectMessagePoll() {
        if (dmPollInterval) {
          clearInterval(dmPollInterval);
          dmPollInterval = null;
        }
      }

      // Aggressive fallback: run separate queries for messages where 'me' is receiver or sender
      // This helps diagnose when .or() queries or policies block combined queries.
      async function tryFetchConversationsFallback() {
        try {
          if (!hasDirectMessagesTable || !window.currentUser?.id) return;
          const me = window.currentUser.id;

          // try receiver query
          const recvQ = await supabase.from('direct_messages').select('*').eq(dmReceiverCol, me).order('created_at', { ascending: true });
          console.debug('tryFetchConversationsFallback: receiver query rows=', Array.isArray(recvQ.data) ? recvQ.data.length : recvQ.data, 'error=', recvQ.error || null);

          // try sender query
          const sendQ = await supabase.from('direct_messages').select('*').eq(dmSenderCol, me).order('created_at', { ascending: true });
          console.debug('tryFetchConversationsFallback: sender query rows=', Array.isArray(sendQ.data) ? sendQ.data.length : sendQ.data, 'error=', sendQ.error || null);

          // Merge results into directMessages cache so inbox can render
          const merged = [];
          if (Array.isArray(recvQ.data)) merged.push(...recvQ.data);
          if (Array.isArray(sendQ.data)) merged.push(...sendQ.data);

          if (merged.length > 0) {
            // build convMap as getConversations would
            merged.forEach(m => {
              const other = m[dmSenderCol] === me ? m[dmReceiverCol] : m[dmSenderCol];
              if (!directMessages[other]) directMessages[other] = [];
              directMessages[other].push(m);
            });
            await refreshConversationsUI();
          }
        } catch (err) {
          console.error('tryFetchConversationsFallback failed:', err);
        }
      }

      // Update direct message UI
      // Delete direct message
      async function deleteDirectMessage(userId, messageId, deleteMode = 'self') {
        try {
          // Try to fetch the server row so we can also remove stored assets if any
          let msgRow = null;
          if (hasDirectMessagesTable && messageId && messageId.indexOf('local-') === -1) {
            try {
              const { data, error } = await supabase
                .from('direct_messages')
                .select(`${dmSenderCol}, ${dmReceiverCol}, image_url, audio_url`)
                .eq('id', messageId)
                .single();
              if (!error && data) msgRow = data;
            } catch (e) {
              console.warn('Could not fetch message row before delete:', e);
            }
          }

          // Helper: attempt to remove an asset from Supabase storage by parsing public URL
          async function tryRemoveUrl(publicUrl) {
            if (!publicUrl) return;
            try {
              const parsed = new URL(publicUrl);
              // look for '/object/public/{bucket}/{path...}' pattern
              const match = parsed.pathname.match(/object\/public\/(.*?)\/(.*)/) || parsed.pathname.match(/storage\/v1\/object\/public\/(.*?)\/(.*)/);
              let bucket = null; let path = null;
              if (match) { bucket = match[1]; path = match[2]; }
              else {
                const parts = publicUrl.split('/object/public/');
                if (parts.length === 2) {
                  const rest = parts[1];
                  const p = rest.split('/');
                  bucket = p.shift();
                  path = p.join('/');
                }
              }
              if (bucket && path) {
                // decode in case encoded
                const cleanPath = decodeURIComponent(path);
                const { error } = await supabase.storage.from(bucket).remove([cleanPath]);
                if (error) console.warn('Storage removal error', bucket, cleanPath, error);
              } else {
                console.debug('Cannot infer storage path from URL, skipping removal:', publicUrl);
              }
            } catch (e) {
              console.warn('tryRemoveUrl error', e);
            }
          }

          if (deleteMode === 'self') {
            // Remove from local cache immediately
            if (directMessages[userId]) {
              directMessages[userId] = directMessages[userId].filter(m => m.id !== messageId);
              updateDirectMessageUI(userId);
            }

            // If there is a server record and current user is the sender, remove storage assets and delete row on server.
            if (msgRow && msgRow[dmSenderCol] === window.currentUser.id) {
              await tryRemoveUrl(msgRow.image_url).catch(()=>{});
              await tryRemoveUrl(msgRow.audio_url).catch(()=>{});
              const { error } = await supabase
                .from('direct_messages')
                .delete()
                .eq('id', messageId);
              if (error) throw error;
              showToast('Success', 'Message removed from server and local', 'success');
            } else {
              showToast('Success', 'Message removed locally', 'success');
            }

          } else if (deleteMode === 'all') {
            // For everyone: ALWAYS send soft-delete to server (mark deleted_at) regardless of msgRow
            // This ensures realtime UPDATE event is triggered for all clients
            if (hasDirectMessagesTable && messageId && messageId.indexOf('local-') === -1) {
              // Remove assets from storage if we can identify them
              if (msgRow) {
                await tryRemoveUrl(msgRow.image_url).catch(()=>{});
                await tryRemoveUrl(msgRow.audio_url).catch(()=>{});
              }
              
              // Send soft-delete update to DB (this will trigger realtime UPDATE for all subscribers)
              console.debug('deleteDirectMessage: sending soft-delete to server for messageId=', messageId);
              const { error } = await supabase
                .from('direct_messages')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', messageId);
              
              if (error) {
                console.error('Soft-delete update error:', error);
                throw error;
              }
              console.debug('Soft-delete sent successfully, messageId=', messageId);
            }

            // Ensure local cache is updated immediately so sender sees deletion right away
            if (directMessages[userId]) {
              directMessages[userId] = directMessages[userId].filter(m => m.id !== messageId);
              updateDirectMessageUI(userId);
            }
            showToast('Success', 'Message deleted for everyone', 'success');
          }
        } catch (err) {
          console.error('Delete message error:', err);
          showToast('Error', 'Failed to delete message', 'error');
        }
      }

      function updateDirectMessageUI(userId) {
  console.debug('updateDirectMessageUI for', userId, 'messagesCount=', (directMessages[userId] || []).length);
  const container = document.getElementById(`dmMessages-${userId}`);
  if (!container) return;
  
  const messages = directMessages[userId] || [];
  
  container.innerHTML = messages.map(msg => {
    const isSender = msg.sender_id === window.currentUser?.id;
    const isMedia = !!(msg.image_url || msg.audio_url);
    let contentHtml = msg.content || '[Empty]';

    // Show image if available
    if (msg.image_url) {
      contentHtml = `
        <div class="dm-image-wrap">
          <img src="${msg.image_url}" alt="Image" class="max-w-xs rounded-lg cursor-pointer" data-src="${msg.image_url}" />
        </div>
      `;
    }

    // Show audio player if available
    if (msg.audio_url) {
      const duration = msg.duration ? Math.round(msg.duration) + 's' : '';
      contentHtml = `
        <div class="flex items-center space-x-3">
          <button class="dm-audio-play p-2 rounded-full border border-slate-600 text-slate-100" data-src="${msg.audio_url}">
            <i data-lucide="play" class="h-4 w-4"></i>
          </button>
          <div class="dm-audio-info text-xs text-slate-200 rounded-full px-3 py-2">
            <span class="dm-audio-duration">${duration}</span>
          </div>
        </div>
      `;
    }

    const bubbleClass = isSender
      ? (isMedia ? 'text-white' : 'bg-cyan-600 text-white')
      : (isMedia ? 'text-slate-100' : 'bg-slate-700 text-slate-100');

    const bubblePadding = isMedia ? 'p-0' : 'px-4 py-2';

    // [PERBAIKAN UTAMA DI SINI]
    // Status Centang: Ukuran fixed (w-3 h-3) dan Warna Hijau (Emerald)
    let statusIcon = '';
    if (isSender) {
      if (msg.is_read) {
        // Centang Dua (Hijau Emerald) - Sudah dibaca
        statusIcon = `
          <span class="ml-1 flex items-center" title="Read">
            <i data-lucide="check-check" class="h-3 w-3 text-emerald-400"></i>
          </span>`;
      } else {
        // Centang Satu (Abu-abu) - Terkirim
        statusIcon = `
          <span class="ml-1 flex items-center" title="Sent">
            <i data-lucide="check" class="h-3 w-3 text-slate-300"></i>
          </span>`;
      }
    }

    return `
      <div class="flex ${isSender ? 'justify-end' : 'justify-start'} group mb-1">
        <div class="${bubbleClass} ${bubblePadding} rounded-lg ${isMedia ? 'overflow-hidden' : ''} max-w-[80%] w-fit break-words shadow-md hover:shadow-lg transition-shadow relative">
          ${contentHtml}
          
          <div class="flex items-center justify-end gap-1 mt-1 select-none">
             <span class="text-[10px] opacity-75 ${isSender ? 'text-cyan-100' : 'text-slate-300'}">
              ${new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </span>
            ${statusIcon}
          </div>
        </div>
        ${isSender ? `
          <div class="flex items-center ml-2 space-x-1 opacity-0 group-hover:opacity-100 transition-opacity self-center">
            <button onclick="deleteDirectMessage('${userId}', '${msg.id}', 'self')" class="p-1 hover:bg-slate-600/50 rounded text-xs text-slate-400 hover:text-slate-200" title="Delete for me">
              <i data-lucide="trash-2" class="h-3 w-3"></i>
            </button>
            <button onclick="deleteDirectMessage('${userId}', '${msg.id}', 'all')" class="p-1 hover:bg-slate-600/50 rounded text-xs text-slate-400 hover:text-slate-200" title="Delete for everyone">
              <i data-lucide="trash" class="h-3 w-3"></i>
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
  
  container.scrollTop = container.scrollHeight;
  
  // Render ulang ikon agar centang muncul
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

      async function appendMessage(msg, updateOnly = false) {
        const chatMessages = document.getElementById("chatMessages");
        if (!chatMessages) {
          console.error("Elemen chatMessages tidak ditemukan");
          return;
        }

        const existingMessage = document.querySelector(`[data-message-id="${msg.id}"]`);
        if (existingMessage && !updateOnly) {
          return;
        }

        if (!isValidUuid(msg.id) && !msg.id.startsWith("temp-")) {
          console.error(`Invalid message ID: ${msg.id}`);
          showToast("Error", "Invalid message ID", "destructive");
          return;
        }

        const isMine = msg.user_id === window.currentUser?.id;
        
        // Hanya proses pesan yang belum dibaca dan bukan milik kita
        if (!isMine && !msg.is_read && !updateOnly) {
          // Buat IntersectionObserver untuk mendeteksi ketika pesan muncul di viewport
          const observer = new IntersectionObserver(async (entries) => {
            if (entries[0].isIntersecting) {
              try {
                console.log('Marking message as read:', msg.id);
                const { data, error } = await supabase
                  .from('messages')
                  .update({ 
                    is_read: true, 
                    read_at: new Date().toISOString(),
                    status: 'Read'
                  })
                  .eq('id', msg.id)
                  .select();

                if (error) {
                  console.error('Error updating message read status:', error);
                } else {
                  msg.is_read = true;
                  msg.status = 'Read';
                  msg.read_at = new Date().toISOString();
                  
                  // Update UI untuk menampilkan status read
                  const statusElement = document.querySelector(`[data-message-id="${msg.id}"] .message-status`);
                  if (statusElement) {
                    statusElement.innerHTML = `
                      <i data-lucide="check-check" class="h-3 w-3 mr-1 text-emerald-400"></i>
                      <span>Read ${new Date().toLocaleTimeString()}</span>
                    `;
                    lucide.createIcons();
                  }
                  
                  // Broadcast ke pengirim bahwa pesan telah dibaca
                  const broadcastChannel = supabase.channel(`message-${msg.id}`);
                  await broadcastChannel.subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                      await broadcastChannel.send({
                        type: 'broadcast',
                        event: 'message_read',
                        payload: {
                          message_id: msg.id,
                          read_by: window.currentUser?.id,
                          read_at: new Date().toISOString()
                        }
                      });
                    }
                  });
                }
              } catch (error) {
                console.error('Error marking message as read:', error);
              } finally {
                // Hentikan observasi setelah pesan ditandai sebagai dibaca
                observer.disconnect();
              }
            }
          }, {
            threshold: 0.5 // Pesan dianggap terlihat jika 50% terlihat di viewport
          });
          
          // Mulai observasi setelah pesan ditambahkan ke DOM
          setTimeout(() => {
            const messageElement = document.querySelector(`[data-message-id="${msg.id}"]`);
            if (messageElement) {
              observer.observe(messageElement);
            }
          }, 100);
        }
        const messageEl = existingMessage || document.createElement("div");
        messageEl.className = `flex mb-4 last:mb-0 ${isMine ? "flex-row-reverse" : ""}`;
        messageEl.setAttribute("data-message-id", msg.id);

        if (existingMessage) {
          const oldButtons = existingMessage.querySelectorAll('.play-pause-btn, .like-btn, .reply-btn, .report-btn');
          oldButtons.forEach(btn => btn.replaceWith(btn.cloneNode(true)));
        }

        let avatarContent = msg.full_name ? msg.full_name[0].toUpperCase() : 'A';
        let avatarColor = "blue";
        if (isMine) avatarColor = "cyan";
        if (msg.full_name?.includes("Sarah")) avatarColor = "purple";

        if (msg.avatar_url) {
          try {
            const { data: avatarData } = await supabase.storage
              .from("avatars")
              .getPublicUrl(msg.avatar_url);
            if (avatarData?.publicUrl) {
              avatarContent = `<img src="${avatarData.publicUrl}" class="h-8 w-8 rounded-full object-cover" alt="Avatar" />`;
            }
          } catch (error) {
            console.error("Gagal ambil avatar:", error);
          }
        }

        const timestamp = new Date(msg.created_at).toLocaleString("id-ID", {
          hour: "numeric",
          minute: "numeric",
          hour12: true,
        });

        // Sanitasi konten terlebih dahulu
        let sanitizedContent = sanitizeHTML(msg.content);
        const highlightedContent = highlightMentions(sanitizedContent);

        // Buat elemen sementara untuk memproses konten
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = highlightedContent;

        // Ganti placeholder __BAD_WORD__ dengan elemen SVG
        const placeholderRegex = /__BAD_WORD__/g;
        if (placeholderRegex.test(tempDiv.innerHTML)) {
          const svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          svgElement.setAttribute("viewBox", "0 0 64 64");
          svgElement.setAttribute("stroke-width", "3");
          svgElement.setAttribute("stroke", "#ff0000");
          svgElement.setAttribute("fill", "none");
          svgElement.style.width = "1em";
          svgElement.style.height = "1em";
          svgElement.style.verticalAlign = "middle";
          svgElement.style.display = "inline-block";

          const g1 = document.createElementNS("http://www.w3.org/2000/svg", "g");
          g1.setAttribute("id", "SVGRepo_bgCarrier");
          g1.setAttribute("stroke-width", "0");
          svgElement.appendChild(g1);

          const g2 = document.createElementNS("http://www.w3.org/2000/svg", "g");
          g2.setAttribute("id", "SVGRepo_tracerCarrier");
          g2.setAttribute("stroke-linecap", "round");
          g2.setAttribute("stroke-linejoin", "round");
          svgElement.appendChild(g2);

          const g3 = document.createElementNS("http://www.w3.org/2000/svg", "g");
          g3.setAttribute("id", "SVGRepo_iconCarrier");
          const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          circle.setAttribute("cx", "32");
          circle.setAttribute("cy", "32");
          circle.setAttribute("r", "25.3");
          g3.appendChild(circle);
          const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
          line.setAttribute("x1", "49.89");
          line.setAttribute("y1", "49.89");
          line.setAttribute("x2", "14.11");
          line.setAttribute("y2", "14.11");
          g3.appendChild(line);
          g2.appendChild(g3);

          const spanElement = document.createElement("span");
          spanElement.className = "bad-word-icon";
          spanElement.appendChild(svgElement);

          // Ganti semua placeholder dengan elemen SVG
          const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT, null, false);
          let node;
          while ((node = walker.nextNode())) {
            if (node.nodeValue.includes("__BAD_WORD__")) {
              const parts = node.nodeValue.split(/(__BAD_WORD__)/);
              const fragment = document.createDocumentFragment();
              parts.forEach(part => {
                if (part === "__BAD_WORD__") {
                  fragment.appendChild(spanElement.cloneNode(true));
                } else {
                  fragment.appendChild(document.createTextNode(part));
                }
              });
              node.parentNode.replaceChild(fragment, node);
            }
          }
        }

        const finalContent = tempDiv.innerHTML;
        const sanitizedFullName = sanitizeHTML(msg.full_name || "Anonim");
        const isMentioned = Array.isArray(msg.mentions) && msg.mentions.includes(window.currentUser?.id);

        const isAtBottom = isScrolledToBottom(chatMessages);

    // ... kode sebelumnya di dalam appendMessage ...

// 1. SIAPKAN LOGIKA REPLY UI
// Anggap msg.reply_to adalah objek yang berisi { full_name: "Dor War", content: "p", id: "..." }
// Jika struktur database Anda belum ada kolom reply_to, Anda perlu menambahkannya atau memparsing dari metadata.

let replyHTML = '';

// Cek apakah pesan ini adalah balasan (Anda perlu menyesuaikan logika ini dengan data dari Supabase Anda)
// Contoh: if (msg.reply_to && msg.reply_to.id) { ... }
// Untuk simulasi visual sesuai request, saya gunakan kondisi dummy atau field 'metadata' jika ada.
if (msg.reply_to) { 
  const replyName = sanitizeHTML(msg.reply_to.full_name || 'Unknown');
  
  // Logic untuk konten reply (handle jika itu gambar/audio)
  let replyContent = sanitizeHTML(msg.reply_to.content || '');
  if (!replyContent && msg.reply_to.image_url) replyContent = '📷 Photo';
  else if (!replyContent && msg.reply_to.audio_url) replyContent = '🎤 Voice Message';
  
  // --- KODE DESAIN REPLY (MIRIP WHATSAPP/TELEGRAM) ---
  replyHTML = `
    <div class="mb-1 relative overflow-hidden rounded-[4px] bg-black/20 p-1.5 border-l-[4px] border-cyan-400 cursor-pointer hover:bg-black/30 transition-colors" onclick="const el = document.querySelector('[data-message-id=\\'${msg.reply_to.id}\\']'); if(el) el.scrollIntoView({behavior:'smooth', block:'center'});">
        <div class="text-[11px] font-bold text-cyan-400 mb-0.5 leading-none">
            ${replyName}
        </div>
        <div class="text-[11px] text-slate-200/90 leading-tight line-clamp-1 opacity-90">
            ${replyContent}
        </div>
    </div>
  `;
}

// 2. MASUKKAN REPLY UI KE DALAM GELEMBUNG PESAN
// Cari bagian messageEl.innerHTML = `...` di kode Anda dan selipkan ${replyHTML}
// tepat sebelum konten pesan (${finalContent}).

messageEl.innerHTML = `
    <div class="flex-shrink-0 ${isMine ? "ml-3" : "mr-3"}" data-user-id="${sanitizeHTML(msg.user_id || '')}" style="cursor: pointer;">
      <div class="h-8 w-8 rounded-full bg-gradient-to-br from-${avatarColor}-500/20 to-${avatarColor}-600/20 border border-${avatarColor}-500/30 flex items-center justify-center shadow-sm">
        ${avatarContent}
      </div>
    </div>
    <div class="flex-1 min-w-0 ${isMine ? "text-right" : ""}">
      <div class="flex items-baseline mb-1 ${isMine ? "justify-end" : ""}">
        <div class="text-xs ${isMine ? "text-slate-500 flex items-center mr-2" : "font-medium text-" + avatarColor + "-400 mr-2"}">
          ${isMine ? `<i data-lucide="clock" class="h-3 w-3 mr-1"></i><span>${timestamp}</span>` : `<span class=\"user-name\" data-user-id=\"${sanitizeHTML(msg.user_id || '')}\" style=\"cursor:pointer\">${sanitizedFullName}</span>`}
        </div>
        ${isMine ? `<div class="text-xs font-medium text-cyan-400">You</div>` : `<div class="text-xs text-slate-500 flex items-center"><i data-lucide="clock" class="h-3 w-3 mr-1"></i><span>${timestamp}</span></div>`}
      </div>
      
      <div class="text-sm text-slate-300 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/30 inline-block text-left max-w-[80%] rounded-lg p-3 ${isMentioned ? "border-cyan-500/50" : ""}">
        
        ${replyHTML}
        ${finalContent}
        ${msg.edited_at ? `<div class="text-xs opacity-60 mt-1 italic">(edited)</div>` : ''}
      </div>
    `;

       // ... di dalam appendMessage ...

if (msg.image_url) {
  const imgContainer = document.createElement("div");
  
  // Pastikan tetap pakai w-fit agar bubble tidak melar
  imgContainer.className = "mt-2 w-fit"; 
  
  imgContainer.innerHTML = `
    <div class="bg-slate-800/70 border border-slate-700/40 rounded-lg overflow-hidden transition-all duration-200 hover:border-cyan-500/40">
        <img src="${msg.image_url}" 
             alt="Image" 
             class="max-w-[200px] h-auto cursor-pointer enlarge-image hover:opacity-90 transition-opacity" 
             loading="lazy">
    </div>
  `;
  messageEl.querySelector(".text-sm").appendChild(imgContainer);
}

// ... lanjutkan kode audio ...

        if (msg.audio_url) {
          const voiceContainer = document.createElement("div");
          voiceContainer.className = "voice-message-container mt-2";
          const duration = msg.duration || Math.floor(Math.random() * 30) + 5;
          const minutes = Math.floor(duration / 60);
          const seconds = duration % 60;

          voiceContainer.innerHTML = `
            <div class="voice-message ${isMine ? 'bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/30' : 'bg-slate-800/50 border border-slate-700/30'} rounded-lg p-2 flex items-center">
                <button class="play-pause-btn p-2 bg-${isMine ? 'cyan' : 'slate'}-500/20 rounded-full">
                    <svg class="play-icon" width="16" height="16" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M8 5v14l11-7z"/>
                    </svg>
                    <svg class="pause-icon" width="16" height="16" viewBox="0 0 24 24" style="display:none">
                        <path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                    </svg>
                </button>
                <div class="waveform-container flex-1 mx-2">
                    <div class="waveform h-6 bg-slate-700/50 rounded-full overflow-hidden">
                        <div class="progress h-full bg-${isMine ? 'cyan' : 'blue'}-500/50" style="width: 0%"></div>
                    </div>
                </div>
                <span class="duration text-xs text-slate-400">${minutes}:${seconds.toString().padStart(2, '0')}</span>
            </div>
            <audio src="${msg.audio_url}" preload="none"></audio>
        `;
          messageEl.querySelector(".text-sm").appendChild(voiceContainer);

          const playBtn = voiceContainer.querySelector('.play-pause-btn');
          const audio = voiceContainer.querySelector('audio');
          const playIcon = voiceContainer.querySelector('.play-icon');
          const pauseIcon = voiceContainer.querySelector('.pause-icon');
          const progress = voiceContainer.querySelector('.progress');

          if (playBtn && audio && playIcon && pauseIcon && progress) {
            playBtn.addEventListener('click', () => {
              if (audio.paused) {
                audio.play();
                playIcon.style.display = 'none';
                pauseIcon.style.display = 'block';
                const startTime = Date.now();
                const animate = () => {
                  const elapsed = (Date.now() - startTime) / 1000;
                  const percentage = Math.min((elapsed / duration) * 100, 100);
                  progress.style.width = `${percentage}%`;
                  if (!audio.paused && percentage < 100) {
                    requestAnimationFrame(animate);
                  }
                };
                animate();
              } else {
                audio.pause();
                playIcon.style.display = 'block';
                pauseIcon.style.display = 'none';
              }
            });

            audio.addEventListener('ended', () => {
              playIcon.style.display = 'block';
              pauseIcon.style.display = 'none';
              progress.style.width = '0%';
            });

            audio.addEventListener('pause', () => {
              playIcon.style.display = 'block';
              pauseIcon.style.display = 'none';
            });
          }
        }

        
  const actions = document.createElement("div");
  actions.className = `flex items-center mt-2 space-x-3 ${isMine ? "justify-end" : ""}`;
        const likes = normalizeLikes(msg.likes);
  // Build actions HTML: likes + (three-dot menu for owner) or reply/report for others
  actions.innerHTML = `
        <div class="like-container flex space-x-2">
            <button class="like-btn like-thumbs-up text-xs text-slate-400 hover:text-cyan-400 flex items-center" data-message-id="${msg.id}" data-type="thumbsUp">
                <i data-lucide="thumbs-up" class="h-3 w-3 mr-1"></i>
                <span>${getLikesCount(likes, "thumbsUp")}</span>
            </button>
            <button class="like-btn like-heart text-xs text-slate-400 hover:text-red-400 flex items-center" data-message-id="${msg.id}" data-type="heart">
                ❤️<span class="ml-1">${getLikesCount(likes, "heart")}</span>
            </button>
            <button class="like-btn like-laugh text-xs text-slate-400 hover:text-yellow-400 flex items-center" data-message-id="${msg.id}" data-type="laugh">
                😆<span class="ml-1">${getLikesCount(likes, "laugh")}</span>
            </button>
            <button class="like-btn like-wow text-xs text-slate-400 hover:text-indigo-400 flex items-center" data-message-id="${msg.id}" data-type="wow">
                😮<span class="ml-1">${getLikesCount(likes, "wow")}</span>
            </button>
            <button class="like-btn like-sad text-xs text-slate-400 hover:text-blue-400 flex items-center" data-message-id="${msg.id}" data-type="sad">
                😢<span class="ml-1">${getLikesCount(likes, "sad")}</span>
            </button>
            <button class="like-btn like-angry text-xs text-slate-400 hover:text-orange-400 flex items-center" data-message-id="${msg.id}" data-type="angry">
                😡<span class="ml-1">${getLikesCount(likes, "angry")}</span>
            </button>
            <button class="like-btn like-love text-xs text-slate-400 hover:text-pink-400 flex items-center" data-message-id="${msg.id}" data-type="love">
                🥰<span class="ml-1">${getLikesCount(likes, "love")}</span>
            </button>
        </div>
        ${!isMine ? `
        <button class="reply-btn text-xs text-slate-400 hover:text-amber-400 flex items-center" data-message-id="${msg.id}">
            <i data-lucide="message-square" class="h-3 w-3 mr-1"></i>
            <span>Reply</span>
        </button>
        <button class="report-btn text-xs text-slate-400 hover:text-rose-400 flex items-center" data-message-id="${msg.id}">
            <i data-lucide="flag" class="h-3 w-3 mr-1"></i>
            <span>Report</span>
        </button>` : `
        <div class="relative">
          <button class="menu-btn text-xs text-slate-400 hover:text-cyan-300 flex items-center" aria-haspopup="true" aria-expanded="false" title="Message menu">
            <i data-lucide="more-vertical" class="h-4 w-4"></i>
          </button>
          <div class="menu-dropdown hidden absolute right-0 mt-2 w-44 bg-slate-800 border border-slate-700 rounded shadow-lg z-50">
            <button class="menu-item edit-item w-full text-left px-3 py-2 text-sm hover:bg-slate-700" ${canEditMessage(msg) ? '' : 'disabled'}>Edit</button>
            <button class="menu-item delete-me-item w-full text-left px-3 py-2 text-sm hover:bg-slate-700">Delete for me</button>
            <button class="menu-item delete-all-item w-full text-left px-3 py-2 text-sm hover:bg-slate-700" ${canDeleteForEveryone(msg) ? '' : 'disabled'}>Delete for everyone</button>
          </div>
          <span class="text-xs text-slate-500 flex items-center ml-2 message-status" data-message-id="${msg.id}">
            ${msg.is_read ? 
              `<i data-lucide="check-check" class="h-3 w-3 mr-1 text-emerald-400"></i>
               <span>Read ${msg.read_at ? new Date(msg.read_at).toLocaleTimeString() : ''}</span>` : 
              `<i data-lucide="check" class="h-3 w-3 mr-1 text-emerald-400"></i>
               <span>Delivered</span>`
            }
          </span>
        </div>`}
    `;
        messageEl.querySelector(".flex-1").appendChild(actions);

        const likeButtons = actions.querySelectorAll('.like-btn');
        likeButtons.forEach(button => {
          button.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const messageId = button.dataset.messageId;
            const likeType = button.dataset.type;

            // Jika pengguna tidak login, tampilkan pesan dan hentikan
            if (!window.currentUser?.id || !isValidUuid(window.currentUser.id)) {
              showToast("Error”, ”Please login to like", "destructive");
              return;
            }

            if (!isValidUuid(messageId)) {
              console.error(`Invalid message ID: ${messageId}`);
              showToast("Error”, ”Invalid message ID", "destructive");
              return;
            }

            let likes = normalizeLikes(msg.likes);
            const userLike = likes.find(like => like.user_id === window.currentUser.id);

            if (userLike) {
              if (userLike.type === likeType) {
                likes = likes.filter(like => like.user_id !== window.currentUser.id);
              } else {
                likes = likes.filter(like => like.user_id !== window.currentUser.id);
                likes.push({ type: likeType, user_id: window.currentUser.id });
              }
            } else {
              likes.push({ type: likeType, user_id: window.currentUser.id });
            }

            const { error } = await supabase.from("messages").update({ likes }).eq("id", messageId);
            if (error) {
              console.error("Gagal menyimpan like ke Supabase:", error);
              showToast("Error”, ”Failed to save like: " + error.message, "destructive");
              return;
            }

            const index = messagesList.findIndex(m => m.id === messageId);
            if (index !== -1) {
              messagesList[index].likes = likes;
              await appendMessage(messagesList[index], true);
            }
          });
        });

        if (!isMine) {
          const replyBtn = actions.querySelector('.reply-btn');
          if (replyBtn) {
            const replyHandler = () => {
  if (!window.currentUser?.id) {
    showToast("Error", "Please login to reply", "destructive");
    return;
  }
  
  // 1. Simpan data pesan yang mau dibalas
  currentReplyTo = {
    id: msg.id,
    full_name: msg.full_name,
    content: msg.content
  };

  // 2. Tampilkan UI Preview Reply di atas Input Chat (Opsional tapi disarankan UX-nya)
  showReplyPreview(currentReplyTo);
  
  // 3. Focus ke input
  const chatInput = document.getElementById("chatInput");
  chatInput.focus();
};

            replyBtn.addEventListener('click', replyHandler);
            eventListeners.push({ element: replyBtn, event: "click", handler: replyHandler });
          }



          

          const reportBtn = actions.querySelector('.report-btn');
          if (reportBtn) {
            const reportHandler = () => {
              if (!window.currentUser?.id) {
                showToast("Error", "Please login to report messages", "destructive");
                return;
              }
              const popup = document.createElement("div");
              popup.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
              popup.innerHTML = `
                    <div class="bg-slate-800 p-4 rounded-lg shadow-lg w-80">
                        <h3 class="text-lg font-semibold text-white mb-2">Report Message</h3>
                        <textarea id="reportReason" class="w-full h-24 p-2 bg-slate-700 text-white rounded mb-4" placeholder="Enter the reason for reporting...."></textarea>
                        <div class="flex justify-end space-x-2">
                            <button id="cancelReport" class="px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-500">cancel</button>
                            <button id="submitReport" class="px-4 py-2 bg-rose-600 text-white rounded hover:bg-rose-500">Send</button>
                        </div>
                    </div>
                `;
              document.body.appendChild(popup);

              const cancelBtn = popup.querySelector("#cancelReport");
              if (cancelBtn) {
                const cancelHandler = () => popup.remove();
                cancelBtn.addEventListener("click", cancelHandler);
                eventListeners.push({ element: cancelBtn, event: "click", handler: cancelHandler });
              }

              const submitBtn = popup.querySelector("#submitReport");
              if (submitBtn) {
                const submitHandler = async () => {
                  const reason = document.getElementById("reportReason").value.trim();
                  if (reason) {
                    await supabase.from("reports").insert({
                      message_id: msg.id,
                      user_id: window.currentUser.id,
                      reason,
                    });
                    showToast("Info”, ”Message has been reported", "default");
                  }
                  popup.remove();
                };
                submitBtn.addEventListener("click", submitHandler);
                eventListeners.push({ element: submitBtn, event: "click", handler: submitHandler });
              }
            };
            reportBtn.addEventListener('click', reportHandler);
            eventListeners.push({ element: reportBtn, event: "click", handler: reportHandler });
          }
        }

        // Owner menu handlers (three-dot menu)
        if (isMine) {
          const menuBtn = actions.querySelector('.menu-btn');
          const dropdown = actions.querySelector('.menu-dropdown');
          const editItem = actions.querySelector('.edit-item');
          const deleteMeItem = actions.querySelector('.delete-me-item');
          const deleteAllItem = actions.querySelector('.delete-all-item');

          if (menuBtn && dropdown) {
            const toggle = (e) => {
              e.stopPropagation();
              const isHidden = dropdown.classList.contains('hidden');
              document.querySelectorAll('.menu-dropdown').forEach(d => d.classList.add('hidden'));
              if (isHidden) dropdown.classList.remove('hidden');
            };
            menuBtn.addEventListener('click', toggle);
            eventListeners.push({ element: menuBtn, event: 'click', handler: toggle });

            // Close on outside click
            const outsideHandler = (ev) => {
              if (!dropdown.contains(ev.target) && ev.target !== menuBtn) dropdown.classList.add('hidden');
            };
            document.addEventListener('click', outsideHandler);
            eventListeners.push({ element: document, event: 'click', handler: outsideHandler });
          }

          if (editItem) {
            const editHandler = (e) => { e.stopPropagation(); startEditMessage(msg.id); dropdown?.classList.add('hidden'); };
            editItem.addEventListener('click', editHandler);
            eventListeners.push({ element: editItem, event: 'click', handler: editHandler });
          }

          if (deleteMeItem) {
            const delMeHandler = async (e) => { 
              e.stopPropagation(); 
              const ok = await showConfirm('Delete', 'Delete this message for you?');
              if (!ok) return; 
              deleteMessageForMe(msg.id); 
              dropdown?.classList.add('hidden'); 
            };
            deleteMeItem.addEventListener('click', delMeHandler);
            eventListeners.push({ element: deleteMeItem, event: 'click', handler: delMeHandler });
          }

          if (deleteAllItem) {
            const delAllHandler = async (e) => { 
              e.stopPropagation(); 
              if (!canDeleteForEveryone(msg)) { 
                showToast('Error', 'Cannot delete for everyone: time limit exceeded', 'destructive'); 
                return; 
              } 
              const ok = await showConfirm('Delete for everyone', 'Delete this message for everyone? This cannot be undone.');
              if (!ok) return;
              await deleteMessageForEveryone(msg.id); 
              dropdown?.classList.add('hidden'); 
            };
            deleteAllItem.addEventListener('click', delAllHandler);
            eventListeners.push({ element: deleteAllItem, event: 'click', handler: delAllHandler });
          }
        }

        // Highlight the emoji the current user liked (make it visually prominent)
try {
  const currentUserId = window.currentUser?.id;
  if (currentUserId && Array.isArray(msg.likes)) {
    // normalize the likes shape
    const normalized = normalizeLikes(msg.likes);
    // find current user's like(s)
    const myLikes = normalized.filter(l => l.user_id === currentUserId);
    likeButtons.forEach(btn => {
      const type = btn.dataset.type;
      const hasMyLike = myLikes.some(l => l.type === type);
      if (hasMyLike) {
        // add a prominent style for the liked emoji
        btn.classList.add('liked-emoji');
        btn.style.transform = 'scale(1.08)';
        btn.style.background = 'linear-gradient(90deg,#06b6d4,#7c3aed)';
        btn.style.color = 'white';
        btn.style.borderRadius = '8px';
        btn.style.padding = '4px 6px';
      } else {
        // reset any inline styles for non-liked buttons (safe-idempotent)
        btn.classList.remove('liked-emoji');
        btn.style.transform = '';
        btn.style.background = '';
        btn.style.color = '';
        btn.style.borderRadius = '';
        btn.style.padding = '';
      }
    });
  }
} catch (e) {
  // don't block UI if something goes wrong
  console.error('Error applying like highlight:', e);
}

        // attach click handlers so clicking avatar or name opens the user profile popup
        try {
          if (msg.user_id) {
            const avatarEl = messageEl.querySelector('.flex-shrink-0');
            if (avatarEl) {
              avatarEl.style.cursor = 'pointer';
              const avHandler = (e) => { e.stopPropagation(); showUserProfilePopup(msg.user_id); };
              avatarEl.addEventListener('click', avHandler);
              eventListeners.push({ element: avatarEl, event: 'click', handler: avHandler });
            }

            const nameEl = messageEl.querySelector('.flex-1 .text-xs');
            if (nameEl) {
              nameEl.style.cursor = 'pointer';
              const nameHandler = (e) => { e.stopPropagation(); showUserProfilePopup(msg.user_id); };
              nameEl.addEventListener('click', nameHandler);
              eventListeners.push({ element: nameEl, event: 'click', handler: nameHandler });
            }
          }
        } catch (e) {
          console.error('attach profile click handlers error:', e);
        }

        lucide.createIcons();
        if (!existingMessage) {
          chatMessages.appendChild(messageEl);
        }

        if (isAtBottom) {
          chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
        }
      }



      // Cek apakah pengguna di bawah
      function isScrolledToBottom(element) {
        return element.scrollHeight - element.scrollTop <= element.clientHeight + 10;
      }

      // Highlight text @username
      function highlightMentions(text) {
        return text.replace(/@([\w\s]+)/g, '<span class="text-cyan-400 font-semibold">@$1</span>');
      }

      // Deteksi mention @username
      function detectMentions(content) {
        const mentions = content.match(/@([\w\s]+)/g) || [];
        return mentions.map(m => m.substring(1).trim());
      }

      // Ambil daftar pengguna yang pernah mengirim pesan
      async function fetchChatParticipants(query = "") {
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .ilike("full_name", `%${query}%`)
            .limit(10);
          if (error) throw error;
          return data;
        } catch (error) {
          console.error("Gagal mengambil daftar pengguna:", error);
          return [];
        }
      }

      // Tampilkan daftar saran autocompletion
      async function showMentionSuggestions(query, chatInput, suggestionList) {
        if (!suggestionList) return;

        const participants = await fetchChatParticipants(query);
        suggestionList.innerHTML = "";
        suggestionList.classList.add("hidden");

        if (participants.length === 0) return;

        participants.forEach(user => {
          const item = document.createElement("div");
          item.className = "suggestion-item flex items-center space-x-2 p-2 hover:bg-gray-100 cursor-pointer";
          const initial = user.full_name ? user.full_name[0].toUpperCase() : "A";
          item.innerHTML = `
            <div class="avatar w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center">
                ${initial}
            </div>
            <span>${sanitizeHTML(user.full_name)}</span>
        `;
          item.dataset.userId = user.id;
          item.dataset.fullName = user.full_name;
          const clickHandler = () => {
            const cursorPos = chatInput.selectionStart;
            const textBefore = chatInput.value.substring(0, cursorPos).replace(/@[\w\s]*$/, `@${user.full_name} `);
            const textAfter = chatInput.value.substring(cursorPos);
            chatInput.value = textBefore + textAfter;
            suggestionList.classList.add("hidden");
            chatInput.focus();
          };
          item.addEventListener("click", clickHandler);
          eventListeners.push({ element: item, event: "click", handler: clickHandler });
          suggestionList.appendChild(item);
        });

        suggestionList.classList.remove("hidden");
      }

      // Ambil data profil pengguna
      async function fetchUserProfile(userId) {
        try {
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("full_name, avatar_url")
            .eq("id", userId)
            .single();
          if (error) throw error;
          return {
            full_name: profile?.full_name || "Anonim",
            avatar_url: profile?.avatar_url || "",
          };
        } catch (error) {
          console.error("Gagal mengambil profil:", error);
          return { full_name: "Anonim", avatar_url: "" };
        }
      }

        // Fetch extended user details for profile popup (points, boosters, followers)
        async function fetchUserDetails(userId) {
          try {
            // Try to get richer profile info from `profiles` table if available
            const { data: profile, error: profileErr } = await supabase
              .from('profiles')
              .select('id, full_name, avatar_url, points, boosters, followers_count')
              .eq('id', userId)
              .single();

            if (profileErr && profileErr.code) {
              // Proceed with fallback minimal profile
              console.warn('fetchUserDetails: profiles query error', profileErr.message || profileErr);
            }

            // Attempt to get follower count from `follows` table if not present
            let followersCount = profile?.followers_count || 0;
            if ((followersCount === undefined || followersCount === null) && profile) {
              try {
                const { count, error: countErr } = await supabase
                  .from('follows')
                  .select('*', { count: 'exact', head: true })
                  .eq('following_id', userId);
                if (!countErr) followersCount = count || 0;
              } catch (e) {
                // ignore
              }
            }

            return {
              id: profile?.id || userId,
              full_name: profile?.full_name || 'Anonim',
              avatar_url: profile?.avatar_url || '',
              points: profile?.points || 0,
              boosters: profile?.boosters || [],
              followers_count: followersCount || 0,
            };
          } catch (err) {
            console.error('fetchUserDetails error:', err);
            return { id: userId, full_name: 'Anonim', avatar_url: '', points: 0, boosters: [], followers_count: 0 };
          }
        }

        

    // Subscribe to message updates
      async function subscribeToMessageUpdates() {
        try {
          const messagesUpdateChannel = supabase.channel('message-updates', {
            config: {
              broadcast: { self: true },
              presence: {
                key: window.currentUser?.id,
              },
            },
          });

          messagesUpdateChannel
            .on(
              'presence',
              { event: 'sync' },
              () => {
                console.log('Presence sync successful');
              }
            )
              .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'messages',
              }, async (payload) => {
                const updatedMsg = payload.new;
                const msgIndex = messagesList.findIndex(m => m.id === updatedMsg.id);
                if (msgIndex !== -1) {
                  // Preserve existing message data and merge with updates
                  messagesList[msgIndex] = { 
                    ...messagesList[msgIndex], 
                    ...updatedMsg,
                    full_name: messagesList[msgIndex].full_name,
                    avatar_url: messagesList[msgIndex].avatar_url
                  };
                  await appendMessage(messagesList[msgIndex], true);
                }
              })
              .on(
                "postgres_changes",
                {
                  event: "DELETE",
                  schema: "public",
                  table: "messages",
                },
                async (payload) => {
                  try {
                    const deleted = payload.old;
                    if (!deleted || !deleted.id) return;
                    const index = messagesList.findIndex(m => m.id === deleted.id);
                    if (index !== -1) {
                      messagesList.splice(index, 1);
                      localStorage.setItem("chatMessages", JSON.stringify(messagesList.slice(-100)));
                    }
                    const el = document.querySelector(`[data-message-id="${deleted.id}"]`);
                    if (el) el.remove();
                    // optional: show a subtle toast or animation
                    // showToast('Info', 'A message was deleted', 'default');
                  } catch (err) {
                    console.error('Error handling deleted message realtime event:', err);
                  }
                }
              );

          // Subscribe to the channel
          await messagesUpdateChannel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              // Track presence for the current user
              const presenceTrackStatus = await messagesUpdateChannel.track({
                online_at: new Date().toISOString(),
                username: window.currentUser?.profile?.full_name,
              });
              
              if (presenceTrackStatus === 'ok') {
                console.log('Presence tracking successful');
              }
            }
          });

          return messagesUpdateChannel;
        } catch (error) {
          console.error('Error setting up message updates subscription:', error);
          throw error;
        }
      }


      // ... kode sebelumnya ...

// ==========================================
// PERBAIKAN: FUNGSI REPLY DILETAKKAN DI SINI (GLOBAL)
// ==========================================

function showReplyPreview(replyData) {
    // Cek apakah container preview sudah ada, jika belum buat
    let previewContainer = document.getElementById('replyPreviewContainer');
    if (!previewContainer) {
        const inputArea = document.getElementById('chatInput')?.parentElement; // Tambahkan ? untuk safety
        if (!inputArea) return; // Safety check
        
        previewContainer = document.createElement('div');
        previewContainer.id = 'replyPreviewContainer';
        previewContainer.className = 'w-full bg-slate-800/90 border-t border-slate-700 p-2 flex justify-between items-center hidden';
        // Insert sebelum input area
        inputArea.parentNode.insertBefore(previewContainer, inputArea); 
    }

    previewContainer.innerHTML = `
        <div class="flex-1 relative overflow-hidden rounded-[4px] bg-black/20 p-2 border-l-[4px] border-cyan-400">
            <div class="text-xs font-bold text-cyan-400 mb-0.5">${sanitizeHTML(replyData.full_name)}</div>
            <div class="text-xs text-slate-300 line-clamp-1">${sanitizeHTML(replyData.content || 'Media')}</div>
        </div>
        <button id="cancelReplyBtn" class="ml-3 p-2 text-slate-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
    `;
    previewContainer.classList.remove('hidden');
    
    // Bind click event manual untuk menghindari masalah 'onclick string'
    document.getElementById('cancelReplyBtn')?.addEventListener('click', cancelReply);
}

function cancelReply() {
    currentReplyTo = null;
    const el = document.getElementById('replyPreviewContainer');
    if (el) el.classList.add('hidden');
}

// ==========================================
// Subscribe to message updates
// ==========================================
async function subscribeToMessageUpdates() {
   // ... (kode subscribeToMessageUpdates Anda) ...
}

// Kirim pesan
async function sendMessage(content, image_url = null, audio_url = null, tempId = null, duration = null) {
   // ... (kode sendMessage Anda) ...
}

      // Kirim pesan
      async function sendMessage(content, image_url = null, audio_url = null, tempId = null, duration = null) {
        const chatInput = document.getElementById("chatInput");
        const sendMessageBtn = document.getElementById("sendMessageBtn");
        const suggestionList = document.getElementById("mentionSuggestions");

        try {
          // Cek apakah ini pesan pribadi
          const isPrivateMessage = window.privateChatTarget ? true : false;
          if (!chatInput || !sendMessageBtn) {
            console.error("Elemen chatInput atau sendMessageBtn tidak ditemukan");
            showToast("Error", "Input element not found", "destructive");
            return;
          }

          const userId = window.currentUser?.id;
          if (!userId) {
            showToast("Error", "You are not logged in yet.", "destructive");
            return;
          }

          const now = Date.now();

          if (content && lastChatTime[userId] && (now - lastChatTime[userId] < CHAT_COOLDOWN)) {
            const remaining = Math.ceil((CHAT_COOLDOWN - (now - lastChatTime[userId])) / 1000);
            showToast("Warning", `Wait ${remaining} seconds left to chat!`, "destructive");
            startChatTimer(remaining);
            return;
          }

          if ((image_url || audio_url) && lastMediaTime[userId] && (now - lastMediaTime[userId] < MEDIA_COOLDOWN)) {
            const remaining = Math.ceil((MEDIA_COOLDOWN - (now - lastMediaTime[userId])) / 1000 / 60);
            showToast("Warning", `Wait ${remaining} more minutes to send media!`, "destructive");
            return;
          }

          if (!content && !image_url && !audio_url) return;

          let filteredContent = content ? filterBadWords(content) : content;

          chatInput.disabled = true;
          sendMessageBtn.disabled = true;
          sendMessageBtn.innerHTML = `<i data-lucide="loader" class="h-4 w-4 animate-spin"></i>`;
          lucide.createIcons();

          const profile = window.currentUser.profile || (await fetchUserProfile(userId));
          window.currentUser.profile = profile;

          const messageData = {
            user_id: userId,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
            content: filteredContent || "",
            status: "Delivered",
            is_read: false,
            read_at: null,
            likes: [],
            reply_to: currentReplyTo ? currentReplyTo : null,
          };

          if (currentReplyTo) cancelReply();

          // support simple direct/private message: set recipient if privateChatTarget present
          if (window.privateChatTarget && isValidUuid(window.privateChatTarget)) {
            messageData.is_private = true;
            messageData.recipient_id = window.privateChatTarget;
          }

          if (image_url) messageData.image_url = image_url;
          if (audio_url) {
            messageData.audio_url = audio_url;
            if (duration) messageData.duration = duration;
          }

          let mentionedUserIds = [];
          const mentionedUsernames = detectMentions(filteredContent);
          for (const username of mentionedUsernames) {
            const { data: taggedUser, error } = await supabase
              .from("profiles")
              .select("id")
              .eq("full_name", username)
              .maybeSingle();
            if (error) {
              console.error(`Gagal mencari pengguna ${username}:`, error);
              continue;
            }
            if (taggedUser) {
              mentionedUserIds.push(taggedUser.id);
            }
          }

          if (mentionedUserIds.length > 0) {
            messageData.mentions = mentionedUserIds;
          }

          // Merge additional fields into the existing messageData object to avoid redeclaration
          if (content) messageData.content = filteredContent || "";
          if (image_url) messageData.image_url = image_url;
          if (audio_url) {
            messageData.audio_url = audio_url;
            if (duration) messageData.duration = duration;
          }

          // Jika ini pesan pribadi, gunakan tabel direct_messages bila tersedia
          if (isPrivateMessage) {
            if (hasDirectMessagesTable) {
              try {
                const { data: dmData, error: dmErr } = await supabase
                  .from('direct_messages')
                  .insert({
                    sender_id: userId,
                    receiver_id: window.privateChatTarget,
                    content: messageData.content
                  })
                  .select()
                  .single();
                if (dmErr) throw dmErr;
                // cache and UI
                if (!directMessages[window.privateChatTarget]) directMessages[window.privateChatTarget] = [];
                directMessages[window.privateChatTarget].push(dmData);
                updateDirectMessageUI(window.privateChatTarget);
                showToast('Success', 'Private message sent', 'success');
              } catch (dmErr) {
                console.error('Failed to send direct message:', dmErr);
                showToast('Error', 'Failed to send private message', 'error');
              }
              // done for private mode
              chatInput.disabled = false;
              sendMessageBtn.disabled = false;
              sendMessageBtn.innerHTML = `<i data-lucide="send" class="h-4 w-4"></i>`;
              lucide.createIcons();
              return;
            } else {
              // fallback: save locally
              try {
                const local = JSON.parse(localStorage.getItem('directMessages') || '{}');
                if (!local[window.privateChatTarget]) local[window.privateChatTarget] = [];
                const localMsg = {
                  id: `local-${Date.now()}`,
                  sender_id: userId,
                  receiver_id: window.privateChatTarget,
                  content: messageData.content,
                  created_at: new Date().toISOString()
                };
                local[window.privateChatTarget].push(localMsg);
                localStorage.setItem('directMessages', JSON.stringify(local));
                if (!directMessages[window.privateChatTarget]) directMessages[window.privateChatTarget] = [];
                directMessages[window.privateChatTarget].push(localMsg);
                updateDirectMessageUI(window.privateChatTarget);
                showToast('Info', 'Private messages are not supported on server; saved locally', 'info');
              } catch (localErr) {
                console.error('Failed to save local DM:', localErr);
                showToast('Error', 'Failed to save private message locally', 'error');
              }
              chatInput.disabled = false;
              sendMessageBtn.disabled = false;
              sendMessageBtn.innerHTML = `<i data-lucide="send" class="h-4 w-4"></i>`;
              lucide.createIcons();
              return;
            }
          }

          // Non-private message -> insert into public messages table
          const { data, error: sendError } = await supabase
            .from("messages")
            .insert(messageData)
            .select()
            .single();
          if (sendError) throw sendError;

          if (tempId) {
            const index = messagesList.findIndex(msg => msg.id === tempId);
            if (index !== -1) {
              messagesList[index] = { ...messagesList[index], ...data };
              localStorage.setItem("chatMessages", JSON.stringify(messagesList.slice(-100)));
              await appendMessage(messagesList[index], true);
            } else {
              messagesList.push(data);
              localStorage.setItem("chatMessages", JSON.stringify(messagesList.slice(-100)));
              await appendMessage(data);
            }
          }

          if (content) {
            lastChatTime[userId] = now;
            startChatTimer(CHAT_COOLDOWN / 1000);
          }
          if (image_url || audio_url) {
            lastMediaTime[userId] = now;
          }

          for (const username of mentionedUsernames) {
            const { data: taggedUser, error } = await supabase
              .from("profiles")
              .select("id")
              .eq("full_name", username)
              .maybeSingle();
            if (error) {
              console.error(`Gagal mencari pengguna untuk notifikasi ${username}:`, error);
              continue;
            }
            if (taggedUser) {
              const { error: notifyError } = await supabase.from("notifications").insert({
                user_id: taggedUser.id,
                type: "mention",
                content: `${profile.full_name} menyebut Anda dalam pesan: "${filteredContent}"`,
                is_read: false,
              });
              if (notifyError) {
                console.error(`Gagal mengirim notifikasi untuk ${username}:`, notifyError);
              } else {
                showToast("Info", `User @${username} has been tagged`, "default");
              }
            }
          }

          if (filteredContent) chatInput.value = "";
          if (suggestionList) {
            suggestionList.classList.add("hidden");
          }

          // if we sent a private message intent, clear the helper
          if (window.privateChatTarget) {
            window.privateChatTarget = null;
            if (chatInput) chatInput.placeholder = "Type your message....";
          }

          showToast("Success", "Message sent", "default");

        } catch (err) {
          console.error("Failed to send message:", err);
          showToast("Error", "Failed to send message: " + err.message, "destructive");
        } finally {
          chatInput.disabled = false;
          sendMessageBtn.disabled = false;
          sendMessageBtn.innerHTML = `<i data-lucide="send" class="h-4 w-4 text-white"></i>`;
          lucide.createIcons();
        }
      }

      // Fungsi timer cooldown chat
      function startChatTimer(seconds) {
        const chatInput = document.getElementById("chatInput");
        const sendMessageBtn = document.getElementById("sendMessageBtn");
        let timeLeft = seconds;
        chatInput.disabled = true;
        sendMessageBtn.disabled = true;

        const timer = setInterval(() => {
          timeLeft--;
          if (timeLeft <= 0) {
            clearInterval(timer);
            chatInput.disabled = false;
            sendMessageBtn.disabled = false;
            chatInput.placeholder = "Type your message...";
          } else {
            chatInput.placeholder = `Wait ${timeLeft} seconds to chat again...`;
          }
        }, 1000);
      }

      // Fungsi untuk memperbarui latensi koneksi
      function updateConnectionLatency() {
        const start = Date.now();
        supabase.from("messages").select("id").limit(1).then(() => {
          const latency = Date.now() - start;
          const connectionLatency = document.getElementById("connectionLatency");
          if (connectionLatency) {
            connectionLatency.textContent = `${latency}ms`;
            connectionLatency.parentElement.classList.remove("text-red-400");
            connectionLatency.parentElement.classList.add("text-slate-400");
          }
        }).catch(() => {
          const connectionLatency = document.getElementById("connectionLatency");
          if (connectionLatency) {
            connectionLatency.textContent = "Terputus";
            connectionLatency.parentElement.classList.remove("text-slate-400");
            connectionLatency.parentElement.classList.add("text-red-400");
          }
        });
      }

      // Fungsi untuk memperbarui daftar pengguna online
      // Fungsi untuk memperbarui daftar pengguna online (Sidebar + Popup Realtime Update)
// Fungsi untuk memperbarui daftar pengguna online (Sidebar + Popup Realtime Update)
function updateOnlineUsers(users) {
  const onlineUsersList = document.getElementById("onlineUsersList");
  if (!onlineUsersList) {
    console.error("Elemen onlineUsersList tidak ditemukan di DOM");
    return;
  }

  // 1. Update Sidebar (Daftar di kanan layar)
  onlineUsersList.innerHTML = "";
  
  if (users.length === 0) {
    onlineUsersList.innerHTML = `<div class="text-center text-slate-400 py-2">No users online</div>`;
  } else {
    users.forEach(user => {
      const userEl = document.createElement("div");
      userEl.className = "flex flex-col items-center";
      
      const color = user.full_name.includes("Sarah") ? "purple" :
        user.full_name.includes("Mike") ? "amber" :
          user.full_name.includes("Lisa") ? "emerald" :
            user.full_name.includes("Alex") ? "rose" : "blue";
      
      const statusColor = user.full_name === "Alex" ? "amber" : "emerald";
      
      // Logic Avatar
      let avatarContent = user.full_name ? user.full_name[0].toUpperCase() : "A";
      if (user.avatar_url) {
        try {
          if (user.avatar_url.startsWith('http')) {
             avatarContent = `<img src="${user.avatar_url}" class="h-8 w-8 rounded-full object-cover" alt="Avatar" />`;
          } else {
             const { data: avatarData } = supabase.storage.from("avatars").getPublicUrl(user.avatar_url);
             if (avatarData?.publicUrl) {
                avatarContent = `<img src="${avatarData.publicUrl}" class="h-8 w-8 rounded-full object-cover" alt="Avatar" />`;
             }
          }
        } catch (error) {
          console.error("Gagal ambil avatar:", error);
        }
      }

      userEl.innerHTML = `
        <div class="relative">
            <div class="h-8 w-8 rounded-full bg-gradient-to-br from-${color}-500/20 to-${color}-600/20 border border-${color}-500/30 flex items-center justify-center shadow-sm">
                ${avatarContent}
            </div>
            <div class="absolute bottom-0 right-0 h-2 w-2 bg-${statusColor}-500 rounded-full border border-slate-900"></div>
        </div>
        <span class="text-xs text-slate-400 mt-1 truncate w-10 text-center">${sanitizeHTML(user.full_name.split(' ')[0])}</span>
      `;
      
      userEl.style.cursor = 'pointer';
      // Simpan ID untuk referensi
      try { userEl.dataset.userId = user.id || user.user_id || ''; } catch (e) {}
      
      const userClickHandler = (e) => {
        e.stopPropagation();
        showUserProfilePopup(user.id || user.user_id);
      };
      
      userEl.addEventListener('click', userClickHandler);
      eventListeners.push({ element: userEl, event: 'click', handler: userClickHandler });
      onlineUsersList.appendChild(userEl);
    });
  }

  // Update counter di header
  const onlineCount = document.querySelector("#onlineUsersList").parentElement.querySelector("span");
  if (onlineCount) {
    onlineCount.textContent = `Online (${users.length})`;
  }
  lucide.createIcons();

  // =====================================================================
  // 2. [UPDATE REALTIME] Popup Profil yang Sedang Terbuka
  // =====================================================================
  const profileModal = document.getElementById('profileModal');
  const statusContainer = document.getElementById('profile-status-container');
  
  // Hanya jalankan jika modal profil sedang terbuka
  if (profileModal && statusContainer) {
    const viewedUserId = profileModal.getAttribute('data-profile-user-id');
    const currentUser = window.currentUser?.id;
    
    if (viewedUserId) {
      // Cek status: Online jika (User itu adalah saya) ATAU (User itu ada di daftar users online)
      const isSelf = String(viewedUserId) === String(currentUser);
      const isRealtimeOnline = isSelf || users.some(u => String(u.user_id || u.id) === String(viewedUserId));

      const dot = statusContainer.querySelector('.status-dot');
      const text = statusContainer.querySelector('.status-text');

      // Jika Realtime mendeteksi online, langsung update UI
      if (dot && text && isRealtimeOnline) {
         dot.className = 'status-dot w-2 h-2 bg-green-500 rounded-full mr-1.5 shadow-[0_0_8px_rgba(34,197,94,0.6)] transition-all duration-300';
         text.textContent = 'Active now';
      }
      // Jika Realtime mendeteksi offline tapi teks masih "Active now", cek apakah perlu diubah
      // (Kita bisa membiarkannya sebentar jika mengandalkan last_seen DB, tapi untuk realtime snappy, ubah saja)
      else if (dot && text && !isRealtimeOnline && text.textContent === 'Active now') {
         // Fallback: Mungkin update DB belum sampai. Tapi jika user hilang dari presence list, anggap offline.
         dot.className = 'status-dot w-2 h-2 bg-slate-500 rounded-full mr-1.5 transition-all duration-300';
         text.textContent = 'Offline';
      }
    }
  }
}

// Fungsi untuk membersihkan event listener dan subscription
// Fungsi untuk membersihkan event listener, subscription, dan update status offline
function cleanupChat() {
  // 1. Hentikan Heartbeat
  if (window.onlineHeartbeat) {
      clearInterval(window.onlineHeartbeat);
      window.onlineHeartbeat = null;
  }
  
  // 2. Set status offline di Database sebelum membersihkan state
  if (window.currentUser?.id) {
      supabase.from('profiles')
        .update({ is_online: false })
        .eq('id', window.currentUser.id)
        .then(() => console.log('Set offline DB'))
        .catch(console.error);
  }

  // 3. Hapus semua event listener
  eventListeners.forEach(({ element, event, handler }) => {
    if (element) element.removeEventListener(event, handler);
  });
  eventListeners = [];

  // 4. Unsubscribe semua channel
  supabaseChannels.forEach(channel => {
    supabase.removeChannel(channel);
  });
  supabaseChannels = [];

  // 5. Bersihkan interval lain
  if (latencyInterval) clearInterval(latencyInterval);
  if (presenceInterval) {
      clearInterval(presenceInterval);
      presenceInterval = null;
  }

  // 6. Reset state
  messagesList = [];
  adminMessagesList = [];
  onlineUsers = [];
  isChatInitialized = false;
  localStorage.removeItem("chatMessages");
  lastChatTime = {};
  lastMediaTime = {};

  // 7. Bersihkan DOM
  const chatMessages = document.getElementById("chatMessages");
  const adminMessages = document.getElementById("adminMessages");
  if (chatMessages) chatMessages.innerHTML = "";
  if (adminMessages) adminMessages.innerHTML = "";
}


      // Fungsi untuk mengikat event listener
      function bindEventListeners() {
        const chatInput = document.getElementById("chatInput");
        const sendMessageBtn = document.getElementById("sendMessageBtn");
        const uploadImageButton = document.getElementById("uploadImageButton");
        const imageInput = document.getElementById("imageInput");
        const recordVoiceBtn = document.getElementById("recordVoiceBtn");
        const suggestionList = document.getElementById("mentionSuggestions");
        const emojiPickerBtn = document.getElementById("emojiPickerBtn");
        const voiceCallBtn = document.getElementById("voiceCallBtn");
        const videoCallBtn = document.getElementById("videoCallBtn");
        const refreshChatBtn = document.getElementById("refreshChatBtn");
        const expandUsersBtn = document.getElementById("expandUsersBtn");

        if (!chatInput || !sendMessageBtn) {
          console.error("Elemen chatInput atau sendMessageBtn tidak ditemukan");
          return;
        }

        // Bersihkan semua listener sebelumnya
        eventListeners.forEach(({ element, event, handler }) => {
          element.removeEventListener(event, handler);
        });
        eventListeners = [];

        const sendMessageHandler = async () => {
          const content = chatInput.value.trim();
          if (content) await sendMessage(content);
          chatInput.focus();
          if (suggestionList) {
            suggestionList.classList.add("hidden");
          }
        };
        sendMessageBtn.addEventListener("click", sendMessageHandler);
        eventListeners.push({ element: sendMessageBtn, event: "click", handler: sendMessageHandler });

        const keypressHandler = async (e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            const content = chatInput.value.trim();
            if (content) await sendMessage(content);
            chatInput.focus();
            if (suggestionList) {
              suggestionList.classList.add("hidden");
            }
          }
        };
        chatInput.addEventListener("keypress", keypressHandler);
        eventListeners.push({ element: chatInput, event: "keypress", handler: keypressHandler });

        let isTyping = false;
        let typingChannel = null;
        const inputHandler = async () => {
          if (!typingChannel) {
            typingChannel = supabase.channel("typing");
            typingChannel.subscribe((status) => {
              if (status === "SUBSCRIBED") {
                if (isTyping) {
                  typingChannel.track({
                    user_id: window.currentUser.id,
                    full_name: window.currentUser.profile.full_name,
                    isTyping: true
                  }).catch(err => console.error("Gagal track typing:", err));
                }
              }
            });
            supabaseChannels.push(typingChannel);
          }

          if (!isTyping) {
            isTyping = true;
            if (typingChannel.state === "SUBSCRIBED") {
              typingChannel.track({
                user_id: window.currentUser.id,
                full_name: window.currentUser.profile.full_name,
                isTyping: true
              }).catch(err => console.error("Gagal track typing:", err));
            }
          }
          clearTimeout(window.typingTimeout);
          window.typingTimeout = setTimeout(() => {
            isTyping = false;
            if (typingChannel.state === "SUBSCRIBED") {
              typingChannel.track({
                user_id: window.currentUser.id,
                full_name: window.currentUser.profile.full_name,
                isTyping: false
              }).catch(err => console.error("Gagal untrack typing:", err));
            }
          }, 2000);

          const cursorPos = chatInput.selectionStart;
          const textBeforeCursor = chatInput.value.substring(0, cursorPos);
          const mentionMatch = textBeforeCursor.match(/@([\w\s]*)$/);
          if (mentionMatch) {
            const query = mentionMatch[1];
            await showMentionSuggestions(query, chatInput, suggestionList);
          } else {
            if (suggestionList) {
              suggestionList.classList.add("hidden");
            }
          }

          chatInput.style.height = "auto";
          chatInput.style.height = `${chatInput.scrollHeight}px`;
        };
        chatInput.addEventListener("input", inputHandler);
        eventListeners.push({ element: chatInput, event: "input", handler: inputHandler });

        if (uploadImageButton && imageInput) {
          const triggerImageInput = () => {
            imageInput.click();
          };
          uploadImageButton.addEventListener("click", triggerImageInput);
          eventListeners.push({ element: uploadImageButton, event: "click", handler: triggerImageInput });

          const handleImageUpload = async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const userId = window.currentUser?.id;
            if (!userId) {
              showToast("Error", "You are not logged in yet.", "destructive");
              return;
            }

            const now = Date.now();
            if (lastMediaTime[userId] && (now - lastMediaTime[userId] < MEDIA_COOLDOWN)) {
              const remaining = Math.ceil((MEDIA_COOLDOWN - (now - lastMediaTime[userId])) / 1000 / 60);
              showToast("Warning", `wait ${remaining} another minute to send a picture!`, "destructive");
              return;
            }

            // Validasi ukuran file (maks 5MB)
            const maxSizeMB = 5;
            if (file.size > maxSizeMB * 1024 * 1024) {
              showToast("Error", `Maximum image size ${maxSizeMB}MB`, "destructive");
              return;
            }

            if (window.isSendingMedia) {
              showToast("Peringatan", "Currently uploading media, please wait.", "destructive");
              return;
            }
            window.isSendingMedia = true;

            showToast("Info", "Uploading images...", "default");

            try {
              const filePath = `chat_images/${Date.now()}_${file.name}`;
              const { error } = await supabase.storage.from("chat-media").upload(filePath, file);
              if (error) throw error;

              const { data } = supabase.storage.from("chat-media").getPublicUrl(filePath);

              const img = new Image();
              img.crossOrigin = "anonymous";
              img.src = data.publicUrl;
              await new Promise(resolve => img.onload = resolve);

              const canvas = document.createElement("canvas");
              const ctx = canvas.getContext("2d");
              const maxWidth = 200;
              let width = img.width;
              let height = img.height;

              if (width > maxWidth) {
                height *= maxWidth / width;
                width = maxWidth;
              }

              canvas.width = width;
              canvas.height = height;
              ctx.drawImage(img, 0, 0, width, height);
              const resizedUrl = canvas.toDataURL("image/jpeg");

              const tempId = `temp-${Date.now()}`;
              // Ganti "🖼️" dengan "" (string kosong)
              await sendMessage("", resizedUrl, null, tempId);

            } catch (error) {
              console.error("Failed to upload image:", error);
              showToast("Error", "Failed to upload image: " + error.message, "destructive");
            } finally {
              event.target.value = "";
              window.isSendingMedia = false;
            }
          };
          imageInput.addEventListener("change", handleImageUpload);
          eventListeners.push({ element: imageInput, event: "change", handler: handleImageUpload });
        }

        if (recordVoiceBtn) {
          const createVoiceRecorderUI = () => {
            const modal = document.createElement("div");
            modal.id = "voiceRecorderModal";
            modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden";
            modal.innerHTML = `
            <div class="bg-slate-800 p-6 rounded-lg shadow-lg w-80 transform transition-all duration-300">
                <h3 class="text-lg font-semibold text-white mb-4">Rekam Suara</h3>
                <div class="flex items-center justify-center mb-4">
                    <span id="voiceTimer" class="text-xl text-cyan-400 font-mono">00:00</span>
                </div>
                <div id="waveformAnimation" class="h-8 flex items-center justify-center gap-1">
                    <div class="bar bg-cyan-500 w-1 rounded" style="animation: wave 0.5s infinite"></div>
                    <div class="bar bg-cyan-500 w-1 rounded" style="animation: wave 0.5s infinite 0.1s"></div>
                    <div class="bar bg-cyan-500 w-1 rounded" style="animation: wave 0.5s infinite 0.2s"></div>
                    <div class="bar bg-cyan-500 w-1 rounded" style="animation: wave 0.5s infinite 0.3s"></div>
                    <div class="bar bg-cyan-500 w-1 rounded" style="animation: wave 0.5s infinite 0.4s"></div>
                </div>
                <div class="flex justify-center space-x-4 mt-4">
                    <button id="startRecordBtn" class="px-4 py-2 bg-cyan-600 text-white rounded-full hover:bg-cyan-500 flex items-center">
                        <i data-lucide="mic" class="h-4 w-4 mr-2"></i>Rekam
                    </button>
                    <button id="stopRecordBtn" class="px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-500 flex items-center hidden">
                        <i data-lucide="square" class="h-4 w-4 mr-2"></i>Stop
                    </button>
                </div>
                <div id="previewControls" class="hidden mt-4">
                    <div class="flex items-center justify-center mb-2">
                        <button id="playPreviewBtn" class="p-2 bg-cyan-500/20 rounded-full">
                            <svg class="play-icon" width="16" height="16" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M8 5v14l11-7z"/>
                            </svg>
                            <svg class="pause-icon" width="16" height="16" viewBox="0 0 24 24" style="display:none">
                                <path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                            </svg>
                        </button>
                        <span id="previewDuration" class="ml-2 text-xs text-slate-400">00:00</span>
                    </div>
                    <div class="flex justify-center space-x-2">
                        <button id="cancelVoiceBtn" class="px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-500">cancel</button>
                        <button id="sendVoiceBtn" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-500">Send</button>
                    </div>
                </div>
            </div>
            <style>
                @keyframes wave {
                    0%, 100% { height: 8px; }
                    50% { height: 24px; }
                }
                .bar { height: 8px; }
            </style>
        `;
            document.body.appendChild(modal);
            lucide.createIcons();
            return modal;
          };

          const handleVoiceRecord = async () => {
            const userId = window.currentUser?.id;
            if (!userId) {
              showToast("Error", "You are not logged in yet.", "destructive");
              return;
            }

            const now = Date.now();
            if (lastMediaTime[userId] && (now - lastMediaTime[userId] < MEDIA_COOLDOWN)) {
              const remaining = Math.ceil((MEDIA_COOLDOWN - (now - lastMediaTime[userId])) / 1000 / 60);
              showToast("Warning", `Wait ${remaining} another minute to send the voice!`, "destructive");
              return;
            }

            if (window.isSendingMedia) {
              showToast("Warning", "Currently uploading media, please wait.", "destructive");
              return;
            }

            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              const mediaRecorder = new MediaRecorder(stream);
              let audioChunks = [];
              let startTime;
              let timerInterval;
              const maxDuration = 120; // 2 menit

              const modal = document.getElementById("voiceRecorderModal") || createVoiceRecorderUI();
              const startBtn = modal.querySelector("#startRecordBtn");
              const stopBtn = modal.querySelector("#stopRecordBtn");
              const playBtn = modal.querySelector("#playPreviewBtn");
              const cancelBtn = modal.querySelector("#cancelVoiceBtn");
              const sendBtn = modal.querySelector("#sendVoiceBtn");
              const timerDisplay = modal.querySelector("#voiceTimer");
              const previewDuration = modal.querySelector("#previewDuration");
              const waveform = modal.querySelector("#waveformAnimation");
              const previewControls = modal.querySelector("#previewControls");
              const playIcon = playBtn.querySelector(".play-icon");
              const pauseIcon = playBtn.querySelector(".pause-icon");

              modal.classList.remove("hidden");

              const updateTimer = () => {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                if (elapsed >= maxDuration) {
                  mediaRecorder.stop();
                }
              };

              mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
              mediaRecorder.onstop = async () => {
                clearInterval(timerInterval);
                waveform.classList.add("hidden");
                previewControls.classList.remove("hidden");
                startBtn.classList.add("hidden");
                stopBtn.classList.add("hidden");

                const blob = new Blob(audioChunks, { type: "audio/webm" });
                const audioUrl = URL.createObjectURL(blob);
                const audio = new Audio(audioUrl);
                const duration = Math.floor((Date.now() - startTime) / 1000);
                const minutes = Math.floor(duration / 60);
                const seconds = duration % 60;
                previewDuration.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

                const playHandler = () => {
                  if (audio.paused) {
                    audio.play();
                    playIcon.style.display = "none";
                    pauseIcon.style.display = "block";
                  } else {
                    audio.pause();
                    playIcon.style.display = "block";
                    pauseIcon.style.display = "none";
                  }
                };
                playBtn.addEventListener("click", playHandler);
                eventListeners.push({ element: playBtn, event: "click", handler: playHandler });

                audio.addEventListener("ended", () => {
                  playIcon.style.display = "block";
                  pauseIcon.style.display = "none";
                });

                const sendHandler = async () => {
                  if (window.isSendingMedia) return;
                  window.isSendingMedia = true;
                  sendBtn.disabled = true;
                  sendBtn.innerHTML = `<i data-lucide="loader" class="h-4 w-4 animate-spin"></i>`;

                  try {
                    const fileName = `voice_notes/${Date.now()}.webm`;
                    const { error } = await supabase.storage
                      .from("chat-media")
                      .upload(fileName, blob, { contentType: "audio/webm" });
                    if (error) throw error;

                    const { data } = supabase.storage.from("chat-media").getPublicUrl(fileName);
                    const tempId = `temp-${Date.now()}`;
                    await sendMessage("", null, data.publicUrl, tempId, duration);

                    modal.classList.add("hidden");
                    showToast("Success", "Voice note sent", "default");

                  } catch (error) {
                    console.error("Failed to upload voice note:", error);
                    showToast("Error", "Failed to upload voice note: " + error.message, "destructive");
                  } finally {
                    window.isSendingMedia = false;
                    sendBtn.disabled = false;
                    sendBtn.innerHTML = `<i data-lucide="send" class="h-4 w-4"></i>`;
                    lucide.createIcons();
                    stream.getTracks().forEach(track => track.stop());
                    URL.revokeObjectURL(audioUrl);
                    audioChunks = [];
                    audio.remove();
                    modal.remove();
                  }
                };
                sendBtn.addEventListener("click", sendHandler);
                eventListeners.push({ element: sendBtn, event: "click", handler: sendHandler });

                const cancelHandler = () => {
                  mediaRecorder.stop();
                  modal.classList.add("hidden");
                  stream.getTracks().forEach(track => track.stop());
                  clearInterval(timerInterval);
                  audioChunks = [];
                  URL.revokeObjectURL(audioUrl);
                  if (audio) audio.remove();
                  modal.remove();
                };
                cancelBtn.addEventListener("click", cancelHandler);
                eventListeners.push({ element: cancelBtn, event: "click", handler: cancelHandler });
              };

              const startHandler = () => {
                mediaRecorder.start();
                startTime = Date.now();
                timerInterval = setInterval(updateTimer, 1000);
                waveform.classList.remove("hidden");
                startBtn.classList.add("hidden");
                stopBtn.classList.remove("hidden");
              };
              startBtn.addEventListener("click", startHandler);
              eventListeners.push({ element: startBtn, event: "click", handler: startHandler });

              const stopHandler = () => {
                mediaRecorder.stop();
              };
              stopBtn.addEventListener("click", stopHandler);
              eventListeners.push({ element: stopBtn, event: "click", handler: stopHandler });
            } catch (err) {
              console.error("Failed to record sound:", err);
              showToast("Error", "Failed to record sound: " + err.message, "destructive");
              window.isSendingMedia = false;
            }
          };
          recordVoiceBtn.addEventListener("click", handleVoiceRecord);
          eventListeners.push({ element: recordVoiceBtn, event: "click", handler: handleVoiceRecord });
        }

        if (emojiPickerBtn) {
          const emojis = ["😊", "😂", "👍", "❤️", "🔥", "👀", "🙌", "💡"];
          const picker = document.createElement("div");
          picker.className = "absolute bottom-12 left-0 bg-slate-800/90 border border-slate-700/30 rounded-lg p-2 shadow-lg z-10 hidden flex-wrap gap-2";
          emojis.forEach(emoji => {
            const btn = document.createElement("button");
            btn.className = "text-lg hover:bg-slate-700/50 rounded p-1";
            btn.textContent = emoji;
            const emojiHandler = () => {
              chatInput.value += emoji;
              picker.classList.add("hidden");
              chatInput.focus();
            };
            btn.addEventListener("click", emojiHandler);
            eventListeners.push({ element: btn, event: "click", handler: emojiHandler });
            picker.appendChild(btn);
          });

          emojiPickerBtn.parentElement.appendChild(picker);

          const togglePicker = () => picker.classList.toggle("hidden");
          emojiPickerBtn.addEventListener("click", togglePicker);
          eventListeners.push({ element: emojiPickerBtn, event: "click", handler: togglePicker });
        }

        if (voiceCallBtn) {
          const voiceCallHandler = () => showToast("Info", "Voice call feature not yet available", "default");
          voiceCallBtn.addEventListener("click", voiceCallHandler);
          eventListeners.push({ element: voiceCallBtn, event: "click", handler: voiceCallHandler });
        }

        if (videoCallBtn) {
          const videoCallHandler = () => showToast("Info", "Video calling feature not yet available", "default");
          videoCallBtn.addEventListener("click", videoCallHandler);
          eventListeners.push({ element: videoCallBtn, event: "click", handler: videoCallHandler });
        }

        if (refreshChatBtn) {
          const refreshChatHandler = async () => {
            refreshChatBtn.disabled = true;
            refreshChatBtn.querySelector("i").classList.add("animate-spin");
            await initializeChat();
            refreshChatBtn.disabled = false;
            refreshChatBtn.querySelector("i").classList.remove("animate-spin");
          };
          refreshChatBtn.addEventListener("click", refreshChatHandler);
          eventListeners.push({ element: refreshChatBtn, event: "click", handler: refreshChatHandler });
        }

        if (expandUsersBtn) {
          const toggleUsersList = () => {
            const onlineUsersList = document.getElementById("onlineUsersList");
            onlineUsersList.classList.toggle("hidden");
            const icon = expandUsersBtn.querySelector("i");
            icon.classList.toggle("rotate-180");
          };
          expandUsersBtn.addEventListener("click", toggleUsersList);
          eventListeners.push({ element: expandUsersBtn, event: "click", handler: toggleUsersList });
        }
      }

      // Fungsi untuk memeriksa dan memulihkan koneksi realtime
      async function checkRealtimeConnection() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const status = await supabase.channel('system').subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Realtime connection restored');
          }
        });

        return status;
      }

      // Fungsi untuk menandai pesan sebagai telah dibaca
      async function markMessageAsRead(messageId) {
        try {
          const { data, error } = await supabase
            .from("messages")
            .update({ 
              is_read: true,
              read_at: new Date().toISOString(),
              status: "Read"
            })
            .eq("id", messageId)
            .select();

          if (error) throw error;
          return data;
        } catch (err) {
          console.error("Error marking message as read:", err);
          return null;
        }
      }

      // Handle ketika pesan dibaca oleh penerima
      function handleMessageRead(messageId, readBy, readAt) {
        const msgIndex = messagesList.findIndex(m => m.id === messageId);
        if (msgIndex !== -1) {
          messagesList[msgIndex].is_read = true;
          messagesList[msgIndex].status = 'Read';
          messagesList[msgIndex].read_at = readAt;
          
          // Update UI untuk menampilkan status read
          const statusElement = document.querySelector(`[data-message-id="${messageId}"] .message-status`);
          if (statusElement) {
            statusElement.innerHTML = `
              <i data-lucide="check-check" class="h-3 w-3 mr-1 text-emerald-400"></i>
              <span>Read ${new Date(readAt).toLocaleTimeString()}</span>
            `;
            lucide.createIcons();
          }
        }
      }

      // Helper: apakah pesan bisa diedit (15 menit dari pengiriman)
      function canEditMessage(msg) {
        try {
          if (!msg || !window.currentUser) return false;
          if (msg.user_id !== window.currentUser.id) return false;
          if (msg.deleted_for_all) return false;
          const created = new Date(msg.created_at).getTime();
          const age = Date.now() - created;
          return age <= 20 * 60 * 1000; // 20 minutes
        } catch (e) { return false; }
      }

      // Helper: apakah pesan bisa dihapus untuk semua (20 menit)
      function canDeleteForEveryone(msg) {
        try {
          if (!msg || !window.currentUser) return false;
          if (msg.user_id !== window.currentUser.id) return false;
          if (msg.deleted_for_all) return false;
          const created = new Date(msg.created_at).getTime();
          const age = Date.now() - created;
          return age <= 20 * 60 * 1000; // 20 minutes
        } catch (e) { return false; }
      }

      // Hapus pesan hanya untuk saya (local only)
      async function deleteMessageForMe(messageId) {
        try {
          if (!window.currentUser?.id) return;
          const userKey = `deleted_for_${window.currentUser.id}`;
          const raw = localStorage.getItem(userKey);
          const arr = raw ? JSON.parse(raw) : [];
          if (!arr.includes(messageId)) arr.push(messageId);
          localStorage.setItem(userKey, JSON.stringify(arr));

          // Remove from local list and DOM
          const index = messagesList.findIndex(m => m.id === messageId);
          if (index !== -1) messagesList.splice(index, 1);
          const el = document.querySelector(`[data-message-id="${messageId}"]`);
          if (el) el.remove();
        } catch (err) {
          console.error('deleteMessageForMe error:', err);
        }
      }

      // Hapus pesan untuk semua (reset konten, tandai deleted_for_all)
      async function deleteMessageForEveryone(messageId) {
        try {
          const index = messagesList.findIndex(m => m.id === messageId);
          if (index === -1) return;
          const msg = messagesList[index];
          if (!canDeleteForEveryone(msg)) {
            showToast('Error', 'Cannot delete for everyone: time limit exceeded', 'destructive');
            return;
          }

          // Delete row from database so it's removed for everyone
          const { data, error } = await supabase.from('messages').delete().eq('id', messageId).select().single();
          if (error) {
            console.error('Failed to delete message for everyone:', error);
            showToast('Error', 'Failed to delete for everyone: ' + error.message, 'destructive');
            return;
          }

          // Remove locally as well
          messagesList.splice(index, 1);
          const el = document.querySelector(`[data-message-id="${messageId}"]`);
          if (el) el.remove();
        } catch (err) {
          console.error('deleteMessageForEveryone error:', err);
        }
      }

      // Mulai proses edit pesan: ganti bubble dengan editor kecil
      function startEditMessage(messageId) {
        const index = messagesList.findIndex(m => m.id === messageId);
        if (index === -1) return;
        const msg = messagesList[index];
        if (!canEditMessage(msg)) {
          showToast('Error', 'Edit time window expired', 'destructive');
          return;
        }

        const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageEl) return;
        const contentEl = messageEl.querySelector('.text-sm');
        if (!contentEl) return;

        // Replace content with editor
        const textarea = document.createElement('textarea');
        textarea.className = 'w-full p-2 bg-slate-800 text-white rounded';
        textarea.value = msg.content || '';
        const controls = document.createElement('div');
        controls.className = 'flex justify-end gap-2 mt-2';
        controls.innerHTML = `
          <button class="cancel-edit px-3 py-1 bg-slate-600 rounded text-sm">Cancel</button>
          <button class="save-edit px-3 py-1 bg-cyan-600 rounded text-sm">Save</button>
        `;

        // Hide original content and append editor
        contentEl.style.display = 'none';
        const editorWrapper = document.createElement('div');
        editorWrapper.className = 'edit-wrapper';
        editorWrapper.appendChild(textarea);
        editorWrapper.appendChild(controls);
        contentEl.parentElement.appendChild(editorWrapper);

        const cancelBtn = controls.querySelector('.cancel-edit');
        const saveBtn = controls.querySelector('.save-edit');

        const cleanupEditor = () => {
          editorWrapper.remove();
          contentEl.style.display = '';
        };

        cancelBtn.addEventListener('click', cleanupEditor);

        saveBtn.addEventListener('click', async () => {
          const newContent = textarea.value.trim();
          if (newContent === msg.content) {
            cleanupEditor();
            return;
          }
          try {
            const { data, error } = await supabase.from('messages').update({ content: newContent, edited: true, edited_at: new Date().toISOString() }).eq('id', messageId).select().single();
            if (error) {
              console.error('Failed to save edited message:', error);
              showToast('Error', 'Failed to edit message: ' + error.message, 'destructive');
              return;
            }
            messagesList[index] = { ...messagesList[index], ...data };
            await appendMessage(messagesList[index], true);
            cleanupEditor();
          } catch (err) {
            console.error('save edit error:', err);
          }
        });
      }


      // Modal confirmation popup (replaces native confirm)
function showConfirm(title = 'Confirm', message = '', confirmText = 'Yes', cancelText = 'Cancel') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60';

    const dialog = document.createElement('div');
    dialog.className = 'bg-slate-800 text-white rounded-lg p-4 max-w-md w-full shadow-lg';
    dialog.innerHTML = `
      <div class="font-semibold text-lg mb-2">${sanitizeHTML(title)}</div>
      <div class="text-sm text-slate-300 mb-4">${sanitizeHTML(message)}</div>
      <div class="flex justify-end gap-2">
        <button class="confirm-cancel px-3 py-1 bg-slate-600 rounded text-sm">${sanitizeHTML(cancelText)}</button>
        <button class="confirm-ok px-3 py-1 bg-rose-600 rounded text-sm">${sanitizeHTML(confirmText)}</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const cleanup = (val) => {
      try { overlay.remove(); } catch (e) { /* ignore */ }
      resolve(val);
    };

    const okBtn = dialog.querySelector('.confirm-ok');
    const cancelBtn = dialog.querySelector('.confirm-cancel');

    const onOk = (e) => { e.preventDefault(); cleanup(true); };
    const onCancel = (e) => { e.preventDefault(); cleanup(false); };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);

    // close when clicking outside the dialog
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(false);
    });

    // allow ESC to cancel
    const escHandler = (e) => { if (e.key === 'Escape') { cleanup(false); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);
  });
}

// Inisialisasi chat
async function initializeChat() {
  if (isChatInitialized) {
    console.log("Chat sudah diinisialisasi, melewati...");
    return;
  }

  if (!window.currentUser) {
    console.log("Tidak ada pengguna, menonaktifkan chat...");
    disableChat();
    return;
  }

  if (!isValidUuid(window.currentUser.id)) {
    console.error(`Invalid user ID: ${window.currentUser.id}`);
    showToast("Error", "Invalid user ID", "destructive");
    disableChat();
    return;
  }

  // Check database schema support
  await checkDatabaseSchema();

  console.log("Menginisialisasi chat...");
  isChatInitialized = true;

  try {
    const chatInput = document.getElementById("chatInput");
    const sendMessageBtn = document.getElementById("sendMessageBtn");
    const chatMessages = document.getElementById("chatMessages");
    const adminMessages = document.getElementById("adminMessages");

    if (!chatInput || !sendMessageBtn || !chatMessages || !adminMessages) {
      console.error("Elemen DOM tidak ditemukan");
      return;
    }

    // ============================================================
    // [FITUR] TOMBOL SCROLL DOWN DENGAN BADGE NOTIFIKASI
    // ============================================================
    
    // 1. Hapus elemen lama jika ada (untuk mencegah duplikat saat re-init)
    document.getElementById('scrollBottomFab')?.remove();

    // 2. Inject HTML Tombol & Badge
    const fabHtml = `
      <div id="scrollBottomFab" class="absolute bottom-24 right-6 z-50 flex flex-col items-end pointer-events-none opacity-0 transition-all duration-300 transform translate-y-10">
          <button id="btnScrollBottom" class="pointer-events-auto relative group bg-slate-800 hover:bg-slate-700 text-slate-200 w-10 h-10 rounded-full shadow-xl flex items-center justify-center border border-slate-600 transition-all duration-200 active:scale-95">
              <i data-lucide="chevron-down" class="h-6 w-6"></i>
              
              <div id="scrollUnreadBadge" class="absolute -top-2 -left-2 bg-teal-500 text-white text-[11px] font-bold h-5 min-w-[1.25rem] px-1.5 rounded-full flex items-center justify-center shadow-md border-2 border-slate-900 transform scale-0 transition-transform duration-200 z-10">
                  0
              </div>
          </button>
      </div>
    `;
    
    // Pastikan parent memiliki posisi relative agar tombol absolute bekerja
    chatMessages.parentElement.style.position = 'relative';
    chatMessages.parentElement.insertAdjacentHTML('beforeend', fabHtml);
    lucide.createIcons();

    // 3. Variable State
    const fabContainer = document.getElementById('scrollBottomFab');
    const btnScrollBottom = document.getElementById('btnScrollBottom');
    const badgeEl = document.getElementById('scrollUnreadBadge');
    let unreadBelowCount = 0; // Penghitung pesan baru

    // 4. Helper: Update Tampilan Badge
    const updateBadgeUI = () => {
        // Update angka
        badgeEl.textContent = unreadBelowCount > 99 ? '99+' : unreadBelowCount;
        
        // Animasi Scale: Jika 0 hide, jika > 0 show
        if (unreadBelowCount > 0) {
            badgeEl.classList.remove('scale-0');
            badgeEl.classList.add('scale-100');
            
            // Efek visual tambahan agar tombol terlihat menonjol saat ada pesan
            btnScrollBottom.classList.add('border-teal-500/50');
        } else {
            badgeEl.classList.remove('scale-100');
            badgeEl.classList.add('scale-0');
            btnScrollBottom.classList.remove('border-teal-500/50');
        }
    };

    // 5. Helper: Show/Hide Tombol Utama
    const toggleFab = (show) => {
        if (show) {
            fabContainer.classList.remove('opacity-0', 'translate-y-10');
            fabContainer.classList.add('opacity-100', 'translate-y-0');
        } else {
            fabContainer.classList.add('opacity-0', 'translate-y-10');
            fabContainer.classList.remove('opacity-100', 'translate-y-0');
            // Jika tombol hilang (berarti user di bawah), reset counter
            if (unreadBelowCount > 0) {
                unreadBelowCount = 0;
                updateBadgeUI();
            }
        }
    };

    // 6. Event Listener: Klik Tombol -> Scroll ke Bawah & Reset
    btnScrollBottom.addEventListener('click', () => {
        chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
        unreadBelowCount = 0;
        updateBadgeUI();
        // Tombol akan hilang otomatis karena event 'scroll' di bawah akan mendeteksi kita sudah di bawah
    });

    // 7. Event Listener: Deteksi Scroll Manual User
    chatMessages.addEventListener('scroll', () => {
        // Toleransi 100px dari bawah dianggap "Sudah di Bawah"
        const isAtBottom = chatMessages.scrollHeight - chatMessages.scrollTop <= chatMessages.clientHeight + 100;
        
        if (isAtBottom) {
            // User sudah di bawah, sembunyikan tombol & reset counter
            toggleFab(false);
            unreadBelowCount = 0;
            updateBadgeUI();
        } else {
            // User sedang scroll ke atas, tampilkan tombol
            toggleFab(true);
        }
    });

    // ============================================================


    const profile = await fetchUserProfile(window.currentUser.id);
    window.currentUser.profile = profile;

    chatInput.disabled = false;
    sendMessageBtn.disabled = false;
    chatInput.placeholder = "Type your message....";

    // --- HEARTBEAT SYSTEM ---
    const updateOnlineStatusDB = async (status) => {
        try {
          if (!window.currentUser?.id) return;
          await supabase.from('profiles').update({ 
            is_online: status,
            last_seen: new Date().toISOString()
          }).eq('id', window.currentUser.id);
        } catch (e) { console.warn('Heartbeat error:', e); }
    };
    updateOnlineStatusDB(true);
    if (window.onlineHeartbeat) clearInterval(window.onlineHeartbeat);
    window.onlineHeartbeat = setInterval(() => { updateOnlineStatusDB(true); }, 30000); 
    window.addEventListener('beforeunload', () => { try { presenceChannel.untrack(); } catch (e) {} });

    // Load Admin Messages
    const { data: adminData, error: adminError } = await supabase
      .from("admin_messages")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(10);
    if (adminError) throw adminError;

    adminMessagesList = adminData || [];
    adminMessages.innerHTML = "";
    for (const msg of adminMessagesList) {
      await appendAdminMessage(msg);
    }

    // Load Chat Messages (Cache)
    const cached = JSON.parse(localStorage.getItem("chatMessages") || "[]");
    messagesList = cached;
    chatMessages.innerHTML = ""; 
    for (const msg of messagesList) {
      await appendMessage(msg, false);
    }

    // Load Chat Messages (Server)
    const { data, error } = await supabase
      .from("messages")
      .select("*, profiles(full_name, avatar_url)")
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) throw error;

    const localDeletedKey = `deleted_for_${window.currentUser.id}`;
    const localDeletedRaw = localStorage.getItem(localDeletedKey);
    const localDeleted = localDeletedRaw ? JSON.parse(localDeletedRaw) : [];

    messagesList = (data || []).filter(m => !localDeleted.includes(m.id));
    localStorage.setItem("chatMessages", JSON.stringify(messagesList));
    
    chatMessages.innerHTML = "";
    for (const msg of messagesList) {
      await appendMessage(msg, false);
    }

    // Force scroll to bottom on init
    setTimeout(() => {
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }, 100); 

    // Channels Setup
    const adminChannel = supabase
      .channel("realtime-admin-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_messages" }, async (payload) => {
          const msg = payload.new;
          if (adminMessagesList.some(existingMsg => existingMsg.id === msg.id)) return;
          adminMessagesList.push(msg);
          await appendAdminMessage(msg);
          showToast("Info", "New admin message", "default");
      })
      .subscribe();
    supabaseChannels.push(adminChannel);

    try {
      const updateChannel = await subscribeToMessageUpdates();
      if (updateChannel) supabaseChannels.push(updateChannel);
    } catch (error) { console.error('Failed to subscribe to message updates:', error); }

    // Message Read Status Logic
    messagesList.forEach(msg => {
      if (msg.user_id === window.currentUser?.id && !msg.is_read) {
        const readStatusChannel = supabase.channel(`message-${msg.id}`);
        readStatusChannel.on('broadcast', { event: 'message_read' }, (payload) => {
            handleMessageRead(payload.payload.message_id, payload.payload.read_by, payload.payload.read_at);
        }).subscribe();
        supabaseChannels.push(readStatusChannel);
      }
    });

    const messagesChannel = supabase
      .channel("realtime-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async (payload) => {
          const msg = payload.new;
          const existingMsgIndex = messagesList.findIndex(m => m.id === msg.id);
          if (existingMsgIndex !== -1) return;

          // ============================================================
          // LOGIKA UTAMA: DETEKSI POSISI SEBELUM APPEND
          // ============================================================
          // Cek apakah user sedang di bawah (toleransi 150px)
          const isUserAtBottom = chatMessages.scrollHeight - chatMessages.scrollTop <= chatMessages.clientHeight + 150;
          
          const profile = await fetchUserProfile(msg.user_id);
          msg.full_name = profile.full_name;
          msg.avatar_url = profile.avatar_url;
          messagesList.push(msg);
          localStorage.setItem("chatMessages", JSON.stringify(messagesList.slice(-100)));
          
          // Render pesan ke DOM
          await appendMessage(msg);

          if (isUserAtBottom) {
             // KONDISI 1: User sedang di bawah
             // Langsung scroll otomatis mengikuti pesan baru
             chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
             
             // Pastikan counter reset karena kita sudah melihat pesan baru
             unreadBelowCount = 0;
             updateBadgeUI();

          } else {
             // KONDISI 2: User sedang scroll ke atas (membaca pesan lama)
             // JANGAN scroll otomatis.
             // Tambahkan Counter Badge.
             
             // Hanya tambah counter jika pesan BUKAN dari diri sendiri
             if (msg.user_id !== window.currentUser.id) {
                 unreadBelowCount++;
                 updateBadgeUI();
                 
                 // Pastikan tombol terlihat
                 toggleFab(true);
                 
                 console.log("Pesan masuk saat scroll up. Counter:", unreadBelowCount);
             } else {
                 // Jika pesan dari diri sendiri, paksa scroll ke bawah
                 chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
             }
          }
          // ============================================================

          if (Array.isArray(msg.mentions) && msg.mentions.includes(window.currentUser?.id)) {
            showToast("Info", `${msg.full_name} mentioned you!`, "default");
          }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, async (payload) => {
          const updatedMsg = payload.new;
          const index = messagesList.findIndex(msg => msg.id === updatedMsg.id);
          if (index !== -1) {
            const profile = await fetchUserProfile(updatedMsg.user_id);
            updatedMsg.full_name = profile.full_name;
            updatedMsg.avatar_url = profile.avatar_url;
            messagesList[index] = { ...messagesList[index], ...updatedMsg };
            localStorage.setItem("chatMessages", JSON.stringify(messagesList.slice(-100)));
            await appendMessage(messagesList[index], true);
          }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, async (payload) => {
          const deleted = payload.old;
          if (!deleted || !deleted.id) return;
          const idx = messagesList.findIndex(m => m.id === deleted.id);
          if (idx !== -1) {
            messagesList.splice(idx, 1);
            localStorage.setItem("chatMessages", JSON.stringify(messagesList.slice(-100)));
          }
          const el = document.querySelector(`[data-message-id="${deleted.id}"]`);
          if (el) {
            el.style.transition = 'opacity 180ms ease, transform 180ms ease';
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 200);
          }
      })
      .subscribe();
    supabaseChannels.push(messagesChannel);

    // Presence Logic (Sama seperti sebelumnya)
    const presenceChannel = supabase
      .channel("presence", { config: { presence: { key: window.currentUser?.id } } })
      .on("presence", { event: "sync" }, async () => {
        const state = presenceChannel.presenceState();
        const users = Object.values(state).flat();
        const filteredUsers = users.filter(p => p.user_id !== window.currentUser?.id);
        
        const typingUsers = filteredUsers.filter(user => user.isTyping);
        const typingIndicator = document.getElementById("typingIndicator");
        if (typingIndicator) {
          if (typingUsers.length > 0) {
            typingIndicator.classList.remove("hidden");
            typingIndicator.querySelector("span").textContent = `${typingUsers[0].full_name} sedang mengetik...`;
          } else {
            typingIndicator.classList.add("hidden");
          }
        }

        onlineUsers = filteredUsers.map(user => ({
          user_id: user.user_id,
          full_name: user.full_name,
          avatar_url: user.avatar_url,
          isTyping: user.isTyping,
        }));
        updateOnlineUsers(onlineUsers);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
            await presenceChannel.track({
              user_id: window.currentUser.id,
              full_name: window.currentUser.profile.full_name,
              avatar_url: window.currentUser.profile.avatar_url,
              isTyping: false,
              online_at: new Date().toISOString()
            });
            if (presenceInterval) clearInterval(presenceInterval);
            presenceInterval = setInterval(() => {
              try {
                const st = presenceChannel.presenceState();
                const usersNow = Object.values(st).flat().map(p => ({
                  user_id: p.user_id,
                  full_name: p.full_name,
                  avatar_url: p.avatar_url,
                  isTyping: p.isTyping
                }));
                updateOnlineUsers(usersNow.filter(u => u.user_id !== window.currentUser.id));
              } catch (e) {}
            }, 8000);
        }
      });
    
    window.addEventListener('beforeunload', () => { try { presenceChannel.untrack(); } catch (e) {} });
    supabaseChannels.push(presenceChannel);

    updateConnectionLatency();
    latencyInterval = setInterval(updateConnectionLatency, 10000);

    bindEventListeners();

  } catch (err) {
    console.error("Inisialisasi chat gagal:", err);
    disableChat();
    isChatInitialized = false;
  }
}

      // Fungsi nonaktifkan chat
      function disableChat() {
        const chatInput = document.getElementById("chatInput");
        const sendMessageBtn = document.getElementById("sendMessageBtn");
        const chatMessages = document.getElementById("chatMessages");

        if (chatInput) {
          chatInput.disabled = true;
          chatInput.placeholder = "Login to chat...";
        }

        if (sendMessageBtn) {
          sendMessageBtn.disabled = true;
          sendMessageBtn.classList.add("opacity-50", "cursor-not-allowed");
        }

        if (chatMessages) {
          chatMessages.innerHTML = `
            <div class="text-center text-slate-400 py-4">Silakan login untuk mengakses chat</div>
        `;
        }
      }



      // Event listener untuk navigasi halaman
      function handlePageNavigation() {
        const navCommunications = document.getElementById("navCommunications");
        if (navCommunications) {
          const navigateHandler = () => {
            console.log("Navigasi ke halaman Communications, menginisialisasi chat...");
            cleanupChat();
            setTimeout(initializeChat, 100);
          };
          navCommunications.addEventListener("click", navigateHandler, { once: true });
          eventListeners.push({ element: navCommunications, event: "click", handler: navigateHandler });
        }
      }

      // Event listener DOM loaded
      document.addEventListener("DOMContentLoaded", () => {
        console.log("DOM loaded, memulai inisialisasi...");
        lucide.createIcons();
        handlePageNavigation();
        // Tambahkan penundaan kecil untuk memastikan DOM benar-benar siap
        setTimeout(() => {
          initializeChat().catch(err => {
            console.error("Gagal inisialisasi chat di DOMContentLoaded:", err);
            showToast("Error", "Failed to load chat, please try again", "destructive");
          });
        }, 100);
      });
