/** @format */

// START: Polyfill untuk fitur navigator.locks (jika belum didukung oleh browser)
if (!navigator.locks) {
  navigator.locks = {
    request: async (name, options, callback) => {
      if (typeof options === "function") {
        callback = options;
        options = {};
      }
      await callback({});
    },
    query: async () => ({ held: [], pending: [] }),
  };
}
// END: Polyfill untuk fitur navigator.locks

// START: Polyfill untuk fitur crypto.randomUUID
if (!crypto.randomUUID) {
  crypto.randomUUID = function () {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
      ""
    );
  };
}
// END: Polyfill untuk fitur crypto.randomUUID

// --- ROUTING CONFIGURATION ---
const routeMap = {
  dashboard: "pageDashboard",
  booster: "pageBooster",
  network: "pagenetwork", // ID di HTML anda 'pagenetwork' (kecil semua)
  "data-center": "pageDataCenter",
  security: "pageSecurity",
  leaderboard: "pageLeaderboard",
  communications: "pageCommunications",
  settings: "pageSettings",
};

// Helper untuk mencari key berdasarkan value (ID -> Slug)
function getSlugByPageId(pageId) {
  return (
    Object.keys(routeMap).find((key) => routeMap[key] === pageId) || "dashboard"
  );
}

// START: Elemen DOM untuk berbagai fitur
const loadingOverlay = document.getElementById("loadingOverlay");
const authModal = document.getElementById("authModal");
const authTitle = document.getElementById("authTitle");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const emailAuthBtn = document.getElementById("emailAuthBtn");
const googleAuthBtn = document.getElementById("googleAuthBtn");
const metamaskAuthBtn = document.getElementById("metamaskAuthBtn");
const phantomAuthBtn = document.getElementById("phantomAuthBtn");
const okxAuthBtn = document.getElementById("okxAuthBtn");
const toggleAuthBtn = document.getElementById("toggleAuthBtn");

const userSection = document.getElementById("userSection");
const loginBtn = document.getElementById("loginBtn");
const userProfile = document.getElementById("userProfile");
const userEmail = document.getElementById("userEmail");
const userWallet = document.getElementById("userWallet");
const userPoints = document.getElementById("userPoints");
const userBooster = document.getElementById("userBooster");
const deviceScoreEl = document.getElementById("deviceScore");
const toggleMiningBtn = document.getElementById("toggleMiningBtn");
const miningStatus = document.getElementById("miningStatus");
const currentPoints = document.getElementById("currentPoints");
const currentDeviceScore = document.getElementById("currentDeviceScore");
const currentBooster = document.getElementById("currentBooster");
const systemStatusEl = document.getElementById("systemStatus");
const cpuUsageEl = document.getElementById("cpuUsage");
const memoryUsageEl = document.getElementById("memoryUsage");
const networkStatusEl = document.getElementById("networkStatus");
const securityLevelEl = document.getElementById("securityLevel");
const systemLoad = document.getElementById("systemLoad");
const systemTime = document.getElementById("systemTime");
const systemDate = document.getElementById("systemDate");
const tabPerformance = document.getElementById("tabPerformance");
const tabProcesses = document.getElementById("tabProcesses");
const tabStorage = document.getElementById("tabStorage");
const performanceTab = document.getElementById("performanceTab");
const processesTab = document.getElementById("processesTab");
const storageTab = document.getElementById("storageTab");
const performanceChart = document.getElementById("performanceChart");
const navDashboard = document.getElementById("navDashboard");
const navBooster = document.getElementById("navBooster");
const navLeaderboard = document.getElementById("navLeaderboard");
const navSettings = document.getElementById("navSettings");
const pageDashboard = document.getElementById("pageDashboard");
const pageBooster = document.getElementById("pageBooster");
const pageLeaderboard = document.getElementById("pageLeaderboard");
const pageSettings = document.getElementById("pageSettings");
const profilePictureInput = document.getElementById("profilePictureInput");
const profilePicturePreview = document.getElementById("profilePicturePreview");
const changeProfilePictureBtn = document.getElementById(
  "changeProfilePictureBtn"
);
const sidebarProfilePicture = document.getElementById("sidebarProfilePicture");
const fullNameInput = document.getElementById("fullNameInput");
const walletAddressInput = document.getElementById("walletAddressInput");
const saveProfileBtn = document.getElementById("saveProfileBtn");
const emailDisplay = document.getElementById("emailDisplay");
const currentPasswordInput = document.getElementById("currentPasswordInput");
const newPasswordInput = document.getElementById("newPasswordInput");
const confirmNewPasswordInput = document.getElementById(
  "confirmNewPasswordInput"
);
const changePasswordBtn = document.getElementById("changePasswordBtn");
const deleteAccountBtn = document.getElementById("deleteAccountBtn");
const deleteAccountModal = document.getElementById("deleteAccountModal");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
// Added for Security page
const navSecurity = document.getElementById("navSecurity");
const pageSecurity = document.getElementById("pageSecurity");
// Added for Communications page
const navCommunications = document.getElementById("navCommunications");
const pageCommunications = document.getElementById("pageCommunications");

const fullNameGroup = document.getElementById("fullNameGroup");
const referralCodeGroup = document.getElementById("referralCodeGroup");
// END: Elemen DOM untuk berbagai fitur

// START: Inisialisasi ikon Lucide
lucide.createIcons();
// END: Inisialisasi ikon Lucide

// LISTENER: Tombol Back/Forward Browser
window.addEventListener("popstate", (event) => {
  // Ambil hash dari URL (misal: #/network)
  const hash = window.location.hash.replace("#/", "");

  // Konversi slug URL kembali ke nama variabel page
  let pageName = hash || "dashboard";

  // Normalisasi nama (misal data-center -> dataCenter)
  if (pageName === "data-center") pageName = "dataCenter";

  // Panggil showPage dengan false agar tidak pushState lagi (looping)
  showPage(pageName, false);
});

// LISTENER: Saat Halaman Pertama Kali Dimuat (Refresh)
// Cari kode: showPage("dashboard"); di bagian bawah checkUser atau init
// GANTI dengan logika ini:

function handleInitialLoad() {
  const hash = window.location.hash.replace("#/", "");
  let pageName = hash || "dashboard";
  if (pageName === "data-center") pageName = "dataCenter";

  // Cek apakah user login sebelum membuka halaman sensitif
  const protectedPages = [
    "booster",
    "network",
    "dataCenter",
    "security",
    "leaderboard",
    "communications",
    "settings",
  ];

  if (protectedPages.includes(pageName) && !window.currentUser) {
    // Jika belum login tapi mau akses halaman dalam, redirect ke dashboard & buka modal login
    showPage("dashboard", false);
    if (authModal) authModal.style.display = "flex";
  } else {
    showPage(pageName, false);
  }
}

