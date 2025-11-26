// Pastikan DOM dimuat sebelum eksekusi
document.addEventListener("DOMContentLoaded", () => {
    initSettings();
});

// Inisialisasi halaman settings
async function initSettings() {
    try {
        await checkUser(); // Pastikan user login
        setupEventListeners(); // Setup semua event listener
        await loadSettings(); // Muat data profil pengguna
    } catch (err) {
        console.error("Error inisialisasi settings:", err);
    }
}

// Fungsi cek apakah user login
async function checkUser() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.user) {
        throw new Error("User not authenticated");
    }
    window.currentUser = session.user;
}

// Setup event listeners
function setupEventListeners() {
    const changeProfilePictureBtn = document.getElementById("changeProfilePictureBtn");
    const profilePictureInput = document.getElementById("profilePictureInput");
    const removeProfilePictureBtn = document.getElementById("removeProfilePictureBtn");
    const saveProfileBtn = document.getElementById("saveProfileBtn");
    const changePasswordBtn = document.getElementById("changePasswordBtn");
    const deleteAccountBtn = document.getElementById("deleteAccountBtn");
    const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
    const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
    const copyReferralBtn = document.getElementById("copyReferralBtn");
    const connectWalletBtn = document.getElementById("connectWalletBtn");
    
    // --- PERBAIKAN: Menambahkan elemen baru untuk link undangan ---
    const copyInviteLinkBtn = document.getElementById("copyInviteLinkBtn");
    // PENAMBAHAN: Elemen baru untuk fitur referral
    const submitReferralCodeBtn = document.getElementById("submitReferralCodeBtn");
    // PENAMBAHAN: Elemen baru untuk menampilkan QR code
    const showQrBtn = document.getElementById("showQrBtn");
    const closeQrModal = document.getElementById("qrCodeModal")?.querySelector("#closeQrModal");




    // Validasi semua elemen ada
    if (!changeProfilePictureBtn || !profilePictureInput || !removeProfilePictureBtn ||
        !saveProfileBtn || !changePasswordBtn || !deleteAccountBtn || !cancelDeleteBtn ||
        !confirmDeleteBtn || !copyReferralBtn || !connectWalletBtn || !copyInviteLinkBtn || !submitReferralCodeBtn || !showQrBtn || !closeQrModal) {
        console.error("Salah satu elemen halaman settings tidak ditemukan");
        showToast("Error", "Some UI elements could not be found.", "destructive");
        return;
    }

    // Profile Picture Events
    changeProfilePictureBtn.addEventListener("click", () => profilePictureInput.click());
    profilePictureInput.addEventListener("change", handleProfilePictureUpload);
    removeProfilePictureBtn.addEventListener("click", removeProfilePicture);

    // Save Profile
    saveProfileBtn.addEventListener("click", saveProfile);

    // Password Toggle Visibility
    document.querySelectorAll(".password-toggle").forEach((icon) => {
        icon.addEventListener("click", () => {
            const input = icon.closest(".relative")?.querySelector("input");
            if (input) {
                input.type = input.type === "password" ? "text" : "password";
                icon.classList.toggle("fa-eye-slash");
                icon.classList.toggle("fa-eye");
            }
        });
    });

    // Change Password Button
    changePasswordBtn.addEventListener("click", changePassword);

    // Delete Account Modal
    deleteAccountBtn.addEventListener("click", () => {
        const modal = document.getElementById("deleteAccountModal");
        if (modal) modal.style.display = "flex";
    });

    cancelDeleteBtn.addEventListener("click", () => {
        const modal = document.getElementById("deleteAccountModal");
        if (modal) modal.style.display = "none";
    });

    confirmDeleteBtn.addEventListener("click", deleteAccount);
    
    // --- PERBAIKAN: Membuat fungsi copy yang bisa dipakai ulang ---
    const handleCopy = (inputId, button) => {
        const input = document.getElementById(inputId);
        if (!input || !input.value || input.value.includes("...")) {
            showToast("Error", "Value not available to copy.", "destructive");
            return;
        }
        navigator.clipboard.writeText(input.value)
            .then(() => {
                const originalText = button.innerHTML;
                button.innerHTML = `<span>Copied!</span>`;
                setTimeout(() => {
                    button.innerHTML = originalText;
                }, 2000);
                showToast("Success", "Copied to clipboard!");
            })
            .catch(err => {
                console.error("Failed to copy:", err);
                showToast("Error", "Failed to copy.", "destructive");
            });
    };

    // Fungsikan kedua tombol copy
    copyReferralBtn.addEventListener("click", () => handleCopy("referralCodeInput", copyReferralBtn));
    copyInviteLinkBtn.addEventListener("click", () => handleCopy("inviteLinkInput", copyInviteLinkBtn));
    

    // Connect Wallet Button
    connectWalletBtn.addEventListener("click", connectWallet);
     // --- PENAMBAHAN: Fungsikan tombol submit kode referral ---
    submitReferralCodeBtn.addEventListener("click", submitReferralCode);
    // PENAMBAHAN: Fungsikan tombol submit kode referral
    submitReferralCodeBtn.addEventListener("click", submitReferralCode);
    // Event listener untuk menampilkan dan menyembunyikan modal QR Code
    showQrBtn.addEventListener("click", () => { document.getElementById("qrCodeModal")?.classList.remove("hidden"); });
    closeQrModal.addEventListener("click", () => { document.getElementById("qrCodeModal")?.classList.add("hidden"); });
}



