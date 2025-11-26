// =========================================================================
      // BAGIAN 7: ALOKASI SUMBER DAYA (Dalam DOMContentLoaded)
      // =========================================================================
      document.addEventListener("DOMContentLoaded", function () {
        // Elemen DOM untuk bar dan persentase
        const procBar = document.getElementById("procBar");
        const memBar = document.getElementById("memBar");
        const netBar = document.getElementById("netBar");

        const procPercent = document.getElementById("procPercent");
        const memPercent = document.getElementById("memPercent");
        const netPercent = document.getElementById("netPercent");

        // Elemen DOM untuk slider prioritas
        const prioritySlider = document.getElementById("prioritySlider");
        const priorityValue = document.getElementById("priorityValue");

        // Inisialisasi nilai awal (variabel lokal untuk scope ini)
        let currentCpuUsage = 40; // Gunakan nama berbeda jika ada global
        let currentMemUsage = 68;
        let currentNetUsage = 35;

        /**
         * @function updateResourceUI
         * @description Memperbarui tampilan bar dan teks persentase untuk alokasi sumber daya.
         */
        function updateResourceUI() {
          // Update Processor Allocation
          if (procBar) procBar.style.width = `${currentCpuUsage}%`;
          if (procPercent) procPercent.textContent = `${currentCpuUsage.toFixed(0)}% allocated`;

          // Update Memory Allocation
          if (memBar) memBar.style.width = `${currentMemUsage}%`;
          if (memPercent) memPercent.textContent = `${currentMemUsage.toFixed(0)}% allocated`;

          // Update Network Allocation
          if (netBar) netBar.style.width = `${currentNetUsage}%`;
          if (netPercent) netPercent.textContent = `${currentNetUsage.toFixed(0)}% allocated`;
        }
        /**
         * @description Akhir dari fungsi updateResourceUI.
         */

        // Panggil update UI awal
        updateResourceUI();

        // --- Estimasi CPU Load menggunakan PerformanceObserver (jika didukung browser) ---
        if (typeof PerformanceObserver !== "undefined" && typeof performance !== "undefined") {
          let lastFrameTime = performance.now();
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntriesByName("task-measure", "measure"); // Dapatkan measure spesifik
            if (entries.length > 0) {
              const entry = entries[entries.length - 1]; // Ambil yang terbaru
              const duration = entry.duration; // Durasi task
              const now = performance.now();
              const elapsed = now - lastFrameTime; // Waktu sejak frame terakhir

              // Estimasi CPU load kasar berdasarkan rasio waktu task terhadap waktu frame
              // Dibatasi agar tidak terlalu ekstrem dan lebih halus
              const estimatedLoad = Math.min(95, Math.max(10, (duration / elapsed) * 100 * 1.5)); // Kalibrasi multiplier
              // Gunakan Exponential Moving Average (EMA) untuk menghaluskan nilai
              currentCpuUsage = currentCpuUsage * 0.8 + estimatedLoad * 0.2;
              currentCpuUsage = Math.round(currentCpuUsage); // Bulatkan

              lastFrameTime = now;
              // Update UI setelah perhitungan CPU
              // updateResourceUI(); // Dipanggil di interval simulasi saja agar tidak terlalu sering
            }
          });

          try {
            observer.observe({ entryTypes: ["measure"] });
          } catch (e) {
            console.warn("PerformanceObserver couldn't observe 'measure'. CPU estimation might be less accurate.", e);
          }

          // Jalankan task ringan secara berkala untuk diukur oleh PerformanceObserver
          setInterval(() => {
            performance.mark("start-task-measure");
            // Simulasi pekerjaan CPU (loop sederhana)
            let result = 0;
            for (let i = 0; i < 5e5; i++) { // Kurangi iterasi agar tidak terlalu berat
              result += Math.sqrt(i);
            }
            performance.mark("end-task-measure");
            try {
              performance.measure("task-measure", "start-task-measure", "end-task-measure");
            } catch (e) {
              // abaikan error jika mark sudah ada atau dihapus
            }

          }, 500); // Jalankan task pengukuran setiap 500ms

        } else {
          console.warn("PerformanceObserver or performance API not fully supported. Using basic CPU simulation.");
          // Fallback simulasi CPU jika PerformanceObserver tidak ada
          setInterval(() => {
            currentCpuUsage += (Math.random() - 0.5) * 8; // Fluktuasi lebih acak
            currentCpuUsage = Math.min(95, Math.max(10, currentCpuUsage));
            currentCpuUsage = Math.round(currentCpuUsage);
          }, 2000);
        }


        // --- Simulasi Perubahan Memori dan Jaringan ---
        setInterval(() => {
          // Simulasi fluktuasi Memori
          currentMemUsage += (Math.random() * 6 - 3); // Fluktuasi -3 sampai +3
          currentMemUsage = Math.max(30, Math.min(90, currentMemUsage)); // Batasi 30-90%

          // Simulasi fluktuasi Jaringan
          currentNetUsage += (Math.random() * 8 - 4); // Fluktuasi -4 sampai +4
          currentNetUsage = Math.max(5, Math.min(75, currentNetUsage)); // Batasi 5-75%

          // Update UI secara berkala
          updateResourceUI();
        }, 2000); // Update simulasi Mem/Net setiap 2 detik

        // --- Event Listener untuk Slider Prioritas ---
        if (prioritySlider && priorityValue) {
          // Set nilai awal teks slider
          priorityValue.textContent = `${prioritySlider.value}/5`;

          // Update teks saat nilai slider berubah
          prioritySlider.addEventListener("input", function () {
            priorityValue.textContent = `${this.value}/5`;
            // Di sini bisa ditambahkan logika untuk mengirim perubahan prioritas
            // console.log(`Priority set to: ${this.value}`);
            // if (isElectronContext && ipcRenderer) {
            //     ipcRenderer.send('set-resource-priority', this.value);
            // }
          });
        }
      }); // Akhir dari DOMContentLoaded untuk Alokasi Sumber Daya