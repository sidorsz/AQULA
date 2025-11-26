//halaman Network

// Inisialisasi Web3.js dengan Infura
const infuraUrl = 'https://mainnet.infura.io/v3/b401d82667c141cebfeb6c97e15ec33a';
const web3 = new Web3(new Web3.providers.HttpProvider(infuraUrl));

// Konfigurasi smart contract (ganti dengan alamat dan ABI kontrak Anda)
const contractAddress = '0xBf4eD7b27F1d666546E30D74d50d173d20bca754';
const contractABI = [
  // INI ADALAH EVENT ANDA (SUDAH ADA)
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "caller", "type": "address" },
      { "indexed": false, "name": "success", "type": "bool" }
    ],
    "name": "ContractCalled",
    "type": "event"
  },
  // --- TAMBAHKAN INI ---
  // Asumsi fungsi Anda bernama 'triggerCall'. Ganti jika namanya beda.
  {
    "name": "triggerCall",
    "type": "function",
    "stateMutability": "nonpayable", // atau "payable" jika perlu
    "inputs": [], // Sesuaikan jika fungsi Anda perlu input
    "outputs": []
  }
];

// Ini adalah 'web3' HANYA UNTUK MEMBACA (reporter)
const infuraWeb3 = new Web3(new Web3.providers.HttpProvider(infuraUrl));
const contract = new infuraWeb3.eth.Contract(contractABI, contractAddress); // Ganti nama variabel


// Fungsi baru untuk menghubungkan dompet (MetaMask)
async function connectWallet() {
  if (window.ethereum) {
    try {
      // Minta izin dompet
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      userWalletAddress = accounts[0];
      
      // Buat instance Web3 baru menggunakan provider dompet (MetaMask)
      walletWeb3 = new Web3(window.ethereum);
      
      // Buat instance kontrak baru yang bisa MENGIRIM transaksi
      walletContract = new walletWeb3.eth.Contract(contractABI, contractAddress);
      
      console.log('Dompet terhubung:', userWalletAddress);
      showToast('Success', 'Wallet connected: ' + userWalletAddress.slice(0, 6) + '...', 'success');
      
      // TODO: Tampilkan tombol "Execute Contract"
      document.getElementById('executeContractBtn').style.display = 'block';
      document.getElementById('connectWalletBtn').style.display = 'none';

    } catch (err) {
      console.error('[WALLET] Gagal terhubung ke dompet:', err);
      showToast('Error', 'Failed to connect wallet: ' + err.message, 'destructive');
    }
  } else {
    showToast('Error', 'Please install MetaMask!', 'destructive');
  }
}

// Fungsi baru untuk MENGEKSEKUSI smart contract
async function executeContractCall() {
  if (!walletContract || !userWalletAddress) {
    showToast('Error', 'Please connect your wallet first', 'warning');
    return;
  }

  try {
    showToast('Info', 'Sending transaction... Please check MetaMask.', 'info');
    
    // Ganti 'triggerCall' dengan nama fungsi Anda
    const receipt = await walletContract.methods.triggerCall() 
      .send({ from: userWalletAddress }); // Kirim transaksi dari dompet user

    console.log('[CONTRACT] Transaksi berhasil:', receipt);
    showToast('Success', 'Transaction successful! Event created.', 'success');
    
    // Setelah transaksi sukses, kita panggil 'fetchContractActivity' secara manual
    // untuk segera memperbarui UI, tanpa menunggu 60 detik.
    showToast('Info', 'Fetching updated activity...', 'info');
    await fetchContractActivity();

  } catch (err) {
    console.error('[CONTRACT] Transaksi gagal:', err);
    showToast('Error', 'Transaction failed: ' + err.message, 'destructive');
  }
}

// Kita akan buat variabel global baru untuk dompet (aktor)
let walletWeb3;
let walletContract;
let userWalletAddress;

// Deklarasi variabel global
let networkChart, perfChart, valChart, pointsChart, quantumSyncChart, contractChart;
let networkChartData, perfChartData, valChartData, pointsChartData, quantumSyncChartData, contractChartData;
let onlineMinersList = [];
let presenceChannel;
let pointsSnapshot = {};
let pointsLastUpdated = {};
let currentMinersPage = 1;
const minersPerPage = 5;

// Variabel khusus untuk Quantum Sync
// --- FIX 3: Baca progress dari localStorage agar tidak reset ke 0 ---
let quantumSyncProgress = parseFloat(localStorage.getItem('quantumSyncProgress')) || 0;
if (quantumSyncProgress >= 100) {
    quantumSyncProgress = 0; // Reset jika sudah 100% terakhir kali
    localStorage.setItem('quantumSyncProgress', 0);
}
// --- AKHIR FIX 3 ---

let quantumNodeLatency = 0;
const quantumPeers = [
  'peer-1.qchain.net',
  'peer-2.qchain.net',
  'peer-3.qchain.net',
  'peer-4.qchain.net',
  'peer-5.qchain.net',
  'peer-6.qchain.net',
  'peer-7.qchain.net'
];
let quantumCurrentPeerIndex = 0;

// Variabel untuk mining
let isMining = false;
let points = 0;
let miningInterval;
const deviceScore = 100; // Nilai contoh
const boosterSpeed = 1; // Nilai contoh


// --- FUNGSI CONTRACT DIPERBAIKI (BONUS) ---
// Fungsi untuk mengambil data dari smart contract (berbasis event)
async function fetchContractActivity() {
  // Ambil ID Supabase UNTUK DATABASE
  const supabaseUserId = window.currentUser?.id;
  // Ambil ALAMAT WALLET (dari profile) UNTUK BLOCKCHAIN
  const userWalletAddress = window.currentUser?.profile?.wallet_address;

  if (!supabaseUserId) {
    console.error('[CONTRACT] No authenticated user found');
    showToast('Error', 'Please login to fetch contract data', 'destructive');
    return;
  }

  // Cek ALAMAT WALLET
  if (!userWalletAddress || !web3.utils.isAddress(userWalletAddress)) {
      console.error('[CONTRACT] User wallet address is not a valid Ethereum address:', userWalletAddress);
      // Jangan tampilkan error, anggap saja 0 call dan update UI
      await updateNetworkDashboard(); 
      return; // Berhenti dengan tenang
  }

  try {
    console.log('[CONTRACT] Fetching real contract events for user wallet:', userWalletAddress);
    
    // Ambil event ContractCalled dari 50000 blok terakhir
    const latestBlock = await web3.eth.getBlockNumber();
    const fromBlock = latestBlock > 50000 ? latestBlock - 50000 : 0; // Perbanyak jangkauan
    
    const events = await contract.getPastEvents('ContractCalled', {
      // FIX PENTING: Tambahkan filter berdasarkan alamat wallet user
      filter: { caller: userWalletAddress }, // 'caller' sesuai ABI Anda
      fromBlock: fromBlock,
      toBlock: 'latest'
    });
    
    // Hitung call_count dan success_rate
    const callCount = events.length;
    const successfulCalls = events.filter(event => event.returnValues.success).length;
    const successRate = callCount > 0 ? (successfulCalls / callCount * 100).toFixed(1) : 0;

    console.log(`[CONTRACT] Found: ${callCount} calls, ${successfulCalls} successful. Rate: ${successRate}%`);
    
    // Simpan ke Supabase (Gunakan upsert agar tidak duplikat)
    const { data, error } = await supabase
      .from('contract_activity')
      // FIX PENTING: Gunakan upsert, bukan insert
      .upsert({
        profile_id: supabaseUserId, // Kunci unik
        call_count: callCount,
        success_rate: parseFloat(successRate),
        status: successRate > 75 ? 'Completed' : 'Pending',
        updated_at: new Date().toISOString()
      }, { onConflict: 'profile_id' }); // Perbarui jika profile_id sudah ada
      
    if (error) throw error;
    console.log('[CONTRACT] Real contract events upserted:', data);
    
    await updateNetworkDashboard();
  } catch (err) {
    console.error('[CONTRACT] Error fetching real contract events:', err);
    showToast('Error', 'Failed to fetch contract data: ' + err.message, 'destructive');
  }
}