// Fungsi untuk menghapus akun pengguna
async function deleteAccount() {
    try {
        showLoading();
        const user = window.currentUser;
        if (!user) {
            throw new Error("User not authenticated");
        }

        const { error: profileError } = await supabase
            .from("profiles")
            .delete()
            .eq("id", user.id);
        if (profileError) throw profileError;

        const { error: authError } = await supabase.auth.signOut();
        if (authError) throw authError;

        const modal = document.getElementById("deleteAccountModal");
        if (modal) modal.style.display = "none";

        showToast("Success", "Account successfully deleted. You will be logged out.");

        setTimeout(() => {
            window.location.href = "/login";
        }, 2000);
    } catch (err) {
        console.error("Error deleting an account:", err);
        showToast("Error", "Failed to delete account: " + err.message, "destructive");
    } finally {
        hideLoading();
    }
}

// Handle Upload Gambar Profil
async function handleProfilePictureUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ["image/png", "image/jpeg"];
    if (file.size > 15 * 1024 * 1024) {
        showToast("Error", "Maximum file size 15MB", "destructive");
        return;
    }
    if (!allowedTypes.includes(file.type)) {
        showToast("Error", "File format must be PNG or JPEG", "destructive");
        return;
    }

    try {
        showLoading();
        const user = window.currentUser;
        const fileName = `${user.email.replace(/[@.]/g, "_")}/avatar_${Date.now()}.${file.name.split(".").pop()}`;
        const { error: uploadError } = await supabase.storage.from("avatars").upload(fileName, file, { upsert: true });
        if (uploadError) throw uploadError;

        const { error: updateError } = await supabase.from("profiles")
            .update({ avatar_url: fileName })
            .eq("id", user.id);
        if (updateError) throw updateError;

        await loadSettings();
        showToast("Success", "Profile photo successfully changed");
    } catch (err) {
        console.error("Error upload foto profil:", err);
        showToast("Error", "Failed to upload profile picture", "destructive");
    } finally {
        hideLoading();
    }
}

// Hapus Foto Profil
async function removeProfilePicture() {
    try {
        showLoading();
        const user = window.currentUser;
        const { error } = await supabase.from("profiles")
            .update({ avatar_url: null })
            .eq("id", user.id);
        if (error) throw error;

        await loadSettings();
        showToast("Success", "Profile photo successfully deleted");
    } catch (err) {
        console.error("Error delete profile picture:", err);
        showToast("Error", "Failed to delete profile picture", "destructive");
    } finally {
        hideLoading();
    }
}

