//Halaman Booster


// START: Konfigurasi booster
      const boosterConfig = {
        elite: { speed: 3, price: 0.0001 },
        epic: { speed: 5, price: 0.0003 },
        pro: { speed: 10, price: 0.009 },
        diamond: { speed: 60, price: 0.01 },
      };
      // END: Konfigurasi booster

     // Flag untuk mencegah toast duplikat
let isToastActive = false;

// Fungsi untuk menampilkan modal konfirmasi pembayaran
function showConfirmationModal(walletType, boosterName, price, onConfirm) {
    const overlay = document.createElement("div");
    overlay.className = "fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4";

    const modal = document.createElement("div");
    modal.className = "bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl shadow-2xl border border-slate-700/50 w-full max-w-md overflow-hidden";
    modal.innerHTML = `
<div class="p-6">
  <div class="flex justify-between items-center mb-4">
    <h3 class="text-xl font-bold text-slate-100 flex items-center gap-2">
      <i data-lucide="credit-card" class="w-5 h-5 text-cyan-400"></i>
      Confirm Payment
    </h3>
    <button class="close-btn text-slate-400 hover:text-slate-200">
      <i data-lucide="x" class="w-5 h-5"></i>
    </button>
  </div>
  <div class="mb-6">
    <div class="bg-slate-700/30 rounded-lg p-4 mb-3">
      <div class="text-xs text-slate-400 mb-1">Purchasing</div>
      <div class="font-medium text-slate-100">${boosterName} Booster</div>
    </div>
    <div class="bg-slate-700/30 rounded-lg p-4 mb-3">
      <div class="text-xs text-slate-400 mb-1">Payment Method</div>
      <div class="font-medium text-slate-100">${walletType.charAt(0).toUpperCase() + walletType.slice(1)}</div>
    </div>
    <div class="bg-slate-700/30 rounded-lg p-4">
      <div class="text-xs text-slate-400 mb-1">Amount</div>
      <div class="font-medium text-slate-100">${price} ETH</div>
    </div>
  </div>
  <div class="flex justify-end gap-3">
    <button class="cancel-btn px-4 py-2 bg-slate-600 text-slate-200 rounded-lg hover:bg-slate-500 transition-colors">
      Cancel
    </button>
    <button class="confirm-btn px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors">
      Confirm
    </button>
  </div>
</div>
`;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";

    if (window.lucide) {
        window.lucide.createIcons();
    }

    const closeModal = () => {
        document.body.removeChild(overlay);
        document.body.style.overflow = "";
    };

    modal.querySelector(".close-btn").addEventListener("click", closeModal);
    modal.querySelector(".cancel-btn").addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal();
    });

    modal.querySelector(".confirm-btn").addEventListener("click", () => {
        onConfirm();
        closeModal();
    });
}