// Fungsi cek apakah user login (SUDAH BENAR)
async function checkUser() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.user) {
    showToast('Error', 'Please login first', 'destructive');
    throw new Error('User not authenticated');
  }
  window.currentUser = session.user;
  const { data, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, points, wallet_address, avatar_url, full_name, booster, referral_code, mining_speed, invited_users, updated_at, show_on_leaderboard')
    .eq('id', session.user.id)
    .single();
  if (profileError || !data) {
    console.error('[CHECK_USER] Error mengambil profil:', profileError);
    showToast('Error', 'User profile not found', 'destructive');
    throw new Error('User profile not found');
  }
  // Pastikan mining_speed ada, set default jika undefined
  data.mining_speed = data.mining_speed || 1;
  window.currentUser.profile = data;
  console.log('[CHECK_USER] User profile loaded:', data);
}

// Setup event listener untuk halaman Network
function setupNetworkEventListeners() {
  const tabOverviewBtn = document.querySelector('button[onclick="showTab(\'tabOverview\')"]');
  const tabMinersBtn = document.querySelector('button[onclick="showTab(\'tabMiners\')"]');
  const tabPointsBtn = document.querySelector('button[onclick="showTab(\'tabPoints\')"]');

  if (!tabOverviewBtn || !tabMinersBtn || !tabPointsBtn) {
    console.error('[EVENT_LISTENER] Salah satu elemen tab Network tidak ditemukan');
    showToast('Error', 'Some elements not found', 'destructive');
    return;
  }

  const refreshNodeMapBtn = document.querySelector('#nodeMap + .text-sm .bg-slate-800\\/50');
  if (refreshNodeMapBtn) {
    refreshNodeMapBtn.addEventListener('click', updateNetworkDashboard);
  }

  const prevMinersBtn = document.querySelector('#minersTableBody + .border-t .bg-slate-700\\/50:first-child');
  const nextMinersBtn = document.querySelector('#minersTableBody + .border-t .bg-slate-700\\/50:last-child');
  if (prevMinersBtn && nextMinersBtn) {
    prevMinersBtn.addEventListener('click', () => paginateMiners('prev'));
    nextMinersBtn.addEventListener('click', () => paginateMiners('next'));
  }

  const toggleMiningBtn = document.getElementById('toggleMiningBtn');
  if (toggleMiningBtn) {
    toggleMiningBtn.addEventListener('click', toggleMining);
  }
}

// Inisialisasi semua grafik untuk halaman Network
function initializeNetworkCharts() {
  try {
    // Hancurkan chart lama jika ada
    if (networkChart) networkChart.destroy();
    if (perfChart) perfChart.destroy();
    if (valChart) valChart.destroy();
    if (pointsChart) pointsChart.destroy();
    if (quantumSyncChart) quantumSyncChart.destroy();
    if (contractChart) contractChart.destroy();

    // Inisialisasi networkChart
    const networkChartCtx = document.getElementById('networkChart')?.getContext('2d');
    if (!networkChartCtx) {
      console.error('[CHART] Canvas networkChart tidak ditemukan');
      return;
    }
    networkChartData = {
      labels: ['Now', '-5m', '-10m', '-15m', '-20m', '-25m'],
      datasets: [{
        label: 'Total AQULA Points',
        data: [0, 0, 0, 0, 0, 0],
        borderColor: 'rgb(245, 158, 11)',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.4,
        pointRadius: 0
      }]
    };
    networkChart = new Chart(networkChartCtx, {
      type: 'line',
      data: networkChartData,
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
          x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
        }
      }
    });
    console.log('[CHART] networkChart berhasil diinisialisasi');

    // Inisialisasi performanceChart
    const perfChartCtx = document.getElementById('performanceChart')?.getContext('2d');
    if (!perfChartCtx) {
      console.error('[CHART] Canvas performanceChart tidak ditemukan');
      return;
    }
    perfChartData = {
      labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '23:59'],
      datasets: [{
        label: 'Hash Rate (TH/s)',
        data: [0, 0, 0, 0, 0, 0, 0],
        backgroundColor: 'rgba(16, 185, 129, 0.5)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 1
      }]
    };
    perfChart = new Chart(perfChartCtx, {
      type: 'bar',
      data: perfChartData,
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
          x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
        }
      }
    });
    console.log('[CHART] performanceChart berhasil diinisialisasi');

    // Inisialisasi validationChart
    const valChartCtx = document.getElementById('validationChart')?.getContext('2d');
    if (!valChartCtx) {
      console.error('[CHART] Canvas validationChart tidak ditemukan');
      return;
    }
    valChartData = {
      labels: ['Block #0', '#0', '#0', '#0', '#0'],
      datasets: [{
        label: 'Validation Time (s)',
        data: [0, 0, 0, 0, 0],
        backgroundColor: 'rgba(147, 51, 234, 0.5)',
        borderColor: 'rgb(147, 51, 234)',
        borderWidth: 1
      }]
    };
    valChart = new Chart(valChartCtx, {
      type: 'bar',
      data: valChartData,
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
          x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
        }
      }
    });
    console.log('[CHART] validationChart berhasil diinisialisasi');

    // Inisialisasi pointsChart
    const pointsChartCtx = document.getElementById('pointsChart')?.getContext('2d');
    if (!pointsChartCtx) {
      console.error('[CHART] Canvas pointsChart tidak ditemukan');
      return;
    }
    pointsChartData = {
      labels: ['Top 10%', 'Next 40%', 'Bottom 50%'],
      datasets: [{
        label: 'Points Distribution',
        data: [0, 0, 0],
        backgroundColor: [
          'rgba(234, 179, 8, 0.5)',
          'rgba(234, 179, 8, 0.3)',
          'rgba(234, 179, 8, 0.1)'
        ],
        borderColor: 'rgb(234, 179, 8)',
        borderWidth: 1
      }]
    };
    pointsChart = new Chart(pointsChartCtx, {
      type: 'doughnut',
      data: pointsChartData,
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } }
      }
    });
    console.log('[CHART] pointsChart berhasil diinisialisasi');

    // Inisialisasi quantumSyncChart
    const quantumSyncChartCtx = document.getElementById('quantumSyncChart')?.getContext('2d');
    if (!quantumSyncChartCtx) {
      console.error('[CHART] Canvas quantumSyncChart tidak ditemukan');
      window.quantumSyncChart = null;
      return;
    }
    quantumSyncChartData = {
      labels: Array(10).fill(''),
      datasets: [{
        label: 'Latency (ms)',
        data: Array(10).fill(0),
        borderColor: '#8b5cf6',
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
        fill: true,
        backgroundColor: 'rgba(139, 92, 246, 0.1)'
      }]
    };
    quantumSyncChart = new Chart(quantumSyncChartCtx, {
      type: 'line',
      data: quantumSyncChartData,
      options: {
        responsive: true,
        animation: false,
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#94a3b8' }
          },
          x: { display: false }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#f1f5f9',
            bodyColor: '#cbd5e1'
          }
        }
      }
    });
    window.quantumSyncChart = quantumSyncChart;
    console.log('[CHART] quantumSyncChart berhasil diinisialisasi');

    // Inisialisasi contractChart
    const contractChartCtx = document.getElementById('contractChart')?.getContext('2d');
    if (!contractChartCtx) {
      console.error('[CHART] Canvas contractChart tidak ditemukan');
      return;
    }
    contractChartData = {
      labels: Array(10).fill(''),
      datasets: [
        {
          label: 'Contract Calls',
          data: Array(10).fill(0),
          borderColor: '#ec4899',
          backgroundColor: 'rgba(236, 72, 153, 0.1)',
          tension: 0.3,
          yAxisID: 'y',
        },
        {
          label: 'Execution Success (%)',
          data: Array(10).fill(0),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.3,
          yAxisID: 'y1',
        },
      ],
    };
    contractChart = new Chart(contractChartCtx, {
      type: 'line',
      data: contractChartData,
      options: {
        responsive: true,
        scales: {
          y: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: 'Contract Calls', color: '#94a3b8' },
            ticks: { color: '#94a3b8' },
            grid: { color: '#334155' },
          },
          y1: {
            type: 'linear',
            position: 'right',
            title: { display: true, text: 'Success Rate (%)', color: '#94a3b8' },
            ticks: { color: '#94a3b8' },
            grid: { drawOnChartArea: false },
            max: 100,
          },
          x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
        },
        plugins: {
          legend: { labels: { color: '#94a3b8' } },
        },
      },
    });
    console.log('[CHART] contractChart berhasil diinisialisasi');
  } catch (err) {
    console.error('[CHART] Error inisialisasi grafik:', err);
    showToast('Error', 'Failed to initialize charts', 'destructive');
  }
}

