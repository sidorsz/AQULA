document.addEventListener('DOMContentLoaded', () => {
    // **OPTIMASI: Flag untuk dev mode, agar warning hilang di production**
    const DEV_MODE = true; // Set false untuk production (hilangkan console.warn)

    // **PERBAIKAN UTAMA**: Function to create and inject modal HTML and required scripts/styles into the page
    function setupApp() {
        // Prevent creating elements if they already exist
        if (document.getElementById('userProfileModal')) return;

        // 1. Inject Google Font (Poppins)
        const fontLink = document.createElement('link');
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap';
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);

        // 2. Inject Lucide Icons library
        const lucideScript = document.createElement('script');
        lucideScript.src = 'https://unpkg.com/lucide@latest';
        lucideScript.onload = () => {
            lucide.createIcons(); // Initial icon rendering
        };
        document.head.appendChild(lucideScript);

        // **PERBAIKAN: Inject html2canvas dari CDN (reliable, no local path issue)**
        const h2cScript = document.createElement('script');
        h2cScript.src = 'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js'; // CDN terpercaya
        h2cScript.onload = () => {
            console.log('html2canvas loaded successfully!');
            // Enable tombol SEKARANG, karena onload terpicu
            const screenshotButton = document.getElementById('screenshotButton');
            if (screenshotButton) {
                screenshotButton.disabled = false;
                console.log('Tombol screenshot diaktifkan setelah load sukses.');
            }
        };
        h2cScript.onerror = () => {
            console.error('Gagal load html2canvas dari CDN. Screenshot tidak akan berfungsi.');
            // Optional: Tampilkan warning toast jika showToast ada
            if (typeof showToast === 'function') {
                showToast('Warning', 'Screenshot library gagal load. Coba refresh halaman.', 'destructive');
            }
        };
        document.head.appendChild(h2cScript);

        // 4. Inject custom styles for modal and premium glow effect
        const style = document.createElement('style');
        style.innerHTML = `
            .profile-modal-font {
                font-family: 'Poppins', sans-serif;
            }
            .premium-card-glow {
                position: relative;
                overflow: hidden;
            }
            .premium-card-glow::before {
                content: '';
                position: absolute;
                left: var(--mouse-x, -1000px);
                top: var(--mouse-y, -1000px);
                width: 350px;
                height: 350px;
                background: radial-gradient(circle, var(--glow-color-1) 0%, var(--glow-color-2) 40%, transparent 80%);
                transform: translate(-50%, -50%);
                opacity: 0;
                transition: opacity 0.3s ease-in-out;
                pointer-events: none;
            }
            .premium-card-glow:hover::before {
                opacity: 1;
            }
            #screenshotButton { /* Tombol selalu clickable, hapus pointer-events none */
                pointer-events: auto;
                cursor: pointer;
            }
            #screenshotButton:disabled {
                cursor: not-allowed;
                opacity: 0.6;
            }
            /* **OPTIMASI: Tambah style untuk tombol share kedua jika diaktifkan** */
            #shareNowButton {
                margin-top: 8px;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            #shareNowButton.visible {
                opacity: 1;
            }
        `;
        document.head.appendChild(style);

        // 5. Create and inject modal HTML
        // **PERBAIKAN: Hapus disabled awal dari button, biar onload yang handle**
        // **OPTIMASI: Tambah tombol share kedua (hidden awal) untuk fix gesture jika perlu**
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = `
            <div id="userProfileModal" class="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center p-4 hidden transition-opacity duration-300 opacity-0 z-50">
                <div id="modalContent" class="bg-slate-900 border border-slate-700 rounded-2xl shadow-xl w-full max-w-md transform transition-all duration-300 scale-95 overflow-hidden profile-modal-font">
                    <div id="premiumBanner" class="text-center hidden"></div>
                    <div class="relative">
                        <button id="closeProfileModal" class="absolute top-3 right-3 text-slate-500 hover:text-white transition-colors z-20">
                            <i data-lucide="x" class="w-7 h-7"></i>
                        </button>
                        <div class="p-6 pt-10 text-center">
                             <div id="profileAvatarWrapper" class="relative w-28 h-28 mx-auto mb-4"></div>
                             <h3 id="profileFullName" class="text-2xl font-bold text-white">-</h3>
                             <div class="flex justify-center">
                               <p id="profileWalletAddress" class="text-sm text-slate-400 font-mono mt-1">-</p>
                             </div>
                             <div id="standardStats" class="grid grid-cols-3 gap-4 mt-6 text-center bg-slate-800/50 p-4 rounded-lg">
                                <div><div id="profilePoints" class="text-xl font-bold text-amber-400">-</div><div class="text-xs text-slate-500">Points</div></div>
                                <div><div id="profileInvites" class="text-xl font-bold text-cyan-400">-</div><div class="text-xs text-slate-500">Invites</div></div>
                                <div><div id="profileBooster" class="text-sm font-bold capitalize text-purple-400">-</div><div class="text-xs text-slate-500">Booster</div></div>
                             </div>
                             <div id="premiumStats" class="mt-6 space-y-3 hidden">
                                <div class="flex items-center justify-between bg-slate-800/50 p-3 rounded-lg"><span class="flex items-center text-sm text-slate-300"><i data-lucide="gem" class="w-5 h-5 mr-2 text-amber-400"></i>Points</span><span id="premiumProfilePoints" class="font-bold text-lg text-amber-400">-</span></div>
                                <div class="flex items-center justify-between bg-slate-800/50 p-3 rounded-lg"><span class="flex items-center text-sm text-slate-300"><i data-lucide="users" class="w-5 h-5 mr-2 text-cyan-400"></i>Invites</span><span id="premiumProfileInvites" class="font-bold text-lg text-cyan-400">-</span></div>
                                <div class="flex items-center justify-between bg-slate-800/50 p-3 rounded-lg"><span class="flex items-center text-sm text-slate-300"><i data-lucide="zap" class="w-5 h-5 mr-2 text-purple-400"></i>Booster</span><span id="premiumProfileBooster" class="font-bold text-lg capitalize text-purple-400">-</span></div>
                             </div>
                             <div id="premiumFeatures" class="mt-6 border-t border-slate-700/50 pt-5 hidden">
                                <button id="screenshotButton" class="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3 px-4 rounded-lg transition-all shadow-lg hover:shadow-emerald-500/30 flex items-center justify-center">
                                    <span class="btn-text flex items-center justify-center"><i data-lucide="camera" class="w-5 h-5 mr-2"></i>Screenshot & Share</span>
                                    <span class="btn-loader hidden animate-spin"><i data-lucide="loader-2" class="w-5 h-5"></i></span>
                                </button>
                                <!-- **OPTIMASI: Tombol share kedua untuk gesture fresh** -->
                                <button id="shareNowButton" class="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-all shadow-lg hover:shadow-blue-500/30 flex items-center justify-center">
                                    <span class="btn-text flex items-center justify-center"><i data-lucide="share-2" class="w-5 h-5 mr-2"></i>Share Image Now</span>
                                </button>
                             </div>
                        </div>
                    </div>
                </div>
            </div>
            <div id="imageViewerModal" class="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 hidden z-50 cursor-pointer">
                <img id="fullScreenImage" src="" class="max-w-full max-h-full rounded-lg shadow-2xl" alt="Full screen avatar">
            </div>
        `;
        document.body.appendChild(modalContainer);

        // **PERBAIKAN: Tambahkan listener ONCE saat setup, bukan clone setiap kali**
        const screenshotButton = document.getElementById('screenshotButton');
        if (screenshotButton) {
            screenshotButton.addEventListener('click', screenshotAndShareProfile);
            console.log('Listener screenshot ditambahkan sekali saat setup.');
        }
        // **OPTIMASI: Listener untuk tombol share kedua**
        const shareNowButton = document.getElementById('shareNowButton');
        if (shareNowButton) {
            shareNowButton.addEventListener('click', shareImageDirect); // Fungsi baru di bawah
            console.log('Listener share now ditambahkan.');
        }
    }

    setupApp();

    function maskWalletAddress(address) {
        if (!address || address.length < 10) return "Invalid Address";
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }

    const loadingOverlay = document.getElementById("loadingOverlay");
    const userProfileModal = document.getElementById('userProfileModal');
    const modalContent = document.getElementById('modalContent');
    const closeProfileModal = document.getElementById('closeProfileModal');
    const imageViewerModal = document.getElementById('imageViewerModal');
    const fullScreenImage = document.getElementById('fullScreenImage');

    const rankIcons = {
        1: `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-yellow-300 drop-shadow-gold" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="gold" stroke-width="1.5"/></svg>`,
        2: `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-300 drop-shadow-silver" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="silver" stroke-width="1.5"/></svg>`,
        3: `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-amber-600 drop-shadow-bronze" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="#cd7f32" stroke-width="1.5"/></svg>`,
        4: `<div class="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-neon">4</div>`,
        5: `<div class="h-6 w-6 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-white shadow-neon">5</div>`,
        6: `<div class="h-6 w-6 rounded-full bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center text-xs font-bold text-white shadow-neon">6</div>`,
        7: `<div class="h-6 w-6 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-xs font-bold text-white shadow-neon">7</div>`,
        8: `<div class="h-6 w-6 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-xs font-bold text-white shadow-neon">8</div>`,
        9: `<div class="h-6 w-6 rounded-full bg-gradient-to-br from-blue-700 to-indigo-800 flex items-center justify-center text-xs font-bold text-white shadow-neon">9</div>`,
        10: `<div class="h-6 w-6 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center text-xs font-bold text-gray-200 shadow-neon">10</div>`
    };

    const rankFrames = {
        1: `<div class="absolute -inset-1.5 rounded-full bg-gradient-to-r from-yellow-500 via-amber-600 to-yellow-400 blur-md opacity-80 animate-pulse"></div><div class="relative z-10 border-2 border-yellow-300 rounded-full p-1 bg-slate-900"><!-- Avatar inside --></div>`,
        2: `<div class="absolute -inset-1.5 rounded-full bg-gradient-to-r from-gray-300 via-slate-400 to-gray-300 blur-md opacity-80 animate-pulse"></div><div class="relative z-10 border-2 border-gray-300 rounded-full p-1 bg-slate-900"><!-- Avatar inside --></div>`,
        3: `<div class="absolute -inset-1.5 rounded-full bg-gradient-to-r from-amber-800 via-amber-700 to-orange-600 blur-md opacity-80 animate-pulse"></div><div class="relative z-10 border-2 border-amber-600 rounded-full p-1 bg-slate-900"><!-- Avatar inside --></div>`,
        default: (rank) => `<div class="absolute -inset-1 rounded-full ${getGradientFrame(rank)} blur-sm opacity-75"></div><div class="relative z-10 border border-slate-700 rounded-full p-1 bg-slate-900"><!-- Avatar inside --></div>`
    };

    function getGradientFrame(rank) {
        switch (rank) {
            case 4: return 'bg-gradient-to-r from-blue-500 to-purple-600';
            case 5: return 'bg-gradient-to-r from-indigo-500 to-cyan-500';
            case 6: return 'bg-gradient-to-r from-purple-600 to-pink-500';
            case 7: return 'bg-gradient-to-r from-green-500 to-teal-500';
            case 8: return 'bg-gradient-to-r from-red-500 to-orange-500';
            case 9: return 'bg-gradient-to-r from-blue-700 to-indigo-800';
            case 10: return 'bg-gradient-to-r from-gray-600 to-gray-800';
            default: return 'bg-gradient-to-r from-slate-700 to-slate-900';
        }
    }
    
    async function loadLeaderboard() {
        try {
            const { data, error } = await supabase.from("profiles").select("full_name, email, points, booster, wallet_address, avatar_url, invited_users").order("points", { ascending: false }).limit(10);
            if (error) throw error;
            const leaderboardList = document.getElementById("leaderboardList");
            if (!leaderboardList) return; 
            leaderboardList.innerHTML = "";
            for (const [index, entry] of data.entries()) {
                const rank = index + 1;
                const displayName = entry.full_name || entry.email || "Anonymous";
                let avatarHTML = `<div class="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-600 to-slate-800 text-white flex items-center justify-center text-sm font-bold shadow">${displayName[0].toUpperCase()}</div>`;
                if (entry.avatar_url) {
                    const { data: avatarData } = await supabase.storage.from("avatars").getPublicUrl(entry.avatar_url);
                    if (avatarData?.publicUrl) {
                        avatarHTML = `<img src="${avatarData.publicUrl}" class="h-8 w-8 rounded-full object-cover shadow" alt="Avatar" />`;
                    }
                }
                const row = document.createElement("div");
                row.className = "grid grid-cols-12 py-4 items-center hover:bg-slate-800/30 transition-colors group cursor-pointer";
                row.innerHTML = `
                    <div class="col-span-1 text-center">${rankIcons[rank] || `<div class="text-xs text-slate-500">${rank}</div>`}</div>
                    <div class="col-span-1 relative h-10 w-10 flex items-center justify-center">${(rank <= 10 ? (rankFrames[rank] || rankFrames.default(rank)) : '<div></div>').replace("<!-- Avatar inside -->", avatarHTML)}</div>
                    <div class="col-span-4">${displayName}</div>
                    <div class="col-span-2">${entry.booster ? `<span class="bg-amber-500/10 text-amber-400 px-2 py-1 rounded-md text-xs">${entry.booster.charAt(0).toUpperCase() + entry.booster.slice(1)}</span>` : '<span class="text-slate-500 text-xs">None</span>'}</div>
                    <div class="col-span-2 text-right text-cyan-400 font-bold">${entry.invited_users || 0}</div>
                    <div class="col-span-2 text-right text-amber-400 font-bold">${(entry.points || 0).toFixed(2)}</div>
                `;
                row.addEventListener('click', () => showUserProfileModal(entry, rank));
                leaderboardList.appendChild(row);
            }
        } catch (error) {
            console.error("Error loading leaderboard:", error);
            if (typeof showToast === 'function') showToast("Error", error.message, "destructive");
        } finally {
            if (loadingOverlay) loadingOverlay.classList.add("hidden");
        }
    }

    // **OPTIMASI: Fungsi baru untuk share langsung (dari tombol kedua, gesture fresh)**
    let currentBlob = null; // Simpan blob global untuk share nanti
    async function shareImageDirect() {
        if (!currentBlob) {
            if (typeof showToast === 'function') showToast('Info', 'Screenshot belum dibuat. Coba screenshot dulu.', 'default');
            return;
        }
        const file = new File([currentBlob], "miner-profile.png", { type: "image/png" });
        const shareData = { files: [file], title: 'My Miner Profile!', text: 'Check out my stats on the leaderboard!' };
        try {
            if (navigator.canShare && navigator.canShare(shareData)) {
                await navigator.share(shareData);
                if (typeof showToast === 'function') showToast('Sukses', 'Profile dibagikan!', 'success');
            } else {
                // Fallback clipboard jika share gagal
                await copyToClipboard(currentBlob);
            }
        } catch (error) {
            console.error('Share direct gagal:', error);
            await copyToClipboard(currentBlob);
        }
    }

    // **PERBAIKAN BESAR: Fungsi screenshot dengan fallback robust untuk NotAllowedError**
    async function screenshotAndShareProfile() {
        // Final check: Pastikan html2canvas ada sebelum lanjut
        if (typeof html2canvas === 'undefined') {
            console.error('html2canvas still undefined. Screenshot impossible.');
            if (typeof showToast === 'function') {
                showToast('Error', 'Library screenshot belum siap. Refresh halaman dan coba lagi.', 'destructive');
            }
            return;
        }

        const screenshotButton = document.getElementById('screenshotButton');
        const btnText = screenshotButton.querySelector('.btn-text');
        const btnLoader = screenshotButton.querySelector('.btn-loader');
        
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');
        screenshotButton.disabled = true; // Disable sementara saat proses

        let blob = null; // **PERBAIKAN: Declare di luar try, biar accessible di catch**
        
        // --- Helper functions ---
        function downloadBlob(b) {
            if (!b) return;
            const a = document.createElement('a');
            a.href = URL.createObjectURL(b);
            a.download = 'miner-profile.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
            console.log('Fallback: Download berhasil.');
            if (typeof showToast === 'function') showToast('Info', 'Gambar profile didownload.', 'default');
        }

        async function copyToClipboard(b) {
            if (!b || !navigator.clipboard || !navigator.clipboard.write) {
                console.warn('Clipboard API tidak tersedia.');
                return false;
            }
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': b })
                ]);
                console.log('Fallback: Copy ke clipboard berhasil.');
                if (typeof showToast === 'function') {
                    showToast('Sukses', 'Gambar profile disalin ke clipboard! Paste di app lain.', 'success');
                }
                return true;
            } catch (clipError) {
                console.error('Clipboard gagal:', clipError);
                return false;
            }
        }

        function resetButton() {
            btnLoader.classList.add('hidden');
            btnText.classList.remove('hidden');
            screenshotButton.disabled = false;
        }

        function showShareErrorFallback(b) {
            // **OPTIMASI: Hilangkan warn jika bukan dev mode; fallback ke clipboard lalu share tombol**
            if (DEV_MODE) {
                console.warn('Share gagal karena user gesture hilang. Coba clipboard...');
            } else {
                console.log('Share fallback activated.');
            }
            if (typeof showToast === 'function') {
                showToast('Info', 'Share gagal (browser restriction). Gambar disalin otomatis!', 'default');
            }
            copyToClipboard(b).then(success => {
                if (!success) {
                    downloadBlob(b);
                }
                // **OPTIMASI: Tampilkan tombol share kedua setelah fallback**
                const shareNowBtn = document.getElementById('shareNowButton');
                if (shareNowBtn) {
                    shareNowBtn.classList.add('visible');
                    currentBlob = b; // Simpan untuk share direct
                }
            });
        }
        // --- Akhir Helper functions ---

        try {
            console.log('Mulai screenshot modal...');
            // **PERBAIKAN: Tambah options lebih lengkap untuk html2canvas**
            const canvas = await html2canvas(modalContent, { 
                useCORS: true, 
                backgroundColor: '#0f172a', // Slate-900 hex untuk background konsisten
                scale: 2, // Higher res untuk share
                logging: false // Kurangi console noise
            });
            
            blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            if (!blob) { throw new Error('Gagal buat image blob.'); }

            currentBlob = blob; // **OPTIMASI: Simpan blob untuk tombol share kedua**

            const file = new File([blob], "miner-profile.png", { type: "image/png" });
            const shareData = { files: [file], title: 'My Miner Profile!', text: 'Check out my stats on the leaderboard!' };

            console.log('Screenshot sukses, coba share...');
            // --- LOGIKA SHARE DENGAN FALLBACK ---
            if (navigator.canShare && navigator.canShare(shareData)) {
                try {
                    await navigator.share(shareData);
                    console.log('Share API sukses!');
                    if (typeof showToast === 'function') showToast('Sukses', 'Profile dibagikan!', 'success');
                } catch (shareError) {
                    // **PERBAIKAN: Tangkap NotAllowedError spesifik dan fallback**
                    if (shareError.name === 'NotAllowedError') {
                        showShareErrorFallback(blob);
                    } else {
                        throw shareError; // Error lain, lempar ke catch utama
                    }
                }
            } else if (await copyToClipboard(blob)) {
                // Clipboard sebagai alternatif utama jika share tidak bisa
                console.log('Langsung copy ke clipboard (no share).');
            } else {
                // Fallback download jika semuanya gagal
                downloadBlob(blob);
            }
        } catch (error) {
            console.error('Screenshot atau share gagal:', error);
            // **PERBAIKAN: Bedakan error type**
            if (error.name === 'NotAllowedError') {
                // Ini dari share, fallback pakai blob jika ada
                if (blob) {
                    showShareErrorFallback(blob);
                } else {
                    if (typeof showToast === 'function') {
                        showToast('Error', 'Share gagal. Coba lagi.', 'destructive');
                    }
                }
            } else {
                // Error screenshot asli
                if (typeof showToast === 'function') {
                    showToast('Error', `Gagal ambil screenshot: ${error.message}. Coba lagi atau check console.`, 'destructive');
                } else {
                    alert('Error: ' + error.message); // Fallback jika showToast tidak ada
                }
            }
        } finally {
            setTimeout(resetButton, 500);
        }
    }
    
    // Define the glow handler function once to be able to add/remove it
    const handleGlow = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
        e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
    };

    async function showUserProfileModal(profile, rank) {
        const modalContent = document.getElementById('modalContent');
        modalContent.className = "bg-slate-900 border border-slate-700 rounded-2xl shadow-xl w-full max-w-md transform transition-all duration-300 scale-95 overflow-hidden profile-modal-font";
        modalContent.removeEventListener('mousemove', handleGlow);

        const premiumBanner = document.getElementById('premiumBanner');
        const standardStats = document.getElementById('standardStats');
        const premiumStats = document.getElementById('premiumStats');
        const premiumFeatures = document.getElementById('premiumFeatures');
        
        [premiumBanner, premiumStats, premiumFeatures].forEach(el => el.classList.add('hidden'));
        standardStats.classList.remove('hidden');

        const displayName = profile.full_name || profile.email || "Anonymous";
        document.getElementById('profileFullName').textContent = displayName;
        document.getElementById('profileWalletAddress').textContent = maskWalletAddress(profile.wallet_address || '');

        const rankDecorations = {
            1: { icon: `<i data-lucide="trophy" class="w-8 h-8 mr-2 text-yellow-300 drop-shadow-lg"></i>`, title: 'Top Miner', glow1: 'rgba(255, 215, 0, 0.25)', glow2: 'rgba(255, 215, 0, 0.05)' },
            2: { icon: `<i data-lucide="medal" class="w-8 h-8 mr-2 text-gray-200 drop-shadow-lg"></i>`, title: 'Rank #2', glow1: 'rgba(192, 192, 192, 0.25)', glow2: 'rgba(192, 192, 192, 0.05)' },
            3: { icon: `<i data-lucide="award" class="w-8 h-8 mr-2 text-orange-300 drop-shadow-lg"></i>`, title: 'Rank #3', glow1: 'rgba(205, 127, 50, 0.25)', glow2: 'rgba(205, 127, 50, 0.05)' }
        };

        if (rank <= 3) {
            const decor = rankDecorations[rank];
            modalContent.classList.add('premium-card-glow');
            modalContent.style.setProperty('--glow-color-1', decor.glow1);
            modalContent.style.setProperty('--glow-color-2', decor.glow2);
            modalContent.addEventListener('mousemove', handleGlow);

            premiumBanner.innerHTML = `<div class="p-3 flex items-center justify-center font-bold text-lg text-white">${decor.icon} ${decor.title}</div>`;
            premiumBanner.classList.remove('hidden');
            premiumStats.classList.remove('hidden');
            premiumFeatures.classList.remove('hidden');
            standardStats.classList.add('hidden');
            document.getElementById('premiumProfilePoints').textContent = (profile.points || 0).toFixed(2);
            document.getElementById('premiumProfileInvites').textContent = profile.invited_users || 0;
            document.getElementById('premiumProfileBooster').textContent = profile.booster ? profile.booster.charAt(0).toUpperCase() + profile.booster.slice(1) : 'None';
            
            // **OPTIMASI: Reset tombol share kedua saat modal buka**
            const shareNowBtn = document.getElementById('shareNowButton');
            if (shareNowBtn) {
                shareNowBtn.classList.remove('visible');
            }
            currentBlob = null; // Reset blob

            // **PERBAIKAN: Tidak perlu clone, listener sudah ada dari setupApp()**

        } else {
            document.getElementById('profilePoints').textContent = (profile.points || 0).toFixed(2);
            document.getElementById('profileInvites').textContent = profile.invited_users || 0;
            document.getElementById('profileBooster').textContent = profile.booster ? profile.booster.charAt(0).toUpperCase() + profile.booster.slice(1) : 'None';
        }
        
        let publicUrl = null;
        let avatarHTML = `<div class="w-28 h-28 rounded-full bg-gradient-to-br from-cyan-600 to-slate-800 text-white flex items-center justify-center text-5xl font-bold shadow-lg">${displayName[0].toUpperCase()}</div>`;
        if (profile.avatar_url) {
            const { data: avatarData } = await supabase.storage.from("avatars").getPublicUrl(profile.avatar_url);
            if (avatarData?.publicUrl) {
                publicUrl = avatarData.publicUrl;
                avatarHTML = `<img src="${publicUrl}" class="w-28 h-28 rounded-full object-cover shadow-lg cursor-pointer" alt="Avatar Pengguna" />`;
            }
        }
        
        document.getElementById('profileAvatarWrapper').innerHTML = (rank <= 10 ? (rankFrames[rank] || rankFrames.default(rank)) : '<div class="relative w-28 h-28"><!-- Avatar inside --></div>').replace("<!-- Avatar inside -->", avatarHTML);
        
        if (publicUrl) {
            const avatarInModal = document.querySelector('#profileAvatarWrapper img');
            if(avatarInModal) avatarInModal.addEventListener('click', () => showFullImage(publicUrl));
        }

        userProfileModal.classList.remove('hidden');
        setTimeout(() => {
            userProfileModal.classList.remove('opacity-0');
            modalContent.classList.remove('scale-95');
            lucide.createIcons();
        }, 10);
    }
    
    function hideModal() {
        userProfileModal.classList.add('opacity-0');
        modalContent.classList.add('scale-95');
        setTimeout(() => userProfileModal.classList.add('hidden'), 300);
    }

    function showFullImage(url) {
        fullScreenImage.src = url;
        imageViewerModal.classList.remove('hidden');
    }

    function hideFullImage() {
        imageViewerModal.classList.add('hidden');
    }

    function subscribeToLeaderboardChanges() {
        return supabase.channel('public:profiles').on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
            loadLeaderboard();
        }).subscribe();
    }

    closeProfileModal.addEventListener('click', hideModal);
    userProfileModal.addEventListener('click', e => { if (e.target === userProfileModal) hideModal(); });
    imageViewerModal.addEventListener('click', hideFullImage);

    loadLeaderboard();
    subscribeToLeaderboardChanges();
});