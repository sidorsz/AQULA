 // =========================================================================
      // BAGIAN 6: TOMBOL AKSI CEPAT (Dalam DOMContentLoaded)
      // =========================================================================
      document.addEventListener("DOMContentLoaded", function () {
        // Ambil elemen tombol
        const btnSecurityScan = document.getElementById("btnSecurityScan");
        const btnSyncData = document.getElementById("btnSyncData");
        const btnBackup = document.getElementById("btnBackup");
        const btnConsole = document.getElementById("btnConsole");

        // Cek apakah ipcRenderer tersedia (di Electron) dan definisikan jika ya
        const isElectronContext = typeof require === "function";
        const ipcRenderer = isElectronContext ? require("electron").ipcRenderer : undefined;

        /**
         * @function showToastActions
         * @description Menampilkan notifikasi toast sementara di pojok kanan bawah.
         * @param {string} message - Pesan yang akan ditampilkan.
         */
        function showToastActions(message) {
          const toast = document.createElement("div");
          // Style toast (fixed position)
          toast.className = "fixed bottom-5 right-5 bg-slate-800 text-slate-200 px-4 py-2 rounded-md shadow-lg text-sm font-mono border border-slate-700 z-50 animate-fade-in-action"; // Gunakan animasi khusus jika perlu
          toast.textContent = message;
          document.body.appendChild(toast);

          // Hapus toast setelah beberapa detik
          setTimeout(() => {
            toast.classList.add("opacity-0", "transition-opacity", "duration-300"); // Tambahkan transisi opacity
            setTimeout(() => toast.remove(), 300); // Hapus setelah transisi
          }, 2000); // Durasi tampil: 2 detik
        }
        /**
         * @description Akhir dari fungsi showToastActions.
         */

        /**
         * @function appendToConsole
         * @description Menambahkan baris teks ke output console modal.
         * @param {string} htmlContent - Teks atau HTML yang akan ditambahkan.
         */
        function appendToConsole(htmlContent) {
          const outputArea = document.getElementById("consoleOutput");
          if (outputArea) {
            const line = document.createElement("div");
            line.innerHTML = htmlContent; // Gunakan innerHTML untuk memungkinkan styling span
            outputArea.appendChild(line);
            // Auto-scroll ke bawah
            outputArea.scrollTop = outputArea.scrollHeight;
          }
        }
        /**
         * @description Akhir dari fungsi appendToConsole.
         */

        // Inject CSS untuk animasi jika belum ada
        if (!document.getElementById("actionAnimations")) {
          const styleSheet = document.createElement("style");
          styleSheet.id = "actionAnimations";
          styleSheet.type = "text/css";
          styleSheet.innerText = `
            @keyframes fade-in-action {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .animate-fade-in-action {
                animation: fade-in-action 0.3s ease-out forwards;
            }
            .animate-spin {
                animation: spin 1s linear infinite;
            }
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            /* Tambahkan style untuk opacity transition pada toast */
            .opacity-0 { opacity: 0; }
            .transition-opacity { transition: opacity 0.3s ease-out; }
        `;
          document.head.appendChild(styleSheet);
        }

        // Tambahkan area log untuk hasil scan jika belum ada
        const quickActionsCard = document.querySelector("#btnSecurityScan")?.closest(".p-4"); // Cari parent card
        if (quickActionsCard && !document.getElementById("scanResultLog")) {
          const logArea = document.createElement("div");
          logArea.id = "scanResultLog";
          logArea.className = "mt-4 text-xs font-mono text-slate-400 bg-slate-800/50 p-3 rounded border border-slate-700/50 overflow-y-auto max-h-32"; // Sesuaikan tinggi maks
          logArea.innerHTML = `<div class="text-slate-500 italic">Hasil scan akan muncul di sini...</div>`;
          // Masukkan setelah grid tombol (atau sesuaikan posisi)
          const gridContainer = btnSecurityScan.closest(".grid");
          if (gridContainer && gridContainer.nextSibling) {
            gridContainer.parentNode.insertBefore(logArea, gridContainer.nextSibling);
          } else if (gridContainer) {
            gridContainer.parentNode.appendChild(logArea);
          } else {
            // Fallback jika struktur berbeda
            quickActionsCard.appendChild(logArea);
          }
        }
        const scanResultLog = document.getElementById("scanResultLog"); // Ambil elemen log

       // --- Event Listener untuk Tombol Security Scan ---
if (btnSecurityScan) {
  btnSecurityScan.addEventListener("click", () => {
    const span = btnSecurityScan.querySelector("span");
    const originalText = span ? span.textContent : "Security Scan"; // Simpan teks asli

    // Nonaktifkan tombol dan ubah teks
    btnSecurityScan.disabled = true;
    if (span) span.textContent = "Scanning...";

    // Dapatkan atau buat container progress bar
    let progressContainer = document.getElementById("scanProgressContainer");
    let progressBar = document.getElementById("scanProgressBar");
    let progressText = document.getElementById("scanProgressText");

    if (!progressContainer) {
      progressContainer = document.createElement("div");
      progressContainer.id = "scanProgressContainer";
      progressContainer.className = "mt-2 w-full"; // Margin top
      progressContainer.innerHTML = `
            <div class="w-full bg-slate-800/50 rounded-full h-1.5 mb-1 dark:bg-gray-700">
                <div id="scanProgressBar" class="bg-gradient-to-r from-cyan-500 to-blue-500 h-1.5 rounded-full" style="width: 0%"></div>
            </div>
            <div class="text-right text-xs text-slate-500">
                <span id="scanProgressText">0%</span>
            </div>
        `;
      // Masukkan progress bar setelah tombol (dalam grid atau setelahnya)
      const gridContainer = btnSecurityScan.closest(".grid");
      if (gridContainer) {
        gridContainer.insertAdjacentElement("afterend", progressContainer);
      } else {
        btnSecurityScan.insertAdjacentElement("afterend", progressContainer);
      }
      progressBar = document.getElementById("scanProgressBar");
      progressText = document.getElementById("scanProgressText");
    } else {
      // Jika sudah ada, reset dan tampilkan
      progressContainer.classList.remove("hidden");
      progressBar = document.getElementById("scanProgressBar");
      progressText = document.getElementById("scanProgressText");
      if (progressBar) progressBar.style.width = "0%";
      if (progressText) progressText.textContent = "0%";
    }

    // Mulai animasi progress bar (simulasi)
    let width = 0;
    const interval = setInterval(() => {
      if (!progressBar || !progressText) { // Hentikan jika elemen hilang
        clearInterval(interval);
        return;
      }
      width += Math.random() * 5 + 1; // Kenaikan acak agar lebih realistis
      width = Math.min(width, 99); // Jangan sampai 100% sebelum selesai
      progressBar.style.width = `${width}%`;
      progressText.textContent = `${Math.floor(width)}%`;
      if (width >= 99 && !isElectronContext) { // Hentikan jika simulasi browser
        clearInterval(interval);
      }
    }, 150); // Interval update progress

    // Kirim event ke Electron atau jalankan simulasi
    if (isElectronContext && ipcRenderer) {
      ipcRenderer.send("start-security-scan");

      // Listener HANYA SEKALI untuk hasil scan
      ipcRenderer.once("security-scan-result", (event, result) => {
        clearInterval(interval); // Hentikan animasi progress

        // Set progress ke 100%
        if (progressBar) progressBar.style.width = "100%";
        if (progressText) progressText.textContent = "100%";

        // Tampilkan hasil di log
        if (scanResultLog) {
          if (scanResultLog.querySelector(".italic")) { // Hapus pesan awal
            scanResultLog.innerHTML = '';
          }
          const line = document.createElement("div");
          line.className = `whitespace-pre-wrap ${result.success ? 'text-green-400' : 'text-red-400'}`;
          line.textContent = `[${new Date().toLocaleTimeString()}] ${result.message || (result.success ? 'Scan complete, no threats found.' : 'Threats detected!')}`;
          scanResultLog.appendChild(line);
          scanResultLog.scrollTop = scanResultLog.scrollHeight; // Scroll ke bawah
        }

        // Sembunyikan progress bar dan kembalikan tombol setelah jeda
        setTimeout(() => {
          if (progressContainer) progressContainer.classList.add("hidden");
          if (span) span.textContent = originalText;
          btnSecurityScan.disabled = false;
        }, 1500); // Jeda sebelum reset

        // Tampilkan toast hasil
        showToastActions(result.success ? "✅ Scan Complete" : "⚠️ Potential Threat Detected!");
      });
    } else {
      // Simulasi jika bukan di Electron
      console.warn("Security scan (browser mode)...");
      const fakeScanSuccess = Math.random() < 0.85; // 85% simulasi Success
      const fakeMessage = fakeScanSuccess
        ? "No threats found during scan."
        : "Suspicious file detected (example.dll)!";

      setTimeout(() => { // Simulasi waktu scan
        clearInterval(interval); // Hentikan progress

        // Set progress ke 100%
        if (progressBar) progressBar.style.width = "100%";
        if (progressText) progressText.textContent = "100%";

        // Tampilkan hasil di log
        if (scanResultLog) {
          if (scanResultLog.querySelector(".italic")) {
            scanResultLog.innerHTML = '';
          }
          const line = document.createElement("div");
          line.className = `whitespace-pre-wrap ${fakeScanSuccess ? 'text-green-400' : 'text-red-400'}`;
          line.textContent = `[${new Date().toLocaleTimeString()}] ${fakeMessage}`;
          scanResultLog.appendChild(line);
          scanResultLog.scrollTop = scanResultLog.scrollHeight;
        }

        // Sembunyikan progress bar dan kembalikan tombol
        setTimeout(() => {
          if (progressContainer) progressContainer.classList.add("hidden");
          if (span) span.textContent = originalText;
          btnSecurityScan.disabled = false;
        }, 1500);

        // Tampilkan toast hasil simulasi
        showToastActions(fakeScanSuccess ? "🛡️ Scan complete." : "⚠️ Threat found!");
      }, Math.random() * 2000 + 3000); // Durasi simulasi 3-5 detik
    }
  });
}

// --- Event Listener untuk Tombol Sync Data ---
if (btnSyncData) {
  btnSyncData.addEventListener("click", () => {
    const span = btnSyncData.querySelector("span");
    const icon = btnSyncData.querySelector("svg");
    const originalText = span ? span.textContent : "Sync Data";

    // Ubah tampilan tombol menjadi loading
    btnSyncData.disabled = true;
    if (span) span.textContent = "Syncing...";
    if (icon) icon.classList.add("animate-spin"); // Pertahankan animasi putar

    // Kirim event ke Electron atau simulasi
    if (isElectronContext && ipcRenderer) {
      ipcRenderer.send("start-data-sync");

      // Listener HANYA SEKALI untuk hasil sync
      ipcRenderer.once("sync-complete", (event, result) => {
        const success = !(result && result.success === false); // Anggap Success jika tidak ada info Failed
        const message = result && result.message ? result.message : (success ? "Data synced successfully." : "Sync failed.");

        if (span) span.textContent = success ? "✅ Synced" : "❌ Sync Failed";
        showToastActions(success ? "🔄 Sync successful!" : "⚠️ Sync error!");

        // Kembalikan tombol setelah jeda
        setTimeout(() => {
          if (span) span.textContent = originalText;
          if (icon) icon.classList.remove("animate-spin");
          btnSyncData.disabled = false;
        }, 2000);
      });

      // Timeout fallback jika tidak ada respons dari main process
      setTimeout(() => {
        if (btnSyncData.disabled && span && span.textContent === "Syncing...") {
          console.error("Sync operation timed out.");
          if (span) span.textContent = "Timeout";
          showToastActions("⌛ Sync timed out.");
          setTimeout(() => {
            if (span) span.textContent = originalText;
            if (icon) icon.classList.remove("animate-spin");
            btnSyncData.disabled = false;
          }, 2000);
        }
      }, 15000); // Timeout 15 detik
    } else {
      // Simulasi jika bukan di Electron
      console.warn("Data sync (browser mode)...");
      setTimeout(() => {
        if (span) span.textContent = "✅ Synced";
        showToastActions("🔄 Sync complete!");

        // Kembalikan tombol setelah jeda
        setTimeout(() => {
          if (span) span.textContent = originalText;
          if (icon) icon.classList.remove("animate-spin");
          btnSyncData.disabled = false;
        }, 2000);
      }, 1500 + Math.random() * 1000); // Simulasi 1.5 - 2.5 detik
    }
  });
}

if (btnBackup) {
  // Event listener untuk click
  btnBackup.addEventListener("click", () => {
    const span = btnBackup.querySelector("span");
    const originalText = span ? span.textContent : "Backup";

    // Nonaktifkan tombol dan ubah teks
    btnBackup.disabled = true;
    if (span) span.textContent = "Backing up...";

    // Dapatkan atau buat progress bar untuk backup
    let backupProgressContainer = document.getElementById("backupProgressContainer");
    let backupProgressBarFill = document.getElementById("backupProgressBarFill");
    let backupProgressText = document.getElementById("backupProgressText");

    if (!backupProgressContainer) {
      backupProgressContainer = document.createElement("div");
      backupProgressContainer.id = "backupProgressContainer";
      backupProgressContainer.className = "w-full h-2 bg-slate-800/50 mt-1 rounded-full overflow-hidden relative z-10";
      backupProgressContainer.innerHTML = `
        <div id="backupProgressBarFill" class="h-full bg-gradient-to-r from-cyan-400 to-blue-600 w-[1%] transition-all duration-300 ease-out shadow-lg"></div>
        <div id="backupProgressText" class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-white font-medium drop-shadow">1%</div>
      `;
      // Masukkan progress bar di dalam tombol, tepat setelah elemen span
      if (span) {
        span.insertAdjacentElement("afterend", backupProgressContainer);
      } else {
        btnBackup.appendChild(backupProgressContainer);
      }
      backupProgressBarFill = document.getElementById("backupProgressBarFill");
      backupProgressText = document.getElementById("backupProgressText");
    } else {
      backupProgressContainer.classList.remove("hidden");
      if (backupProgressBarFill) backupProgressBarFill.style.width = "1%";
      if (backupProgressText) backupProgressText.textContent = "1%";
    }

    // Mulai animasi progress bar (simulasi)
    let width = 1; // Mulai dari 1%
    const interval = setInterval(() => {
      if (!backupProgressBarFill || !backupProgressText) { // Hentikan jika elemen hilang
        clearInterval(interval);
        return;
      }
      width += Math.random() * 5 + 1; // Kenaikan acak untuk realisme
      width = Math.min(width, 100); // Maksimum 100%
      backupProgressBarFill.style.width = `${width}%`;
      backupProgressText.textContent = `${Math.floor(width)}%`;
      if (width >= 100) {
        clearInterval(interval);
      }
    }, 150); // Interval untuk animasi halus

    // Kirim event ke Electron atau simulasi
    if (isElectronContext && ipcRenderer) {
      ipcRenderer.send("start-backup");

      // Listener HANYA SEKALI untuk hasil backup
      ipcRenderer.once("backup-complete", (event, result) => {
        clearInterval(interval); // Hentikan animasi progress
        if (backupProgressBarFill) backupProgressBarFill.style.width = "100%";
        if (backupProgressText) backupProgressText.textContent = "100%";

        const success = !(result && result.success === false);
        const message = result && result.message ? result.message : (success ? "Backup completed successfully." : "Backup failed.");

        if (span) span.textContent = success ? "✅ Backup Done" : "❌ Backup Failed";
        showToastActions(success ? "💾 Backup successful!" : "⚠️ Backup error!");

        // Hapus progress bar dari DOM setelah jeda
        setTimeout(() => {
          if (backupProgressContainer) backupProgressContainer.remove();
          if (span) span.textContent = originalText;
          btnBackup.disabled = false;
        }, 2000);
      });

      // Timeout fallback
      setTimeout(() => {
        if (btnBackup.disabled && span && span.textContent === "Backing up...") {
          console.error("Backup operation timed out.");
          clearInterval(interval);
          if (span) span.textContent = "Timeout";
          if (backupProgressBarFill) backupProgressBarFill.style.width = "100%";
          if (backupProgressText) backupProgressText.textContent = "100%";
          showToastActions("⌛ Backup timed out.");
          setTimeout(() => {
            if (backupProgressContainer) backupProgressContainer.remove();
            if (span) span.textContent = originalText;
            btnBackup.disabled = false;
          }, 2000);
        }
      }, 20000); // Timeout 20 detik
    } else {
      // Simulasi jika bukan di Electron
      console.warn("Backup (browser mode)...");
      const simulationDuration = Math.random() * 2000 + 3000; // 3-5 detik
      setTimeout(() => {
        if (backupProgressBarFill && parseFloat(backupProgressBarFill.style.width) < 100) {
          clearInterval(interval); // Hentikan jika belum 100%
          if (backupProgressBarFill) backupProgressBarFill.style.width = "100%";
          if (backupProgressText) backupProgressText.textContent = "100%";
        }
        setTimeout(() => {
          if (span) span.textContent = "✅ Backup Done";
          showToastActions("💾 Backup completed.");

          // Hapus progress bar dari DOM
          setTimeout(() => {
            if (backupProgressContainer) backupProgressContainer.remove();
            if (span) span.textContent = originalText;
            btnBackup.disabled = false;
          }, 2000);
        }, 100); // Jeda kecil
      }, simulationDuration);
    }
  });
}

        // --- Event Listener untuk Tombol Console ---
        if (btnConsole) {
          // Cek atau buat modal console
          let consoleModal = document.getElementById("consoleModal");

          if (!consoleModal) {
            consoleModal = document.createElement("div");
            consoleModal.id = "consoleModal";
            // Modal container: full screen, background semi-transparan, flex center
            consoleModal.className = "fixed inset-0 hidden items-center justify-center bg-black/70 z-50 p-4 backdrop-blur-sm";
            // Modal content: background gelap, border, rounded, ukuran maks, flex column
            consoleModal.innerHTML = `
                <div class="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col shadow-xl">
                    <div class="p-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center rounded-t-lg">
                        <span class="text-sm font-mono text-cyan-400 flex items-center">
                           <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 9l3 3-3 3m5 0h3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                           root@server:~#
                        </span>
                        <button id="closeConsoleBtn" title="Close Console" class="text-lg text-slate-400 hover:text-red-500 transition-colors">&times;</button>
                    </div>
                    <div id="consoleOutput" class="flex-1 p-3 overflow-y-auto font-mono text-sm text-slate-300 space-y-1 h-64 bg-black/20">
                       <div class="text-yellow-500">Welcome to the simulated console. Type 'help' for commands.</div>
                    </div>
                    <div class="p-2 bg-slate-800 border-t border-slate-700 flex items-center rounded-b-lg">
                       <span class="text-cyan-400 font-mono text-sm mr-1">$</span>
                       <input id="consoleInput" type="text" placeholder="Enter command..." class="w-full bg-transparent outline-none text-slate-200 text-sm font-mono" autocomplete="off" />
                    </div>
                </div>
            `;
            document.body.appendChild(consoleModal);
          }

          // Ambil elemen-elemen di dalam modal
          const closeBtn = document.getElementById("closeConsoleBtn");
          const consoleInput = document.getElementById("consoleInput");
          const consoleOutput = document.getElementById("consoleOutput");

          // Event listener untuk membuka modal
          btnConsole.addEventListener("click", () => {
            if (consoleModal) {
              consoleModal.classList.remove("hidden");
              consoleModal.classList.add("flex"); // Gunakan flex untuk centering
              if (consoleInput) consoleInput.focus(); // Fokus ke input saat dibuka
            }
          });

          // Event listener untuk menutup modal
          if (closeBtn) {
            closeBtn.addEventListener("click", () => {
              if (consoleModal) {
                consoleModal.classList.add("hidden");
                consoleModal.classList.remove("flex");
              }
            });
          }
          // Event listener untuk menutup modal jika klik di luar area konten
          if (consoleModal) {
            consoleModal.addEventListener('click', (event) => {
              // Cek jika target klik adalah background modal itu sendiri
              if (event.target === consoleModal) {
                consoleModal.classList.add("hidden");
                consoleModal.classList.remove("flex");
              }
            });
          }


          // Event listener untuk input command
          if (consoleInput && consoleOutput) {
            consoleInput.addEventListener("keydown", function (e) {
              if (e.key === "Enter") {
                const cmd = consoleInput.value.trim();
                consoleInput.value = ""; // Kosongkan input

                // Tampilkan command yang diketik
                appendToConsole(`<span class="text-gray-500">&gt;</span> ${cmd}`);

                // Proses command (simulasi)
                if (cmd === "help") {
                  appendToConsole("Available commands: help, ls, clear, date, whoami, ping [host], exit");
                } else if (cmd === "ls") {
                  appendToConsole("<span class='text-blue-400'>backup.log</span>  config.yaml  <span class='text-green-400'>run.sh</span>  <span class='text-purple-400'>logs/</span>");
                } else if (cmd === "whoami") {
                  appendToConsole("user: <span class='text-yellow-400'>User</span>");
                } else if (cmd === "date") {
                  appendToConsole(new Date().toString());
                } else if (cmd === "clear") {
                  consoleOutput.innerHTML = '<div class="text-yellow-500">Console cleared.</div>'; // Beri pesan setelah clear
                } else if (cmd.startsWith("ping ")) {
                  const host = cmd.substring(5);
                  appendToConsole(`Pinging ${host}...`);
                  setTimeout(() => appendToConsole(`Reply from ${host}: time=12ms TTL=64`), 500);
                  setTimeout(() => appendToConsole(`Reply from ${host}: time=15ms TTL=64`), 1000);
                } else if (cmd === "exit") {
                  appendToConsole("Closing console...");
                  setTimeout(() => {
                    if (consoleModal) {
                      consoleModal.classList.add("hidden");
                      consoleModal.classList.remove("flex");
                    }
                  }, 500);
                } else if (cmd === "") {
                  // Abaikan input kosong, tidak perlu output
                } else {
                  appendToConsole(`<span class="text-red-500">Command not found:</span> ${cmd}`);
                }
              }
            });
          }
        } // Akhir dari if (btnConsole)

      }); // Akhir dari DOMContentLoaded untuk Tombol Aksi Cepat