// Simpan Perubahan Profil
async function saveProfile() {
    try {
        showLoading();
        const fullNameInput = document.getElementById("settingsFullNameInput");
        const walletAddressInput = document.getElementById("walletAddressInput");

        if (!fullNameInput || !walletAddressInput) {
            throw new Error("Input not found");
        }

        const fullName = fullNameInput.value.trim();
        const walletAddress = walletAddressInput.value.trim();

        if (!fullName) {
            toggleError(fullNameInput, true, "Full name required.");
            return;
        }

        const user = window.currentUser;
        const { error } = await supabase.from("profiles")
            .update({ full_name: fullName, wallet_address: walletAddress })
            .eq("id", user.id);
        if (error) throw error;

        showToast("Success", "Profile saved successfully");
        await loadSettings();
    } catch (err) {
        console.error("Save profile error:", err);
        showToast("Error", "Failed to save profile", "destructive");
    } finally {
        hideLoading();
    }
}

// Fungsi untuk menampilkan loading (ganti dengan implementasi Anda)
function showLoading() {
    console.log("Loading...");
}

// Fungsi untuk menyembunyikan loading (ganti dengan implementasi Anda)
function hideLoading() {
    console.log("Loading selesai");
}

// Toggle Password Visibility
function setupPasswordToggles() {
    const toggleButtons = [
        { toggleId: "toggleCurrentPassword", inputId: "currentPasswordInput", isVisible: false },
        { toggleId: "toggleNewPassword", inputId: "newPasswordInput", isVisible: false },
        { toggleId: "toggleConfirmPassword", inputId: "confirmNewPasswordInput", isVisible: false },
    ];

    toggleButtons.forEach((btn) => {
        const toggleElement = document.getElementById(btn.toggleId);
        const inputElement = document.getElementById(btn.inputId);

        if (toggleElement && inputElement) {
            toggleElement.addEventListener("click", () => {
                btn.isVisible = !btn.isVisible;
                inputElement.type = btn.isVisible ? "text" : "password";
                toggleElement.innerHTML = btn.isVisible ?
                    `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-500 cursor-pointer hover:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>` :
                    `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-500 cursor-pointer hover:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>`;
            });
        }
    });
}

// Ubah Kata Sandi
async function changePassword() {
    try {
        showLoading();
        const currentInput = document.getElementById("currentPasswordInput");
        const newInput = document.getElementById("newPasswordInput");
        const confirmInput = document.getElementById("confirmNewPasswordInput");

        if (!currentInput || !newInput || !confirmInput) throw new Error("Password input not found");

        const currentPass = currentInput.value;
        const newPass = newInput.value;
        const confirmPass = confirmInput.value;

        if (!currentPass || !newPass || !confirmPass) {
            showToast("Error", "All fields are required", "destructive");
            return;
        }
        if (newPass !== confirmPass) {
            showToast("Error", "Confirmation password does not match", "destructive");
            return;
        }
        if (newPass.length < 6) {
            showToast("Error", "Password must be at least 6 characters", "destructive");
            return;
        }

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user || !user.email) throw new Error("User not found");

        const { error: reauthError } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: currentPass,
        });
        if (reauthError) throw new Error("Incorrect current password");

        const { error } = await supabase.auth.updateUser({ password: newPass });
        if (error) throw error;

        currentInput.value = "";
        newInput.value = "";
        confirmInput.value = "";
        showToast("Success", "Password changed successfully");
    } catch (err) {
        console.error("Error changing password:", err);
        showToast("Error", err.message || "Failed to change password", "destructive");
    } finally {
        hideLoading();
    }
}

// Inisialisasi fungsi toggle
setupPasswordToggles();

// Tambahkan event listener untuk tombol Update Password
document.getElementById("changePasswordBtn").addEventListener("click", changePassword);

