/**
 * Backend Server — API Proxy para Whisper
 * 
 * Protege a API Key da OpenAI no servidor.
 * Endpoint: POST /api/transcribe — recebe arquivo de áudio, retorna transcrição.
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const result = dotenv.config();
if (result.error) {
  console.error('❌ Erro ao carregar .env:', result.error);
} else {
  console.log('✅ Arquivo .env carregado com sucesso.');
  console.log('📝 Variáveis carregadas:', Object.keys(result.parsed || {}));
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Multer para upload temporário de áudio
const upload = multer({
  dest: path.join(__dirname, 'tmp_uploads'),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB max (Whisper limit)
});

// CORS para o frontend Vite (porta 5173 e 5174)
app.use(cors({
  origin: [
    'http://localhost:5173', 'http://127.0.0.1:5173',
    'http://localhost:5174', 'http://127.0.0.1:5174'
  ],
  methods: ['POST', 'GET'],
  allowedHeaders: ['Content-Type', 'X-API-Key']
}));

app.use(express.json());

// Criar pasta tmp_uploads se não existir
const tmpDir = path.join(__dirname, 'tmp_uploads');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

/**
 * POST /api/transcribe
 * 
 * Recebe: multipart/form-data com campo "file" (áudio)
 * Header: X-API-Key com a chave da OpenAI
 * Retorna: { transcription: "texto transcrito" }
 */
app.post('/api/transcribe', async (req, res) => {
  try {
    await new Promise((resolve, reject) => {
      upload.single('file')(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } catch (err) {
    console.error('Erro no upload:', err.message);
    return res.status(400).json({ error: `Erro no upload: ${err.message}` });
  }

  const apiKey = req.headers['x-api-key'] || process.env.OPENAI_API_KEY;
  console.log('🔑 Verificando API Key para requisição...');
  if (apiKey) {
    console.log(`✅ API Key detectada (Início: ${apiKey.substring(0, 7)}...)`);
  } else {
    console.log('❌ API Key NÃO detectada na requisição ou no ambiente.');
  }

  if (!apiKey) {
    return res.status(400).json({
      error: 'API Key não fornecida. Envie no header X-API-Key ou configure OPENAI_API_KEY no .env'
    });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo de áudio enviado' });
  }

  console.log(`📥 Recebido: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`);

  const filePath = req.file.path;

  try {
    // Preparar FormData para a API da OpenAI
    const FormData = (await import('form-data')).default;
    const formData = new FormData();

    let originalName = req.file.originalname || 'audio.ogg';
    // Whisper não aceita .opus — renomear para .ogg (mesmo codec, container compatível)
    if (originalName.endsWith('.opus')) {
      originalName = originalName.replace(/\.opus$/, '.ogg');
    }
    formData.append('file', fs.createReadStream(filePath), {
      filename: originalName,
      contentType: 'audio/ogg'
    });
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');
    formData.append('response_format', 'text');

    // Chamar API Whisper
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || response.statusText;
      console.error(`❌ Whisper API erro ${response.status}:`, errorMsg);

      if (response.status === 401) {
        return res.status(401).json({ error: 'API Key Inválida', transcription: '[ERRO: API Key Inválida]' });
      }
      return res.status(response.status).json({ error: errorMsg, transcription: `[ERRO: ${errorMsg}]` });
    }

    const transcription = await response.text();
    res.json({ transcription: transcription.trim() });

  } catch (error) {
    console.error('Erro na transcrição:', error.message);
    res.status(500).json({
      error: error.message,
      transcription: '[ERRO: Áudio Inaudível]'
    });
  } finally {
    // Limpar arquivo temporário
    try {
      fs.unlinkSync(filePath);
    } catch (_) { /* ignore */ }
  }
});

/**
 * GET /api/health
 * Health check simples
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasEnvKey: !!process.env.OPENAI_API_KEY,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`\n  🚀 Backend rodando em http://localhost:${PORT}`);
  console.log(`  📡 Endpoint: POST http://localhost:${PORT}/api/transcribe`);
  console.log(`  🔑 API Key via: header X-API-Key ou .env OPENAI_API_KEY\n`);
});