(async () => {
  // START: Variabel state
  let theme = "dark";
  let systemStatus = 85;
  let cpuUsage = 42;
  let memoryUsage = 68;
  let networkStatus = 92;
  let securityLevel = 75;
  let isMining = false;
  let miningInterval = null;
  let points = 0;
  let deviceScore = 0;
  let boosterSpeed = 1;
  let user = null;
  let isLogin = true;
  let currentPage = "dashboard";
  let isSyncing = false;
  // END: Variabel state

  // Performance chart
  let performanceData = {
    cpu: Array(20)
      .fill(0)
      .map(() => Math.random() * 100),
    memory: Array(20)
      .fill(0)
      .map(() => Math.random() * 100),
    network: Array(20)
      .fill(0)
      .map(() => Math.random() * 100),
  };

  function updatePerformanceChart() {
    performanceData.cpu.shift();
    performanceData.cpu.push(cpuUsage);
    performanceData.memory.shift();
    performanceData.memory.push(memoryUsage);
    performanceData.network.shift();
    performanceData.network.push(networkStatus);
    performanceChart.innerHTML = "";
    const maxPoints = 20;
    const barWidth = 100 / maxPoints;
    for (let i = 0; i < maxPoints; i++) {
      const cpuHeight = (performanceData.cpu[i] / 100) * 100;
      const memoryHeight = (performanceData.memory[i] / 100) * 100;
      const networkHeight = (performanceData.network[i] / 100) * 100;
      const div = document.createElement("div");
      div.className = "flex flex-col justify-end items-center";
      div.style.width = `${barWidth}%`;
      div.innerHTML = `
                <div class="w-1/3 bg-cyan-500/50 rounded-t-sm" style="height: ${cpuHeight}%"></div>
                <div class="w-1/3 bg-purple-500/50 rounded-t-sm" style="height: ${memoryHeight}%"></div>
                <div class="w-1/3 bg-blue-500/50 rounded-t-sm" style="height: ${networkHeight}%"></div>
            `;
      performanceChart.appendChild(div);
    }
  }

  // Tab switching
  tabPerformance.addEventListener("click", () => {
    tabPerformance.classList.add("text-cyan-400", "bg-slate-700");
    tabProcesses.classList.remove("text-cyan-400", "bg-slate-700");
    tabStorage.classList.remove("text-cyan-400", "bg-slate-700");
    performanceTab.classList.remove("hidden");
    processesTab.classList.add("hidden");
    storageTab.classList.add("hidden");
  });
  tabProcesses.addEventListener("click", () => {
    tabProcesses.classList.add("text-cyan-400", "bg-slate-700");
    tabPerformance.classList.remove("text-cyan-400", "bg-slate-700");
    tabStorage.classList.remove("text-cyan-400", "bg-slate-700");
    processesTab.classList.remove("hidden");
    performanceTab.classList.add("hidden");
    storageTab.classList.add("hidden");
  });
  tabStorage.addEventListener("click", () => {
    tabStorage.classList.add("text-cyan-400", "bg-slate-700");
    tabPerformance.classList.remove("text-cyan-400", "bg-slate-700");
    tabProcesses.classList.remove("text-cyan-400", "bg-slate-700");
    storageTab.classList.remove("hidden");
    performanceTab.classList.add("hidden");
    processesTab.classList.add("hidden");
  });

  // Hitung skor perangkat pengguna
  function calculateDeviceScore() {
    const cores = navigator.hardwareConcurrency || 4;
    const memory = (navigator.deviceMemory || 4) * 1024;
    const isHighPerformance = window.matchMedia(
      "(prefers-reduced-motion: no-preference)"
    ).matches;

    deviceScore = (cores * 10 + memory / 100) * (isHighPerformance ? 1.2 : 1);
    deviceScore = Math.min(deviceScore, 100);

    if (currentDeviceScore) {
      currentDeviceScore.textContent = deviceScore.toFixed(2);
    }
  }

  // Fungsi untuk sinkronkan poin ke Supabase (DIPERBAIKI - Hapus Typo 's')
  async function syncPointsToSupabase() {
    // 1. Cek Validasi: Jangan sync jika sedang sync, user kosong, atau poin error (NaN)
    if (
      isSyncing ||
      !window.currentUser ||
      typeof points !== "number" ||
      isNaN(points)
    )
      return;

    isSyncing = true;
    try {
      // 2. LANGSUNG UPDATE (Tanpa Select/Fetch dulu)
      const { data, error } = await supabase
        .from("profiles")
        .update({
          points: points,
          updated_at: new Date().toISOString(),
        })
        .eq("id", window.currentUser.id)
        .select(); // Return data untuk memastikan update sukses

      // 3. Handle jika Update Gagal (Misal profil belum ada di database)
      if (error || !data || data.length === 0) {
        console.warn(
          "[SYNC] Update failed or profile missing. Attempting recovery..."
        );

        // Cek apakah error karena profil benar-benar tidak ada
        const { data: checkUser, error: checkError } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", window.currentUser.id)
          .single();

        // Jika profil tidak ada, buat profil baru (INSERT)
        if (!checkUser) {
          const { error: insertError } = await supabase
            .from("profiles")
            .insert({
              id: window.currentUser.id,
              email: window.currentUser.email || "",
              points: points, // Gunakan poin yang sudah didapat
              wallet_address:
                window.currentUser.profile?.wallet_address || null,
              avatar_url: null,
              full_name:
                window.currentUser.user_metadata?.full_name ||
                window.currentUser.email?.split("@")[0],
              booster: "none",
              referral_code: window.currentUser.profile?.referral_code || "",
              mining_speed: 0,
              invited_users: 0,
            });

          if (insertError) throw insertError;
          console.log(
            `[SYNC] Created missing profile for user ${window.currentUser.id}`
          );
        } else if (error) {
          throw error; // Lempar error jika bukan masalah profil hilang
        }
      }

      // --- TYPO 's' SUDAH DIHAPUS DARI SINI ---

      console.log(`[SYNC] Points synced to Supabase: ${points.toFixed(2)}`);

      // 4. Update localStorage segera setelah sukses
      localStorage.setItem("mining_points", points.toString());
    } catch (error) {
      console.error("[SYNC] Error syncing points:", error.message);
      // PENTING: Jangan reset points lokal ke 0 jika error.
      // Simpan ke localStorage agar progres tetap aman di browser.
      localStorage.setItem("mining_points", points.toString());
    } finally {
      isSyncing = false;
    }
  }

  // Tambahkan variabel dan fungsi tambahan di luar fungsi utama
  const pickaxeIcon = document.getElementById("pickaxe-icon");

  function togglePickaxeAnimation(start = true) {
    if (!pickaxeIcon) return;

    if (start) {
      pickaxeIcon.classList.add("animate-swing");
    } else {
      pickaxeIcon.classList.remove("animate-swing");
    }
  }

  function startMining() {
    if (!window.currentUser?.profile) {
      showToast(
        "Error",
        "Please login and ensure profile is loaded",
        "destructive"
      );
      const authModal = document.getElementById("authModal");
      if (authModal) authModal.style.display = "flex";
      return;
    }

    isMining = true;

    // --- GANTI BAGIAN INI ---
    // Panggil fungsi UI baru untuk mengubah tombol jadi "Stop" (Merah)
    updateMiningButtonUI(true);
    // ------------------------

    miningInterval = setInterval(async () => {
      // ... (Logika hitung poin TETAP SAMA, jangan diubah) ...
      const referralSpeed = window.currentUser.profile.mining_speed || 0;
      const activeBooster = window.currentUser.profile.booster;
      const boosterSpeedBonus = activeBooster
        ? boosterConfig[activeBooster]?.speed || 0
        : 0;
      const totalMiningSpeed = 1 + referralSpeed + boosterSpeedBonus;
      const basePoints = (deviceScore / 100) * totalMiningSpeed;

      points += basePoints;
      pointsSnapshot[window.currentUser.id] = points;
      pointsLastUpdated[window.currentUser.id] = new Date();

      console.log(
        `[MINING] Total: ${totalMiningSpeed}x -> Points: ${points.toFixed(2)}`
      );

      if (userPoints) userPoints.textContent = points.toFixed(2);
      if (currentPoints) currentPoints.textContent = points.toFixed(2);

      await syncPointsToSupabase();
    }, 5000);

    togglePickaxeAnimation(true);
  }

  function stopMining() {
    isMining = false;

    // --- GANTI BAGIAN INI ---
    // Panggil fungsi UI baru untuk mengubah tombol kembali ke "Start" (Cyan)
    updateMiningButtonUI(false);
    // ------------------------

    if (miningInterval) {
      clearInterval(miningInterval);
      miningInterval = null;
    }

    syncPointsToSupabase();
    togglePickaxeAnimation(false);
  }

  // Enhanced Mining Toggle Button with Elegant UI
  toggleMiningBtn.addEventListener("click", (e) => {
    const ripple = document.createElement("span");
    ripple.className = "mining-ripple";
    ripple.style.left = `${
      e.clientX - e.target.getBoundingClientRect().left
    }px`;
    ripple.style.top = `${e.clientY - e.target.getBoundingClientRect().top}px`;
    e.target.appendChild(ripple);

    setTimeout(() => ripple.remove(), 600);

    if (isMining) {
      toggleMiningBtn.classList.add("stopping");
      setTimeout(() => {
        stopMining();
        toggleMiningBtn.classList.remove("stopping");
        toggleMiningBtn.classList.add("starting");
        setTimeout(() => toggleMiningBtn.classList.remove("starting"), 300);
      }, 200);
    } else {
      toggleMiningBtn.classList.add("starting");
      setTimeout(() => {
        startMining();
        toggleMiningBtn.classList.remove("starting");
      }, 200);
    }
  });

  // === INISIALISASI SAAT HALAMAN SIAP ===
  // === INISIALISASI SAAT HALAMAN SIAP (DIPERBAIKI) ===
  document.addEventListener("DOMContentLoaded", async () => {
    // 1. Hitung skor device dulu
    if (typeof calculateDeviceScore === "function") calculateDeviceScore();

    // 2. Ambil poin dari localStorage untuk tampilan INSTAN (agar tidak 0 dulu)
    const storedPoints = localStorage.getItem("mining_points");
    // Pastikan poin adalah angka (float), jika rusak set ke 0
    points =
      storedPoints && !isNaN(parseFloat(storedPoints))
        ? parseFloat(storedPoints)
        : 0;

    console.log(`[INIT] Points loaded from LocalStorage: ${points}`);

    // Update UI awal
    if (typeof userPoints !== "undefined" && userPoints)
      userPoints.textContent = points.toFixed(2);
    if (typeof currentPoints !== "undefined" && currentPoints)
      currentPoints.textContent = points.toFixed(2);

    // 3. Cek User ke Database (ini akan mengambil poin terbaru dari DB jika ada)
    await checkUser();

    // 4. Inisialisasi Booster (setelah checkUser selesai mengambil profil)
    if (window.currentUser && window.currentUser.profile) {
      boosterSpeed = window.currentUser.profile.booster
        ? boosterConfig[window.currentUser.profile.booster]?.speed || 1
        : 1;

      // Hapus pemanggilan syncPointsToSupabase() di sini.
      // Alasan: checkUser baru saja mengambil data terbaru.
      // Kita tidak perlu langsung push balik ke server kecuali kita mulai mining.
    }
  });

  // Helper untuk Update Tampilan Tombol Mining (Supaya Ikon tidak hilang)
  function updateMiningButtonUI(isActive) {
    const btn = document.getElementById("toggleMiningBtn");
    const statusLabel = document.getElementById("miningStatus");

    if (!btn) return;

    if (isActive) {
      // --- TAMPILAN SAAT MINING AKTIF (TOMBOL STOP) ---

      // 1. Ganti Class Warna (Jadi Merah/Rose)
      btn.className =
        "w-full bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white rounded-lg py-3 px-4 font-medium transition-all hover:shadow-lg hover:shadow-rose-500/30 flex items-center justify-center group btn-mining-stop";

      // 2. Ganti Isi HTML (Ikon Stop + Teks)
      btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
            <span class="tracking-wide">Stop Mining</span>
            <span class="ml-2 flex h-2 w-2 relative">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
        `;

      // 3. Update Label Status Kecil (di atas tombol)
      if (statusLabel) {
        statusLabel.innerHTML = `
                <span class="w-2 h-2 mr-2 rounded-full bg-green-400 animate-pulse"></span>
                Running...
            `;
        statusLabel.className =
          "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/30";
      }
    } else {
      // --- TAMPILAN SAAT MINING MATI (TOMBOL START) ---

      // 1. Kembalikan Class Warna (Cyan/Biru)
      btn.className =
        "w-full bg-gradient-to-r from-cyan-600/90 to-cyan-700 hover:from-cyan-500/90 hover:to-cyan-600/90 text-white rounded-lg py-3 px-4 font-medium transition-all hover:shadow-lg hover:shadow-cyan-500/30 flex items-center justify-center group btn-mining-start";

      // 2. Ganti Isi HTML (Ikon Kapak + Teks)
      btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 group-hover:-translate-y-0.5 group-hover:rotate-12 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span class="tracking-wide">Start Mining</span>
        `;

      // 3. Update Label Status Kecil
      if (statusLabel) {
        statusLabel.innerHTML = `
                <span class="w-2 h-2 mr-2 rounded-full bg-slate-500"></span>
                Ready
            `;
        statusLabel.className =
          "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-800/50 text-slate-400 border border-slate-700/50";
      }
    }
  }

  // --- TAMBAHKAN INI DI All System & Auth.js ---

  // Event Listener Khusus untuk sinkronisasi Poin dari Task/Claim
  window.addEventListener("pointsUpdatedFromTask", (e) => {
    if (e.detail && typeof e.detail.newPoints === "number") {
      console.log(
        "[MINING SYNC] Menerima update poin dari Task:",
        e.detail.newPoints
      );

      // 1. Update variabel lokal mining
      points = parseFloat(e.detail.newPoints);

      // 2. Simpan ke localStorage agar aman saat refresh
      localStorage.setItem("mining_points", points.toString());

      // 3. Update UI Mining segera
      const userPointsEl = document.getElementById("userPoints");
      const currentPointsEl = document.getElementById("currentPoints");
      if (userPointsEl) userPointsEl.textContent = points.toFixed(2);
      if (currentPointsEl) currentPointsEl.textContent = points.toFixed(2);

      // 4. (Opsional) Reset snapshot snapshot mining agar tidak double sync
      if (window.pointsSnapshot) {
        window.pointsSnapshot[window.currentUser.id] = points;
      }
    }
  });

  // START: Fungsi checkUser (versi perbaikan)
  async function checkUser() {
    try {
      console.log("Memulai pengecekan pengguna...");
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      if (session && session.user) {
        const user = session.user;
        console.log("Pengguna ditemukan:", user);

        window.currentUser = user;

        // Ambil profil pengguna
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select(
            "id, email, points, wallet_address, avatar_url, full_name, booster, referral_code, mining_speed, invited_users"
          )
          .eq("id", user.id)
          .single();

        if (profileError) {
          if (profileError.code === "PGRST116") {
            // Profil belum ada → buat profil baru
            console.log("Profil tidak ditemukan. Membuat profil baru...");

            const fullName =
              user.user_metadata.full_name || user.email.split("@")[0];
            const generatedReferralCode = await generateReferralCode();

            // Gunakan nilai points dari localStorage atau default 0
            const initialPoints =
              parseInt(localStorage.getItem("mining_points")) || 0;

            const { error: insertError } = await supabase
              .from("profiles")
              .insert({
                id: user.id,
                email: user.email,
                points: initialPoints,
                wallet_address: null,
                avatar_url: null,
                full_name: fullName,
                booster: 0,
                referral_code: generatedReferralCode,
                mining_speed: 0,
                invited_users: 0,
              });

            if (insertError) throw insertError;

            // Ambil kembali profil setelah dibuat
            const { data: newProfile } = await supabase
              .from("profiles")
              .select(
                "id, email, points, wallet_address, avatar_url, full_name, booster, referral_code, mining_speed, invited_users"
              )
              .eq("id", user.id)
              .single();

            window.currentUser.profile = newProfile;

            points = newProfile.points; // Update variabel global points
            localStorage.setItem("mining_points", points.toString());
          } else {
            // Error lain selain PGRST116
            throw profileError;
          }
        } else {
          // Profil ditemukan → gunakan datanya
          window.currentUser.profile = profileData;
          points =
            profileData.points !== undefined ? profileData.points : points || 0;
          localStorage.setItem("mining_points", points.toString());
          console.log(`Points loaded from Supabase: ${points}`);
        }

        console.log("Data profil lengkap:", window.currentUser.profile);

        // Setup realtime subscription
        // Setup realtime subscription (DIPERBAIKI)
        const channel = supabase
          .channel(`profiles:${user.id}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "profiles",
              filter: `id=eq.${user.id}`,
            },
            (payload) => {
              // console.log('Realtime update received:', payload); // Debugging opsional
              const updatedProfile = payload.new;

              // === LOGIKA PENTING ===
              // Hanya terima update poin dari server JIKA user TIDAK sedang mining.
              // Jika sedang mining, browserlah yang paling benar (master), abaikan server (slave).
              if (
                !isMining &&
                updatedProfile.points !== undefined &&
                updatedProfile.points !== null
              ) {
                points = parseFloat(updatedProfile.points);
                localStorage.setItem("mining_points", points.toString());

                // Update Tampilan Poin
                if (typeof userPoints !== "undefined" && userPoints)
                  userPoints.textContent = points.toFixed(2);
                if (typeof currentPoints !== "undefined" && currentPoints)
                  currentPoints.textContent = points.toFixed(2);
                console.log(
                  "[REALTIME] Points updated from server (Mining inactive)"
                );
              } else if (isMining) {
                console.log(
                  "[REALTIME] Server update ignored because Mining is ACTIVE (Preventing Reset)"
                );
              }

              // Selalu update data lain (seperti avatar/nama) meskipun sedang mining
              if (window.currentUser && window.currentUser.profile) {
                window.currentUser.profile = {
                  ...window.currentUser.profile,
                  ...updatedProfile,
                  // Pertahankan poin lokal jika sedang mining
                  points: isMining ? points : updatedProfile.points,
                };
              }
            }
          )
          .subscribe();

        // Hapus channel saat halaman ditutup
        window.addEventListener("beforeunload", () => {
          supabase.removeChannel(channel);
        });

        updateUI();
        authModal.style.display = "none";
        showPage("dashboard");
      } else {
        // Tidak ada session aktif
        window.currentUser = null;
        console.log("Tidak ada sesi pengguna.");
        updateUI();
        authModal.style.display = "flex";
      }
    } catch (error) {
      console.error("Error dalam checkUser:", error);
      showToast("Error", "Failed to load user profile.", "destructive");
      window.currentUser = null;
      updateUI();
      authModal.style.display = "flex";
    }
  }

  // Elemen UI
  const authModal = document.getElementById("authModal");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const emailAuthBtn = document.getElementById("emailAuthBtn");
  const googleAuthBtn = document.getElementById("googleAuthBtn");
  const metamaskAuthBtn = document.getElementById("metamaskAuthBtn");
  const phantomAuthBtn = document.getElementById("phantomAuthBtn");
  const okxAuthBtn = document.getElementById("okxAuthBtn");
  const registerBtn = document.getElementById("registerBtn");
  const toggleAuthBtn = document.getElementById("toggleAuthBtn");
  const fullNameGroup = document.getElementById("fullNameGroup");
  const referralCodeGroup = document.getElementById("referralCodeGroup");

  // --- PERBAIKAN: Fungsi ini dipindahkan ke lingkup global skrip ---
  function promptForReferralCode() {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className =
        "fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4";

      const modal = document.createElement("div");
      modal.className =
        "bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl shadow-2xl border border-slate-700/50 w-full max-w-sm overflow-hidden transform transition-all scale-95";
      modal.innerHTML = `
            <div class="p-6">
                <h3 class="text-lg font-bold text-slate-100 flex items-center gap-2 mb-4">
                    <i data-lucide="gift" class="w-5 h-5 text-cyan-400"></i>
                    Have a Referral Code?
                </h3>
                <p class="text-sm text-slate-400 mb-4">Enter the code below to get your welcome bonus!</p>
                <input id="modalReferralInput" type="text" class="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500" placeholder="Enter code here...">
                <div class="flex justify-end gap-3 mt-5">
                    <button id="skipBtn" class="px-4 py-2 text-sm font-medium rounded-lg bg-slate-600 text-slate-200 hover:bg-slate-500 transition-colors">Skip</button>
                    <button id="submitBtn" class="px-4 py-2 text-sm font-medium rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition-colors">Submit</button>
                </div>
            </div>
        `;

      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      if (window.lucide) lucide.createIcons();

      setTimeout(() => modal.classList.remove("scale-95"), 10);

      const closeModal = (value) => {
        modal.classList.add("scale-95");
        setTimeout(() => {
          if (document.body.contains(overlay)) {
            document.body.removeChild(overlay);
          }
          resolve(value);
        }, 300);
      };

      modal.querySelector("#submitBtn").addEventListener("click", () => {
        const input = modal.querySelector("#modalReferralInput").value.trim();
        closeModal(input || null);
      });

      modal
        .querySelector("#skipBtn")
        .addEventListener("click", () => closeModal(null));
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal(null);
      });
    });
  }

  // START: Fungsi untuk memperbarui UI
  function updateUI() {
    const referralSpeed = document.getElementById("referralSpeed");
    const userProfile = document.getElementById("userProfile");
    const userSection = document.getElementById("userSection");
    const userEmail = document.getElementById("userEmail");
    const userWallet = document.getElementById("userWallet");
    const userPoints = document.getElementById("userPoints");
    const userBooster = document.getElementById("userBooster");
    const deviceScoreEl = document.getElementById("deviceScore");
    const currentPoints = document.getElementById("currentPoints");
    const currentDeviceScore = document.getElementById("currentDeviceScore");
    const currentBooster = document.getElementById("currentBooster");
    const emailDisplay = document.getElementById("emailDisplay");
    const fullNameInput = document.getElementById("fullNameInput");
    const walletAddressInput = document.getElementById("walletAddressInput");
    const profilePicturePreview = document.getElementById(
      "profilePicturePreview"
    );
    const sidebarProfilePicture = document.getElementById(
      "sidebarProfilePicture"
    );
    const invitedUsersCount = document.getElementById("invitedUsersCount");

    if (!referralSpeed || !userSection || !userProfile) {
      console.error("Required DOM elements not found:", {
        referralSpeed,
        userSection,
        userProfile,
      });
      return;
    }

    console.log("Updating UI...");
    console.log("Current points:", points);

    if (window.currentUser && window.currentUser.profile) {
      user = window.currentUser;
      const boosterSpeed = window.currentUser.profile.booster
        ? boosterConfig[window.currentUser.profile.booster]?.speed || 1
        : 1;

      userProfile.classList.remove("hidden");
      userSection.innerHTML = `
            <div class="flex items-center space-x-2">
                <div class="h-8 w-8 rounded-full bg-slate-700 text-cyan-500 flex items-center justify-center">
                    ${
                      window.currentUser.profile.full_name
                        ? window.currentUser.profile.full_name[0].toUpperCase()
                        : window.currentUser.email[0].toUpperCase()
                    }
                </div>
                <button id="logoutBtn" class="text-slate-100 bg-red-600 hover:bg-red-700 rounded-md px-3 py-1.5 flex items-center">
                    <i data-lucide="log-out" class="h-4 w-4 mr-2"></i> Logout
                </button>
            </div>
        `;

      const logoutBtn = document.getElementById("logoutBtn");
      if (logoutBtn) {
        logoutBtn.addEventListener("click", handleLogout);
        console.log("Logout button event listener added");
      } else {
        console.error("Logout button not found after rendering");
      }

      const speed = window.currentUser.profile.mining_speed || 0;
      referralSpeed.textContent = `${speed}x`;
      referralSpeed.classList.toggle("text-cyan-400", speed > 0);
      referralSpeed.classList.toggle("text-slate-400", speed === 0);

      if (userEmail)
        userEmail.textContent =
          window.currentUser.profile.email || window.currentUser.email;
      if (userWallet)
        userWallet.textContent =
          window.currentUser.profile.wallet_address || "Not set";
      if (userPoints) userPoints.textContent = points.toFixed(2);
      if (userBooster)
        userBooster.textContent = window.currentUser.profile.booster
          ? window.currentUser.profile.booster.charAt(0).toUpperCase() +
            window.currentUser.profile.booster.slice(1)
          : "None";
      if (deviceScoreEl) deviceScoreEl.textContent = deviceScore.toFixed(2);
      if (currentPoints) currentPoints.textContent = points.toFixed(2);
      if (currentDeviceScore)
        currentDeviceScore.textContent = deviceScore.toFixed(2);
      if (currentBooster)
        currentBooster.textContent = window.currentUser.profile.booster
          ? window.currentUser.profile.booster.charAt(0).toUpperCase() +
            window.currentUser.profile.booster.slice(1)
          : "None";
      if (emailDisplay)
        emailDisplay.value =
          window.currentUser.profile.email || window.currentUser.email;
      if (fullNameInput)
        fullNameInput.value = window.currentUser.profile.full_name || "";
      if (walletAddressInput)
        walletAddressInput.value =
          window.currentUser.profile.wallet_address || "";
      if (invitedUsersCount)
        invitedUsersCount.textContent =
          window.currentUser.profile.invited_users || 0;

      if (window.currentUser.profile.avatar_url) {
        const { data: avatarData, error: avatarError } = supabase.storage
          .from("avatars")
          .getPublicUrl(window.currentUser.profile.avatar_url);
        if (avatarError) {
          console.error("Avatar fetch error:", avatarError);
        } else if (avatarData.publicUrl) {
          if (profilePicturePreview)
            profilePicturePreview.innerHTML = `<img src="${avatarData.publicUrl}" class="h-24 w-24 rounded-full object-cover" alt="Profile" />`;
          if (sidebarProfilePicture)
            sidebarProfilePicture.innerHTML = `<img src="${avatarData.publicUrl}" class="h-12 w-12 rounded-full object-cover" alt="Profile" />`;
        }
      }

      lucide.createIcons();
      if (authModal) authModal.style.display = "none";
    } else {
      userProfile.classList.add("hidden");
      userSection.innerHTML = `
            <button id="loginBtn" class="text-slate-100 bg-cyan-600 hover:bg-cyan-700 rounded-md px-3 py-1.5 flex items-center">
                <i data-lucide="user" class="h-4 w-4 mr-2"></i> Login
            </button>
        `;

      const loginBtn = document.getElementById("loginBtn");
      if (loginBtn) {
        loginBtn.addEventListener("click", () => {
          if (authModal) authModal.style.display = "flex";
        });
      }

      referralSpeed.textContent = "0x";
      referralSpeed.classList.add("text-slate-400");

      if (currentBooster) {
        currentBooster.textContent = "None";
        currentBooster.classList.add("text-amber-400");
      }

      lucide.createIcons();
    }
  }

  // START: Event listener navigasi
  navDashboard.addEventListener("click", () => showPage("dashboard"));
  navBooster.addEventListener("click", () => {
    if (!window.currentUser) {
      showToast("Error", "Please login to access Booster", "destructive");
      if (authModal) authModal.style.display = "flex";
      return;
    }
    showPage("booster");
  });
  navLeaderboard.addEventListener("click", () => showPage("leaderboard"));
  navCommunications.addEventListener("click", () => {
    if (!window.currentUser) {
      showToast(
        "Error",
        "Please login to access Communications",
        "destructive"
      );
      if (authModal) authModal.style.display = "flex";
      return;
    }
    showPage("communications");
  });
  navSettings.addEventListener("click", () => {
    if (!window.currentUser) {
      showToast("Error", "Please login to access Settings", "destructive");
      if (authModal) authModal.style.display = "flex";
      return;
    }
    showPage("settings");
  });
  navSecurity.addEventListener("click", () => {
    if (!window.currentUser) {
      showToast("Error", "Please login to access Security", "destructive");
      if (authModal) authModal.style.display = "flex";
      return;
    }
    showPage("security");
  });
  navDataCenter.addEventListener("click", () => {
    if (!window.currentUser) {
      showToast("Error", "Please login to access Data Center", "destructive");
      if (authModal) authModal.style.display = "flex";
      return;
    }
    showPage("dataCenter");
  });
  navNetwork.addEventListener("click", () => {
    if (!window.currentUser) {
      showToast("Error", "Please login to access Network", "destructive");
      if (authModal) authModal.style.display = "flex";
      return;
    }
    showPage("network");
  });
  // END: Event listener navigasi

  // START: Fungsi untuk menangani logout dengan PERBAIKAN
  async function handleLogout() {
    try {
      // --- PERBAIKAN: Urutan diubah untuk memastikan data disimpan SEBELUM dihentikan/direset ---

      // 1. Ambil nilai poin saat ini sebelum ada proses lain yang bisa mengubahnya.
      const pointsToSave = points;
      console.log(`Preparing to save ${pointsToSave} points before logout.`);

      // 2. Langsung simpan nilai yang sudah diamankan ke Supabase.
      // Ini menggantikan panggilan ke `window.syncPointsToSupabase()` untuk menghindari bug.
      if (window.currentUser && window.currentUser.id) {
        const { error: syncError } = await supabase
          .from("profiles")
          .update({ points: pointsToSave })
          .eq("id", window.currentUser.id);

        if (syncError) {
          // Jika Failed menyimpan, hentikan proses logout agar pengguna tidak kehilangan data.
          throw new Error(
            `Failed to save points before logout: ${syncError.message}`
          );
        }
        console.log(`Successfully saved ${pointsToSave} points to Supabase.`);
      }

      // 3. Hentikan proses mining SETELAH data berhasil disimpan.
      if (window.isMining && window.stopMining) {
        window.stopMining();
      }

      // 4. Reset status mining di localStorage.
      localStorage.setItem("isMining", "false");

      // 5. Lakukan proses logout dari Supabase.
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;

      // 6. Reset semua variabel state lokal SETELAH logout berhasil.
      window.user = null;
      window.currentUser = null;

      showToast("Success", "Logged out successfully");

      // 7. Perbarui UI untuk menampilkan kondisi logout.
      if (window.updateUI) window.updateUI();
      if (window.showPage) window.showPage("dashboard");
      if (authModal) authModal.style.display = "flex";
    } catch (error) {
      console.error("Logout error:", error);
      showToast("Error", "Failed to logout. Please try again.", "destructive");
    }
  }

  // START: Fungsi untuk mereset semua error pada form
  function clearErrors() {
    document
      .querySelectorAll(".input-error")
      .forEach((el) => el.classList.remove("input-error"));
    document
      .querySelectorAll(".shake")
      .forEach((el) => el.classList.remove("shake"));
    document.querySelectorAll(".error-message").forEach((el) => {
      el.textContent = "";
      el.classList.add("hidden");
    });
  }

  // START: Fungsi untuk menampilkan atau menyembunyikan pesan error pada input
  function toggleError(inputElement, hasError, message = "") {
    if (!inputElement) return;
    const parent =
      inputElement.closest(".relative") || inputElement.parentElement;
    const errorDiv = parent.querySelector(".error-message");

    if (hasError) {
      inputElement.classList.add("input-error", "shake");
      setTimeout(() => inputElement.classList.remove("shake"), 500);
      if (errorDiv) {
        errorDiv.innerHTML = `<span class="error-text"><i class="fas fa-exclamation-circle"></i> ${message}</span>`;
        errorDiv.classList.remove("hidden");
      }
    } else {
      inputElement.classList.remove("input-error", "shake");
      if (errorDiv) {
        errorDiv.innerHTML = "";
        errorDiv.classList.add("hidden");
      }
    }
  }

  // START: Fungsi untuk membuat kode referral acak dan memastikan unik
  async function generateReferralCode() {
    let unique = false;
    let newCode;
    while (!unique) {
      const randomNumbers = Math.floor(100000 + Math.random() * 900000);
      newCode = `AQULA${randomNumbers}`;
      const { count, error } = await supabase
        .from("profiles")
        .select("referral_code", { count: "exact", head: true })
        .eq("referral_code", newCode);

      if (error) {
        console.error("Error checking referral code uniqueness:", error);
        throw error;
      }
      if (count === 0) {
        unique = true;
      }
    }
    return newCode;
  }

  // START: Fungsi untuk memvalidasi kode referral
  async function validateReferralCode(code) {
    if (!code) return { valid: true, referrer: null };
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("referral_code", code)
      .single();
    if (error || !data) {
      return { valid: false, referrer: null };
    }
    return { valid: true, referrer: data.id };
  }

  // START: Fungsi untuk memeriksa apakah email sudah terdaftar
  async function checkEmailExists(email) {
    const { count, error } = await supabase
      .from("profiles")
      .select("email", { count: "exact", head: true })
      .eq("email", email);
    if (error) {
      console.error("Error checking email:", error);
      return false;
    }
    return count > 0;
  }

  // START: Regex untuk validasi password kuat
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

  // START: Validasi real-time untuk input email dan password
  document.getElementById("emailInput")?.addEventListener("input", function () {
    const value = this.value.trim();
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    toggleError(this, !isValid, "Enter a valid email address.");
  });

  document
    .getElementById("passwordInput")
    ?.addEventListener("input", function () {
      const value = this.value;
      const isValid = value.length >= 6;
      toggleError(this, !isValid, "Password must be at least 6 characters.");
    });

  document
    .getElementById("regEmailInput")
    ?.addEventListener("input", async function () {
      const value = this.value.trim();
      const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      if (!isValid) {
        toggleError(this, true, "Enter a valid email address.");
        return;
      }
      try {
        const emailExists = await checkEmailExists(value);
        toggleError(
          this,
          emailExists,
          "Email already registered. Use another email or login."
        );
      } catch (error) {
        toggleError(this, true, "Failed to check email. Try again.");
      }
    });

  document
    .getElementById("regPasswordInput")
    ?.addEventListener("input", function () {
      const value = this.value;
      const isValid = passwordRegex.test(value);
      toggleError(
        this,
        !isValid,
        "Passwords must contain uppercase letters, lowercase letters, numbers, and special characters."
      );
    });

  document
    .getElementById("referralInput")
    ?.addEventListener("input", async function () {
      const value = this.value.trim();
      if (value) {
        const { valid } = await validateReferralCode(value);
        toggleError(this, !valid, "Invalid referral code.");
      } else {
        toggleError(this, false);
      }
    });

  // START: Toggle show/hide password
  document.querySelectorAll(".show-password").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      const targetId = this.getAttribute("data-target");
      if (!targetId) return;
      const input = document.getElementById(targetId);
      if (!input) return;
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      const svg = this.querySelector("svg");
      if (!svg) return;
      svg.innerHTML = isPassword
        ? `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.975 9.975 0 011.689-2.908m2.121 2.121A3 3 0 1015 12a3 3 0 00-4.242 0m6.366 6.366A10.05 10.05 0 0012 19c-4.478 0-8.268-2.943-9.542-7a9.975 9.975 0 011.689-2.908m2.121 2.121A3 3 0 1015 12a3 3 0 00-4.242 0m6.366 6.366l2.121-2.121" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3l18 18" />`
        : `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />`;
    });
  });

  // START: Event listener for email login button
  emailAuthBtn.addEventListener("click", async () => {
    let hasError = false;
    const email = document.getElementById("emailInput").value.trim();
    const password = document.getElementById("passwordInput").value;
    clearErrors();

    const emailField = document.getElementById("emailInput");
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    toggleError(emailField, !emailValid, "Please enter a valid email address.");
    if (!emailValid) hasError = true;

    const passwordField = document.getElementById("passwordInput");
    const passwordValid = password.length >= 6;
    toggleError(
      passwordField,
      !passwordValid,
      "Password must be at least 6 characters."
    );
    if (!passwordValid) hasError = true;

    if (hasError) return;

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toggleError(passwordField, true, "Incorrect password");
          showToast("Error", "Incorrect password", "destructive");
        } else if (error.message.includes("User not found")) {
          toggleError(emailField, true, "Email not found");
          showToast("Error", "Email not found", "destructive");
        } else {
          showToast(
            "Error",
            error.message ||
              "Failed to log in. Please check your email and password.",
            "destructive"
          );
        }
        return;
      }

      showToast("Success", "Login successful.");
      if (authModal) authModal.style.display = "none";
      if (window.checkUser) await window.checkUser();
    } catch (error) {
      showToast(
        "Error",
        error.message || "An error occurred. Please try again.",
        "destructive"
      );
    }
  });

  // START: Event listener untuk tombol register dengan PERBAIKAN
  registerBtn.addEventListener("click", async () => {
    let hasError = false;
    clearErrors();

    const email = document.getElementById("regEmailInput").value.trim();
    const password = document.getElementById("regPasswordInput").value;
    const fullName = document.getElementById("fullNameInput").value.trim();
    const referralCode = document.getElementById("referralInput")?.value.trim();
    const successMessage = document.getElementById("successMessage");

    const emailField = document.getElementById("regEmailInput");
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    toggleError(emailField, !emailValid, "Enter a valid email address.");
    if (!emailValid) hasError = true;

    if (emailValid) {
      const emailExists = await checkEmailExists(email);
      if (emailExists) {
        toggleError(
          emailField,
          true,
          "Email already registered. Use another email or login."
        );
        hasError = true;
      }
    }

    const passwordField = document.getElementById("regPasswordInput");
    const passwordValid = passwordRegex.test(password);
    toggleError(
      passwordField,
      !passwordValid,
      "Passwords must contain uppercase letters, lowercase letters, numbers, and special characters."
    );
    if (!passwordValid) hasError = true;

    const fullNameField = document.getElementById("fullNameInput");
    const fullNameValid = fullName.length > 0;
    toggleError(fullNameField, !fullNameValid, "Full name required.");
    if (!fullNameValid) hasError = true;

    const referralField = document.getElementById("referralInput");
    let referrerId = null;
    if (referralCode) {
      const { valid, referrer } = await validateReferralCode(referralCode);
      if (!valid) {
        toggleError(referralField, true, "Invalid referral code.");
        hasError = true;
      }
      referrerId = referrer;
    }

    if (hasError) return;

    try {
      registerBtn.disabled = true;
      registerBtn.innerHTML = `<svg class="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8h-8z"></path></svg> Processing...`;

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          redirectTo: `${window.location.origin}/confirm`,
          data: { full_name: fullName },
        },
      });
      if (signUpError) throw signUpError;

      const userId = data.user.id;
      const generatedReferralCode = await generateReferralCode();
      const initialPoints = referralCode ? 1000 : 0;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          points: initialPoints,
          full_name: fullName,
          referral_code: generatedReferralCode,
          referred_by: referrerId, // Simpan ID referrer, bonus akan diberikan oleh trigger
        })
        .eq("id", userId);

      if (profileError) throw profileError;

      // PENTING: Panggilan RPC untuk memberikan bonus telah DIHAPUS dari sini.
      // Bonus sekarang akan diberikan secara otomatis oleh trigger di backend setelah email dikonfirmasi.

      if (successMessage) {
        successMessage.classList.remove("hidden");
        loginForm.classList.add("hidden");
        registerForm.classList.add("hidden");
      }
      showToast(
        "Success",
        "Registration complete! Please check your email for verification."
      );

      setTimeout(async () => {
        if (authModal) authModal.style.display = "none";
        await checkUser();
      }, 3000);
    } catch (error) {
      console.error("Authentication error:", error.message);
      showToast(
        "Error",
        error.message || "An error occurred. Try again.",
        "destructive"
      );
    } finally {
      registerBtn.disabled = false;
      registerBtn.innerHTML = `Create Account`;
    }
  });

  // START: Event listener untuk tombol Google Auth
  googleAuthBtn.addEventListener("click", async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });

      if (error) throw error;
      // Alur setelah redirect akan ditangani oleh onAuthStateChange
    } catch (error) {
      showToast(
        "Error",
        error.message || "Google authentication failed.",
        "destructive"
      );
    }
  });

  // --- FUNGSI REGISTRASI & LOGIN WALLET DENGAN PERBAIKAN ---
  async function handleWalletLoginOrRegister(walletType) {
    try {
      let options = {
        statement: "Welcome to AQULA! Please sign in to continue.",
      };
      let isNewUser = false;
      let walletAddress;

      // 1. Dapatkan provider, alamat dompet, dan tentukan chain
      switch (walletType.toLowerCase()) {
        case "metamask":
        case "okx":
          if (!window.ethereum)
            throw new Error(
              "Please install an Ethereum wallet (e.g., MetaMask or OKX)."
            );
          options.chain = "ethereum";

          const provider = new ethers.providers.Web3Provider(window.ethereum);
          await provider.send("eth_requestAccounts", []);
          const signer = provider.getSigner();
          walletAddress = await signer.getAddress();
          break;

        case "phantom":
          if (!window.solana || !window.solana.isPhantom)
            throw new Error("Please install Phantom wallet.");
          const res = await window.solana.connect({ onlyIfTrusted: false });
          walletAddress = res.publicKey.toString();
          options.chain = "solana";
          break;

        default:
          throw new Error("Invalid wallet type.");
      }

      if (!walletAddress) throw new Error("Could not get wallet address.");

      // 2. Gunakan signInWithWeb3 untuk login atau registrasi
      const { data, error: web3Error } = await supabase.auth.signInWithWeb3(
        options
      );
      if (web3Error) throw web3Error;

      const user = data.user;
      if (!user) throw new Error("Authentication failed.");

      // 3. Cek apakah ini pengguna baru
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", user.id)
        .single();

      if (profileError && profileError.code !== "PGRST116") throw profileError;

      if (!profile || !profile.full_name) {
        isNewUser = true;
        showToast("Info", "Welcome! Let's set up your profile.", "info");

        const generatedReferralCode = await generateReferralCode();
        const fullName = `${
          walletType.charAt(0).toUpperCase() + walletType.slice(1)
        } User (${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)})`;

        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            full_name: fullName,
            wallet_address: walletAddress,
            referral_code: generatedReferralCode,
          })
          .eq("id", user.id);
        if (updateError) throw updateError;
      } else {
        showToast("Info", `Welcome back, ${profile.full_name}!`, "info");
      }

      // 4. Proses referral (hanya untuk pengguna baru)
      if (isNewUser) {
        const referralCode = await promptForReferralCode();
        if (referralCode) {
          const { valid, referrer: referrerId } = await validateReferralCode(
            referralCode
          );
          if (valid && referrerId) {
            // Beri bonus ke referrer
            const { error: rpcError } = await supabase.rpc(
              "increment_referrer_stats",
              { referrer_id: referrerId }
            );
            if (rpcError) {
              showToast(
                "Warning",
                "Login successful, but failed to apply referrer bonus.",
                "warning"
              );
            } else {
              showToast(
                "Success",
                "Referrer has received their bonus!",
                "success"
              );
            }

            // --- PERBAIKAN: Beri bonus ke pengguna baru ---
            const { error: newUserBonusError } = await supabase
              .from("profiles")
              .update({ points: 1000 }) // Tambahkan 1000 poin
              .eq("id", user.id);

            if (newUserBonusError) {
              showToast(
                "Warning",
                "Failed to apply your welcome bonus.",
                "warning"
              );
            } else {
              showToast(
                "Success",
                "You received a 1000 point welcome bonus!",
                "success"
              );
            }
          } else {
            showToast(
              "Error",
              "The referral code you entered is invalid.",
              "destructive"
            );
          }
        }
      }

      showToast("Success", "Login successful!");
      if (authModal) authModal.style.display = "none";
      if (window.checkUser) await window.checkUser();
    } catch (error) {
      console.error("Wallet auth error:", error);
      let errorMessage = "Failed to process wallet authentication.";
      if (
        error.message.includes("User denied") ||
        (error.code && error.code === 4001)
      ) {
        errorMessage = "Request cancelled by user.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      showToast("Error", errorMessage, "destructive");
    }
  }

  // START: Event listener untuk tombol autentikasi wallet (diperbarui)
  if (metamaskAuthBtn)
    metamaskAuthBtn.addEventListener("click", () =>
      handleWalletLoginOrRegister("metamask")
    );
  if (phantomAuthBtn)
    phantomAuthBtn.addEventListener("click", () =>
      handleWalletLoginOrRegister("phantom")
    );
  if (okxAuthBtn)
    okxAuthBtn.addEventListener("click", () =>
      handleWalletLoginOrRegister("okx")
    );

  // START: Event listener untuk toggle form autentikasi (login/register)
  toggleAuthBtn.addEventListener("click", () => {
    isLogin = !isLogin;
    loginForm.classList.toggle("hidden", !isLogin);
    registerForm.classList.toggle("hidden", isLogin);
    emailAuthBtn.querySelector("span").textContent = isLogin
      ? "Continue"
      : "Create Account";
    toggleAuthBtn.innerHTML = isLogin
      ? 'Need an account? <span class="underline">Register here</span>'
      : 'Already have an account? <span class="underline">Login here</span>';
    fullNameGroup.classList.toggle("hidden", isLogin);
    referralCodeGroup.classList.toggle("hidden", isLogin);
  });

  // START: Event listener untuk toggle tema (dark/light)
  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      document.documentElement.classList.toggle("dark");
      const currentTheme = document.documentElement.classList.contains("dark")
        ? "dark"
        : "light";
      localStorage.setItem("theme", currentTheme);
      themeToggle.innerHTML = `<i data-lucide="${
        currentTheme === "dark" ? "moon" : "sun"
      }" class="h-5 w-5"></i>`;
      lucide.createIcons();
    });
  }

  // START: Event listener untuk menutup modal autentikasi
  document.getElementById("closeAuthModal")?.addEventListener("click", () => {
    if (authModal) authModal.style.display = "none";
  });

  // START: Event listener untuk tombol "Forgot password?"
  document
    .getElementById("forgotPasswordBtn")
    ?.addEventListener("click", () => {
      loginForm.classList.add("hidden");
      registerForm.classList.add("hidden");
      document.getElementById("forgotPasswordForm").classList.remove("hidden");
    });

  // START: Event listener untuk tombol "Back to Login"
  document.getElementById("backToLoginBtn")?.addEventListener("click", () => {
    document.getElementById("forgotPasswordForm").classList.add("hidden");
    loginForm.classList.remove("hidden");
  });

  // START: Event listener untuk tombol reset password
  document
    .getElementById("resetPasswordBtn")
    ?.addEventListener("click", async () => {
      const email = document.getElementById("resetEmailInput")?.value.trim();
      const emailField = document.getElementById("resetEmailInput");
      clearErrors();

      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      toggleError(emailField, !emailValid, "Enter a valid email address.");
      if (!emailValid) return;

      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

        if (error) {
          toggleError(
            emailField,
            true,
            error.message || "Failed to send password reset request."
          );
          return;
        }

        showToast(
          "Success",
          "A password reset link has been sent to your email.",
          "success"
        );

        const forgotPasswordForm =
          document.getElementById("forgotPasswordForm");
        const loginForm = document.getElementById("loginForm");
        if (forgotPasswordForm) forgotPasswordForm.classList.add("hidden");
        if (loginForm) loginForm.classList.remove("hidden");
      } catch (err) {
        console.error("Reset password error:", err);
        toggleError(
          emailField,
          true,
          err.message || "An error occurred. Please try again."
        );
      }
    });
})();