// Hubungkan Dompet (MetaMask)
async function connectWallet() {
    if (!window.ethereum?.isMetaMask) {
        showToast("Error", "MetaMask is not detected. Please install it.", "destructive");
        return;
    }
    try {
        showLoading();
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        const walletAddress = accounts[0];
        document.getElementById("walletAddressInput").value = walletAddress;

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            const { error } = await supabase.from("profiles")
                .update({ wallet_address: walletAddress || null })
                .eq("id", session.user.id);
            if (error) throw error;
            document.getElementById("userWallet").textContent = walletAddress;
            showToast("Success", "Wallet connected successfully");
        }
    } catch (err) {
        console.error("Failed to connect wallet:", err);
        if (err.code === 4001) {
            showToast("Info", "User rejected wallet connection");
        } else {
            showToast("Error", "Failed to connect wallet: " + err.message, "destructive");
        }
    } finally {
        hideLoading();
    }
}

async function loadSettings() {
    try {
        // Pastikan fungsi showLoading() ada di skrip Anda
        if (typeof showLoading === 'function') showLoading();
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session?.user) {
            throw new Error("User is not authenticated");
        }
        const user = session.user;
        
        // Ambil SEMUA data profil, termasuk 'referred_by'
        const { data, error } = await supabase
            .from("profiles")
            .select("*") 
            .eq("id", user.id)
            .single();

        if (error) {
            // Jika profil belum ada, buat profil baru
            if (error.code === "PGRST116") {
                // Pastikan fungsi generateReferralCode() ada
                const generatedReferralCode = await generateReferralCode();
                const fullName = user.user_metadata.full_name || user.email.split("@")[0];

                // 'select()' di akhir untuk mengembalikan data yang baru dibuat
                const { data: newData, error: insertError } = await supabase.from("profiles").insert({
                    id: user.id, email: user.email, points: 0, wallet_address: null,
                    booster: null, avatar_url: null, full_name: fullName,
                    referral_code: generatedReferralCode, mining_speed: 0, invited_users: 0
                }).select().single(); // Ambil data baru
                
                if (insertError) throw insertError;

                // Kirim data BARU ke fungsi populate
                populateSettingsForm(newData, user); 
                updateProfilePicture(newData.avatar_url, newData.full_name || user.email);
            } else {
                throw error;
            }
        } else {
            // Jika profil ada, kirim data yang ada ke fungsi populate
            populateSettingsForm(data, user); 
            updateProfilePicture(data.avatar_url, data.full_name || user.email);
        }

        // Muat riwayat referral (ini sudah benar)
        await loadReferralHistory();

    } catch (err) {
        console.error("Error loading settings:", err);
        if (typeof showToast === 'function') {
            showToast("Error", "Failed to load profile", "destructive");
        }
    } finally {
        if (typeof hideLoading === 'function') hideLoading();
    }
}

// Fungsi bantu untuk isi form settings (DENGAN PERBAIKAN)
function populateSettingsForm(data, user) {
    const fullNameInput = document.getElementById("settingsFullNameInput");
    const walletAddressInput = document.getElementById("walletAddressInput");
    const emailDisplay = document.getElementById("emailDisplay");
    const referralCodeInput = document.getElementById("referralCodeInput");
    const invitedUsersCount = document.getElementById("invitedUsersCount");
    const inviteLinkInput = document.getElementById("inviteLinkInput");
    const enterReferralCodeSection = document.getElementById("enterReferralCodeSection");

    // Isi semua data seperti biasa
    if (fullNameInput) fullNameInput.value = data.full_name || "";
    if (walletAddressInput) walletAddressInput.value = data.wallet_address || "";
    if (emailDisplay) emailDisplay.value = user.email; // Note: using .value for input
    if (referralCodeInput) referralCodeInput.value = data.referral_code || "";
    if (invitedUsersCount) invitedUsersCount.textContent = data.invited_users || "0";

    // Logika link undangan (sudah benar)
    if (inviteLinkInput && data.referral_code) {
        const baseUrl = window.location.origin; 
        const inviteLink = `${baseUrl}/?ref=${data.referral_code}`;
        inviteLinkInput.value = inviteLink;
        
        // Pastikan fungsi generateQRCode ada
        if (typeof generateQRCode === 'function') {
            generateQRCode(inviteLink);
        }
    } else if (inviteLinkInput) {
        inviteLinkInput.value = "Referral code not available.";
    }

    // --- INI PERBAIKAN YANG ANDA MINTA ---
    // Logika untuk menampilkan/menyembunyikan form input referral
    if (enterReferralCodeSection) {
        if (data.referred_by) {
            // Jika 'referred_by' SUDAH ADA (sudah pernah isi kode), SEMBUNYIKAN form
            enterReferralCodeSection.classList.add("hidden");
        } else {
            // Jika 'referred_by' null (BELUM diisi), TAMPILKAN form
            enterReferralCodeSection.classList.remove("hidden");
        }
    }
}


