// =========================================================================
      // BAGIAN 3: SISTEM ALERT (Dalam DOMContentLoaded)
      // =========================================================================
      document.addEventListener("DOMContentLoaded", function () {
        // Elemen DOM untuk alert
        const alertContainer = document.getElementById("systemAlertsContainer");
        // Asumsi library 'si' (systeminformation) sudah di-load jika tidak di Electron
        const si = (typeof require === 'function') ? require('systeminformation') : window.si;
        // Asumsi ipcRenderer sudah ada jika di Electron
        const ipcRenderer = (typeof require === 'function') ? require('electron').ipcRenderer : undefined;

        /**
         * @function getCurrentTime
         * @description Mendapatkan waktu saat ini dalam format string lokal.
         * @returns {string} String waktu (misal: "14:30:55").
         */
        function getCurrentTime() {
          return new Date().toLocaleTimeString();
        }
        /**
         * @description Akhir dari fungsi getCurrentTime.
         */

        /**
         * @function createAlert
         * @description Membuat dan menambahkan elemen alert baru ke container alert.
         * @param {object} options - Opsi untuk alert.
         * @param {string} [options.type="info"] - Tipe alert ('info', 'warning', 'success').
         * @param {string} options.title - Judul alert.
         * @param {string} options.message - Pesan detail alert.
         * @param {string} [options.time=getCurrentTime()] - Waktu kejadian alert.
         */
        function createAlert({ type = "info", title, message, time = getCurrentTime() }) {
          if (!alertContainer) {
            console.error("Alert container (#systemAlertsContainer) not found.");
            return;
          }

          const icons = {
            info: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
            warning: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`,
            success: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
          };

          const colors = {
            info: { bg: "bg-blue-900/20", border: "border-blue-700/30", iconBg: "bg-blue-500/20", iconColor: "text-blue-400" },
            warning: { bg: "bg-amber-900/20", border: "border-amber-700/30", iconBg: "bg-amber-500/20", iconColor: "text-amber-400" },
            success: { bg: "bg-green-900/20", border: "border-green-700/30", iconBg: "bg-green-500/20", iconColor: "text-green-400" }
          };

          const alertDiv = document.createElement("div");
          alertDiv.className = `flex items-start space-x-3 p-3 bg-gradient-to-r from-${colors[type].bg} to-${colors[type].bg.replace("/20", "/10")} rounded-lg border ${colors[type].border} transition-all hover:scale-[1.01] mb-2`; // Tambah margin bottom
          alertDiv.innerHTML = `
            <div class="mt-0.5 p-1.5 ${colors[type].iconBg} rounded-full">
                ${icons[type]}
            </div>
            <div class="flex-1">
                <div class="flex items-center">
                    <div class="text-sm font-medium text-slate-200">${title}</div>
                    <div class="ml-2 text-xs text-slate-500">${time}</div>
                </div>
                <div class="text-xs text-slate-400 mt-1">
                    ${message}
                </div>
            </div>
        `;
          // Tambahkan alert baru di bagian atas container
          alertContainer.prepend(alertDiv);
        }
        /**
         * @description Akhir dari fungsi createAlert.
         */

        /**
         * @function checkMemoryUsage
         * @description Memeriksa penggunaan memori sistem menggunakan systeminformation (jika tersedia)
         * dan membuat alert jika penggunaan melebihi batas tertentu.
         */
        async function checkMemoryUsage() {
          // Hanya jalankan jika 'si' tersedia (Electron atau library dimuat manual)
          if (!si || typeof si.mem !== 'function') {
            // console.warn("Systeminformation library (si.mem) not available for memory check.");
            return;
          }
          try {
            const mem = await si.mem();
            const usagePercent = Math.round((mem.active / mem.total) * 100);

            if (usagePercent > 80) {
              createAlert({
                type: "warning",
                title: "MemoryWarning",
                message: `Penggunaan RAM melebihi batas aman: ${usagePercent}% aktif`
              });
            }
          } catch (err) {
            console.warn("Failed to retrieve RAM data:", err.message);
          }
        }
        /**
         * @description Akhir dari fungsi checkMemoryUsage.
         */

        /**
         * @function checkSuspiciousProcesses
         * @description Memeriksa daftar proses yang berjalan (jika 'si' tersedia)
         * dan membuat alert jika ditemukan nama proses yang mencurigakan.
         */
        async function checkSuspiciousProcesses() {
          // Hanya jalankan jika 'si' tersedia (Electron atau library dimuat manual)
          if (!si || typeof si.processes !== 'function') {
            // console.warn("Systeminformation library (si.processes) not available for process check.");
            return;
          }
          try {
            const processes = await si.processes();
            // Filter proses berdasarkan nama yang mengandung kata kunci mencurigakan (case-insensitive)
            const suspicious = processes.list.filter(p => /trojan|virus|malware|keylogger|rms/i.test(p.name));

            if (suspicious.length > 0) {
              createAlert({
                type: "warning",
                title: "⚠️ Ancaman Terdeteksi!",
                message: `Ditemukan ${suspicious.length} proses mencurigakan: ${suspicious.map(p => p.name).slice(0, 3).join(", ") || "Proses tidak diketahui"}`
              });
            }
          } catch (err) {
            console.warn("Failed to check the process:", err.message);
          }
        }
        /**
         * @description Akhir dari fungsi checkSuspiciousProcesses.
         */

        // Setup listener IPC jika berjalan di Electron
        if (typeof ipcRenderer !== "undefined") {
          // Listener untuk hasil scan keamanan dari proses main
          ipcRenderer.on("security-scan-result", (event, result) => {
            createAlert({
              type: result.success ? "success" : "warning",
              title: result.success ? "Scan Finish" : "Threat Detected!", // Judul disesuaikan
              message: result.message || (result.success
                ? "Security scan completed without threat."
                : "Viruses or potential threats detected during the scan."),
              time: new Date().toLocaleTimeString()
            });
          });

          // Listener untuk notifikasi backup selesai
          ipcRenderer.on("backup-complete", (event, result) => { // Tambahkan parameter result jika ada
            createAlert({
              type: result && result.success === false ? "warning" : "success", // Cek status Success
              title: "💾 Backup " + (result && result.success === false ? "Failed" : "Finish"),
              message: result && result.message ? result.message : "Backup data saved successfully."
            });
          });

          // Listener untuk notifikasi sinkronisasi selesai
          ipcRenderer.on("sync-complete", (event, result) => { // Tambahkan parameter result jika ada
            createAlert({
              type: result && result.success === false ? "warning" : "success", // Cek status Success
              title: "🔄 Sinkronisasi " + (result && result.success === false ? "Failed" : "Success"),
              message: result && result.message ? result.message : "Data is successfully synchronized with the server."
            });
          });
        }

        // Jalankan pengecekan berkala (Memori & Proses)
        setInterval(() => {
          checkMemoryUsage();
          checkSuspiciousProcesses();
        }, 10000); // Cek setiap 10 detik


        // Simulasi alert jika bukan di Electron (untuk testing UI)

        const alertHistory = [];
        const alertsPerPage = 5;
        let currentPage = 1;

        // Fungsi untuk menambahkan alert ke riwayat
        function addAlertToHistory(alertData) {
          alertHistory.unshift(alertData); // Masukkan dari depan
          renderPaginatedAlerts();         // Update pagination
          renderActiveAlerts();            // Update alert aktif (maksimal 5)
        }

        // Fungsi untuk menampilkan hanya 5 alert terbaru di UI
        function renderActiveAlerts() {
          const container = document.getElementById("systemAlertsContainer");
          if (!container) return;

          container.innerHTML = ""; // Kosongkan dulu

          const alertsToShow = alertHistory.slice(0, 5); // Ambil 5 alert terbaru

          alertsToShow.forEach(alert => {
            const alertDiv = document.createElement("div");
            alertDiv.className = `bg-slate-800/60 p-3 rounded-lg border-l-4 ${alert.type === 'warning' ? 'border-yellow-500' :
              alert.type === 'success' ? 'border-green-500' : 'border-cyan-500'
              }`;

            alertDiv.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="font-medium text-slate-100">${alert.title}</h4>
                        <p class="text-sm text-slate-300 mt-1">${alert.message}</p>
                    </div>
                </div>
            `;
            container.appendChild(alertDiv);
          });
        }

        // Fungsi render pagination
        function renderPaginatedAlerts() {
          const paginationContainer = document.getElementById("alertPaginationContainer");
          if (!paginationContainer) return;

          paginationContainer.innerHTML = "";

          const totalPages = Math.ceil(alertHistory.length / alertsPerPage);
          if (totalPages <= 1) return;

          // Tombol Prev
          const prevBtn = document.createElement("button");
          prevBtn.textContent = "Prev";
          prevBtn.disabled = currentPage === 1;
          prevBtn.className = "px-3 py-1 bg-slate-700 text-white rounded hover:bg-slate-600 disabled:opacity-50";
          prevBtn.onclick = () => {
            if (currentPage > 1) {
              currentPage--;
              renderPaginatedAlerts();
              renderActiveAlerts();
            }
          };
          paginationContainer.appendChild(prevBtn);

          // Halaman
          const maxVisiblePages = 3;
          let startPage = Math.max(1, currentPage - 1);
          let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

          for (let i = startPage; i <= endPage; i++) {
            const btn = document.createElement("button");
            btn.textContent = i;
            btn.className = `px-3 py-1 rounded ${i === currentPage ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'
              }`;
            btn.onclick = () => {
              currentPage = i;
              renderPaginatedAlerts();
              renderActiveAlerts();
            };
            paginationContainer.appendChild(btn);
          }

          // Tombol Next
          const nextBtn = document.createElement("button");
          nextBtn.textContent = "Next";
          nextBtn.disabled = currentPage === totalPages;
          nextBtn.className = "px-3 py-1 bg-slate-700 text-white rounded hover:bg-slate-600 disabled:opacity-50";
          nextBtn.onclick = () => {
            if (currentPage < totalPages) {
              currentPage++;
              renderPaginatedAlerts();
              renderActiveAlerts();
            }
          };
          paginationContainer.appendChild(nextBtn);
        }

        // Simulasi alert
        if (typeof ipcRenderer === "undefined") {
          console.warn("Running in browser mode. Simulating system alerts.");
          setInterval(() => {
            const randomNum = Math.random();
            let fakeType = "info";
            let fakeTitle = "System Info";
            let fakeMessage = "No suspicious activity detected.";

            if (randomNum > 0.9) {
              fakeType = "warning";
              fakeTitle = "MemoryWarning";
              fakeMessage = "RAM usage is close to the limit (" + Math.floor(Math.random() * 10 + 80) + "%).";
            } else if (randomNum > 0.8) {
              fakeType = "success";
              fakeTitle = "Operasi Success";
              fakeMessage = "Cloud data synchronization completed without issue.";
            }

            createAlert({
              type: fakeType,
              title: fakeTitle,
              message: fakeMessage
            });

            addAlertToHistory({
              type: fakeType,
              title: fakeTitle,
              message: fakeMessage
            });
          }, 15000);
        }

        // Inisialisasi awal
        renderActiveAlerts();
        renderPaginatedAlerts();

      }); // Akhir DOMContentLoaded