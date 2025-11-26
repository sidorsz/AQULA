// === DOM Elements ===
const coinSelect = document.getElementById('coinSelect');
const cryptoPrice = document.getElementById('cryptoPrice');
const priceChange = document.getElementById('priceChange');
const volume24h = document.getElementById('volume24h');
const marketCap = document.getElementById('marketCap');
const highLow = document.getElementById('highLow');

// === Chart Initialization ===
const ctxCrypto = document.getElementById('cryptoChart').getContext('2d');
let cryptoChart = new Chart(ctxCrypto, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Price (USD)',
            data: [],
            borderColor: '#06b6d4', // Cyan AQULA
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 4
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { display: false },
            y: { 
                display: true,
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: { color: '#64748b', font: { size: 10 } }
            }
        },
        interaction: { intersect: false, mode: 'index' }
    }
});

// === FUNGSI UTAMA (COINGECKO) ===
async function fetchCryptoData(coinId = 'bitcoin') {
    // Loading state visual
    if (cryptoPrice.textContent.includes('Error')) cryptoPrice.textContent = 'Loading...';

    try {
        console.log(`[Client] Requesting data for ${coinId}...`);

        // 1. Request Data Pasar (Harga, Vol, Cap)
        const tickerRes = await fetch(`http://localhost:5500/coingecko-ticker?coinId=${coinId}`);
        
        if (!tickerRes.ok) {
            // Jika rate limited (429), jangan throw error, biarkan data lama
            if (tickerRes.status === 429) {
                console.warn("CoinGecko Rate Limit. Using cached/old data.");
                return;
            }
            throw new Error('Ticker API Error');
        }

        const data = await tickerRes.json();

        // 2. Update UI Realtime
        // CoinGecko memberikan data yang sangat rapi
        const price = data.current_price;
        const change = data.price_change_percentage_24h;
        const high = data.high_24h;
        const low = data.low_24h;
        const vol = data.total_volume;
        const cap = data.market_cap;

        // Format Harga
        cryptoPrice.textContent = `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
        
        // Format Perubahan %
        if (change !== null && change !== undefined) {
            priceChange.textContent = `${change > 0 ? '+' : ''}${change.toFixed(2)}%`;
            priceChange.className = `text-base font-medium ${change >= 0 ? 'text-green-400' : 'text-red-400'}`;
        } else {
            priceChange.textContent = "0.00%";
        }

        // Format High/Low & Volume
        highLow.textContent = `$${low.toLocaleString()} / $${high.toLocaleString()}`;
        volume24h.textContent = `$${vol.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
        
        // Market Cap (Format Miliar/Triliun)
        if (cap > 1000000000) {
            marketCap.textContent = `$${(cap / 1000000000).toFixed(2)}B`;
        } else {
            marketCap.textContent = `$${(cap / 1000000).toFixed(2)}M`;
        }

        // 3. Request Data Grafik (Chart)
        const chartRes = await fetch(`http://localhost:5500/coingecko-chart?coinId=${coinId}`);
        if (!chartRes.ok) return; // Skip chart update if failed
        
        const chartData = await chartRes.json();
        
        // chartData.prices adalah array [[timestamp, price], [timestamp, price], ...]
        if (chartData.prices && chartData.prices.length > 0) {
            // Ambil sampel data agar grafik tidak terlalu berat (ambil setiap data ke-5)
            // atau gunakan semua jika performa PC bagus
            const pricesArray = chartData.prices; 
            
            const labels = pricesArray.map(item => {
                const date = new Date(item[0]);
                return `${date.getHours()}:${date.getMinutes() < 10 ? '0' : ''}${date.getMinutes()}`;
            });
            
            const prices = pricesArray.map(item => item[1]);

            // 4. Update Chart JS
            cryptoChart.data.labels = labels;
            cryptoChart.data.datasets[0].data = prices;
            
            // Warna chart dinamis
            const isUp = prices[prices.length - 1] >= prices[0];
            const color = isUp ? '#10b981' : '#ef4444'; 
            const bg = isUp ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';

            cryptoChart.data.datasets[0].borderColor = color;
            cryptoChart.data.datasets[0].backgroundColor = bg;
            cryptoChart.update();
        }

    } catch (err) {
        console.error("Crypto Fetch Error:", err);
        // Opsional: Tampilkan error di UI jika fatal
        // cryptoPrice.textContent = "API Error";
    }
}

// === EVENT LISTENERS ===
if (coinSelect) {
    coinSelect.addEventListener('change', (e) => {
        // Reset visual loading agar user tahu sedang proses
        cryptoPrice.textContent = '...'; 
        fetchCryptoData(e.target.value);
    });
}

// === AUTO START & REFRESH ===
// Load pertama kali
fetchCryptoData('bitcoin');

// Refresh otomatis setiap 30 detik (Agar aman dari rate limit CoinGecko Free)
setInterval(() => {
    const currentCoin = coinSelect ? coinSelect.value : 'bitcoin';
    fetchCryptoData(currentCoin);
}, 30000);