// Update Preview Foto Profil
function updateProfilePicture(avatarUrl, nameOrEmail) {
    const preview = document.getElementById("profilePicturePreview");
    const sidebar = document.getElementById("sidebarProfilePicture");

    if (!preview || !sidebar) return;

    const initial = (nameOrEmail || "U")[0].toUpperCase();

    if (avatarUrl) {
        const { data } = supabase.storage.from("avatars").getPublicUrl(avatarUrl);
        if (data.publicUrl) {
            preview.innerHTML = `<img src="${data.publicUrl}" class="h-28 w-28 rounded-full object-cover" alt="Profile" />`;
            sidebar.innerHTML = `<img src="${data.publicUrl}" class="h-12 w-12 rounded-full object-cover" alt="Profile" />`;
        }
    } else {
        preview.innerHTML = `<div class="h-28 w-28 rounded-full bg-gradient-to-br from-cyan-600 to-slate-800 text-white flex items-center justify-center text-3xl font-bold shadow-lg">${initial}</div>`;
        sidebar.innerHTML = `<div class="h-12 w-12 rounded-full bg-gradient-to-br from-cyan-600 to-slate-800 text-white flex items-center justify-center text-xl font-bold">${initial}</div>`;
    }
}

// Fungsi Toggle Error
function toggleError(inputElement, hasError, message = "") {
    if (!inputElement) return;
    const parent = inputElement.closest(".relative") || inputElement.parentElement;
    const errorDiv = parent?.querySelector(".error-message");

    if (hasError) {
        inputElement.classList.add("input-error", "shake");
        setTimeout(() => inputElement.classList.remove("shake"), 500);
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.remove("hidden");
        }
    } else {
        inputElement.classList.remove("input-error", "shake");
        if (errorDiv) {
            errorDiv.textContent = "";
            errorDiv.classList.add("hidden");
        }
    }
}


// Fungsi untuk menghasilkan kode QR unik
function generateQRCode(url) {
        const qrCodeContainer = document.getElementById('qrCodeContainer');
        const qrLinkText = document.getElementById('qrLinkText');
        if (!qrCodeContainer || !qrLinkText) return;

        qrCodeContainer.innerHTML = '';
        if (typeof QRCode === 'undefined') {
            qrCodeContainer.textContent = 'QR library failed to load.';
            return;
        }

        // Generate QR
        new QRCode(qrCodeContainer, {
            text: url,
            width: 230,
            height: 230,
            colorDark : "#1e293b",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });

        // Tambahkan teks AQULA di tengah setelah QR selesai digambar
        setTimeout(() => {
            const qrCanvas = qrCodeContainer.querySelector("canvas");
            if (!qrCanvas) return;

            const ctx = qrCanvas.getContext("2d");
            const centerX = qrCanvas.width / 2;
            const centerY = qrCanvas.height / 2;

            // Lingkaran background putih
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(centerX, centerY, 32, 0, 2 * Math.PI);
            ctx.fill();

            // Teks AQULA
            ctx.fillStyle = "#1e293b";
            ctx.font = "bold 18px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("AQULA", centerX, centerY);
        }, 400); // beri delay agar QR sudah render
        

        qrLinkText.textContent = url;
    }



    // --- PENAMBAHAN: Fungsi baru untuk submit kode referral ---
