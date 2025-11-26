    // =========================================================================
      // BAGIAN 8: PENGATURAN SISTEM (TOGGLES - Dalam DOMContentLoaded)
      // =========================================================================
      document.addEventListener("DOMContentLoaded", function () {
        // Ambil elemen toggle
        const powerManagementToggle = document.getElementById("powerManagementToggle");
        const securityProtocolToggle = document.getElementById("securityProtocolToggle");
        const powerSavingModeToggle = document.getElementById("powerSavingModeToggle");
        const autoShutdownToggle = document.getElementById("autoShutdownToggle");

        // Variabel lokal untuk log aktivitas dan timeout shutdown
        let activityLog = [];
        let shutdownTimeout = null; // Untuk menyimpan ID timeout auto shutdown

        /**
         * @function showToastSettings
         * @description Menampilkan notifikasi toast sementara (versi untuk settings).
         * @param {string} message - Pesan yang akan ditampilkan.
         * @param {string} [type="info"] - Tipe notifikasi ('info', 'success', 'warning', 'danger').
         */
        function showToastSettings(message, type = "info") {
          const colors = {
            info: "bg-slate-800 border-slate-700 text-slate-200",
            success: "bg-green-900/30 border-green-800 text-green-300",
            warning: "bg-yellow-900/30 border-yellow-800 text-yellow-300",
            danger: "bg-red-900/30 border-red-800 text-red-300"
          };

          const toast = document.createElement("div");
          // Gunakan style fixed yang sama seperti di Actions
          toast.className = `fixed bottom-5 right-5 ${colors[type]} px-4 py-2 rounded-md shadow-lg text-sm font-mono border z-50 animate-fade-in-action`; // Re-use animasi
          toast.textContent = message;
          document.body.appendChild(toast);

          // Hapus toast setelah beberapa detik
          setTimeout(() => {
            toast.classList.add("opacity-0", "transition-opacity", "duration-300");
            setTimeout(() => toast.remove(), 300);
          }, 2500); // Durasi tampil sedikit lebih lama: 2.5 detik

          // Tambahkan juga ke log internal
          addLog(message);
        }
        /**
         * @description Akhir dari fungsi showToastSettings.
         */

        /**
         * @function addLog
         * @description Menambahkan entri log ke array activityLog dengan timestamp.
         * @param {string} message - Pesan log.
         */
        function addLog(message) {
          const timestamp = new Date().toLocaleTimeString();
          const logEntry = `[${timestamp}] ${message}`;
          activityLog.push(logEntry);
          // console.log("Activity Log:", logEntry); // Tampilkan di console jika perlu debug
          // Batasi ukuran log jika perlu
          if (activityLog.length > 100) {
            activityLog.shift(); // Hapus log terlama
          }
        }
        /**
         * @description Akhir dari fungsi addLog.
         */

        /**
         * @function toggleVisualEffect
         * @description Menambah atau menghapus efek visual (ring border) pada elemen parent toggle.
         * @param {HTMLElement} element - Elemen toggle (input checkbox).
         * @param {boolean} isActive - Status aktif toggle.
         */
        function toggleVisualEffect(element, isActive) {
          // Cari elemen parent terdekat yang memiliki class 'border' untuk diberi efek ring
          const parentBorder = element.closest(".border");
          if (parentBorder) {
            if (isActive) {
              // Tambahkan kelas untuk efek aktif (misal: ring biru)
              parentBorder.classList.add("ring-2", "ring-cyan-500/50", "border-cyan-600/70");
              parentBorder.classList.remove("border-slate-700"); // Hapus border default
            } else {
              // Hapus kelas efek aktif dan kembalikan border default
              parentBorder.classList.remove("ring-2", "ring-cyan-500/50", "border-cyan-600/70");
              parentBorder.classList.add("border-slate-700");
            }
          }
        }
        /**
         * @description Akhir dari fungsi toggleVisualEffect.
         */

        /**
         * @function simulateAsyncAction
         * @description Mensimulasikan aksi asynchronous (misalnya API call) dengan delay.
         * @param {string} actionName - Nama aksi untuk logging.
         * @param {number} [duration=1000] - Durasi simulasi dalam milidetik.
         * @returns {Promise<string>} Promise yang resolve dengan pesan Success.
         */
        function simulateAsyncAction(actionName, duration = 1000) {
          // console.log(`Starting async action: ${actionName}...`);
          return new Promise(resolve => {
            setTimeout(() => {
              const message = `${actionName} configuration applied successfully.`;
              // console.log(`Finished async action: ${actionName}`);
              resolve(message);
            }, duration);
          });
        }
        /**
         * @description Akhir dari fungsi simulateAsyncAction.
         */

        // --- Event Listener untuk Toggle Power Management ---
        if (powerManagementToggle) {
          // Set visual awal berdasarkan state checked
          toggleVisualEffect(powerManagementToggle, powerManagementToggle.checked);

          powerManagementToggle.addEventListener("change", async function () {
            const isActive = this.checked;
            toggleVisualEffect(this, isActive); // Update visual

            this.disabled = true; // Nonaktifkan sementara
            const actionName = isActive ? "Power Management Activation" : "Power Management Deactivation";
            const toastMessage = isActive ? "⚡ Power Management: Activated — Optimizing..." : "🛑 Power Management: Deactivated";
            const toastType = isActive ? "success" : "warning";

            showToastSettings(toastMessage, toastType);
            try {
              const result = await simulateAsyncAction(actionName, isActive ? 1200 : 800);
              addLog(result); // Log hasil Success
            } catch (error) {
              console.error(`${actionName} failed:`, error);
              showToastSettings(`Error during ${actionName}`, "danger");
            } finally {
              this.disabled = false; // Aktifkan kembali toggle
            }
          });
        }

        // --- Event Listener untuk Toggle Security Protocol ---
        if (securityProtocolToggle) {
          // Set visual awal
          toggleVisualEffect(securityProtocolToggle, securityProtocolToggle.checked);

          securityProtocolToggle.addEventListener("change", async function () {
            const isActive = this.checked;
            toggleVisualEffect(this, isActive);

            this.disabled = true;
            const actionName = isActive ? "Security Protocol Enhancement" : "Security Protocol Relaxation";
            const toastMessage = isActive ? "🔐 Security Protocol: Enhanced" : "🔓 Security Protocol: Standard";
            const toastType = isActive ? "success" : "warning";

            showToastSettings(toastMessage, toastType);
            try {
              const result = await simulateAsyncAction(actionName, 1000);
              addLog(result);
            } catch (error) {
              console.error(`${actionName} failed:`, error);
              showToastSettings(`Error during ${actionName}`, "danger");
            } finally {
              this.disabled = false;
            }
          });
        }

        // --- Event Listener untuk Toggle Power Saving Mode ---
        if (powerSavingModeToggle) {
          // Set visual awal
          toggleVisualEffect(powerSavingModeToggle, powerSavingModeToggle.checked);

          powerSavingModeToggle.addEventListener("change", async function () {
            const isActive = this.checked;
            toggleVisualEffect(this, isActive);

            this.disabled = true;
            const actionName = isActive ? "Entering Low-Power Mode" : "Leaving Low-Power Mode";
            const toastMessage = isActive ? "🌙 Power Saving Mode: Activated" : "💡 Power Saving Mode: Deactivated";
            const toastType = isActive ? "success" : "info";

            showToastSettings(toastMessage, toastType);
            try {
              const result = await simulateAsyncAction(actionName, isActive ? 1000 : 800);
              addLog(result);
            } catch (error) {
              console.error(`${actionName} failed:`, error);
              showToastSettings(`Error during ${actionName}`, "danger");
            } finally {
              this.disabled = false;
            }
          });
        }

        // --- Event Listener untuk Toggle Auto Shutdown ---
        if (autoShutdownToggle) {
          // Set visual awal
          toggleVisualEffect(autoShutdownToggle, autoShutdownToggle.checked);

          autoShutdownToggle.addEventListener("change", async function () {
            const isActive = this.checked;
            toggleVisualEffect(this, isActive);

            if (isActive) {
              // Aktifkan auto shutdown
              const shutdownDelay = 30000; // 30 detik
              showToastSettings(`⏰ Auto Shutdown: Activated — System will shut down in ${shutdownDelay / 1000} seconds`, "danger");
              addLog(`Auto Shutdown scheduled in ${shutdownDelay / 1000} seconds.`);

              // Hapus timeout sebelumnya jika ada
              if (shutdownTimeout) clearTimeout(shutdownTimeout);

              // Set timeout baru
              shutdownTimeout = setTimeout(() => {
                showToastSettings("🔴 SYSTEM SHUTDOWN INITIATED ", "danger");
                addLog(" Auto Shutdown executed.");
                // Di aplikasi nyata, di sini akan memanggil fungsi shutdown sistem
                // Contoh: if (ipcRenderer) ipcRenderer.send('shutdown-system');

                // Reset toggle secara visual setelah shutdown (simulasi)
                this.checked = false;
                toggleVisualEffect(this, false);
                shutdownTimeout = null; // Reset ID timeout

              }, shutdownDelay);

            } else {
              // Batalkan auto shutdown jika dinonaktifkan
              if (shutdownTimeout) {
                clearTimeout(shutdownTimeout); // Batalkan timeout yang terjadwal
                shutdownTimeout = null;
                showToastSettings("⏸️ Auto Shutdown: Canceled", "info");
                addLog("Auto Shutdown schedule canceled by user.");
              } else {
                // Jika tidak ada timeout aktif, tidak perlu notifikasi pembatalan
                addLog("Auto Shutdown was not active.");
              }
            }
          });
        }

        // Opsi untuk menampilkan log aktivitas di console secara berkala (untuk debug)
        const showActivityLogInConsole = false; // Ubah ke true jika ingin melihat log di console
        if (showActivityLogInConsole) {
          setInterval(() => {
            if (activityLog.length > 0) {
              console.groupCollapsed(`Activity Log (${activityLog.length} entries)`);
              console.table(activityLog.slice(-10)); // Tampilkan 10 log terakhir dalam tabel
              console.groupEnd();
            }
          }, 10000); // Tampilkan setiap 10 detik
        }

      }); // Akhir dari DOMContentLoaded untuk Pengaturan Sistem