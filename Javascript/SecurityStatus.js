// =========================================================================
      // BAGIAN 2: STATUS KEAMANAN (Firewall, Intrusion, dll. - Tanpa DOMContentLoaded)
      // =========================================================================

      // Cek apakah berjalan di lingkungan Electron
      const isElectron = typeof require === 'function';

      // Elemen DOM untuk status keamanan (diasumsikan ada saat script dieksekusi)
      const firewallBadge = document.getElementById("firewallBadge");
      const intrusionBadge = document.getElementById("intrusionBadge");
      const encryptionBadge = document.getElementById("encryptionBadge");
      const threatDbTime = document.getElementById("threatDbTime");
      const securityLevelBar = document.getElementById("securityLevelBar");
      const securityLevelText = document.getElementById("securityLevelText");
      const toastContainer = document.getElementById("toastContainer"); // Container untuk toast


      function randomBool(probability = 0.9) {
        return Math.random() < probability;
      }

      function showToastSecurity(message, type = "info") {
        // Pastikan container ada
        if (!toastContainer) {
          console.error("Toast container (#toastContainer) not found.");
          return;
        }

        const colors = {
          info: "bg-slate-800 border-slate-700 text-slate-200",
          success: "bg-green-900/30 border-green-800 text-green-300",
          warning: "bg-yellow-900/30 border-yellow-800 text-yellow-300",
          danger: "bg-red-900/30 border-red-800 text-red-300"
        };

        const toast = document.createElement("div");
        toast.className = `mb-2 ${colors[type]} px-4 py-2 rounded-md shadow-lg text-sm font-mono border animate-fade-in`;
        toast.textContent = message;

        toastContainer.appendChild(toast);

        // Hapus toast setelah beberapa detik
        setTimeout(() => {
          toast.classList.add("opacity-0");
          // Hapus elemen dari DOM setelah transisi selesai
          setTimeout(() => toast.remove(), 300);
        }, 2000); // Durasi tampil: 2 detik
      }

      function updateSecurityUI(data) {
        // Update Firewall Badge
        if (firewallBadge) {
          if (data.firewallActive) {
            firewallBadge.textContent = "Active";
            firewallBadge.className = "bg-gradient-to-r from-green-900/30 to-green-800/20 text-green-400 border border-green-700/50 rounded-md px-2 py-1 text-xs";
          } else {
            firewallBadge.textContent = "Inactive";
            firewallBadge.className = "bg-gradient-to-r from-red-900/30 to-red-800/20 text-red-400 border border-red-700/50 rounded-md px-2 py-1 text-xs";
          }
        }

        // Update Intrusion Detection Badge
        if (intrusionBadge) {
          if (!data.intrusionDetected) {
            intrusionBadge.textContent = "Active";
            intrusionBadge.className = "bg-gradient-to-r from-green-900/30 to-green-800/20 text-green-400 border border-green-700/50 rounded-md px-2 py-1 text-xs";
          } else {
            intrusionBadge.textContent = "⚠️ Threat Detected!";
            intrusionBadge.className = "bg-gradient-to-r from-red-900/30 to-red-800/20 text-red-400 border border-red-700/50 rounded-md px-2 py-1 text-xs animate-pulse";
            // Tampilkan notifikasi toast jika ancaman terdeteksi

          }
        }

        // Update Encryption Badge
        if (encryptionBadge) {
          if (data.encryptionEnabled) {
            encryptionBadge.textContent = "Active";
            encryptionBadge.className = "bg-gradient-to-r from-green-900/30 to-green-800/20 text-green-400 border border-green-700/50 rounded-md px-2 py-1 text-xs";
          } else {
            encryptionBadge.textContent = "Disabled";
            encryptionBadge.className = "bg-gradient-to-r from-yellow-900/30 to-yellow-800/20 text-yellow-400 border border-yellow-700/50 rounded-md px-2 py-1 text-xs";
          }
        }

        // Update Threat DB Time
        if (threatDbTime) {
          threatDbTime.innerHTML = `Updated <span class="text-slate-500">${data.threatDbUpdated}</span>`;
        }

        // Update Security Level Bar and Text
        if (securityLevelBar && securityLevelText) {
          securityLevelBar.style.width = `${data.securityLevel}%`;
          securityLevelText.textContent = `${data.securityLevel}%`;

          // Ganti warna bar berdasarkan level keamanan
          if (data.securityLevel > 70) {
            securityLevelBar.className = "h-full bg-gradient-to-r from-green-500 to-cyan-500 rounded-full";
          } else if (data.securityLevel > 40) {
            securityLevelBar.className = "h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full";
          } else {
            securityLevelBar.className = "h-full bg-gradient-to-r from-red-500 to-pink-500 rounded-full";
          }
        }
      }
      /**
       * @description Akhir dari fungsi updateSecurityUI.
       */

      // Logika utama untuk status keamanan
      if (isElectron) {
        // Jika berjalan di Electron, gunakan IPC untuk komunikasi data
        const { ipcRenderer } = require("electron"); // Gunakan require yang aman

        // Terima data update keamanan dari proses main
        ipcRenderer.on("security-update", (event, data) => {
          updateSecurityUI(data);
        });

        // Kirim permintaan data keamanan awal saat siap
        ipcRenderer.send("request-security-data");

      } else {
        // Jika berjalan di browser biasa, jalankan simulasi data
        console.warn("Running in browser mode. Simulating security data.");
        setInterval(() => {
          const simulatedData = {
            firewallActive: randomBool(0.95),
            intrusionDetected: !randomBool(0.98), // Lebih sering tidak terdeteksi
            encryptionEnabled: randomBool(0.99),
            threatDbUpdated: `${Math.floor(Math.random() * 60)} min ago`,
            securityLevel: Math.max(30, Math.min(100, Math.floor(Math.random() * 80) + 20)) // Antara 30 dan 100
          };
          // Panggil fungsi update UI dengan data simulasi
          updateSecurityUI(simulatedData);
        }, 5000); // Update simulasi setiap 5 detik
      }