// --- FUNGSI PERBAIKAN ---
// Fungsi untuk menangani pembelian booster dengan alur yang lebih aman
async function handlePurchase(walletType, booster, price) {
    if (isToastActive) return;

    try {
        let provider, walletAddress, txHash;
        const toAddress = "0x597c2c69f5a3538e9809f563274a8f5168bc9907";

        // Langkah 1: Hubungkan wallet dan kirim transaksi
        switch (walletType.toLowerCase()) {
            case "metamask":
                provider = window.ethereum;
                if (!provider) throw new Error("MetaMask is not installed");
                const metaAccounts = await provider.request({ method: "eth_requestAccounts" });
                walletAddress = metaAccounts[0];
                txHash = await provider.request({
                    method: "eth_sendTransaction",
                    params: [{
                        from: walletAddress,
                        to: toAddress,
                        value: '0x' + (parseFloat(price) * 1e18).toString(16),
                    }],
                });
                break;

            case "phantom":
                throw new Error("Phantom wallet is not supported yet. Please use MetaMask or OKX Wallet.");

            case "okx":
                provider = window.okxwallet;
                if (!provider) throw new Error("OKX Wallet is not installed");
                const okxAccounts = await provider.request({ method: "eth_requestAccounts" });
                walletAddress = okxAccounts[0];
                txHash = await provider.request({
                    method: "eth_sendTransaction",
                    params: [{
                        from: walletAddress,
                        to: toAddress,
                        value: '0x' + (parseFloat(price) * 1e18).toString(16),
                    }],
                });
                break;

            default:
                throw new Error("Unsupported wallet type");
        }
        
        // Jika tidak ada hash transaksi, berarti ada masalah (misalnya, pengguna menolak)
        if (!txHash) {
            throw new Error("Transaction was not sent or was rejected.");
        }
        
        // Beri tahu pengguna bahwa transaksi sedang diproses
        showToast("Info", "Transaction submitted. Waiting for confirmation...");

        // Langkah 2: Dapatkan data pengguna dari Supabase
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) throw new Error("User not logged in");

        // Langkah 3: Hitung masa berlaku dan detail booster
        const validityDays = { elite: 30, epic: 45, pro: 60, diamond: 160 };
        const speedMultiplier = { elite: 3, epic: 5, pro: 10, diamond: 60 };
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + validityDays[booster]);

        // Langkah 4: Simpan bukti transaksi ke tabel `boosters`
        const { error: insertError } = await supabase.from("boosters").insert({
            user_id: user.id,
            booster_type: booster,
            speed_multiplier: speedMultiplier[booster],
            price: parseFloat(price),
            wallet_address: walletAddress,
            expires_at: expiresAt.toISOString(),
            transaction_hash: txHash // Simpan bukti transaksi
        });

        if (insertError) {
            console.error("Failed to insert booster into boosters table:", insertError);
            throw new Error("Failed to record booster purchase");
        }

        // Langkah 5: Perbarui profil pengguna untuk mengaktifkan booster
        const { error: updateError } = await supabase
            .from("profiles")
            .update({ booster: booster })
            .eq("id", user.id);

        if (updateError) {
            console.error("Failed to update booster in profiles table:", updateError);
            throw new Error("Failed to update booster status");
        }

        console.log(`Booster purchase recorded successfully with tx: ${txHash}`);
        isToastActive = true;
        // Beri pesan sukses yang lebih akurat
        showToast("Success", `${booster.charAt(0).toUpperCase() + booster.slice(1)} Booster activated!`);
        setTimeout(() => { isToastActive = false; }, 3000);

        // Perbarui UI jika perlu
        const boosterElement = document.querySelector(".booster-value");
        if (boosterElement) {
            boosterElement.textContent = booster.charAt(0).toUpperCase() + booster.slice(1);
        }

    } catch (error) {
        console.error("Purchase error:", error);
        if (!isToastActive) {
            isToastActive = true;
            let errorMessage = "Purchase failed";
            if (error.code === 4001 || (error.message && error.message.includes("User denied"))) {
                 errorMessage = "Transaction cancelled by user";
            } else if (error.message) {
                 errorMessage = error.message;
            }
            showToast("Error", errorMessage, "destructive");
            setTimeout(() => { isToastActive = false; }, 3000);
        }
    }
}