// START: Routing sisi klien
// START: Routing sisi klien (DIPERBAIKI)
function showPage(pageName, updateUrl = true) {
  // Mapping internal untuk variabel elemen DOM (karena variabel anda tidak konsisten dengan string key)
  // Ini menghubungkan string input 'showPage' dengan Elemen DOM Variable yang sudah dideklarasikan di atas
  const pageElements = {
    dashboard: pageDashboard,
    network:
      typeof pagenetwork !== "undefined"
        ? pagenetwork
        : document.getElementById("pagenetwork"),
    booster: pageBooster,
    leaderboard: pageLeaderboard,
    communications: pageCommunications,
    settings: pageSettings,
    security: pageSecurity,
    dataCenter: pageDataCenter,
  };

  const navElements = {
    dashboard: navDashboard,
    network: navNetwork,
    booster: navBooster,
    leaderboard: navLeaderboard,
    communications: navCommunications,
    settings: navSettings,
    security: navSecurity,
    dataCenter: navDataCenter,
  };

  // 1. Sembunyikan semua halaman
  Object.values(pageElements).forEach((el) => {
    if (el) el.classList.add("page-hidden");
  });

  // 2. Reset semua tombol navigasi
  Object.values(navElements).forEach((el) => {
    if (el) {
      el.classList.remove("nav-active", "text-cyan-400");
      el.classList.add("text-slate-300"); // Kembalikan ke warna default
    }
  });

  // 3. Tampilkan halaman yang diminta
  const activePageEl = pageElements[pageName];
  const activeNavEl = navElements[pageName];

  if (activePageEl) {
    activePageEl.classList.remove("page-hidden");
  }

  if (activeNavEl) {
    activeNavEl.classList.remove("text-slate-300");
    activeNavEl.classList.add("nav-active", "text-cyan-400");
  }

  currentPage = pageName;

  // 4. Update URL Browser (Hash Routing)
  if (updateUrl) {
    // Konversi 'dataCenter' (camelCase) menjadi 'data-center' (kebab-case) untuk URL yang cantik
    let urlSlug = pageName === "dataCenter" ? "data-center" : pageName;
    window.history.pushState({ page: pageName }, "", `/#/${urlSlug}`);
  }

  // 5. Trigger Inisialisasi Khusus Halaman
  if (pageName === "leaderboard" && typeof loadLeaderboard === "function")
    loadLeaderboard();
  if (pageName === "settings" && typeof loadSettings === "function")
    loadSettings();
  if (pageName === "security" && typeof runSecurityScan === "function")
    runSecurityScan();
  if (pageName === "communications" && typeof initializeChat === "function")
    initializeChat();
  if (pageName === "dataCenter" && typeof initializeDataCenter === "function")
    initializeDataCenter();
  if (pageName === "network" && typeof initializeNetwork === "function")
    initializeNetwork();
}
// END: Routing sisi klien