// Inisialisasi Supabase Presence
async function initializePresence() {
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', window.currentUser.id)
      .single();
    if (profileError) {
      console.error('[PRESENCE] Failed to retrieve user profile:', profileError);
      return;
    }

    presenceChannel = supabase
      .channel('network-presence')
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const users = Object.values(state).flat();
        console.log('[PRESENCE] Presence State:', users);

        onlineMinersList = users
          .filter(user => user.isMining === true && user.user_id !== window.currentUser.id)
          .map(user => ({
            user_id: user.user_id,
            full_name: user.full_name || 'Unknown',
          }));

        console.log('[PRESENCE] Online Miners List Updated:', onlineMinersList);
        updateNetworkDashboard();
      })
      .subscribe((status) => {
        console.log('[PRESENCE] Presence Subscription Status:', status);
        if (status === 'SUBSCRIBED') {
          presenceChannel.track({
            user_id: window.currentUser.id,
            full_name: profile.full_name || 'Unknown',
            isMining: false,
          }).catch(err => {
            console.error('[PRESENCE] Failed to track users in presence:', err);
          });
        } else if (status === 'CLOSED' || status === 'TIMED_OUT') {
          console.warn('[PRESENCE] Subscription presence failed, retry...');
          setTimeout(() => presenceChannel.subscribe(), 2000);
        }
      });
  } catch (err) {
    console.error('[PRESENCE] Error inisialisasi Presence:', err);
  }
}

// Fungsi untuk memantau perubahan poin secara berkala
function startPointsMonitoring() {
  setInterval(async () => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, points, full_name');
      if (error) throw error;

      const activeMinersFromPoints = [];

      profiles.forEach(profile => {
        const previousPoints = pointsSnapshot[profile.id] || 0;
        const currentPoints = profile.points || 0;

        if (currentPoints > previousPoints && profile.id !== window.currentUser.id) {
          activeMinersFromPoints.push({
            user_id: profile.id,
            full_name: profile.full_name || 'Unknown',
          });
        }

        pointsSnapshot[profile.id] = currentPoints;
      });

      console.log('[POINTS] Active Miners from Points:', activeMinersFromPoints);

      if (onlineMinersList.length === 0 && activeMinersFromPoints.length > 0) {
        onlineMinersList = activeMinersFromPoints;
        updateNetworkDashboard();
      }
    } catch (err) {
      console.error('[POINTS] Error monitoring points:', err);
    }
  }, 5000);
}

// Fungsi untuk menghasilkan hash sederhana (simulasi)
function generateBlockHash(blockNumber) {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 15);
  return `0x${blockNumber.toString(16)}${timestamp.toString(16)}${randomStr}`;
}

// Fungsi untuk memulai pembuatan blok otomatis
function startBlockGeneration() {
  setInterval(async () => {
    try {
      if (onlineMinersList.length === 0) {
        console.log('[BLOCK] Tidak ada miner aktif, pembuatan blok ditunda.');
        return;
      }

      const { data: lastBlock, error: lastBlockError } = await supabase
        .from('blocks')
        .select('block_number')
        .order('block_number', { ascending: false })
        .limit(1);

      if (lastBlockError) {
        console.error('[BLOCK] Error mengambil block terakhir:', lastBlockError);
        return;
      }

      const newBlockNumber = lastBlock.length > 0 ? lastBlock[0].block_number + 1 : 1;
      const solver = onlineMinersList[Math.floor(Math.random() * onlineMinersList.length)];
      const solverId = solver.user_id;
      const validationTime = (Math.random() * 4.5 + 0.5).toFixed(2);
      const blockHash = generateBlockHash(newBlockNumber);

      const { data, error } = await supabase
        .from('blocks')
        .insert({
          block_number: newBlockNumber,
          validation_time: validationTime,
          hash: blockHash,
          solver_id: solverId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error('[BLOCK] Error menambahkan blok baru:', error);
      } else {
        console.log(`[BLOCK] Blok baru ditambahkan: #${newBlockNumber}, Hash: ${blockHash}, Solver: ${solverId}`);
        updateNetworkDashboard();
      }
    } catch (err) {
      console.error('[BLOCK] Error dalam pembuatan blok:', err);
    }
  }, 120000);
}

// Fungsi untuk memperbarui network clock
function startNetworkClock() {
  const networkClockEl = document.getElementById('networkClock');
  if (networkClockEl) {
    const updateClock = () => {
      const now = new Date();
      networkClockEl.textContent = now.toLocaleTimeString('en-US', { timeZone: 'UTC', hour12: false }) + ' UTC';
    };
    updateClock();
    setInterval(updateClock, 1000);
  } else {
    console.warn('[CLOCK] Elemen networkClock tidak ditemukan');
  }
}

// Fungsi untuk mengambil status node quantum (simulasi)
async function fetchQuantumNodeStatus(peer) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({
        peer,
        latency: Math.random() * 60 + 20,
        synced: Math.random() > 0.05,
        timestamp: Date.now()
      });
    }, 1000);
  });
}

// Fungsi untuk menyimpan latensi ke localStorage
function saveLatencyToLocalStorage(latency) {
  const key = 'quantumNodeLatencyHistory';
  let history = JSON.parse(localStorage.getItem(key)) || [];

  history.push({ time: new Date().toLocaleTimeString(), latency });

  if (history.length > 10) {
    history.shift();
  }

  localStorage.setItem(key, JSON.stringify(history));
}

