
      // START: Konfigurasi variabel
      const PROXY_URL = 'http://localhost:5500/ask'; // Ubah port dari 3000 ke 8081
      const blockedWords = ['token', 'source code', 'contract', 'bypass', 'funding']; // Daftar kata-kata terlarang
      // END: Konfigurasi variabel

      // START: Elemen DOM
      const sendButton = document.getElementById('send-button'); // Tombol untuk mengirim pesan
      const messageInput = document.getElementById('message-input'); // Input untuk menulis pesan
      const logMessages = document.getElementById('log-messages'); // Area untuk menampilkan log pesan
      const newMessages = document.getElementById('new-messages'); // Elemen untuk menampilkan jumlah pesan baru
      const attachFileBtn = document.getElementById('attach-file-btn'); // Tombol untuk melampirkan file
      const fileInput = document.getElementById('file-input'); // Input untuk memilih file
      const toggleTemplatesBtn = document.getElementById('toggle-templates'); // Tombol untuk menampilkan/menyembunyikan template
      const templatePanel = document.getElementById('template-panel'); // Panel yang berisi template pertanyaan
      // END: Elemen DOM

// Deklarasi elemen DOM
const aiLogContainer = document.getElementById('ai-log-container');
const aiLogMessages = document.getElementById('ai-log-messages');
const newAiMessages = document.getElementById('new-ai-messages');
const aiMessageInput = document.getElementById('ai-message-input');
const aiSendButton = document.getElementById('ai-send-button');
const aiAttachFileBtn = document.getElementById('ai-attach-file-btn');
const aiFileInput = document.getElementById('ai-file-input');
const aiTemplatePanel = document.getElementById('ai-template-panel');
const aiToggleTemplatesBtn = document.getElementById('ai-toggle-templates');

// Variabel global
let aiMessageCount = 0;
let aiAvatarUrl = 'https://mnobniomzmjgpyyqartz.supabase.co/storage/v1/object/public/avatars/avatar/ai_avatar.png '; // Avatar default AI
let user = null;

// Fungsi untuk mendapatkan avatar pengguna dari Supabase
function getUserAvatar() {
    if (user && user.profile && user.profile.avatar_url) {
        const {
            data
        } = supabase.storage.from('avatars').getPublicUrl(user.profile.avatar_url);
        return data?.publicUrl || null;
    }
    return null;
}


