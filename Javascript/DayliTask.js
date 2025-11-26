//halaman task dayly

let loggedInUserId = null; // Ganti dari email ke id
let loggedInUserEmail = null; // Tetap simpan email jika ada, tapi optional

async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      console.error('Failed mendapatkan data pengguna:', error.message);
      return null;
    }
    if (!user) {
      console.error('Tidak ada user yang login');
      return null;
    }
    loggedInUserId = user.id; // Selalu ambil id
    loggedInUserEmail = user.email || null; // Email optional
    return user;
  } catch (err) {
    console.error('Error dalam getCurrentUser:', err);
    return null;
  }
}

// Fungsi baru untuk mengambil PIN dari tabel profiles di Supabase menggunakan id
async function getUserPin() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('pin')
      .eq('id', loggedInUserId) 
      .single();
    if (error) {
      console.error('Failed mengambil PIN:', error.message);
      // Jangan tampilkan toast error koneksi disini agar tidak spam, cukup return null
      return null;
    }
    if (!data || !data.pin) {
      console.error('PIN tidak ditemukan untuk id:', loggedInUserId);
      return null;
    }
    return data.pin;
  } catch (err) {
    console.error('Error dalam getUserPin:', err);
    return null;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = await getCurrentUser();
  if (!loggedInUserId) {
    console.error('Cannot proceed without user id');
    return;
  }

  const dayTaskModal = document.getElementById('dayTaskModal');
  const closeDayTaskModal = document.getElementById('closeDayTaskModal');
  const closeDayTaskModalBottom = document.getElementById('closeDayTaskModalBottom');
  const claimButtons = document.querySelectorAll('.claim-btn');
  const visitButtons = document.querySelectorAll('.visit-btn');

  function showModal() {
    if (dayTaskModal) dayTaskModal.classList.remove('hidden');
  }

  function hideModal() {
    if (dayTaskModal) dayTaskModal.classList.add('hidden');
  }

  if (closeDayTaskModal) closeDayTaskModal.addEventListener('click', hideModal);
  if (closeDayTaskModalBottom) closeDayTaskModalBottom.addEventListener('click', hideModal);

  if (dayTaskModal) {
    dayTaskModal.addEventListener('click', (e) => {
      if (e.target === dayTaskModal) {
        hideModal();
      }
    });
  }
  
  // --- NEW FUNCTION for Daily Login Task ---
  async function setupDailyLoginTask() {
    try {
        const dailyClaimBtn = document.querySelector('.claim-btn[data-task="daily-login"]');
        const rewardAmountSpan = document.getElementById('daily-reward-amount');

        if (!dailyClaimBtn || !rewardAmountSpan) {
            // console.error("Element for daily login task not found"); // Silent fail ok
            return;
        }

        // 1. Get user profile (HANYA untuk booster dan cek awal)
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('booster') 
            .eq('id', loggedInUserId)
            .single();

        if (profileError) {
            console.error('Failed to get user profile for daily task:', profileError.message);
            return;
        }

        const userProfile = profileData || { booster: null };

        // 2. Determine reward points based on booster
        const pointsMap = {
            'elite': 1000,
            'epic': 5000,
            'pro': 10000,
            'diamond': 60000
        };
        const rewardPoints = pointsMap[userProfile.booster] || 100;
        rewardAmountSpan.textContent = `${rewardPoints.toLocaleString()} Points`;

        // 3. Check if the task has been completed today
        const today = new Date().toISOString().split('T')[0];
        const { data: taskCompleted, error: taskError } = await supabase
            .from('user_task_completion')
            .select('completed')
            .eq('user_id', loggedInUserId)
            .eq('task_type', 'daily-login')
            .eq('date', today)
            .maybeSingle();

        if (taskError) {
            console.error('Error checking daily login completion:', taskError.message);
            return;
        }

        if (taskCompleted && taskCompleted.completed) {
            // Already claimed today
            dailyClaimBtn.disabled = true;
            dailyClaimBtn.innerHTML = '<i data-lucide="check-circle" class="h-3.5 w-3.5"></i><span>Claimed</span>';
            dailyClaimBtn.classList.remove('bg-amber-600/90', 'hover:bg-amber-600');
            dailyClaimBtn.classList.add('bg-emerald-600/90');
            if (window.lucide) lucide.createIcons();
        } else {
            // Not claimed yet, enable the button and add listener
            dailyClaimBtn.disabled = false;
            
            dailyClaimBtn.addEventListener('click', async () => {
                dailyClaimBtn.disabled = true; // Prevent double click

                // 1. Ambil data poin TERBARU dari Supabase (PENTING!)
                const { data: currentProfile, error: fetchError } = await supabase
                    .from('profiles')
                    .select('points')
                    .eq('id', loggedInUserId)
                    .single();

                if (fetchError) {
                    console.error('Failed to fetch current points:', fetchError.message);
                    dailyClaimBtn.disabled = false;
                    return;
                }

                // 2. Hitung poin baru
                const newPoints = (currentProfile.points || 0) + rewardPoints;

                // 3. Update poin ke Database
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ points: newPoints })
                    .eq('id', loggedInUserId);

                if (updateError) {
                    console.error('Failed to update points:', updateError.message);
                    dailyClaimBtn.disabled = false;
                    return;
                }

                // 4. Record task completion
                await supabase.from('user_task_completion').insert({
                    user_id: loggedInUserId,
                    task_type: 'daily-login',
                    completed: true,
                    date: today
                });

                // --- PERBAIKAN UTAMA: KIRIM SINYAL KE MINING SYSTEM ---
                const syncEvent = new CustomEvent('pointsUpdatedFromTask', { 
                    detail: { newPoints: newPoints } 
                });
                window.dispatchEvent(syncEvent);
                // -----------------------------------------------------
                
                showToast('Success', `You have claimed ${rewardPoints.toLocaleString()} points!`, 'success');
                dailyClaimBtn.innerHTML = '<i data-lucide="check-circle" class="h-3.5 w-3.5"></i><span>Claimed</span>';
                dailyClaimBtn.classList.remove('bg-amber-600/90', 'hover:bg-amber-600');
                dailyClaimBtn.classList.add('bg-emerald-600/90');
                if (window.lucide) lucide.createIcons();
            });
        }
    } catch (err) {
        console.error('Error in setupDailyLoginTask:', err);
    }
}
  // --- END of NEW FUNCTION ---

  async function checkBoosterPurchased() {
    try {
        const boosterClaimBtn = document.querySelector('.claim-btn[data-task="buy-booster"]');
        if (!boosterClaimBtn) return;

        // 1. Get user profile
        const { data: userProfile, error: profileError } = await supabase
            .from('profiles')
            .select('booster')
            .eq('id', loggedInUserId)
            .single();

        if (profileError || !userProfile) return;

        // 2. Check if the user has a booster
        if (userProfile.booster && userProfile.booster !== 'NULL' && userProfile.booster !== '') {
            
            // 3. Check if the task has EVER been claimed before
            const { data: taskCompletion, error: taskError } = await supabase
                .from('user_task_completion')
                .select('user_id') 
                .eq('user_id', loggedInUserId)
                .eq('task_type', 'buy-booster')
                .limit(1); 

            if (taskError) return;

            const isAlreadyClaimed = taskCompletion && taskCompletion.length > 0;

            // 4. Determine button status
            if (isAlreadyClaimed) {
                // ALREADY CLAIMED
                boosterClaimBtn.disabled = true;
                boosterClaimBtn.innerHTML = '<i data-lucide="check-circle" class="h-3.5 w-3.5"></i><span>Done</span>';
                boosterClaimBtn.classList.remove('bg-cyan-600/90', 'hover:bg-cyan-600');
                boosterClaimBtn.classList.add('bg-emerald-600/90');
                boosterClaimBtn.title = "You have already claimed this reward.";
                if (window.lucide) lucide.createIcons();
            } else {
                // NOT YET CLAIMED
                boosterClaimBtn.disabled = false;
                boosterClaimBtn.title = "Click to claim your booster reward!";
                
                if (boosterClaimBtn.hasAttribute('data-listener-added')) return; 
                boosterClaimBtn.setAttribute('data-listener-added', 'true');

                boosterClaimBtn.addEventListener('click', async () => {
                    boosterClaimBtn.disabled = true; 
                    const rewardAmount = 10000; 

                    // 1. Ambil Poin Terbaru
                    const { data: currentProfile, error: fetchError } = await supabase
                        .from('profiles')
                        .select('points')
                        .eq('id', loggedInUserId)
                        .single();

                    if (fetchError) {
                        boosterClaimBtn.disabled = false;
                        return;
                    }

                    const newPoints = (currentProfile.points || 0) + rewardAmount;

                    // 2. Update Database
                    const { error: updateError } = await supabase
                        .from('profiles')
                        .update({ points: newPoints })
                        .eq('id', loggedInUserId);

                    if (updateError) {
                        boosterClaimBtn.disabled = false; 
                        return;
                    }

                    // 3. Insert Log
                    await supabase.from('user_task_completion').insert({
                        user_id: loggedInUserId,
                        task_type: 'buy-booster',
                        completed: true,
                        date: new Date().toISOString().split('T')[0]
                    });

                    // --- PERBAIKAN UTAMA: KIRIM SINYAL KE MINING SYSTEM ---
                    const syncEvent = new CustomEvent('pointsUpdatedFromTask', { 
                        detail: { newPoints: newPoints } 
                    });
                    window.dispatchEvent(syncEvent);
                    // -----------------------------------------------------

                    showToast('Task Complete!', `You've successfully claimed ${rewardAmount.toLocaleString()} points!`, 'success');
                    
                    boosterClaimBtn.innerHTML = '<i data-lucide="check-circle" class="h-3.5 w-3.5"></i><span>Done</span>';
                    boosterClaimBtn.classList.remove('bg-cyan-600/90', 'hover:bg-cyan-600');
                    boosterClaimBtn.classList.add('bg-emerald-600/90');
                    if (window.lucide) lucide.createIcons();
                });
            }
        } else {
            // If the user doesn't have a booster, disable the button
            boosterClaimBtn.disabled = true;
            boosterClaimBtn.title = "You must purchase a Booster first to claim this reward.";
        }
    } catch (err) {
        console.error('Error in checkBoosterPurchased:', err);
    }
}

  async function generateAndUpdateCode(userId, taskPrefix) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`${taskPrefix}_code, ${taskPrefix}_visited`)
        .eq('id', userId); 

      if (error || !data || data.length === 0) {
        console.error('Gagal mengambil profil untuk kode');
        return null;
      }

      const userProfile = data[0];
      let code = userProfile[`${taskPrefix}_code`];
      let visited = userProfile[`${taskPrefix}_visited`];

      // Generate kode baru jika belum ada atau belum dikunjungi
      if (!code || !visited || visited === false) {
        code = Math.floor(100000 + Math.random() * 900000).toString();
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            [`${taskPrefix}_code`]: code,
            [`${taskPrefix}_visited`]: true 
          })
          .eq('id', userId); 
        if (updateError) {
          console.error('Gagal update kode:', updateError.message);
          return null;
        }
      }

      return { code, visited };
    } catch (err) {
      console.error('Error dalam generateAndUpdateCode:', err);
      return null;
    }
  }

  async function markTaskVisited(taskPrefix) {
    try {
      await supabase
        .from('profiles')
        .update({ [`${taskPrefix}_visited`]: true })
        .eq('id', loggedInUserId);
    } catch (err) {
      console.error('Error dalam markTaskVisited:', err);
    }
  }

  function showCodeInUI(taskPrefix, code) {
    const codeDisplayId = taskPrefix === 'youtube' ? 'youtubeCodeDisplay' : 'twitterCodeDisplay';
    const codeDisplay = document.getElementById(codeDisplayId);
    // Code input container sekarang dimunculkan setelah klaim
    const codeInputContainer = codeDisplay?.parentElement.querySelector('.code-input-container');

    if (codeDisplay) {
      codeDisplay.querySelector('.code-text').textContent = code;
      codeDisplay.classList.remove('hidden');

      const copyBtn = codeDisplay.querySelector('.copy-btn');
      // Reset event listener copy lama
      const newCopyBtn = copyBtn.cloneNode(true);
      copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);
      
      newCopyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(code).then(() => {
          showToast('Success', 'Code copied successfully!', 'success');
        }).catch(err => {
          showToast('Error', 'Failed to copy the code!', 'destructive');
        });
      });
    }
  }

  // --- LOGIKA TOMBOL VISIT (YOUTUBE/TWITTER) ---
  visitButtons.forEach(button => {
    // Hapus event listener sebelumnya
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);

    newButton.addEventListener('click', async () => {
      console.log('Visit button clicked');
      const claimBtn = newButton.closest('.flex.space-x-2').querySelector('.claim-btn');
      const task = claimBtn.getAttribute('data-task');
      
      let link;
      let taskPrefix;
      
      switch (task) {
        case 'youtube-subscribe':
          link = 'https://www.youtube.com/@aqulaapp';
          taskPrefix = 'youtube';
          break;
        case 'twitter-follow':
          link = 'https://x.com/aqula_app';
          taskPrefix = 'twitter';
          break;
        default:
          // Untuk booster, langsung skip logika PIN
          if (task === 'buy-booster') {
             const navBooster = document.getElementById('navBooster');
             if (navBooster) navBooster.click();
             return;
          }
          link = '#';
          taskPrefix = '';
      }

      if (taskPrefix) {
        // 1. Buka Link
        window.open(link, '_blank');
        
        // 2. Tandai Visited & Generate Kode
        await markTaskVisited(taskPrefix);
        const result = await generateAndUpdateCode(loggedInUserId, taskPrefix);
        
        if (result && result.code) {
          // 3. Tampilkan Input PIN Container
          const pinInputContainer = document.getElementById(`${taskPrefix}PinInputContainer`);
          if (pinInputContainer) {
            pinInputContainer.classList.remove('hidden');
            const pinInput = pinInputContainer.querySelector('.pin-input');
            const pinSubmitBtn = pinInputContainer.querySelector('.pin-submit-btn');

            // Fokus ke input PIN
            if(pinInput) pinInput.focus();

            // Handler Submit PIN
            pinSubmitBtn.onclick = null; // Reset lama
            pinSubmitBtn.addEventListener('click', async () => {
              const enteredPin = pinInput.value.trim();
              
              // Validasi: PIN Kosong
              if (!enteredPin) {
                  showToast('Warning', 'Please enter your PIN first!', 'warning');
                  pinInput.classList.add('border-red-500');
                  setTimeout(() => pinInput.classList.remove('border-red-500'), 1000);
                  return;
              }

              // Validasi: Cek PIN ke Supabase
              const correctPin = await getUserPin(); 
              
              if (!correctPin) {
                showToast('Error', 'Failed to verify PIN. Try again later.', 'destructive');
                return;
              }

              if (enteredPin === correctPin) {
                // SUKSES PIN
                console.log('PIN Verified');
                pinInputContainer.classList.add('hidden');
                pinInput.value = ''; // Clear PIN input
                
                // Tampilkan Kode Verifikasi
                showCodeInUI(taskPrefix, result.code);

                // AKTIFKAN & MUNCULKAN TOMBOL CLAIM UTAMA
                if (claimBtn) {
                  claimBtn.classList.remove('hidden');
                  claimBtn.disabled = false;
                  // Tambahkan efek visual bahwa tombol aktif
                  claimBtn.classList.add('animate-pulse');
                  setTimeout(() => claimBtn.classList.remove('animate-pulse'), 2000);
                }
              } else {
                // PIN SALAH
                showToast('Error', 'Incorrect PIN! Please try again.', 'destructive');
                pinInput.classList.add('border-red-500');
                pinInput.value = '';
                setTimeout(() => pinInput.classList.remove('border-red-500'), 1000);
              }
            });
          }
        }
      }
    });
  });

  // --- LOGIKA TOMBOL CLAIM (YOUTUBE/TWITTER) ---
  claimButtons.forEach(button => {
    const taskType = button.dataset.task;
    if (taskType === 'buy-booster' || taskType === 'daily-login') return; 

    let taskPrefix = (taskType === 'youtube-subscribe') ? 'youtube' : 
                     (taskType === 'twitter-follow') ? 'twitter' : null;

    if (!taskPrefix) return;

    // Cek status saat load halaman (apakah sudah selesai hari ini?)
    const today = new Date().toISOString().split('T')[0];
    supabase
        .from('user_task_completion')
        .select('completed')
        .eq('user_id', loggedInUserId)
        .eq('task_type', taskType)
        .eq('date', today)
        .then(({ data: taskCompleted }) => {
          if (taskCompleted && taskCompleted.length > 0 && taskCompleted[0].completed) {
            // Jika sudah selesai, tampilkan "Done"
            button.disabled = true;
            button.classList.remove('hidden'); // Tetap tampilkan jika done
            button.innerHTML = '<i data-lucide="check-circle" class="h-3.5 w-3.5"></i><span>Done</span>';
            button.classList.remove('bg-red-600/90', 'hover:bg-red-600', 'bg-blue-600/90', 'hover:bg-blue-600');
            button.classList.add('bg-emerald-600/90');
            if (window.lucide) lucide.createIcons();
          } else {
            // Jika belum selesai, SEMBUNYIKAN tombol claim.
            // Tombol ini hanya muncul setelah PIN benar di bagian Visit Button.
            button.classList.add('hidden');
          }
        });

    // Event Listener Klik Claim (Input Kode Verifikasi)
    button.addEventListener('click', async function() {
      // Ambil kode yang benar dari DB lagi untuk keamanan
      const result = await generateAndUpdateCode(loggedInUserId, taskPrefix);
      if (!result) return;
      const { code: correctCode } = result;

      const inputContainer = this.parentElement.querySelector('.code-input-container');
      if (inputContainer) {
        // Sembunyikan tombol claim, tampilkan input kode
        this.classList.add('hidden');
        inputContainer.classList.remove('hidden');
        const inputField = inputContainer.querySelector('.code-input');
        if (inputField) inputField.focus();

        const okBtn = inputContainer.querySelector('.ok-btn');
        if (okBtn) {
          // Reset listener OK button
          const newOkBtn = okBtn.cloneNode(true);
          okBtn.parentNode.replaceChild(newOkBtn, okBtn);

          newOkBtn.addEventListener('click', async () => {
            const enteredCode = inputField.value.trim();
            
            // Validasi Kode Verifikasi
            if (enteredCode === correctCode) {
                // KODE BENAR
                
                // Cek lagi apakah sudah selesai hari ini (Double Check)
                const { data: checkDone } = await supabase
                  .from('user_task_completion')
                  .select('completed')
                  .eq('user_id', loggedInUserId)
                  .eq('task_type', taskType)
                  .eq('date', today);

                if (checkDone && checkDone.length > 0 && checkDone[0].completed) {
                   showToast('Warning', 'Task already completed!', 'warning');
                   location.reload(); // Refresh state
                   return;
                }

                // --- UPDATE POIN & STATUS ---
                console.log('Updating points...');
                
                // 1. Update UI
                inputContainer.classList.add('hidden');
                button.classList.remove('hidden');
                button.disabled = true;
                button.innerHTML = '<i data-lucide="check-circle" class="h-3.5 w-3.5"></i><span>Done</span>';
                button.classList.remove('bg-red-600/90', 'hover:bg-red-600', 'bg-blue-600/90', 'hover:bg-blue-600');
                button.classList.add('bg-emerald-600/90');

                // 2. Fetch Poin
                const { data: userProfile } = await supabase
                  .from('profiles')
                  .select('points')
                  .eq('id', loggedInUserId)
                  .single();

                if (userProfile) {
                  const reward = 1000; // 1000 Poin untuk sosmed
                  const newPoints = (userProfile.points || 0) + reward;
                  
                  const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ points: newPoints })
                    .eq('id', loggedInUserId);
                    
                  if (!updateError) {
                    // Kirim Sinyal ke Mining System
                    const syncEvent = new CustomEvent('pointsUpdatedFromTask', { detail: { newPoints: newPoints } });
                    window.dispatchEvent(syncEvent);
                  }
                }

                // 3. Log Task Completion
                await supabase.from('user_task_completion').insert({ 
                  user_id: loggedInUserId, 
                  task_type: taskType, 
                  completed: true, 
                  date: today 
                });

                showToast('Success', 'Task completed successfully! +1000 Points', 'success');
                if (window.lucide) lucide.createIcons();

            } else {
                // KODE SALAH
                showToast('Error', 'Incorrect verification code!', 'destructive');
                inputField.classList.add('border-red-500');
                inputField.value = '';
                setTimeout(() => inputField.classList.remove('border-red-500'), 1000);
            }
          });
        }
      }
    });
  });

  // Call all initialization functions
  setupDailyLoginTask();
  checkBoosterPurchased();

  const toggleDayTaskModal = document.getElementById('toggleDayTaskModal');
  if (toggleDayTaskModal) {
    toggleDayTaskModal.addEventListener('click', () => {
      dayTaskModal.classList.remove('hidden');
    });
  }
});