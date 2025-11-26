// START: Fungsi untuk menampilkan notifikasi toast
      function showToast(title, description, variant = "default") {
        const variants = {
          default: {
            bg: 'bg-gradient-to-r from-cyan-500 to-blue-600',
            icon: `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>`
          },
          success: {
            bg: 'bg-gradient-to-r from-emerald-500 to-green-600',
            icon: `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>`
          },
          destructive: {
            bg: 'bg-gradient-to-r from-red-500 to-pink-600',
            icon: `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>`
          },
          warning: {
            bg: 'bg-gradient-to-r from-amber-500 to-yellow-600',
            icon: `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>`
          }
        };

        const selectedVariant = variants[variant] || variants.default;

        // Cek atau buat container
        let toastContainer = document.getElementById("toast-container");
        if (!toastContainer) {
          toastContainer = document.createElement("div");
          toastContainer.id = "toast-container";
          toastContainer.className = "fixed top-4 right-4 z-[100] space-y-2 pointer-events-none";
          document.body.appendChild(toastContainer);
        }

        // Buat elemen toast
        const toast = document.createElement("div");
        toast.className = `
        pointer-events-auto relative p-4 rounded-xl text-white shadow-2xl backdrop-blur-sm w-80 overflow-hidden transition-all duration-400 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)]
        ${selectedVariant.bg}
    `;
        toast.style.opacity = "0";
        toast.style.transform = "translateX(20px)";
        toast.style.pointerEvents = "auto";

        // Konten toast
        toast.innerHTML = `
        <div class="relative z-10 flex items-start gap-3">
            <div class="mt-0.5 flex-shrink-0 text-white/90">
                ${selectedVariant.icon}
            </div>
            <div class="flex-1">
                <div class="font-bold text-lg mb-1">${title}</div>
                <div class="text-sm opacity-90">${description}</div>
            </div>
            <button onclick="this.closest('.toast').remove()" class="text-white/80 hover:text-white ml-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
            </button>
        </div>

        <!-- Loading bar -->
        <div class="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-white/20 via-white/50 to-white/20" id="progress-bar"></div>
    `;

        toast.classList.add("toast");
        toastContainer.appendChild(toast);

        // Animasi masuk
        requestAnimationFrame(() => {
          toast.style.opacity = "1";
          toast.style.transform = "translateX(0)";
        });

        // Animasi loading bar (manual agar sinkron)
        const progressBar = toast.querySelector("#progress-bar");
        progressBar.style.width = "0%";
        progressBar.style.transition = "width 3s linear";
        requestAnimationFrame(() => {
          progressBar.style.width = "100%";
        });

        // Hapus toast setelah selesai
        setTimeout(() => {
          toast.style.opacity = "0";
          toast.style.transform = "translateX(20px)";
          setTimeout(() => {
            toast.remove();
            if (toastContainer && !toastContainer.children.length) {
              toastContainer.remove();
            }
          }, 400);
        }, 3000);
      }
      // END: Fungsi untuk menampilkan notifikasi toast