function addAiMessage(sender, message, isUser = false, options = {}) {
    const {
        imageUrl
    } = options;
    const messageWrapper = document.createElement('div');
    messageWrapper.className = `w-full flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`;

    // Mendefinisikan kelas CSS kondisional
    const bubbleOrder = isUser ? 'flex-row-reverse' : 'flex-row';
    const bubbleColor = isUser ? 'bg-cyan-600 text-white' : 'bg-slate-800/60 border border-slate-700/50 text-slate-300';
    const avatarMargin = isUser ? 'ml-3' : 'mr-3';
    const senderName = isUser ? 'You' : sender;
    const senderNameColor = isUser ? 'text-slate-200' : 'text-cyan-400';
    const timestampColor = isUser ? 'text-slate-300' : 'text-slate-500';

    const avatarUrl = isUser ? getUserAvatar() : aiAvatarUrl;
    const avatarIcon = `
        ${avatarUrl
            ? `<img src="${avatarUrl}" class="h-5 w-5 object-cover rounded-full" alt="${sender} avatar"
                onerror="this.style.display='none'; this.parentElement.innerHTML='<svg xmlns=\\"http://www.w3.org/2000/svg\\" class=\\"h-5 w-5 text-cyan-400\\" fill=\\"none\\" viewBox=\\"0 0 24 24\\" stroke=\\"currentColor\\" stroke-width=\\"1.5\\"><path stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" d=\\"M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z\\" /></svg>`
            : `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>`
        }
    `;

    // Konten dinamis: bisa gambar, teks, atau keduanya
    const messageContent = imageUrl ?
        `
        <img src="${imageUrl}" class="rounded-lg max-w-xs cursor-pointer object-cover mb-2" alt="Uploaded Image Preview"/>
        <p class="leading-relaxed">${message.replace(/\n/g, '<br>')}</p>
        ` :
        `<p class="leading-relaxed">${message.replace(/\n/g, '<br>')}</p>`;

    messageWrapper.innerHTML = `
        <div class="flex items-start max-w-lg ${bubbleOrder}">
            <div class="flex-shrink-0 bg-slate-700/50 p-2 rounded-lg border border-slate-700/50 ${avatarMargin}">
                ${avatarIcon}
            </div>
            <div class="${bubbleColor} rounded-xl p-3 text-sm">
                <div class="font-medium ${senderNameColor} mb-1 flex items-center">
                    ${senderName}
                    ${!isUser ? '<span class="ml-2 text-xs px-2 py-0.5 bg-slate-700/50 rounded-full text-slate-400">System</span>' : ''}
                </div>
                ${messageContent}
                <div class="text-xs ${timestampColor} mt-2 flex items-center ${isUser ? 'justify-start' : 'justify-end'}">
                    ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>
        </div>
    `;

    aiLogMessages.appendChild(messageWrapper);
    scrollToBottom(aiLogContainer);
}


// Fungsi untuk memperbarui jumlah pesan baru
function updateAiMessageCount() {
    aiMessageCount++;
    newAiMessages.textContent = `${aiMessageCount} New Messages`;
}

/**
 * Fungsi untuk memproses gambar (Versi Modifikasi)
 * Menampilkan pratinjau lokal terlebih dahulu, lalu mengirim ke server.
 */
async function processAiImage(file) {
    // 1. Tampilkan pratinjau gambar di chat secara lokal
    const reader = new FileReader();
    reader.onload = function(e) {
        // Panggil addAiMessage dengan URL gambar lokal dan nama file sebagai caption
        addAiMessage('You', file.name, true, {
            imageUrl: e.target.result
        });
    };
    reader.readAsDataURL(file);

    // 2. Lanjutkan proses pengiriman ke server di latar belakang
    const formData = new FormData();
    formData.append('image', file);

    // Tampilkan animasi loading terpisah untuk menandakan proses analisis
    const loadingContainer = document.createElement('div');
    loadingContainer.className = 'w-full flex justify-start mb-4'; // AI side
    loadingContainer.innerHTML = `
        <div class="flex items-center max-w-lg">
             <div class="flex-shrink-0 bg-slate-700/50 p-2 rounded-lg border border-slate-700/50 mr-3">
                 <img src="${aiAvatarUrl}" class="h-5 w-5 object-cover rounded-full" alt="AI avatar"/>
             </div>
             <div class="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 text-sm text-slate-300">
                <div class="flex items-center space-x-2">
                    <div class="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-pulse" style="animation-delay: -0.3s;"></div>
                    <div class="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-pulse" style="animation-delay: -0.1s;"></div>
                    <div class="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-pulse"></div>
                    <span class="text-xs text-slate-400">Analyzing image...</span>
                </div>
             </div>
        </div>
    `;
    aiLogMessages.appendChild(loadingContainer);
    scrollToBottom(aiLogContainer);

    try {
        const response = await fetch('http://localhost:5500/analyze-image', {
            method: 'POST',
            body: formData,
        });
        if (!response.ok) throw new Error('Failed to analyze the image');
        const data = await response.json();

        if (data.description && data.description.trim()) {
            addAiMessage('AI Assistant', `Based on the picture: "${data.description}"`, false);
            sendToAi(data.description); // Kirim ke AI
        } else {
            addAiMessage('AI Assistant', 'No legible text from the image.', false);
        }

        updateAiMessageCount();
    } catch (error) {
        console.error('Error menganalisis gambar:', error);
        addAiMessage('AI Assistant', 'Error: Unable to read text from pictures.', false);
    } finally {
        loadingContainer.remove(); // Hapus animasi loading setelah selesai
        aiFileInput.value = ''; // Reset input file
    }
}


// Fungsi untuk mengirim pesan ke AI
async function sendToAi(message) {
    const blockedWords = ['hack', 'password', 'token', 'private key'];
    const lowerMessage = message.toLowerCase();

    if (blockedWords.some(word => lowerMessage.includes(word))) {
        addAiMessage('AI Assistant', 'Sorry, your question is off the topic of Project Aqula.', false);
        updateAiMessageCount();
        return;
    }

    if (
        lowerMessage.includes('roadmap') ||
        lowerMessage.includes('road map') ||
        lowerMessage.includes('jalur perkembangan')
    ) {
        const roadmapButtonContainer = document.createElement('div');
        roadmapButtonContainer.className = 'p-3';
        roadmapButtonContainer.innerHTML = `
      <button id="ai-roadmap-button" class="
        group relative inline-flex items-center justify-center px-5 py-3 overflow-hidden font-medium
        tracking-tighter text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg
        transition-all duration-300 hover:scale-105 hover:shadow-xl
      ">
        <span class="absolute w-0 h-full bg-cyan-400 top-0 left-0 block transition-all duration-300 ease-out group-hover:w-full"></span>
        <span class="relative flex items-center z-10">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 animate-pulse" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656 0L10 9.172a4 4 0 000 5.656l3 3a4 4 0 005.656-5.656l-3-3a4 4 0 00-5.656 0l-.707.707a1 1 0 001.414 1.414l.707-.707z" clip-rule="evenodd" />
          </svg>
          View Aqula Roadmap
        </span>
      </button>
    `;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'w-full flex justify-start mb-4';
        messageDiv.innerHTML = `
            <div class="flex items-start max-w-lg">
                <div class="flex-shrink-0 bg-slate-700/50 p-2 rounded-lg border border-slate-700/50 mr-3">
                    <img src="${aiAvatarUrl}" class="h-5 w-5 object-cover" alt="AI Avatar" />
                </div>
                <div class="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 text-sm text-slate-300 flex-1">
                    <div class="font-medium text-cyan-400 mb-1 flex items-center">
                        AI Assistant
                        <span class="ml-2 text-xs px-2 py-0.5 bg-slate-700/50 rounded-full text-slate-400">System</span>
                    </div>
                    <p>Would you like to see Aqula's roadmap? Click the button below:</p>
                </div>
            </div>
        `;

        aiLogMessages.appendChild(messageDiv);
        aiLogMessages.appendChild(roadmapButtonContainer);
        scrollToBottom(aiLogContainer);

        document.getElementById('ai-roadmap-button').addEventListener('click', () => {
            showToast('SOON: Roadmap will be available shortly!');
        });

        updateAiMessageCount();
        return;
    }


    // Kirim ke API
    const prompt = `
