/**
 * Vercel Serverless Function — Proxy seguro para OpenAI Whisper
 * 
 * A chave OPENAI_API_KEY fica protegida no servidor (Vercel Environment Variables).
 * O navegador nunca a vê.
 * 
 * Rota: POST /api/transcribe
 */

export const config = {
  api: {
    bodyParser: false, // necessário para receber FormData com arquivo
  },
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (!openAiApiKey) {
    return res.status(500).json({
      error: 'OPENAI_API_KEY não configurada nas variáveis de ambiente da Vercel',
    });
  }

  try {
    // Ler o body como buffer
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Extrair o boundary do Content-Type
    const contentType = req.headers['content-type'] || '';
    
    // Repassar o FormData exato para a OpenAI
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': contentType,
      },
      body: buffer,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || response.statusText;
      console.error(`Whisper API erro ${response.status}:`, errorMsg);
      return res.status(response.status).json({ error: errorMsg });
    }

    const transcriptionText = await response.text();
    return res.status(200).json({ transcription: transcriptionText });
  } catch (error) {
    console.error('Erro na API de transcrição:', error);
    return res.status(500).json({ error: error.message });
  }
}