async function submitReferralCode() {
    const input = document.getElementById("enterReferralCodeInput");
    const code = input.value.trim();
    if (!code) {
        showToast("Error", "Please enter a referral code.", "destructive");
        return;
    }
    try {
        const { error } = await supabase.rpc('apply_referral_code', {
            referral_code_to_apply: code
        });
        if (error) throw error;
        showToast("Success", "Referral code applied! You received 1000 points.");
        await loadSettings(); // Muat ulang data untuk menyembunyikan input
    } catch (err) {
        console.error("Error applying referral code:", err);
        showToast("Error", err.message, "destructive");
    }
}

// --- PENAMBAHAN: Fungsi baru untuk memuat riwayat referral ---
async function loadReferralHistory() {
    const container = document.getElementById('referralHistoryContainer');
    if (!container) return;
    container.innerHTML = `<p class="text-sm text-slate-400">Loading history...</p>`;
    try {
        // --- PERBAIKAN: Mengganti 'created_at' menjadi 'updated_at' ---
        const { data, error } = await supabase
            .from('profiles')
            .select('full_name, updated_at') // Menggunakan updated_at
            .eq('referred_by', window.currentUser.id);

        if (error) throw error;
        if (data.length === 0) {
            container.innerHTML = `<p class="text-sm text-slate-400">No users have used your code yet.</p>`;
            return;
        }
        container.innerHTML = '';
        data.forEach(referredUser => {
           const date = new Date(referredUser.updated_at).toLocaleString('en-US', { 
  weekday: 'short',  // "Sat"
  year: 'numeric', 
  month: 'short',    // "Sep"
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
});


            const userElement = document.createElement('div');
            userElement.className = 'flex items-center justify-between text-sm p-2 rounded-md hover:bg-slate-700/50';
            userElement.innerHTML = `
                <span class="text-slate-200">${referredUser.full_name || 'A New User'}</span>
                <span class="text-slate-400" style="font-size:8px">${date}</span>
               
            `;
            container.appendChild(userElement);
        });
    } catch (err) {
        console.error('Error loading referral history:', err);
        container.innerHTML = `<p class="text-sm text-red-400">Could not load history.</p>`;
    }
}



// Loading Overlay
function showLoading() {
    let overlay = document.getElementById("loadingOverlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "loadingOverlay";
        overlay.className = "fixed inset-0 bg-black/50 flex items-center justify-center z-50 hidden";
        overlay.innerHTML = `<div class="loader border-t-4 border-cyan-500 rounded-full w-12 h-12 animate-spin"></div>`;
        document.body.appendChild(overlay);
    }
    overlay.classList.remove("hidden");
}

function hideLoading() {
    const overlay = document.getElementById("loadingOverlay");
    if (overlay) overlay.classList.add("hidden");
}



