You are the official AI Assistant of Project Aqula. 
Always keep your answers consistent with what has been said before, so the user gets continuity across conversations.

Guidelines for answering:
- Focus only on Aqula’s general functions, mining features, and its future vision. 
- Do NOT provide technical details, code, smart contracts, or confidential information. 
- If the user asks whether Aqula is a scam, firmly and consistently state that Aqula is a decentralized blockchain-based future project and not a scam. 
- Maintain the same language as the user in every reply (do not ask what language to use). 
- You may also generate or describe images related to Aqula (such as the Aqula logo, branding visuals, mining concepts, or project artwork) when requested. 

Question: ${message}
`;

    try {
        // [PERBAIKAN] Ganti PROXY_URL dengan URL endpoint server yang benar
        const response = await fetch('http://localhost:5500/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt // Server Anda mengharapkan objek dengan key 'prompt'
            }),
        });

        if (!response.ok) throw new Error('Failed to contact the server');

        const data = await response.json();
        // Server Anda mengirim balasan dalam 'completion', bukan 'description'
        addAiMessage('AI Assistant', data.completion, false); 
        updateAiMessageCount();
    } catch (error) {
        console.error('Error:', error);
        addAiMessage('AI Assistant', 'Error: Unable to contact the server.', false);
        updateAiMessageCount();
    }
}
// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await checkUser();
        user = window.currentUser ? { ...window.currentUser,
            profile: window.currentUser.profile
        } : null;
        initializeAiCommunicationsLog();
    } catch (error) {
        console.error('Error checking user:', error);
        user = null;
        initializeAiCommunicationsLog();
    }

    aiAttachFileBtn?.addEventListener('click', () => aiFileInput.click());

    aiFileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            processAiImage(file);
        } else {
            addAiMessage('AI Assistant', 'Please upload image files.', false);
        }
    });

    aiSendButton?.addEventListener('click', () => {
        const message = aiMessageInput.value.trim();
        if (message) {
            addAiMessage('You', message, true);
            sendToAi(message);
            aiMessageInput.value = '';
            updateAiMessageCount();
        }
    });

    aiMessageInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            aiSendButton.click();
        }
    });

    aiToggleTemplatesBtn?.addEventListener('click', () => {
        aiTemplatePanel.classList.toggle('hidden');
        aiToggleTemplatesBtn.textContent = aiTemplatePanel.classList.contains('hidden') ?
            'Show Templates' :
            'Hide Templates';
    });

    if (aiTemplatePanel) {
        const templates = [{
            label: 'Features',
            question: 'What are the main features of Aqula mining?'
        }, {
            label: 'How It Works',
            question: 'How does Aqula mining work?'
        }, {
            label: 'Future Vision',
            question: 'What is the future vision of Aqula?'
        }, {
            label: 'Roadmap',
            question: 'What is the roadmap of Aqula project?'
        }];

        templates.forEach(template => {
            const btn = document.createElement('button');
            btn.className = 'text-xs text-slate-400 hover:text-white transition-all px-2 py-1 rounded text-left';
            btn.setAttribute('data-template', template.question);
            btn.textContent = template.label;
            aiTemplatePanel.appendChild(btn);
        });

        aiTemplatePanel.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', () => {
                const question = button.getAttribute('data-template');
                addAiMessage('You', question, true);
                sendToAi(question);
                aiTemplatePanel.classList.add('hidden');
                aiToggleTemplatesBtn.textContent = 'Show Templates';
            });
        });
    }
});

// Dummy function untuk checkUser (harus sesuai dengan sistem auth Anda)
async function checkUser() {
    const {
        data: {
            user
        },
        error
    } = await supabase.auth.getUser();
    if (error || !user) throw error || new Error('No user found');

    const {
        data: profile,
        error: profileError
    } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (profileError) throw profileError;

    window.currentUser = { ...user,
        profile
    };
}

// Fungsi dummy inisialisasi
function initializeAiCommunicationsLog() {
    console.log('AI Communications successfully started.');
}

// Helper: Scroll otomatis ke bawah
function scrollToBottom(container) {
    if (container) container.scrollTop = container.scrollHeight;
}