// Fungsi untuk memperbarui UI Quantum Sync
function updateQuantumUI(data) {
  const nodeLatencyEl = document.getElementById('nodeLatency');
  const syncProgressEl = document.getElementById('syncProgress');
  const currentPeerEl = document.getElementById('currentPeer');

  quantumNodeLatency = data.latency.toFixed(1);
  if (nodeLatencyEl) {
    nodeLatencyEl.textContent = `${quantumNodeLatency} ms`;
    console.log('[QUANTUM_UI] nodeLatency diperbarui ke:', nodeLatencyEl.textContent);
  } else {
    console.warn('[QUANTUM_UI] Elemen nodeLatency tidak ditemukan');
  }

  // --- FIX 3: Logika progres diperbarui ---
  if (quantumSyncProgress < 100) {
      quantumSyncProgress += Math.random() * 5 + 1; // Terus tambah
  }
  if (quantumSyncProgress > 100) quantumSyncProgress = 100;
  
  if (syncProgressEl) {
    const progressValue = Math.round(quantumSyncProgress);
    syncProgressEl.textContent = `${progressValue}%`;
    localStorage.setItem('quantumSyncProgress', quantumSyncProgress); // Simpan progres terbaru
    console.log('[QUANTUM_UI] syncProgress diperbarui ke:', progressValue);

    // Jika sudah 100%, reset variabel global agar interval berikutnya mulai dari 0
    if (quantumSyncProgress >= 100) {
        console.log('[QUANTUM_UI] Sync progress 100%, akan direset ke 0');
        quantumSyncProgress = 0; // Reset variabel global
    }
  } else {
    console.warn('[QUANTUM_UI] Elemen syncProgress tidak ditemukan');
  }
  // --- AKHIR FIX 3 ---

  if (currentPeerEl) {
    currentPeerEl.textContent = data.peer;
    console.log('[QUANTUM_UI] currentPeer diperbarui ke:', data.peer);
  } else {
    console.warn('[QUANTUM_UI] Elemen currentPeer tidak ditemukan');
  }

  saveLatencyToLocalStorage(data.latency);

  if (window.quantumSyncChart && window.quantumSyncChart.data?.datasets?.[0]) {
    try {
      window.quantumSyncChart.data.datasets[0].data.shift();
      window.quantumSyncChart.data.datasets[0].data.push(parseFloat(quantumNodeLatency));
      window.quantumSyncChart.update();
      console.log('[QUANTUM_UI] quantumSyncChart berhasil diperbarui, latency:', quantumNodeLatency);
    } catch (err) {
      console.error('[QUANTUM_UI] Error saat memperbarui quantumSyncChart:', err);
    }
  } else {
    console.warn('[QUANTUM_UI] quantumSyncChart belum siap atau tidak valid');
  }
}

// Fungsi utama untuk memulai monitoring Quantum Sync
window.startQuantumSyncMonitoring = function () {
  if (!window.quantumSyncChart) {
    console.error('[QUANTUM] Tidak dapat memulai Quantum Sync Monitoring: quantumSyncChart tidak tersedia');
    return;
  }
  console.log('[QUANTUM] Quantum Sync Monitoring dimulai...');

  setInterval(async () => {
    const currentPeer = quantumPeers[quantumCurrentPeerIndex];
    const result = await fetchQuantumNodeStatus(currentPeer);
    console.log('[QUANTUM] Data node:', result);
    updateQuantumUI(result);

    quantumCurrentPeerIndex = (quantumCurrentPeerIndex + 1) % quantumPeers.length;

    if (!result.synced) {
      console.warn(`[QUANTUM] Node ${result.peer} simulasi gangguan sinkronisasi (normal untuk pengujian)`);
      showToast('Info', `Node ${result.peer} is out of sync`, 'info');
    }
  }, 5000);
};

// Fungsi untuk pagination miners
function paginateMiners(direction) {
  if (direction === 'next' && !document.querySelector('#minersTableBody + .border-t .bg-slate-700/50:last-child').disabled) {
    currentMinersPage++;
  } else if (direction === 'prev' && !document.querySelector('#minersTableBody + .border-t .bg-slate-700/50:first-child').disabled) {
    currentMinersPage--;
  }
  updateMinersTable();
}

// Fungsi untuk memperbarui tabel miners
async function updateMinersTable() {
  const minersTableBodyEl = document.getElementById('minersTableBody');
  const minersCountEl = document.getElementById('minersCount');
  const totalMinersEl = document.getElementById('totalMiners');
  const prevMinersBtn = document.querySelector('#minersTableBody + .border-t .bg-slate-700/50:first-child');
  const nextMinersBtn = document.querySelector('#minersTableBody + .border-t .bg-slate-700/50:last-child');

  if (minersTableBodyEl && minersCountEl && totalMinersEl && prevMinersBtn && nextMinersBtn) {
    minersTableBodyEl.innerHTML = '';

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, points')
      .order('updated_at', { ascending: false });
    if (profilesError) {
      console.warn('[MINERS] Failed mengambil data profiles:', profilesError);
      minersTableBodyEl.innerHTML = `<tr><td colspan="5" class="px-5 py-3 text-center text-slate-400">Failed to load miner data.</td></tr>`;
      return;
    }

    const { data: scans, error: scansError } = await supabase
      .from('security_scans')
      .select('id, profile_id, location, created_at') // Ambil created_at
      .order('created_at', { ascending: false });
    if (scansError) {
      console.warn('[MINERS] Failed mengambil security scans:', scansError);
      minersTableBodyEl.innerHTML = `<tr><td colspan="5" class="px-5 py-3 text-center text-slate-400">Failed to load miner data.</td></tr>`;
      return;
    }

    const start = (currentMinersPage - 1) * minersPerPage;
    const end = start + minersPerPage;

    const now = new Date();
    const twentySecondsAgo = new Date(now.getTime() - 20 * 1000);

    const minerData = scans
      .map(scan => {
        const profile = profiles.find(p => p.id === scan.profile_id);
        if (!profile) return null;

        const previousPoints = pointsSnapshot[scan.profile_id] || 0;
        const currentPoints = profile.points || 0;

        const isOnline = currentPoints > previousPoints && (pointsLastUpdated[scan.profile_id] || new Date(0)) >= twentySecondsAgo;

        if (currentPoints > previousPoints) {
          pointsSnapshot[scan.profile_id] = currentPoints;
          pointsLastUpdated[scan.profile_id] = new Date();
        }

        return {
          id: scan.id,
          location: scan.location || 'Unknown',
          hashRate: (Math.random() * 100).toFixed(2) + ' TH/s', // Ini masih simulasi
          status: isOnline ? 'Active' : 'Inactive',
          lastActive: pointsLastUpdated[scan.profile_id] ? pointsLastUpdated[scan.profile_id].toLocaleString() : new Date(scan.created_at).toLocaleString()
        };
      })
      .filter(miner => miner !== null && miner.status === 'Active');

    const paginatedMinerData = minerData.slice(start, end);

    if (paginatedMinerData.length > 0) {
      paginatedMinerData.forEach(miner => {
        const row = `
          <tr class="hover:bg-slate-700/30 transition-colors duration-200">
            <td class="px-5 py-3 text-left">${miner.id.length > 8 ? miner.id.slice(0, 4) + '...' + miner.id.slice(-4) : miner.id}</td>
            <td class="px-5 py-3 text-left">${miner.location.length > 8 ? miner.location.slice(0, 4) + '...' + miner.location.slice(-4) : miner.location}</td>
            <td class="px-5 py-3 text-left">${miner.hashRate}</td>
            <td class="px-5 py-3 text-left ${miner.status === 'Active' ? 'text-green-400' : 'text-red-400'}">${miner.status}</td>
            <td class="px-5 py-3 text-left text-xs text-slate-400">${miner.lastActive}</td>
          </tr>
        `;
        minersTableBodyEl.insertAdjacentHTML('beforeend', row);
      });
    } else {
      minersTableBodyEl.innerHTML = `<tr><td colspan="5" class="px-5 py-3 text-center text-slate-400">Tidak ada miner aktif saat ini.</td></tr>`;
    }

    const totalActiveMiners = minerData.length;
    const totalPages = Math.ceil(totalActiveMiners / minersPerPage);
    prevMinersBtn.disabled = currentMinersPage === 1;
    nextMinersBtn.disabled = currentMinersPage === totalPages || totalActiveMiners <= minersPerPage;
    prevMinersBtn.style.opacity = prevMinersBtn.disabled ? '0.5' : '1';
    nextMinersBtn.style.opacity = nextMinersBtn.disabled ? '0.5' : '1';

    minersCountEl.textContent = paginatedMinerData.length;
    totalMinersEl.textContent = totalActiveMiners;
  } else {
    console.warn('[MINERS] Salah satu elemen tabel miners tidak ditemukan');
  }
}

