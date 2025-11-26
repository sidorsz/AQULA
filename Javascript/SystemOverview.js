// Namespace untuk System Overview
      const SystemOverview = {
        // Inisialisasi variabel
        cpuUsage: 0,
        memoryUsage: 0,
        networkStatus: 0,
        isBenchmarkRunning: false,

        // Inisialisasi elemen DOM
        elements: {
          cpuUsageEl: document.getElementById('cpuUsage'),
          cpuBar: document.querySelector('.cpu-bar'),
          cpuInfoEl: document.querySelector('.cpu-info'),
          memoryUsageEl: document.getElementById('memoryUsage'),
          memoryBar: document.querySelector('.memory-bar'),
          networkUsageEl: document.getElementById('networkUsage'),
          networkBar: document.querySelector('.network-bar')
        },

        // Fungsi untuk mengukur beban CPU (simulasi)
        async measureCPULoad() {
          const start = performance.now();
          let i = 0;
          while (i < 1e6) {
            Math.random();
            i++;
          }
          const end = performance.now();
          const duration = end - start;
          return Math.min(100, (duration / 10) * 100);
        },

        // Fungsi untuk memperbarui informasi CPU
        updateCPUInfo() {
          const coreCount = navigator.hardwareConcurrency || 'Unknown';
          if (this.elements.cpuInfoEl) {
            this.elements.cpuInfoEl.textContent = `Varies by device | ${coreCount} Cores`;
          }
        },

        // Fungsi untuk mensimulasikan beban CPU menggunakan Worker
        simulateHeavyTask() {
          if (this.isBenchmarkRunning) return;

          this.isBenchmarkRunning = true;

          const workerCode = `
                    self.onmessage = function () {
                        let i = 0;
                        while (i < 1e8) {
                            Math.sqrt(i);
                            i++;
                        }
                        self.postMessage("done");
                    };
                `;

          try {
            const blob = new Blob([workerCode], { type: "application/javascript" });
            const workerURL = URL.createObjectURL(blob);
            const worker = new Worker(workerURL);

            worker.onmessage = async () => {
              await new Promise(r => setTimeout(r, 500));
              this.isBenchmarkRunning = false;
              URL.revokeObjectURL(workerURL);
              worker.terminate();
            };

            worker.onerror = (error) => {
              console.error('Worker error:', error);
              this.isBenchmarkRunning = false;
              URL.revokeObjectURL(workerURL);
              worker.terminate();
            };

            worker.postMessage("start");
          } catch (e) {
            console.error('Failed to create worker:', e);
            this.isBenchmarkRunning = false;
          }
        },

        // Fungsi untuk memperbarui UI System Overview
        async update() {
          try {
            if (!this.isBenchmarkRunning) this.simulateHeavyTask();

            this.cpuUsage = await this.measureCPULoad();
            if (this.elements.cpuUsageEl) {
              this.elements.cpuUsageEl.innerHTML = `${this.cpuUsage.toFixed(0)}<span class="text-lg text-slate-400 ml-1">%</span>`;
            }
            if (this.elements.cpuBar) this.elements.cpuBar.style.width = `${this.cpuUsage}%`;

            if (performance && performance.memory) {
              const mem = performance.memory;
              const used = (mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100;
              this.memoryUsage = Math.min(100, used);
              if (this.elements.memoryUsageEl) {
                this.elements.memoryUsageEl.innerHTML = `${this.memoryUsage.toFixed(0)}<span class="text-lg text-slate-400 ml-1">%</span>`;
                this.elements.memoryUsageEl.nextElementSibling.innerHTML = `${(mem.usedJSHeapSize / 1e9).toFixed(1)} GB / ${(mem.jsHeapSizeLimit / 1e9).toFixed(1)} GB`;
              }
              if (this.elements.memoryBar) this.elements.memoryBar.style.width = `${this.memoryUsage}%`;
            } else {
              if (this.elements.memoryUsageEl) this.elements.memoryUsageEl.innerHTML = `N/A`;
              if (this.elements.memoryBar) this.elements.memoryBar.style.width = `0%`;
            }

            if (navigator.connection) {
              const { downlink } = navigator.connection;
              this.networkStatus = Math.min(100, (downlink / 10) * 100);
              if (this.elements.networkUsageEl) {
                this.elements.networkUsageEl.innerHTML = `${this.networkStatus.toFixed(0)}<span class="text-lg text-slate-400 ml-1">%</span>`;
                this.elements.networkUsageEl.nextElementSibling.innerHTML = `${downlink.toFixed(1)} MB/s | ${navigator.connection.rtt || 'N/A'} ms`;
              }
              if (this.elements.networkBar) this.elements.networkBar.style.width = `${this.networkStatus}%`;
            } else {
              this.networkStatus = Math.min(Math.max(this.networkStatus + (Math.random() * 4 - 2), 0), 100);
              if (this.elements.networkUsageEl) {
                this.elements.networkUsageEl.innerHTML = `${this.networkStatus.toFixed(0)}<span class="text-lg text-slate-400 ml-1">%</span>`;
              }
              if (this.elements.networkBar) this.elements.networkBar.style.width = `${this.networkStatus}%`;
            }
          } catch (error) {
            console.error('Error updating system overview:', error);
          }
        },

        // Fungsi untuk memulai monitoring
        startMonitoring() {
          setInterval(async () => {
            await this.update();
          }, 3000);
        }
      };

      // Namespace untuk Performance Chart Tabs
      const PerformanceChartTabs = {
        // Inisialisasi variabel
        chartInstance: null,
        chartData: {
          labels: [],
          cpu: [],
          memory: [],
          network: []
        },

        // Inisialisasi elemen DOM
        elements: {
          tabPerformance: document.getElementById('tabPerformance'),
          tabProcesses: document.getElementById('tabProcesses'),
          tabStorage: document.getElementById('tabStorage'),
          performanceTab: document.getElementById('performanceTab'),
          processesTab: document.getElementById('processesTab'),
          storageTab: document.getElementById('storageTab'),
          processesTable: document.getElementById('processesTable'),
          storageInfo: document.getElementById('storageInfo'),
          systemLoadEl: document.getElementById('systemLoad')
        },

        // Inisialisasi Chart.js
        initChart() {
          const chartCanvas = document.getElementById('performanceChartTab');
          if (!chartCanvas) {
            console.error('Chart canvas not found');
            return;
          }
          const chartCtx = chartCanvas.getContext('2d');
          this.chartInstance = new Chart(chartCtx, {
            type: 'line',
            data: {
              labels: this.chartData.labels,
              datasets: [
                {
                  label: 'CPU',
                  data: this.chartData.cpu,
                  borderColor: 'rgba(34, 211, 238, 1)',
                  backgroundColor: 'rgba(34, 211, 238, 0.2)',
                  fill: false,
                  tension: 0.4
                },
                {
                  label: 'Memory',
                  data: this.chartData.memory,
                  borderColor: 'rgba(168, 85, 247, 1)',
                  backgroundColor: 'rgba(168, 85, 247, 0.2)',
                  fill: false,
                  tension: 0.4
                },
                {
                  label: 'Network',
                  data: this.chartData.network,
                  borderColor: 'rgba(59, 130, 246, 1)',
                  backgroundColor: 'rgba(59, 130, 246, 0.2)',
                  fill: false,
                  tension: 0.4
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: {
                  display: true,
                  grid: { display: false },
                  ticks: { color: 'rgba(100, 116, 139, 0.8)' }
                },
                y: {
                  min: 0,
                  max: 100,
                  ticks: {
                    stepSize: 25,
                    color: 'rgba(100, 116, 139, 0.8)',
                    callback: value => `${value}%`
                  },
                  grid: { color: 'rgba(100, 116, 139, 0.2)' }
                }
              },
              plugins: {
                legend: { display: false }
              }
            }
          });
        },

        // --- Update Processes Tab (masih simulasi karena browser sandbox) ---
updateProcessesTab() {
  const processes = [
    { name: 'browser (real)', cpu: (performance.now() / 1000).toFixed(1), memory: (performance.memory?.usedJSHeapSize / 1048576).toFixed(1) || 'N/A' },
    { name: 'render-engine', cpu: (Math.random() * 5).toFixed(1), memory: (Math.random() * 120).toFixed(1) },
    { name: 'extension-service', cpu: (Math.random() * 4).toFixed(1), memory: (Math.random() * 80).toFixed(1) }
  ];

  this.elements.processesTable.innerHTML = processes.map(proc => `
    <tr class="border-b border-slate-700/30">
      <td class="px-4 py-2">${proc.name}</td>
      <td class="px-4 py-2">${proc.cpu}%</td>
      <td class="px-4 py-2">${proc.memory} MB</td>
    </tr>
  `).join('');
},

// --- Update Storage Tab (real data + Details button) ---
async updateStorageTab() {
  try {
    let usageGB = 0, quotaGB = 0, percentage = 0;

    if (navigator.storage?.estimate) {
      const { usage, quota } = await navigator.storage.estimate();
      usageGB = (usage / (1024 ** 3)).toFixed(2);
      quotaGB = (quota / (1024 ** 3)).toFixed(2);
      percentage = ((usage / quota) * 100).toFixed(1);
    }

    const freeGB = (quotaGB - usageGB).toFixed(2);

    this.elements.storageInfo.innerHTML = `
      <div class="storage-card bg-gray-800/90 p-4 rounded-xl border border-gray-700/50 shadow-sm">
        <div class="flex justify-between items-center mb-3">
          <div class="flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>
            </svg>
            <h3 class="text-sm font-semibold text-white">Browser Storage (A:)</h3>
          </div>
          <span class="text-xs px-2 py-1 rounded bg-gray-700/50 text-blue-300">IndexedDB</span>
        </div>

        <div class="mb-2">
          <div class="flex justify-between text-xs text-gray-300 mb-1">
            <span>${usageGB} GB / ${quotaGB} GB</span>
            <span>${percentage}%</span>
          </div>
          <div class="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
            <div class="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full" 
                 style="width: ${percentage}%"></div>
          </div>
        </div>

        <div class="flex justify-between items-center text-xs">
          <span class="text-gray-400">Free: ${freeGB} GB</span>
          <button id="storageDetailsBtn" class="text-blue-400 hover:text-blue-300 transition-colors flex items-center">
            <span>Details</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>

        <div id="storageDetails" class="hidden mt-3 text-xs text-gray-300"></div>
      </div>
    `;

    // Event klik tombol "Details"
    document.getElementById('storageDetailsBtn')?.addEventListener('click', async () => {
      const details = document.getElementById('storageDetails');
      if (!details) return;

      const localStorageUsage = Object.keys(localStorage).length;
      const indexedDBs = await indexedDB.databases?.() || [];
      const cachesList = await caches.keys();

      details.innerHTML = `
        <div class="p-2 border-t border-gray-700 mt-2 space-y-1">
          <p><strong>LocalStorage:</strong> ${localStorageUsage} item(s)</p>
          <p><strong>IndexedDB:</strong> ${indexedDBs.length} DB(s)</p>
          <ul class="pl-4 list-disc">${indexedDBs.map(db => `<li>${db.name || '(unnamed)'} - v${db.version}</li>`).join('')}</ul>
          <p><strong>CacheStorage:</strong> ${cachesList.length} cache(s)</p>
          <ul class="pl-4 list-disc">${cachesList.map(c => `<li>${c}</li>`).join('')}</ul>
        </div>
      `;

      details.classList.toggle('hidden');
    });

  } catch (err) {
    console.error('Error updating storage:', err);
    this.elements.storageInfo.innerHTML = `
      <div class="bg-gray-800 p-3 rounded-xl border border-gray-700 text-center text-xs">
        <p class="text-red-400">⚠️ Storage data unavailable</p>
      </div>
    `;
  }
},


        // Fungsi untuk memperbarui grafik dan system load
        updateChart() {
          const now = new Date();
          this.chartData.labels.push(now.toLocaleTimeString());
          this.chartData.cpu.push(SystemOverview.cpuUsage);
          this.chartData.memory.push(SystemOverview.memoryUsage);
          this.chartData.network.push(SystemOverview.networkStatus);

          if (this.chartData.labels.length > 20) {
            this.chartData.labels.shift();
            this.chartData.cpu.shift();
            this.chartData.memory.shift();
            this.chartData.network.shift();
          }

          if (this.chartInstance) {
            this.chartInstance.update();
          }

          const systemLoad = ((SystemOverview.cpuUsage + SystemOverview.memoryUsage + SystemOverview.networkStatus) / 3).toFixed(0);
          if (this.elements.systemLoadEl) {
            this.elements.systemLoadEl.innerHTML = `${systemLoad}<span class="text-sm">%</span>`;
          }
        },

        // Fungsi untuk mengelola tab
        switchTab(tab) {
          this.elements.tabPerformance.classList.remove('bg-slate-700/50', 'text-slate-100');
          this.elements.tabProcesses.classList.remove('bg-slate-700/50', 'text-slate-100');
          this.elements.tabStorage.classList.remove('bg-slate-700/50', 'text-slate-100');
          this.elements.tabPerformance.classList.add('text-slate-400');
          this.elements.tabProcesses.classList.add('text-slate-400');
          this.elements.tabStorage.classList.add('text-slate-400');

          this.elements.performanceTab.classList.add('hidden');
          this.elements.processesTab.classList.add('hidden');
          this.elements.storageTab.classList.add('hidden');

          if (tab === 'performance') {
            this.elements.tabPerformance.classList.add('bg-slate-700/50', 'text-slate-100');
            this.elements.performanceTab.classList.remove('hidden');
          } else if (tab === 'processes') {
            this.elements.tabProcesses.classList.add('bg-slate-700/50', 'text-slate-100');
            this.elements.processesTab.classList.remove('hidden');
            this.updateProcessesTab();
          } else if (tab === 'storage') {
            this.elements.tabStorage.classList.add('bg-slate-700/50', 'text-slate-100');
            this.elements.storageTab.classList.remove('hidden');
            this.updateStorageTab();
          }
        },

        // Inisialisasi
        init() {
          this.initChart();
          this.elements.tabPerformance.addEventListener('click', () => this.switchTab('performance'));
          this.elements.tabProcesses.addEventListener('click', () => this.switchTab('processes'));
          this.elements.tabStorage.addEventListener('click', () => this.switchTab('storage'));
          this.switchTab('performance');
        }
      };

      // Jalankan saat DOM siap
      document.addEventListener("DOMContentLoaded", () => {
        try {
          SystemOverview.updateCPUInfo();
          SystemOverview.update();
          SystemOverview.startMonitoring();
          PerformanceChartTabs.init();
          // Perbarui grafik bersamaan dengan System Overview
          setInterval(() => {
            PerformanceChartTabs.updateChart();
          }, 3000);
        } catch (error) {
          console.error('Error initializing system monitoring:', error);
        }
      });