// START: Final Cookie & Privacy Modal Logic
document.addEventListener('DOMContentLoaded', () => {
    // Elemen Banner Utama
    const banner = document.getElementById('cookieConsentBanner');
    const acceptBtn = document.getElementById('acceptAllCookies');
    const rejectBtn = document.getElementById('rejectAllCookies');
    const dontShowAgainCheckbox = document.getElementById('dontShowAgain');
    const cookieDurationSelect = document.getElementById('cookieDuration');

    // Elemen Modal Kebijakan Privasi
    const privacyModal = document.getElementById('privacyPolicyModal');
    const privacyLink = document.getElementById('privacyPolicyLink');
    const closePrivacyModal = document.getElementById('closePrivacyModal');
    const agreePrivacyBtn = document.getElementById('agreePrivacyBtn');
    const rejectPrivacyBtn = document.getElementById('rejectPrivacyBtn');
    const privacyContent = document.getElementById('privacyContent');
    const scrollIndicator = document.getElementById('scrollIndicator');

    let visitorId = null;

    // --- Fungsi Utama ---

    const getVisitorId = async () => {
        if (visitorId) return visitorId;
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            visitorId = user.id;
            return visitorId;
        }
        let anonymousId = localStorage.getItem('anonymous_visitor_id');
        if (!anonymousId) {
            anonymousId = crypto.randomUUID();
            localStorage.setItem('anonymous_visitor_id', anonymousId);
        }
        visitorId = anonymousId;
        return visitorId;
    };

    const logVisitToSupabase = async (visitorId, consentStatus) => {
        try {
            const { error } = await supabase.rpc('handle_visit', {
                p_visitor_id: visitorId,
                p_consent_status: consentStatus
            });
            if (error) console.error('Supabase RPC Error:', error);
            else console.log(`Visit logged for ${visitorId} with consent: ${consentStatus}`);
        } catch (e) {
            console.error('Error calling Supabase function:', e);
        }
    };

    // --- FUNGSI MODIFIKASI INTI ---
    // Fungsi baru untuk menyembunyikan banner sepenuhnya
    const hideBannerPermanently = () => {
        if (banner) {
            // Animasi menghilang
            banner.classList.add('opacity-0', 'translate-y-8');
            // Setelah animasi selesai, gunakan display: none agar tidak mengganggu
            setTimeout(() => {
                banner.style.display = 'none';
            }, 500); // Sesuaikan dengan durasi transisi di CSS
        }
    };
    
    // Fungsi untuk mengatur cookie dan mencatat ke Supabase
    const setCookieAndLog = (value, id) => {
        // Cek apakah opsi "Don't show again" dipilih
        if (dontShowAgainCheckbox.checked) {
            const durationInSeconds = cookieDurationSelect.value;
            // Gunakan max-age untuk durasi dalam detik
            document.cookie = `cookie_consent=${value}; path=/; max-age=${durationInSeconds}; SameSite=Lax`;
        } else {
            // Jika tidak dicentang, cookie hanya berlaku untuk sesi ini (session cookie)
            document.cookie = `cookie_consent=${value}; path=/; SameSite=Lax`;
        }
        
        hideBannerPermanently();
        if (privacyModal) hidePrivacyModal();

        logVisitToSupabase(id, value);
    };

    // Fungsi untuk memeriksa persetujuan
    const checkConsent = async () => {
        const id = await getVisitorId();
        const consentCookie = document.cookie.split('; ').find(row => row.startsWith('cookie_consent='));

        if (consentCookie) {
            // Jika cookie ada, sembunyikan banner dan catat kunjungan
            hideBannerPermanently();
            const status = consentCookie.split('=')[1];
            logVisitToSupabase(id, status);
        } else {
            // Jika tidak ada cookie, tampilkan banner
            if (banner) {
                banner.style.display = 'block'; // Pastikan display-nya block sebelum animasi
                banner.classList.remove('hidden');
                setTimeout(() => {
                    banner.classList.remove('opacity-0', 'translate-y-8');
                }, 100);
            }
            logVisitToSupabase(id, 'pending');
        }

        // Setup event listeners utama
        acceptBtn.addEventListener('click', () => setCookieAndLog('accepted', id));
        rejectBtn.addEventListener('click', () => setCookieAndLog('rejected', id));
    };

    // --- Logika Modal Kebijakan Privasi (Tidak berubah, tetap disertakan) ---
    const showPrivacyModal = () => {
        if (privacyModal) {
            privacyModal.classList.remove('hidden');
            setTimeout(() => {
                privacyModal.classList.remove('opacity-0');
                privacyModal.querySelector('div').classList.remove('scale-95');
            }, 10);
        }
    };

    const hidePrivacyModal = () => {
        if (privacyModal) {
            privacyModal.classList.add('opacity-0');
            privacyModal.querySelector('div').classList.add('scale-95');
            setTimeout(() => privacyModal.classList.add('hidden'), 300);
        }
    };

    privacyLink.addEventListener('click', (e) => {
        e.preventDefault();
        showPrivacyModal();
    });

    closePrivacyModal.addEventListener('click', hidePrivacyModal);
    rejectPrivacyBtn.addEventListener('click', hidePrivacyModal);

    agreePrivacyBtn.addEventListener('click', async () => {
        const id = await getVisitorId();
        // Saat setuju dari modal, anggap 'Don't show again' dicentang
        dontShowAgainCheckbox.checked = true;
        setCookieAndLog('accepted', id);
    });

    privacyContent.addEventListener('scroll', () => {
        const isAtBottom = privacyContent.scrollHeight - privacyContent.scrollTop <= privacyContent.clientHeight + 10;
        if (isAtBottom) {
            agreePrivacyBtn.disabled = false;
            if (scrollIndicator) scrollIndicator.style.display = 'none';
        }
    });

    // Jalankan pemeriksaan utama
    checkConsent();
});
// END: Final Cookie & Privacy Modal Logic