// Fungsi untuk memulai mining (VERSI PERBAIKAN FINAL)
function startMining() {
    if (!window.currentUser?.profile) {
        showToast('Error', 'Please login and ensure profile is loaded', 'destructive');
        document.getElementById('authModal').style.display = 'flex';
        return;
    }

    isMining = true;
    const miningStatus = document.getElementById('miningStatus');
    const toggleMiningBtn = document.getElementById('toggleMiningBtn');
    if (miningStatus) {
        miningStatus.textContent = 'Active';
        miningStatus.className = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/50';
    }
    if (toggleMiningBtn) toggleMiningBtn.textContent = 'Stop Mining';

    miningInterval = setInterval(async () => {
        // --- PENGECEKAN KEAMANAN DI DALAM INTERVAL ---
        if (!window.currentUser?.profile) {
            console.error('[MINING] User profile is missing. Stopping mining.');
            stopMining(); // Panggil fungsi untuk menghentikan interval & membersihkan state.
            showToast('Warning', 'Mining stopped due to session issue.', 'warning');
            return; // Hentikan eksekusi interval saat ini.
        }
        // --- AKHIR PENGECEKAN ---

        const miningSpeed = window.currentUser.profile.mining_speed || 0; // Default ke 0 jika tidak ada
        const boosterName = window.currentUser.profile.booster;
        const boosterMultiplier = boosterConfig[boosterName]?.speed || 1; // Default booster 1x

        // Poin dasar dihitung dari device score, kecepatan booster, dan kecepatan mining
        const basePoints = (deviceScore / 100) * boosterMultiplier * (1 + miningSpeed);
        points += basePoints;

        // Update UI jika elemen ada
        const userPointsEl = document.getElementById('userPoints');
        const currentPointsEl = document.getElementById('currentPoints');
        if (userPointsEl) userPointsEl.textContent = points.toFixed(2);
        if (currentPointsEl) currentPointsEl.textContent = points.toFixed(2);
        
        // Simpan snapshot untuk leaderboard
        pointsSnapshot[window.currentUser.id] = points;
        pointsLastUpdated[window.currentUser.id] = new Date();
        
        console.log(`[MINING] Points earned: ${basePoints.toFixed(4)}, Total: ${points.toFixed(2)}`);

        // Panggil fungsi sinkronisasi yang juga sudah diperbaiki
        await syncPointsToSupabase();
    }, 5000);
}


// Fungsi untuk menghentikan mining
function stopMining() {
  isMining = false;
  const miningStatus = document.getElementById('miningStatus');
  const toggleMiningBtn = document.getElementById('toggleMiningBtn');
  if (miningStatus && toggleMiningBtn) {
    miningStatus.textContent = 'Inactive';
    miningStatus.className = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/50';
    toggleMiningBtn.textContent = 'Start Mining';
  }
  clearInterval(miningInterval);
}

// Fungsi untuk toggle mining
function toggleMining() {
  if (isMining) {
    stopMining();
  } else {
    startMining();
  }
}

// Fungsi untuk menyinkronkan poin ke Supabase
async function syncPointsToSupabase() {
  if (!window.currentUser?.id) {
    console.error('[MINING] No authenticated user found for syncing points');
    return;
  }
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ points: points, updated_at: new Date().toISOString() })
      .eq('id', window.currentUser.id);
    if (error) throw error;
    console.log('[MINING] Points synced to Supabase:', points);
  } catch (err) {
    console.error('[MINING] Error syncing points to Supabase:', err);
  }
}