document.addEventListener('DOMContentLoaded', () => {
  // Pertahankan inisialisasi container dan ukuran
  const container = document.getElementById('particleContainer');
  const width = container.clientWidth;
  const height = container.clientHeight;

  // Scene dengan fog yang lebih halus
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0f172a, 0.003);

  // Kamera tetap sama
  const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
  camera.position.set(0, 0, 50);

  // Renderer dengan enhancement
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // Lighting ditingkatkan
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0x7dd3fc, 1.2);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);

  // Tambahkan point light untuk efek neon
  const pointLight = new THREE.PointLight(0x00ffff, 1, 50);
  pointLight.position.set(10, 10, 20);
  scene.add(pointLight);

  // Particle count tetap sama (2500)
  const particleCount = 2500;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);

  // Palette warna neon yang lebih hidup
  const colorPalette = [
    new THREE.Color(0x00ffff), // Cyan neon
    new THREE.Color(0xff00ff), // Magenta neon
    new THREE.Color(0x7dd3fc), 
    new THREE.Color(0x38bdf8),
    new THREE.Color(0x0ea5e9)
  ];

  // Path huruf tetap sama
  const letterPaths = {
    'A': [ [-8,-10,0], [-4,10,0], [0,-10,0], [4,10,0], [8,-10,0], [-6,0,0], [6,0,0] ],
    'Q': [ [0,10,0], [6,8,0], [8,4,0], [8,-4,0], [6,-8,0], [0,-10,0], [-6,-8,0], [-8,-4,0], [-8,4,0], [-6,8,0], [4,-6,0], [8,-10,0] ],
    'U': [ [-8,10,0], [-8,-4,0], [-6,-8,0], [-2,-10,0], [2,-10,0], [6,-8,0], [8,-4,0], [8,10,0] ],
    'L': [ [-8,10,0], [-8,-10,0], [8,-10,0] ],
    'A2': [ [-8,-10,0], [-4,10,0], [0,-10,0], [4,10,0], [8,-10,0], [-6,0,0], [6,0,0] ]
  };

  // Posisi horizontal tiap huruf tetap sama
  const letterPositions = { 'A': -44, 'Q': -22, 'U': 0, 'L': 22, 'A2': 44 };

  // Distribusi partikel lebih rapat di sekitar huruf
  let pIndex = 0;
  const particlesPerLetter = Math.floor(particleCount / 5);
  const particleDensity = 2; // Lebih rapat

  for (const [letter, path] of Object.entries(letterPaths)) {
    for (let i = 0; i < particlesPerLetter && pIndex < particleCount; i++) {
      const segment = i % (path.length - 1);
      const progress = (i % particleDensity) / particleDensity;

      const start = path[segment];
      const end = path[segment + 1] || path[0];

      // Kurangi noise untuk bentuk huruf yang lebih jelas
      positions[pIndex * 3] = THREE.MathUtils.lerp(start[0] + letterPositions[letter], end[0] + letterPositions[letter], progress) + (Math.random() - 0.5) * 0.8;
      positions[pIndex * 3 + 1] = THREE.MathUtils.lerp(start[1], end[1], progress) + (Math.random() - 0.5) * 0.8;
      positions[pIndex * 3 + 2] = THREE.MathUtils.lerp(start[2], end[2], progress) + (Math.random() - 0.5) * 5;

      // Warna lebih dinamis
      const colorIndex = Math.floor(Math.random() * colorPalette.length);
      colors[pIndex * 3] = colorPalette[colorIndex].r;
      colors[pIndex * 3 + 1] = colorPalette[colorIndex].g;
      colors[pIndex * 3 + 2] = colorPalette[colorIndex].b;

      // Ukuran bervariasi untuk efek lebih hidup
      sizes[pIndex] = Math.random() * 1.0 + 0.8;

      pIndex++;
    }
  }

  // Set atribut geometri
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  // Material partikel premium dengan glow
  const material = new THREE.PointsMaterial({
    size: 1.5,
    vertexColors: true,
    transparent: true,
    opacity: 0.98,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    alphaTest: 0.01,
    map: createGlowTexture()
  });

  // Fungsi untuk membuat texture glow
  function createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.7, 'rgba(255,255,255,0.3)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  }

  const particles = new THREE.Points(geometry, material);
  scene.add(particles);

  // Variabel animasi
  let time = 0;
  const rotationSpeed = 0.15;
  const pulseSpeed = 0.3;

  // Animasi yang ditingkatkan
  function animate() {
    requestAnimationFrame(animate);
    time += 0.01;

    // Rotasi halus
    particles.rotation.y = Math.sin(time * rotationSpeed) * 0.2;
    particles.rotation.x = Math.cos(time * rotationSpeed * 0.8) * 0.15;

    // Efek pulsing
    material.size = 1.5 + Math.sin(time * pulseSpeed) * 0.3;

    // Gerakan partikel lebih dinamis
    const positions = geometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i + 2] += Math.sin(time * 0.5 + i * 0.01) * 0.15;
    }
    geometry.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
  }

  // Resize handler tetap sama
  function onWindowResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }

  window.addEventListener('resize', onWindowResize);
  animate();
});

