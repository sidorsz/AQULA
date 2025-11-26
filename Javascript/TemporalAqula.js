document.addEventListener("DOMContentLoaded", function () {
  // Elemen DOM untuk semua fitur dashboard
  const systemTime = document.getElementById("systemTime");
  const systemDate = document.getElementById("systemDate");
  const uptimeDisplay = document.getElementById("uptime");
  const timezoneDisplay = document.getElementById("timezone");
  const ntpStatusDisplay = document.getElementById("ntpStatus");
  const leapSecondDisplay = document.getElementById("leapSecond");
  const relativeDilationDisplay = document.getElementById("relativeDilation");
  const atomicClockSyncDisplay = document.getElementById("atomicClockSync");
  const manualSyncButton = document.getElementById("manualSyncButton");
  const globalSyncCities = document.getElementById("globalSyncCities");

  // Daftar kota untuk Global Synchronization
  const CITIES = [
    { name: "London", zone: "Europe/London" },
    { name: "New York", zone: "America/New_York" },
    { name: "Tokyo", zone: "Asia/Tokyo" }
  ];

  /**
   * @function updateSystemTime
   * @description Memperbarui tampilan waktu dan tanggal sistem pada elemen DOM terkait.
   */
  function updateSystemTime() {
    const now = new Date();
    if (systemTime) {
      const timeString = now.toLocaleTimeString("en-US", { hour12: false });
      const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
      systemTime.innerHTML = `${timeString}.<span class="text-cyan-400/60 text-3xl">${milliseconds}</span>`;
    }
    if (systemDate) {
      const dateOptions = {
        month: "long",
        day: "numeric",
        year: "numeric",
        weekday: "long"
      };
      systemDate.textContent = now.toLocaleDateString("en-US", dateOptions).toUpperCase();
    }
  }

  /**
   * @function formatDuration
   * @description Mengubah durasi dalam milidetik menjadi format "Xd HH:MM:SS".
   * @param {number} ms - Durasi dalam milidetik.
   * @returns {string} String durasi yang diformat.
   */
  function formatDuration(ms) {
    let seconds = Math.floor((ms / 1000) % 60);
    let minutes = Math.floor((ms / (1000 * 60)) % 60);
    let hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    let days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const paddedHours = String(hours).padStart(2, '0');
    const paddedMinutes = String(minutes).padStart(2, '0');
    const paddedSeconds = String(seconds).padStart(2, '0');
    return `${days}d ${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
  }

  /**
   * @function updateUptime
   * @description Menghitung dan memperbarui tampilan uptime sistem/aplikasi.
   */
  const startTime = new Date();
  function updateUptime() {
    if (!uptimeDisplay) return;
    const now = new Date();
    const diff = now - startTime;
    uptimeDisplay.textContent = formatDuration(diff);
  }

  /**
   * @function updateTimezone
   * @description Mendapatkan dan memperbarui tampilan timezone lokal dalam format UTC offset.
   */
  function updateTimezone() {
    if (!timezoneDisplay) return;
    const offsetMin = new Date().getTimezoneOffset();
    const offsetHrsAbs = Math.abs(Math.floor(offsetMin / 60));
    const offsetMinsAbs = Math.abs(offsetMin % 60);
    const sign = offsetMin <= 0 ? "+" : "-";
    const formattedOffset = `UTC${sign}${String(offsetHrsAbs).padStart(2, '0')}:${String(offsetMinsAbs).padStart(2, '0')}`;
    timezoneDisplay.textContent = formattedOffset;
  }

  /**
   * @function updateGlobalSynchronization
   * @description Memperbarui waktu untuk London, New York, Tokyo berdasarkan zona waktu lokal.
   */
  function updateGlobalSynchronization() {
    if (!globalSyncCities) return;
    const cityTimes = CITIES.map(city => {
      const time = new Date().toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        timeZone: city.zone
      });
      return `${city.name}: ${time}`;
    });
    globalSyncCities.textContent = cityTimes.join(" • ");
  }

  /**
   * @function updateNTPStatus
   * @description Memperbarui status NTP dengan simulasi sinkronisasi.
   */
  function updateNTPStatus() {
    if (!ntpStatusDisplay) return;
    const isSynced = Math.random() > 0.1; // 90% kemungkinan synced
    ntpStatusDisplay.textContent = isSynced ? "SYNCED" : "DESYNCED";
    const ntpDot = ntpStatusDisplay.previousElementSibling;
    ntpDot.classList.toggle("bg-green-500", isSynced);
    ntpDot.classList.toggle("bg-red-500", !isSynced);
  }

  /**
   * @function checkLeapSecond
   * @description Memeriksa apakah leap second mungkin terjadi berdasarkan bulan saat ini.
   */
  function checkLeapSecond() {
    if (!leapSecondDisplay) return;
    const now = new Date();
    const month = now.getUTCMonth(); // 0=Jan, 5=June, 11=Dec
    if (month === 5 || month === 11) {
      leapSecondDisplay.textContent = "PEND - POSSIBLE";
    } else {
      leapSecondDisplay.textContent = "NONE PENDING";
    }
  }

  /**
   * @function updateDilation
   * @description Menghitung dan memperbarui nilai relatif dilasi waktu berdasarkan rumus Lorentz.
   */
  function updateDilation() {
    if (!relativeDilationDisplay) return;
    const v = 0.9; // 90% kecepatan cahaya
    const c = 1; // Kecepatan cahaya
    const gamma = 1 / Math.sqrt(1 - Math.pow(v, 2) / Math.pow(c, 2));
    relativeDilationDisplay.textContent = `${gamma.toFixed(4)}x`;
  }

  /**
   * @function updateAtomicClockSync
   * @description Memperbarui waktu terakhir sinkronisasi dengan atomic clock (simulasi).
   */
  function updateAtomicClockSync() {
    if (!atomicClockSyncDisplay) return;
    const msAgo = (Math.random() * 5 + 1).toFixed(1);
    atomicClockSyncDisplay.textContent = `${msAgo}ms ago`;
  }

  /**
   * @function handleManualSync
   * @description Menangani klik tombol Manual Sync untuk memperbarui semua elemen.
   */
  function handleManualSync() {
    updateSystemTime();
    updateUptime();
    updateTimezone();
    updateGlobalSynchronization();
    updateNTPStatus();
    checkLeapSecond();
    updateDilation();
    updateAtomicClockSync();
    manualSyncButton.classList.add("bg-cyan-600/50");
    setTimeout(() => {
      manualSyncButton.classList.remove("bg-cyan-600/50");
    }, 200);
  }

  // Tambahkan event listener untuk tombol Manual Sync
  if (manualSyncButton) {
    manualSyncButton.addEventListener("click", handleManualSync);
  }

  // Jalankan pembaruan awal saat halaman dimuat
  updateSystemTime();
  updateUptime();
  updateTimezone();
  updateGlobalSynchronization();
  updateNTPStatus();
  checkLeapSecond();
  updateDilation();
  updateAtomicClockSync();

  // Set interval untuk pembaruan periodik
  setInterval(updateSystemTime, 1000);
  setInterval(updateUptime, 1000);
  setInterval(updateGlobalSynchronization, 60000); // Update setiap 60 detik
  setInterval(updateNTPStatus, 10000);
  setInterval(checkLeapSecond, 1000); // Sesuai kode Anda
  setInterval(updateDilation, 1000); // Sesuai kode Anda
  setInterval(updateAtomicClockSync, 5000);
});