// --- FUNGSI DASHBOARD DIPERBAIKI (FIX 1 & 2) ---
// Fungsi untuk memperbarui dashboard network
async function updateNetworkDashboard() {
  try {
    console.log('[DASHBOARD] Updating network dashboard...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('updated_at', { ascending: false });
    if (profilesError) throw profilesError;
    console.log('[DASHBOARD] Profiles fetched:', profiles.length);

    const { data: scans, error: scansError } = await supabase
      .from('security_scans')
      .select('*')
      .order('created_at', { ascending: false });
    if (scansError) throw scansError;
    console.log('[DASHBOARD] Security scans fetched:', scans.length);

    const { data: blocks, error: blocksError } = await supabase
      .from('blocks')
      .select('block_number, created_at, validation_time, hash')
      .order('created_at', { ascending: false });
    if (blocksError) throw blocksError;
    console.log('[DASHBOARD] Blocks fetched:', blocks.length);

    // Update Miners
    let onlineMiners = onlineMinersList.length;
    const minersOnlineEl = document.getElementById('minersOnline');
    const minersProgressEl = document.getElementById('minersProgress');
    const minersChangeEl = document.getElementById('minersChange');
    if (minersOnlineEl && minersProgressEl && minersChangeEl) {
      const prevMiners = parseInt(minersOnlineEl.textContent) || 0;
      minersOnlineEl.innerHTML = `${onlineMiners}<span class="text-lg text-slate-400 ml-2">Miners</span>`;
      const minersProgress = (onlineMiners / 20000) * 100;
      minersProgressEl.style.width = `${Math.min(minersProgress, 100)}%`;
      const change = onlineMiners - prevMiners;
      minersChangeEl.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
    }

    // --- FIX 1: Update Latency ---
    let avgLatency = scans.length > 0 ? scans.reduce((sum, scan) => sum + (scan.latency || 0), 0) / scans.length : 0;
    
    // Jika data dari DB 0, gunakan simulasi realistis untuk tampilan
    if (avgLatency === 0) {
        avgLatency = Math.random() * 40 + 20; // Simulasi latency antara 20-60ms
    }
    
    const latencyEl = document.getElementById('latency');
    const latencyProgressEl = document.getElementById('latencyProgress');
    const latencyChangeEl = document.getElementById('latencyChange');
    if (latencyEl && latencyProgressEl && latencyChangeEl) {
      const prevLatency = parseInt(latencyEl.textContent) || 0;
      latencyEl.innerHTML = `${Math.round(avgLatency)}<span class="text-lg text-slate-400 ml-2">ms</span>`;
      const latencyProgress = (avgLatency / 50) * 100;
      latencyProgressEl.style.width = `${Math.min(latencyProgress, 100)}%`;
      const change = avgLatency - prevLatency;
      latencyChangeEl.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
    }
    // --- AKHIR FIX 1 ---

    // Update Points
    const totalPoints = profiles.reduce((sum, profile) => sum + (profile.points || 0), 0);
    const totalPointsEl = document.getElementById('totalPoints');
    const pointsProgressEl = document.getElementById('pointsProgress');
    const pointsChangeEl = document.getElementById('pointsChange');
    const pointsTextEl = document.getElementById('pointsText');
    const todayRewardsEl = document.getElementById('todayReward');
    const avgPerMinerEl = document.getElementById('avgPerMiner');
    if (totalPointsEl && pointsProgressEl && pointsChangeEl) {
      const prevPoints = parseInt(totalPointsEl.textContent.replace(/,/g, '')) || 0;
      totalPointsEl.innerHTML = `${totalPoints.toLocaleString()}<span class="text-lg text-slate-400 ml-2">AQULA</span>`;
      const pointsProgress = (totalPoints / 5000000) * 100;
      pointsProgressEl.style.width = `${Math.min(pointsProgress, 100)}%`;
      const change = ((totalPoints - prevPoints) / (prevPoints || 1)) * 100;
      pointsChangeEl.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
    }

    // Update Points Text
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const pointsLastHour = profiles
      .filter(profile => new Date(profile.updated_at) >= oneHourAgo)
      .reduce((sum, profile) => sum + (profile.points || 0), 0);
    const avgPointsPerHour = pointsLastHour / (profiles.length || 1);

    const avgMiningSpeed = profiles.length > 0 ? profiles.reduce((sum, profile) => sum + (profile.mining_speed || 0), 0) / profiles.length : 0;
    const rewardRate = (avgMiningSpeed / 1000).toFixed(1);

    const latestBlock = blocks.length > 0 ? blocks[0].block_number : 0;
    const blocksUntilHalving = 5000 - (latestBlock % 5000);

    if (pointsTextEl) {
      pointsTextEl.textContent = `AQULA Points continue to accumulate across the network with an average of ${Math.round(avgPointsPerHour).toLocaleString()} points mined per hour. The current reward rate stands at ${rewardRate} AQULA per TH/s with halving scheduled in approximately ${blocksUntilHalving} blocks.`;
    }

    // Update Today Rewards
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const todayPoints = profiles
      .filter(profile => new Date(profile.updated_at) >= oneDayAgo)
      .reduce((sum, profile) => sum + (profile.points || 0), 0);
    if (todayRewardsEl) {
      todayRewardsEl.textContent = `${todayPoints.toLocaleString()} AQULA`;
    }

    // Update Average Per Miner
    const avgPerMiner = onlineMiners > 0 ? (todayPoints / onlineMiners).toFixed(1) : 0;
    if (avgPerMinerEl) {
      avgPerMinerEl.textContent = `${avgPerMiner} AQULA`;
    }

    // Update Charts
    if (networkChart && networkChartData) {
      networkChartData.datasets[0].data.shift();
      networkChartData.datasets[0].data.push(totalPoints);
      networkChart.update();
    }

    if (pointsChart && pointsChartData) {
      const sortedPoints = profiles.map(p => p.points || 0).sort((a, b) => b - a);
      const top10PercentCount = Math.ceil(profiles.length * 0.1);
      const next40PercentCount = Math.ceil(profiles.length * 0.4);
      const top10Points = sortedPoints.slice(0, top10PercentCount).reduce((sum, p) => sum + p, 0);
      const next40Points = sortedPoints.slice(top10PercentCount, top10PercentCount + next40PercentCount).reduce((sum, p) => sum + p, 0);
      const bottom50Points = sortedPoints.slice(top10PercentCount + next40PercentCount).reduce((sum, p) => sum + p, 0);
      pointsChartData.datasets[0].data = [top10Points, next40Points, bottom50Points];
      pointsChart.update();
    }

    // Update Overview Text
    const overviewTextEl = document.getElementById('overviewText');
    const uniqueLocations = [...new Set(scans.map(scan => scan.location).filter(loc => loc))].length;
    const totalTransactions = (await supabase.from('contract_activity').select('call_count', { count: 'exact' })).count || 0;
    const uptime = 99.98;
    if (overviewTextEl) {
      overviewTextEl.textContent = `AQULA Network is currently operating at optimal capacity with ${onlineMiners} active miners across ${uniqueLocations} regions. The blockchain has processed over ${totalTransactions.toLocaleString()} transactions this month with ${uptime}% uptime. New mining rewards protocol v2.5 is active since block #${latestBlock}.`;
    }

    // Update Block Metrics
    const blocksPerDayEl = document.getElementById('blocksPerDay');
    const avgTxFeeEl = document.getElementById('avgTxFee');
    const difficultyEl = document.getElementById('difficulty');
    const hashRateEl = document.getElementById('hashRate');
    const hashRateProgressEl = document.getElementById('hashRateProgress');
    const hashRateChangeEl = document.getElementById('hashRateChange');
    const efficiencyEl = document.getElementById('efficiency');
    const efficiencyProgressEl = document.getElementById('efficiencyProgress');
    const efficiencyChangeEl = document.getElementById('efficiencyChange');

    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentBlocks = blocks.filter(block => new Date(block.created_at) >= oneWeekAgo);
    const blocksPerDay = recentBlocks.length > 0 ? (recentBlocks.length / 7).toFixed(0) : 0;
    if (blocksPerDayEl) blocksPerDayEl.textContent = `${blocksPerDay}`;

    const avgTxFee = 0.0021;
    if (avgTxFeeEl) avgTxFeeEl.textContent = `${avgTxFee} AQULA`;

    const difficulty = (avgMiningSpeed * 1000).toFixed(2);
    if (difficultyEl) difficultyEl.textContent = `${difficulty} TH`;

    // --- FIX 2: Update Hash Rate (Versi Perbaikan) ---
const oneDayAgoHash = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const recentProfiles = profiles.filter(profile => new Date(profile.updated_at) >= oneDayAgoHash);
let avgHashRate24h = recentProfiles.length > 0 ? recentProfiles.reduce((sum, profile) => sum + (profile.mining_speed || 0), 0) / recentProfiles.length : 0;

// Jika data dari DB 0, gunakan simulasi realistis untuk tampilan
if (avgHashRate24h === 0) {
    if (recentProfiles.length > 0) {
        // Jika ada profile tapi speed 0, simulasikan
        avgHashRate24h = (Math.random() * 50) + 25; // Simulasi 25-75 TH/s
    } else {
         // Jika tidak ada profil, tampilkan angka acak kecil (tapi tidak 0)
        avgHashRate24h = (Math.random() * 10) + 5; // Simulasi 5-15 TH/s
    }
}
// --- AKHIR FIX 2 ---

if (hashRateEl && hashRateProgressEl && hashRateChangeEl) {
  const prevHashRate = parseFloat(hashRateEl.textContent.replace('TH/s', '').trim()) || 0;
  
  // --- PERUBAHAN DI SINI: Gunakan toFixed(1) BUKAN Math.round() ---
  hashRateEl.innerHTML = `${avgHashRate24h.toFixed(1)}<span class="text-lg text-slate-400 ml-1">TH/s</span>`;
  
  hashRateProgressEl.style.width = `${(avgHashRate24h / 200) * 100}%`;
  const hashRateChange = avgHashRate24h - prevHashRate;
  hashRateChangeEl.textContent = `${hashRateChange >= 0 ? '+' : ''}${hashRateChange.toFixed(1)}%`;
}

    const activeMiners24h = recentProfiles.filter(profile => profile.mining_speed > 0).length;
    const miningEfficiency = recentProfiles.length > 0 ? (activeMiners24h / recentProfiles.length) * 100 : 0;
    if (efficiencyEl && efficiencyProgressEl && efficiencyChangeEl) {
      const prevEfficiency = parseFloat(efficiencyEl.textContent.replace('%', '').trim()) || 0;
      efficiencyEl.innerHTML = `${Math.round(miningEfficiency)}<span class="text-lg text-slate-400 ml-1">%</span>`;
      efficiencyProgressEl.style.width = `${Math.min(miningEfficiency, 100)}%`;
      const efficiencyChange = miningEfficiency - prevEfficiency;
      efficiencyChangeEl.textContent = `${efficiencyChange >= 0 ? '+' : ''}${efficiencyChange.toFixed(1)}%`;
    }

    // Update Performance Chart (gunakan data hash rate yang sudah disimulasi jika perlu)
    if (perfChart && perfChartData) {
      perfChartData.datasets[0].data.shift();
      perfChartData.datasets[0].data.push(Math.round(avgHashRate24h));
      perfChart.update();
    }

    // Update Validation Chart
    if (valChart && valChartData && blocks.length > 0) {
      valChartData.labels.shift();
      valChartData.labels.push(`Block #${blocks[0].block_number}`);
      valChartData.datasets[0].data.shift();
      valChartData.datasets[0].data.push(parseFloat(blocks[0].validation_time || 0));
      valChart.update();
    }

    // Update Miners Table
    const minersTableBodyEl = document.getElementById('minersTableBody');
    const minersCountEl = document.getElementById('minersCount');
    const totalMinersEl = document.getElementById('totalMiners');
    if (minersTableBodyEl && minersCountEl && totalMinersEl) {
      minersTableBodyEl.innerHTML = '';
      const minerData = scans.map(scan => {
        const profile = profiles.find(p => p.id === scan.profile_id);
        const previousPoints = pointsSnapshot[scan.profile_id] || 0;
        const currentPoints = profile ? (profile.points || 0) : 0;
        const isOnline = currentPoints > previousPoints;
        pointsSnapshot[scan.profile_id] = currentPoints;
        return {
          id: scan.id,
          profile_id: scan.profile_id,
          location: scan.location || 'Unknown',
          hashRate: (Math.random() * 100).toFixed(2) + ' TH/s',
          status: isOnline ? 'Active' : 'Inactive',
          lastActive: new Date(scan.created_at).toLocaleString()
        };
      }).slice(0, 10);

      minerData.forEach(miner => {
        const row = `
          <tr class="hover:bg-slate-700/30 transition-colors duration-200">
            <td class="px-5 py-3 text-left">${miner.id.length > 8 ? miner.id.slice(0, 4) + '...' + miner.id.slice(-4) : miner.id}</td>
            <td class="px-5 py-3 text-left">${miner.location.length > 8 ? miner.location.slice(0, 4) + '...' + miner.location.slice(-4) : miner.location}</td>
            <td class="px-5 py-3 text-left">${miner.hashRate}</td>
            <td class="px-5 py-3 text-left ${miner.status === 'Active' ? 'text-green-400' : 'text-red-400'}">${miner.status}</td>
            <td class="px-5 py-3 text-left text-xs text-slate-400">${miner.lastActive}</td>
          </tr>
        `;
        minersTableBodyEl.insertAdjacentHTML('beforeend', row);
      });

      minersCountEl.textContent = minerData.length;
      totalMinersEl.textContent = scans.length;
    }

    // Update Node Map
    const nodeMapEl = document.getElementById('nodeMap');
    const nodeCountEl = document.getElementById('nodeCount');
    const nodeRegionsEl = document.getElementById('nodeRegions');
    if (nodeMapEl && nodeCountEl && nodeRegionsEl) {
      nodeMapEl.innerHTML = '';
      const locations = scans.map(scan => scan.location).filter(loc => loc);
      const uniqueRegions = [...new Set(locations)];
      const locationPositions = {
        'Medan, North Sumatra, ID': { left: '20%', top: '30%' },
        'Jakarta, ID': { left: '25%', top: '35%' },
        'Singapore, SG': { left: '60%', top: '40%' },
        'Tokyo, JP': { left: '80%', top: '50%' },
        'London, UK': { left: '10%', top: '60%' },
        'New York, US': { left: '50%', top: '20%' },
      };

      const locationCounts = {};
      locations.forEach(loc => {
        locationCounts[loc] = (locationCounts[loc] || 0) + 1;
        const count = locationCounts[loc];
        const pos = locationPositions[loc] || { left: `${Math.random() * 80}%`, top: `${Math.random() * 80}%` };
        const offset = (count - 1) * 5;
        const adjustedPos = {
          left: `calc(${pos.left} + ${offset}%)`,
          top: `calc(${pos.top} + ${offset}%)`,
        };
        const node = `<div class="node animate-pulse-node" style="left: ${adjustedPos.left}; top: ${adjustedPos.top};" title="${loc}"></div>`;
        nodeMapEl.insertAdjacentHTML('beforeend', node);
      });
      nodeCountEl.textContent = locations.length;
      nodeRegionsEl.textContent = uniqueRegions.length;
    }

    // Update Block Info
    const latestBlockEl = document.getElementById('latestBlock');
    const validationTimeEl = document.getElementById('validationTime');
    const blockHashEl = document.getElementById('blockHash');
    if (latestBlockEl && validationTimeEl && blockHashEl) {
      if (blocks.length > 0) {
        latestBlockEl.textContent = blocks[0].block_number;
        validationTimeEl.innerHTML = `${blocks[0].validation_time.toFixed(1)}<span class="text-lg text-slate-400 ml-1">s</span>`;
        blockHashEl.textContent = blocks[0].hash;
      } else {
        latestBlockEl.textContent = '0';
        validationTimeEl.innerHTML = '0<span class="text-lg text-slate-400 ml-1">s</span>';
        blockHashEl.textContent = '0x0000...0000';
      }
    }

    // Update Transaction Feed
    const transactionFeedEl = document.getElementById('transactionFeed');
    if (transactionFeedEl) {
      transactionFeedEl.innerHTML = '';
      profiles.slice(0, 10).forEach(profile => {
        const pointsChange = profile.points || 0;
        const entry = `
          <div class="p-3 bg-slate-800/50 rounded-lg border border-blue-500/20 animate-fadeIn">
            <div class="flex items-center justify-between">
              <span class="text-slate-100">${profile.id.slice(0, 8)}...</span>
              <span class="text-blue-400 font-semibold">+${pointsChange.toLocaleString()} AQULA</span>
            </div>
            <span class="text-xs text-slate-400">${new Date(profile.updated_at).toLocaleTimeString()}</span>
          </div>
        `;
        transactionFeedEl.insertAdjacentHTML('beforeend', entry);
      });
    }

    // Update Smart Contract Section
    const contractCallsEl = document.getElementById('contractCalls');
    const executionSuccessEl = document.getElementById('executionSuccess');
    const contractActivityEl = document.getElementById('contractActivity');
    if (contractCallsEl && executionSuccessEl && contractActivityEl) {
      console.log('[CONTRACT] DOM elements found:', { contractCallsEl, executionSuccessEl, contractActivityEl });
      try {
        const { data, error } = await supabase
          .from('contract_activity')
          .select('call_count, success_rate, status, updated_at, profile_id')
          .order('updated_at', { ascending: false })
          .limit(5);
        console.log('[CONTRACT] Fetched contract_activity:', data, 'Error:', error);
        if (error) {
          console.warn('[CONTRACT] Failed to retrieve contract_activity data:', error);
          contractCallsEl.textContent = '0';
          executionSuccessEl.innerHTML = '0<span class="text-lg text-slate-400 ml-1">%</span>';
          contractActivityEl.innerHTML = '<div class="text-slate-400">No data available</div>';
        } else {
          // Ambil data spesifik user saat ini dari hasil fetch (jika ada)
          const currentUserData = data.find(c => c.profile_id === window.currentUser?.id);
          
          let callCount = 0;
          let successRate = 0;

          if (currentUserData) {
            // Jika data user ada, tampilkan itu
            callCount = currentUserData.call_count || 0;
            successRate = currentUserData.success_rate || 0;
            console.log('[CONTRACT] Displaying data for current user');
          } else {
            // Jika tidak, tampilkan data agregat (seperti sebelumnya)
            callCount = data.reduce((sum, c) => sum + (c.call_count || 0), 0);
            successRate = data.length > 0 ? data.reduce((sum, c) => sum + (c.success_rate || 0), 0) / data.length : 0;
            console.log('[CONTRACT] Displaying aggregate data');
          }

          contractCallsEl.textContent = callCount.toLocaleString();
          executionSuccessEl.innerHTML = `${successRate.toFixed(1)}<span class="text-lg text-slate-400 ml-1">%</span>`;
          console.log('[CONTRACT] Updated UI:', { callCount, successRate });

          // Update grafik
          if (contractChart && contractChartData) {
            contractChartData.datasets[0].data.shift();
            contractChartData.datasets[0].data.push(callCount);
            contractChartData.datasets[1].data.shift();
            contractChartData.datasets[1].data.push(successRate);
            contractChartData.labels.shift();
            contractChartData.labels.push(new Date().toLocaleTimeString());
            contractChart.update();
          }

          contractActivityEl.innerHTML = '';
          if (data.length > 0) {
            data.forEach(contract => {
              const status = contract.status || 'Pending';
              const entry = `
                <div class="p-3 bg-slate-800/50 rounded-lg border border-pink-500/20 animate-fadeIn">
                  <div class="flex items-center justify-between">
                    <span class="text-slate-100">Contract ${contract.profile_id.slice(0, 8)}...</span>
                    <span class="text-pink-400 font-semibold">${status}</span>
                  </div>
                  <span class="text-xs text-slate-400">${new Date(contract.updated_at).toLocaleTimeString()}</span>
                </div>
              `;
              contractActivityEl.insertAdjacentHTML('beforeend', entry);
              console.log('[CONTRACT] Added contract activity entry:', contract);
            });
          } else {
            contractActivityEl.innerHTML = '<div class="text-slate-400">No data available</div>';
            console.log('[CONTRACT] No contract activity data available');
          }
        }
      } catch (err) {
        console.error('[CONTRACT] Error fetching contract_activity:', err);
        contractCallsEl.textContent = '0';
        executionSuccessEl.innerHTML = '0<span class="text-lg text-slate-400 ml-1">%</span>';
        contractActivityEl.innerHTML = '<div class="text-slate-400">No data available</div>';
      }
    } else {
      console.error('[CONTRACT] DOM elements not found:', { contractCallsEl, executionSuccessEl, contractActivityEl });
    }
  } catch (error) {
    console.error('[DASHBOARD] Error updating network dashboard:', error);
    showToast('Error', 'Failed to update dashboard data', 'destructive');
  }
}
// --- AKHIR FUNGSI DASHBOARD DIPERBAIKI ---


// Berlangganan pembaruan real-time dari Supabase
function subscribeToRealtimeUpdates() {
  supabase
    .channel('profiles-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, payload => {
      console.log('[REALTIME] Profiles change received:', payload);
      if (currentPage === 'network') updateNetworkDashboard();
    })
    .subscribe((status) => {
      console.log('[REALTIME] Profiles subscription status:', status);
    });

  supabase
    .channel('security-scans-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'security_scans' }, payload => {
      console.log('[REALTIME] Security scans change received:', payload);
      if (currentPage === 'network') updateNetworkDashboard();
    })
    .subscribe((status) => {
      console.log('[REALTIME] Security scans subscription status:', status);
    });

  supabase
    .channel('blocks-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'blocks' }, payload => {
      console.log('[REALTIME] Blocks change received:', payload);
      if ((window.currentPage || document.body?.dataset?.page) === 'network') updateNetworkDashboard();
    })
    .subscribe((status) => {
      console.log('[REALTIME] Blocks subscription status:', status);
    });

  supabase
    .channel('contract-activity-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'contract_activity' }, payload => {
      console.log('[REALTIME] Contract activity change received:', payload);
      if ((window.currentPage || document.body?.dataset?.page) === 'network') {
        console.log('[REALTIME] Updating dashboard due to contract activity change');
        updateNetworkDashboard();
      }
    })
    .subscribe((status) => {
      console.log('[REALTIME] Contract activity subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('[REALTIME] Successfully subscribed to contract_activity changes');
      } else if (status === 'CLOSED' || status === 'TIMED_OUT') {
        console.warn('[REALTIME] Contract activity subscription failed, retrying...');
        setTimeout(() => supabase.channel('contract-activity-changes').subscribe(), 2000);
      }
    });
}

