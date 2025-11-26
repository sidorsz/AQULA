
           // Simulate device connection
            document.addEventListener('DOMContentLoaded', function () {
              // Connection status simulation
              const connectionStatus = document.getElementById('connectionStatus');
              // Simulate device connection sequence
              setTimeout(() => {
                connectionStatus.innerHTML = `<span class="w-2 h-2 rounded-full bg-green-400 mr-1 animate-pulse"></span> CONNECTED`;
                connectionStatus.className = connectionStatus.className.replace('bg-cyan-600/30', 'bg-green-600/30').replace('border-cyan-400/20', 'border-green-400/20');
                // Initialize values after connection
                updateSyncValue(72);
                updateModuleCount(3);
                updateLinkStability(82);
              }, 2000);

              // Neural Sync Slider
              const syncSlider = document.getElementById('neuralSyncSlider');
              const syncValue = document.getElementById('syncValue');
              const syncProgress = document.getElementById('syncProgress');
              const syncIcon = document.getElementById('syncIcon');

              syncSlider.addEventListener('input', function () {
                updateSyncValue(this.value);
              });

              function updateSyncValue(value) {
                syncValue.textContent = `${value}%`;
                syncProgress.style.width = `${value}%`;

                if (value > 70) {
                  syncIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />`;
                } else if (value > 30) {
                  syncIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />`;
                } else {
                  syncIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 5v6m0 0v6m0-6h6m-6 0H7" />`;
                }

                console.log(`Setting neural sync to ${value}%`);
              }

              // Cognitive Modules
              const decreaseBtn = document.getElementById('decreaseModule');
              const increaseBtn = document.getElementById('increaseModule');
              const moduleCount = document.getElementById('moduleCount');
              let modules = 0;

              decreaseBtn.addEventListener('click', function () {
                if (modules > 0) {
                  updateModuleCount(modules - 1);
                }
              });

              increaseBtn.addEventListener('click', function () {
                if (modules < 5) {
                  updateModuleCount(modules + 1);
                }
              });

              function updateModuleCount(count) {
                modules = count;
                moduleCount.textContent = `${count}x`;
                console.log(`Setting cognitive modules to ${count}x`);
              }

              // Preset Modes
              const focusMode = document.getElementById('focusMode');
              const creativeMode = document.getElementById('creativeMode');
              const relaxMode = document.getElementById('relaxMode');

              [focusMode, creativeMode, relaxMode].forEach(btn => {
                btn.addEventListener('click', function () {
                  [focusMode, creativeMode, relaxMode].forEach(b =>
                    b.classList.remove('bg-cyan-600/40', 'border-cyan-400/50'));
                  this.classList.add('bg-cyan-600/40', 'border-cyan-400/50');

                  if (this === focusMode) {
                    updateSyncValue(85);
                    updateModuleCount(4);
                    updateLinkStability(90);
                    syncSlider.value = 85;
                  } else if (this === creativeMode) {
                    updateSyncValue(65);
                    updateModuleCount(5);
                    updateLinkStability(75);
                    syncSlider.value = 65;
                  } else {
                    updateSyncValue(40);
                    updateModuleCount(2);
                    updateLinkStability(95);
                    syncSlider.value = 40;
                  }
                  console.log(`Activated ${this.textContent.trim()} mode`);
                });
              });

              // Link Stability
              const linkStability = document.getElementById('linkStability');
              const linkStabilityBar = document.getElementById('linkStabilityBar');

              function updateLinkStability(value) {
                linkStability.textContent = `${value}% Stable`;
                linkStabilityBar.style.width = `${value}%`;

                if (value > 80) {
                  linkStabilityBar.className = linkStabilityBar.className.replace(/from-[\w-]+ to-[\w-]+/, 'from-green-500 to-green-400');
                } else if (value > 50) {
                  linkStabilityBar.className = linkStabilityBar.className.replace(/from-[\w-]+ to-[\w-]+/, 'from-cyan-500 to-cyan-400');
                } else {
                  linkStabilityBar.className = linkStabilityBar.className.replace(/from-[\w-]+ to-[\w-]+/, 'from-yellow-500 to-yellow-400');
                }
              }

              setInterval(() => {
                const fluctuation = Math.floor(Math.random() * 6) - 3;
                const currentStability = parseInt(linkStability.textContent);
                const newStability = Math.min(100, Math.max(0, currentStability + fluctuation));
                updateLinkStability(newStability);
              }, 5000);

              // === MUSIK INTEGRATION === //
              const focusAudio = document.getElementById('focusAudio');
              const creativeAudio = document.getElementById('creativeAudio');
              const relaxAudio = document.getElementById('relaxAudio');

              function stopAllAudio() {
                focusAudio.pause();
                creativeAudio.pause();
                relaxAudio.pause();
                focusAudio.currentTime = 0;
                creativeAudio.currentTime = 0;
                relaxAudio.currentTime = 0;
              }

              focusMode.addEventListener('click', () => {
                stopAllAudio();
                focusAudio.play().catch(() => {
                  console.log("Autoplay diblokir browser");
                });
              });

              creativeMode.addEventListener('click', () => {
                stopAllAudio();
                creativeAudio.play().catch(() => {
                  console.log("Autoplay diblokir browser");
                });
              });

              relaxMode.addEventListener('click', () => {
                stopAllAudio();
                relaxAudio.play().catch(() => {
                  console.log("Autoplay diblokir browser");
                });
              });

              syncSlider.addEventListener('input', function () {
                const value = parseInt(this.value) / 100;
                focusAudio.volume = value;
                creativeAudio.volume = value;
                relaxAudio.volume = value;
              });
            });
       