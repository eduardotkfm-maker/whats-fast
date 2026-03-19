/**
 * Agente 1 — Transcribitor (Controller A)
 * 
 * 🎯 FUNÇÃO: Processar dados do MODEL (arquivos de áudio) e gerar saída estruturada.
 * 
 * ⚙️ PROCESSAMENTO:
 * - Identificar todos os áudios
 * - Transcrever fielmente
 * - Estruturar cada áudio com metadados
 * - Manter ordem cronológica
 * 
 * ⚠️ REGRAS:
 * - Proibido interpretar
 * - Proibido resumir
 * - Proibido alterar texto
 * - Deve garantir estrutura consistente
 */

// O Supabase não é mais usado aqui, a transcrição vai para a /api/transcribe (Vercel)
/**
 * Transcreve um arquivo de áudio via Supabase Edge Function (que proxeia para Whisper API)
 * @param {Blob} audioBlob - Arquivo de áudio
 * @param {string} filename - Nome do arquivo
 * @returns {string} Texto transcrito ou mensagem de erro
 */
async function transcribeAudio(audioBlob, filename) {
  try {
    const formData = new FormData();
    
    const extension = filename.split('.').pop().toLowerCase();
    const mimeTypes = {
      'opus': 'audio/opus',
      'ogg': 'audio/ogg',
      'mp3': 'audio/mpeg',
      'm4a': 'audio/mp4',
      'wav': 'audio/wav',
      'aac': 'audio/aac',
      'amr': 'audio/amr'
    };
    
    const mimeType = mimeTypes[extension] || 'audio/ogg';
    const file = new File([audioBlob], filename, { type: mimeType });
    
    formData.append('file', file);

    // Enviar para a Vercel Serverless Function em vez da Supabase Edge Function
    const response = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error || response.statusText;
      console.warn("API de transcrição falhou:", errorMsg);
      return '🎧 Áudio (transcrição indisponível - configure OPENAI_API_KEY na Vercel)';
    }

    const data = await response.json();
    return data.transcription ? data.transcription.trim() : '🎧 Áudio (vazio)';
  } catch (error) {
    console.error(`Erro ao transcrever ${filename}:`, error);
    return '🎧 Áudio (erro de rede)';
  }
}

/**
 * Correlaciona arquivos de áudio com linhas do chat
 * @param {Array} messages - Lista de mensagens parseadas
 * @param {Map} mediaFiles - Mapa de arquivos de mídia
 * @returns {Array} Lista de correlações
 */
function correlateAudioWithMessages(messages, mediaFiles) {
  const correlations = [];
  const audioFiles = [...mediaFiles.entries()]
    .filter(([_, f]) => f.type === 'audio');

  for (const [filename, audioData] of audioFiles) {
    // Estratégia 1: Match exato pelo nome do arquivo na mensagem
    let matchIndex = messages.findIndex(m =>
      m.mediaFilename && m.mediaFilename.toLowerCase() === filename.toLowerCase()
    );

    // Estratégia 2: Match por timestamp no nome do arquivo
    // Suporta: PTT-20260303-WA0001 ou 00000038-AUDIO-2026-03-03-11-15-22
    if (matchIndex === -1) {
      const dateMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})/) || filename.match(/(\d{4})(\d{2})(\d{2})/);
      if (dateMatch) {
        const formattedDate = `${dateMatch[3]}/${dateMatch[2]}/${dateMatch[1]}`;
        
        const alreadyCorrelated = new Set(correlations.map(c => c.messageIndex));
        const candidates = messages.filter(m =>
          m.data === formattedDate && (m.tipo === 'audio' || m.tipo === 'media_omitida') &&
          !alreadyCorrelated.has(m.index)
        );
        
        if (candidates.length > 0) {
          matchIndex = candidates[0].index;
        }
      }
    }

    // Estratégia 3: Match por ordem de aparição
    if (matchIndex === -1) {
      const alreadyCorrelated = new Set(correlations.map(c => c.messageIndex));
      const mediaMsg = messages.find(m =>
        (m.tipo === 'audio' || m.tipo === 'media_omitida') && !alreadyCorrelated.has(m.index)
      );
      if (mediaMsg) {
        matchIndex = mediaMsg.index;
      }
    }

    correlations.push({
      audioFilename: filename,
      audioData,
      messageIndex: matchIndex
    });
  }

  return correlations;
}

/**
 * Executa o Agente 1: Transcrição de áudios
 * 
 * 📤 OUTPUT (MODEL PADRONIZADO):
 * {
 *   "audio_id": "PTT-20260303-WA0001.opus",
 *   "data": "03/03/2026",
 *   "hora": "10:26:23",
 *   "remetente": "Nome",
 *   "linha_referencia": "Após mensagem: '...' ",
 *   "mensagem_anterior": "...",
 *   "mensagem_posterior": "...",
 *   "transcricao": "texto completo"
 * }
 * 
 * @param {Array} messages - Mensagens parseadas pelo parser
 * @param {Map} mediaFiles - Mapa de arquivos de mídia
 * @param {Function} onProgress - Callback de progresso
 * @returns {Array} Model JSON com transcrições
 */
export async function executeAgent1(messages, mediaFiles, onProgress = () => {}) {
  const audioFiles = [...mediaFiles.entries()]
    .filter(([_, f]) => f.type === 'audio');

  if (audioFiles.length === 0) {
    onProgress(0, 0, 'Nenhum áudio encontrado');
    return [];
  }

  // Correlacionar áudios com mensagens
  const correlations = correlateAudioWithMessages(messages, mediaFiles);
  const transcriptions = [];
  
  const DELAY_BETWEEN_TRANSCRIPTIONS_MS = 1000; // 1 segundo de respiro entre cada áudio

  // Helper para criar delay
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  for (let i = 0; i < correlations.length; i++) {
    const { audioFilename, audioData, messageIndex } = correlations[i];
    
    onProgress(i + 1, correlations.length, audioFilename);

    // Transcrever áudio (um por um, esperando terminar)
    const transcricao = await transcribeAudio(audioData.blob, audioFilename);

    // Obter vizinhança contextual
    const message = messageIndex >= 0 ? messages[messageIndex] : null;
    const prevMessage = messageIndex > 0 ? messages[messageIndex - 1] : null;
    const nextMessage = messageIndex >= 0 && messageIndex < messages.length - 1
      ? messages[messageIndex + 1] : null;

    // linha_referencia como string descritiva conforme spec
    let linhaReferencia = 'N/A';
    if (prevMessage && prevMessage.remetente !== '__SISTEMA__') {
      const previewText = prevMessage.conteudo.length > 80 
        ? prevMessage.conteudo.slice(0, 80) + '...' 
        : prevMessage.conteudo;
      linhaReferencia = `Após mensagem: '${previewText}'`;
    } else if (message) {
      linhaReferencia = `Mensagem na posição ${messageIndex}`;
    }

    const entry = {
      audio_id: audioFilename,
      data: message ? message.data : 'N/A',
      hora: message ? message.hora : 'N/A',
      remetente: message ? message.remetente : 'Desconhecido',
      linha_referencia: linhaReferencia,
      mensagem_anterior: prevMessage ? prevMessage.conteudo : null,
      mensagem_posterior: nextMessage ? nextMessage.conteudo : null,
      transcricao: transcricao
    };

    transcriptions.push(entry);

    // Pequena pausa antes do próximo áudio (se houver)
    if (i < correlations.length - 1) {
      await delay(DELAY_BETWEEN_TRANSCRIPTIONS_MS);
    }
  }

  return transcriptions;
}