// Fungsi untuk menampilkan tab
function showTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.tab-content + .tab-content button').forEach(btn => {
    btn.classList.remove('text-slate-100', 'bg-gradient-to-br', 'from-slate-700/50', 'to-slate-800/70');
    btn.classList.add('text-slate-400', 'hover:text-slate-100', 'hover:bg-slate-700/50');
  });
  const activeTabBtn = document.querySelector(`button[onclick="showTab('${tabId}')"]`);
  if (activeTabBtn) {
    activeTabBtn.classList.remove('text-slate-400', 'hover:text-slate-100', 'hover:bg-slate-700/50');
    activeTabBtn.classList.add('text-slate-100', 'bg-gradient-to-br', 'from-slate-700/50', 'to-slate-800/70');
  }
  document.getElementById(tabId).classList.remove('hidden');
}

// Inisialisasi halaman Network
async function initializeNetwork() {
  console.log('[INIT] Starting network initialization...');
  try {
    await checkUser();
    console.log('[INIT] User checked:', window.currentUser);
    setupNetworkEventListeners();
    initializeNetworkCharts();
    console.log('[INIT] Network charts initialized');
    await updateNetworkDashboard();
    console.log('[INIT] Network dashboard updated');
    subscribeToRealtimeUpdates();
    initializePresence();
    startPointsMonitoring();
    startBlockGeneration();
    startNetworkClock();
    if (window.quantumSyncChart) {
      startQuantumSyncMonitoring();
      console.log('[INIT] Quantum Sync Monitoring dimulai setelah chart siap');
    } else {
      console.warn('[INIT] Tidak memulai Quantum Sync Monitoring karena quantumSyncChart tidak tersedia');
    }
    // Jalankan fetchContractActivity jika user terautentikasi
    if (window.currentUser?.id) {
      await fetchContractActivity(); // Ambil data nyata pertama kali
      setInterval(fetchContractActivity, 60000); // Ambil data setiap 60 detik
    }
  } catch (err) {
    console.error('[INIT] Error inisialisasi Network:', err);
    showToast('Error', 'Failed to load the Network page', 'destructive');
    stopMining();
  }
}

// Inisialisasi saat DOM siap
document.addEventListener('DOMContentLoaded', function () {
  console.log('[INIT] DOM loaded, memulai inisialisasi...');
  const _pageFlag = window.currentPage || document.body?.dataset?.page || (location.pathname || '').split('/').pop();
  if (_pageFlag === 'network' || _pageFlag === 'networks') {
    initializeNetwork();
  }
});