// Event listener untuk tombol pembelian booster
document.querySelectorAll(".purchase-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
        e.preventDefault(); // Mencegah aksi default jika ada
        const booster = btn.dataset.booster;
        const price = btn.dataset.price;
        const boosterName = booster.charAt(0).toUpperCase() + booster.slice(1);

        // Modal untuk memilih metode pembayaran
        const overlay = document.createElement("div");
        overlay.className = "fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4";

        const modal = document.createElement("div");
        modal.className = "bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl shadow-2xl border border-slate-700/50 w-full max-w-md overflow-hidden";
        modal.innerHTML = `
    <div class="p-6">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-bold text-slate-100 flex items-center gap-2">
          <i data-lucide="wallet" class="w-5 h-5 text-cyan-400"></i>
          Select Payment Method
        </h3>
        <button class="close-btn text-slate-400 hover:text-slate-200">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>
      
      <div class="mb-6">
        <div class="bg-slate-700/30 rounded-lg p-4 mb-3">
          <div class="text-xs text-slate-400 mb-1">Purchasing</div>
          <div class="font-medium text-slate-100">${boosterName} Booster</div>
        </div>
        <div class="bg-slate-700/30 rounded-lg p-4">
          <div class="text-xs text-slate-400 mb-1">Amount</div>
          <div class="font-medium text-slate-100">${price} ETH</div>
        </div>
      </div>
      
      <div class="space-y-3 mb-6">
        <button class="wallet-btn flex items-center gap-4 p-4 w-full rounded-lg bg-slate-700/50 hover:bg-slate-700/70 transition-colors border border-slate-600/50" data-wallet="Metamask">
          <img src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" alt="MetaMask" class="w-8 h-8">
          <span class="text-slate-100 font-medium">MetaMask</span>
          <i data-lucide="chevron-right" class="ml-auto w-5 h-5 text-slate-400"></i>
        </button>
        
        <button class="wallet-btn flex items-center gap-4 p-4 w-full rounded-lg bg-slate-700/50 hover:bg-slate-700/70 transition-colors border border-slate-600/50" data-wallet="Phantom">
          <img src="https://avatars.githubusercontent.com/u/124594793?s=280&v=4" alt="Phantom" class="w-8 h-8 rounded-full">
          <span class="text-slate-100 font-medium">Phantom</span>
          <i data-lucide="chevron-right" class="ml-auto w-5 h-5 text-slate-400"></i>
        </button>
        
        <button class="wallet-btn flex items-center gap-4 p-4 w-full rounded-lg bg-slate-700/50 hover:bg-slate-700/70 transition-colors border border-slate-600/50" data-wallet="OKX">
          <img src="https://res.cloudinary.com/dgsowylnz/image/upload/v1689608130/okx_wallet_Logo_5dd9156499.jpg" alt="OKX" class="w-8 h-8 rounded-full">
          <span class="text-slate-100 font-medium">OKX Wallet</span>
          <i data-lucide="chevron-right" class="ml-auto w-5 h-5 text-slate-400"></i>
        </button>
      </div>
      
      <div class="text-xs text-slate-500 text-center">
        Your wallet will open to confirm the transaction
      </div>
    </div>
  `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        document.body.style.overflow = "hidden";

        if (window.lucide) {
            window.lucide.createIcons();
        }

        const closeModal = () => {
            document.body.removeChild(overlay);
            document.body.style.overflow = "";
        };

        overlay.querySelector(".close-btn").addEventListener("click", closeModal);
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) closeModal();
        });

        const walletBtns = overlay.querySelectorAll(".wallet-btn");
        walletBtns.forEach(btn => {
            btn.addEventListener("click", async (e) => {
                e.preventDefault(); // Mencegah aksi default
                const walletType = btn.dataset.wallet;

                if (walletType.toLowerCase() === "phantom") {
                    modal.innerHTML = `
            <div class="p-6 flex flex-col items-center justify-center h-64">
              <i data-lucide="alert-triangle" class="w-8 h-8 text-red-400 mb-4"></i>
              <h3 class="text-lg font-medium text-slate-100 mb-2">Phantom Not Supported</h3>
              <p class="text-sm text-slate-400 text-center">Phantom wallet is not supported yet. Please use MetaMask or OKX Wallet.</p>
              <button class="close-btn mt-6 px-4 py-2 bg-slate-600 text-slate-200 rounded-lg hover:bg-slate-500 transition-colors">
                Close
              </button>
            </div>
          `;
                    if (window.lucide) {
                        window.lucide.createIcons();
                    }
                    modal.querySelector(".close-btn").addEventListener("click", closeModal);
                    return;
                }

                showConfirmationModal(walletType, boosterName, price, async () => {
                    modal.innerHTML = `
              <div class="p-6 flex flex-col items-center justify-center h-64">
                <div class="animate-spin mb-4">
                  <i data-lucide="loader" class="w-8 h-8 text-cyan-400"></i>
                </div>
                <h3 class="text-lg font-medium text-slate-100 mb-2">Connecting to ${btn.querySelector("span").textContent}</h3>
                <p class="text-sm text-slate-400 text-center">Please check your wallet to confirm the transaction</p>
              </div>
            `;

                    if (window.lucide) {
                        window.lucide.createIcons();
                    }

                    // Tidak perlu try-catch di sini karena sudah ditangani di dalam handlePurchase
                    await handlePurchase(walletType, booster, price);
                    closeModal();
                });
            });
        });
    });
});
//end of purchase.js