function updateSystemMetrics() {
  // Simulasi perubahan nilai metrik
  cpuUsage = Math.min(100, Math.max(20, cpuUsage + (Math.random() - 0.5) * 10));
  memoryUsage = Math.min(
    100,
    Math.max(40, memoryUsage + (Math.random() - 0.5) * 8)
  );
  networkStatus = Math.min(
    100,
    Math.max(70, networkStatus + (Math.random() - 0.5) * 5)
  );
  securityLevel = Math.min(
    100,
    Math.max(60, securityLevel + (Math.random() - 0.5) * 4)
  );
  systemStatus = Math.round(
    (cpuUsage + memoryUsage + networkStatus + securityLevel) / 4
  );

  // Memperbarui elemen DOM dengan nilai baru
  cpuUsageEl.textContent = `${cpuUsage.toFixed(0)}%`;
  memoryUsageEl.textContent = `${memoryUsage.toFixed(0)}%`;
  networkStatusEl.textContent = `${networkStatus.toFixed(0)}%`;
  securityLevelEl.textContent = `${securityLevel.toFixed(0)}%`;
  systemStatusEl.textContent = `${systemStatus}%`;
  systemLoad.textContent = `${((cpuUsage + memoryUsage) / 2).toFixed(0)}%`;

  // Memperbarui grafik performa (fungsi updatePerformanceChart diasumsikan ada)
  updatePerformanceChart();
}
/**
 * @description Akhir dari fungsi updateSystemMetrics.
 */
