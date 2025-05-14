const express = require('express');
const axios = require('axios');
const multer = require('multer');
const { createWorker } = require('tesseract.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

// --- KONFIGURASI API GEMINI ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBvxIy4Ki43eOOHBg5QRp5gSPMBQdNx9lQ';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// --- SETUP UPLOAD GAMBAR UNTUK OCR ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/';
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage });

// --- FUNGSI OCR DENGAN TESSERACT.JS ---
async function performOCR(filePath) {
  const worker = await createWorker('eng'); // Bahasa Inggris
  const { data: { text } } = await worker.recognize(filePath);
  await worker.terminate();
  return text;
}

// --- MIDDLEWARE CORS ---
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // Ubah ke '*' untuk sementara agar semua origin diizinkan
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// --- SAJIKAN FILE STATIS ---
app.use(express.static(path.join(__dirname))); // Sajikan file statis dari direktori saat ini

// --- ROUTE: LOGIN (Mengembalikan index.html) ---
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// --- ROUTE: HALAMAN UTAMA ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// --- ENDPOINT: ANALYZE IMAGE (OCR) ---
app.post('/analyze-image', upload.single('image'), async (req, res) => {
  try {
    const imagePath = req.file.path;
    const extractedText = await performOCR(imagePath);

    // Hapus file setelah selesai
    fs.unlinkSync(imagePath);

    if (!extractedText.trim()) {
      return res.json({ description: 'Tidak ada teks terdeteksi dalam gambar.' });
    }

    res.json({ description: extractedText });
  } catch (error) {
    console.error('Error OCR:', error);
    res.status(500).json({ error: 'Gagal membaca teks dari gambar' });
  }
});

// --- ENDPOINT: ASK AI (GEMINI) ---
app.post('/ask', async (req, res) => {
  const { prompt } = req.body;

  try {
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const rawAnswer = response.data.candidates[0].content.parts[0].text;
    res.json({ completion: rawAnswer });
  } catch (error) {
    console.error('Error calling Gemini API:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    res.status(500).json({ error: 'Gagal menghubungi API Gemini' });
  }
});

// --- JALANKAN SERVER DI PORT 8081 ---
const PORT = 8081; // Ubah ke port 8081 sesuai URL yang Anda akses
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});