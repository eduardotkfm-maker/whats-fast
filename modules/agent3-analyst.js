/**
 * Agente 3 — Analista de Extração (Controller C)
 *
 * FUNÇÃO: Analisar a conversa estruturada e identificar perguntas relevantes
 * do cliente com respostas correspondentes, categorizadas automaticamente.
 *
 * PROCESSAMENTO:
 * - Identificar perguntas relevantes
 * - Ignorar perguntas sociais (small talk)
 * - Agrupar mensagens consecutivas do mesmo remetente
 * - Associar resposta correta
 * - Categorizar automaticamente por tema
 * REGRAS:
 * - Proibido alterar texto
 * - Proibido resumir
 * - Proibido interpretar
 * - Deve ignorar small talk
 */

// Padrões de small talk / saudações para ignorar
const SMALLTALK_PATTERNS = [
  /^(oi|olá|ola|hey|hi|hello|e aí|eai|fala)\s*[!.,]?\s*$/i,
  /^(tudo bem|tudo bom|como vai|como está|td bem|td bom)\s*[!?.,]?\s*$/i,
  /^(bom dia|boa tarde|boa noite|bom diaaa*|boa tardeee*|boa noiteee*)\s*[!.,]?\s*$/i,
  /^(obrigad[oa]|vlw|valeu|thanks|brigad[oa]|agradeço)\s*[!.,]?\s*$/i,
  /^(tchau|até mais|até logo|flw|falou|bye|até)\s*[!.,]?\s*$/i,
  /^(ok|okay|blz|beleza|certo|entendi|entendido|perfeito|show)\s*[!.,]?\s*$/i,
  /^(sim|não|nao|yes|no|s|n)\s*[!.,]?\s*$/i,
  /^[.!,?]+$/,
  /^(kk+|haha+|rsrs+|kkk+)\s*$/i,
  /^[\u{1F600}-\u{1F64F}\u{1F44D}\u{1F64F}\u{2764}\u{FE0F}\u{1F389}\u{1F4AA}\u{1F60D}\u{1F525}\u{1F49C}\u{1F49B}\u{1F499}\u{2728}\u{1F64C}\u{1F60A}\u{1F618}\u{1F4AF}\u{1F91D}\u{1F48E}\u{1F451}\u{1F680}\u{2705}\u{274C}]+\s*$/u,
  /^(tudo ótimo|tudo certo|estou bem|to bem|tô bem)\s*[!.,]?\s*$/i,
  // Novos padrões brasileiros
  /^(amém|amem|amén)\s*[!.,]?\s*$/i,
  /^(arrasou|arrasouu*|maravilhos[oa]|incrível|lind[oa]|perfeita?o?)\s*[!.,]?\s*$/i,
  /^(top|massa|bora|partiu|vamos|tmj|tamo junto|vamo)\s*[!.,]?\s*$/i,
  /^(verdade|exato|isso|isso mesmo|com certeza|claro)\s*[!.,]?\s*$/i,
  /^(boa|boaaa*|ótimo|ótima|show|showw*)\s*[!.,]?\s*$/i,
  /^(pode ser|bora|vamos lá|vamo lá|simbora)\s*[!.,]?\s*$/i,
  /^(amen|glória|gloria|deus|graças a deus)\s*[!.,]?\s*$/i,
  /^(ansiosa?|animada?|empolgada?|feliz)\s*[!.,]?\s*$/i,
  // Links isolados
  /^https?:\/\/\S+$/i,
  // Stickers / figurinhas
  /^(sticker omitted|figurinha omitida|figurinha)$/i,
  // Áudio sem transcrição
  /^🎧\s*áudio$/i,
  // Imagem/Video/Documento sem conteúdo
  /^(📷|🎥|📄)\s/i,
];

/**
 * Verifica se uma mensagem é small talk
 */
function isSmallTalk(text) {
  if (!text) return true;
  const trimmed = text.trim();
  if (trimmed.length === 0) return true;
  if (trimmed.length <= 3 && !trimmed.includes('?')) return true;

  return SMALLTALK_PATTERNS.some(pattern => pattern.test(trimmed));
}

/**
 * Verifica se uma mensagem contém uma pergunta relevante
 */
function isRelevantQuestion(text) {
  if (!text) return false;
  const trimmed = text.trim();

  // Ignorar small talk mesmo com interrogação
  if (isSmallTalk(trimmed)) return false;

  // Interrogação explícita
  if (trimmed.includes('?')) return true;

  // Padrões interrogativos em português
  const questionPatterns = [
    /^(como|qual|quais|quanto|quantos|quantas|quando|onde|quem|por ?qu[eê]|porque)\s/i,
    /^(o que|tem como|é possível|pode|poderia|consegue|dá pra|da pra|da para|tem)\s/i,
    /^(vocês?\s+tem|vocês?\s+faz|vocês?\s+trabalha|vocês?\s+atende)/i,
    /^(gostaria de saber|queria saber|preciso saber|me (explica|fala|diz))/i,
    /^(qual o|qual a|quais os|quais as)\s/i,
    /(informações?|info|orçamento|preço|valor|custo|prazo)\s*\??/i,
  ];

  return questionPatterns.some(pattern => pattern.test(trimmed));
}

// ===== AUTO-DETECÇÃO DE CATEGORIAS =====

const CATEGORY_KEYWORDS = {
  'Marketing': [
    'anúncio', 'tráfego', 'audiência', 'persona', 'marketing', 'postagem',
    'campanha', 'ads', 'público', 'engajamento', 'seguidor'
  ],
  'Comercial': [
    'proposta', 'venda', 'preço', 'contrato', 'fechamento', 'comercial',
    'vender', 'pagamento', 'pix', 'boleto', 'cartão', 'desconto', 'objeção'
  ],
  'Sucesso do Cliente': [
    'suporte', 'ajuda', 'problema', 'erro', 'não consigo', 'dúvida',
    'fidelização', 'retorno', 'acompanhamento', 'resultado'
  ],
  'Mentalidade': [
    'mindset', 'pensamento', 'trava', 'crença', 'mentalidade', 'bloqueio',
    'medo', 'insegurança', 'procrastinação', 'foco', 'motivação'
  ],
  'Arquétipos / Branding': [
    'arquétipo', 'identidade visual', 'marca', 'feed', 'estética', 'foto',
    'fotografia', 'paleta', 'cores', 'logo', 'posicionamento'
  ],
  'Produção de Conteúdo': [
    'conteúdo', 'post', 'vídeo', 'reels', 'carrossel', 'produção',
    'roteiro', 'linha editorial', 'ideia', 'copys', 'gravação'
  ],
  'Contratação': [
    'equipe', 'vaga', 'contratar', 'freelancer', 'serviço', 'colaborador',
    'recrutamento', 'delegar', 'seleção'
  ],
  'Acesso / Onboarding': [
    'login', 'plataforma', 'senha', 'onboarding', 'call', 'acesso', 'link',
    'hotmart', 'entrar', 'boas vindas'
  ]
};

// Compilar regex para cada categoria
const CATEGORY_REGEXES = {};
for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
  CATEGORY_REGEXES[category] = new RegExp(`(${keywords.join('|')})`, 'i');
}

/**
 * Detecta a categoria de uma pergunta baseado em keywords
 */
function detectCategory(text) {
  if (!text) return 'Dúvidas Gerais';

  for (const [category, regex] of Object.entries(CATEGORY_REGEXES)) {
    if (regex.test(text)) return category;
  }

  return 'Dúvidas Gerais';
}

/**
 * Agrupa mensagens consecutivas do mesmo remetente
 * Preserva textoAnalise (transcrições) na junção
 */
function groupConsecutiveMessages(messages) {
  if (messages.length === 0) return [];

  const grouped = [];
  let current = {
    ...messages[0],
    textos_agrupados: [messages[0].textoAnalise || messages[0].conteudo],
    medias_agrupadas: messages[0].mediaFilename ? [messages[0].mediaFilename] : []
  };

  for (let i = 1; i < messages.length; i++) {
    const msg = messages[i];

    if (msg.remetente === current.remetente) {
      current.textos_agrupados.push(msg.textoAnalise || msg.conteudo);
      if (msg.mediaFilename) {
        current.medias_agrupadas.push(msg.mediaFilename);
      }
    } else {
      current.textoAnalise = current.textos_agrupados.join('\n');
      current.mediaFilenames = [...current.medias_agrupadas];
      delete current.textos_agrupados;
      delete current.medias_agrupadas;
      grouped.push(current);
      current = {
        ...msg,
        textos_agrupados: [msg.textoAnalise || msg.conteudo],
        medias_agrupadas: msg.mediaFilename ? [msg.mediaFilename] : []
      };
    }
  }

  current.textoAnalise = current.textos_agrupados.join('\n');
  current.mediaFilenames = [...current.medias_agrupadas];
  delete current.textos_agrupados;
  delete current.medias_agrupadas;
  grouped.push(current);

  return grouped;
}

/**
 * Executa o Agente 3: Extração de Perguntas e Respostas
 *
 * OUTPUT:
 * [
 *   {
 *     "data_pergunta": "03/03/2026",
 *     "hora_pergunta": "10:26",
 *     "remetente": "Nome",
 *     "pergunta": "texto exato (transcrição se áudio)",
 *     "resposta": "texto exato (transcrição se áudio)",
 *     "categoria": "Categoria detectada"
 *   }
 * ]
 *
 * @param {Array} conversation - Model de Conversa Unificada do Agente 2
 * @param {Function} onProgress - Callback de progresso
 * @returns {Object} { qaList, roles, stats, categorias }
 */
export function executeAgent3(conversation, onProgress = () => {}) {
  // Filtrar apenas mensagens de participantes (excluir sistema e apagadas)
  const userMessages = conversation.filter(m =>
    m.remetente !== '__SISTEMA__' && m.tipo !== 'sistema' && m.tipo !== 'apagada'
  );

  // Preparar conteúdo: para áudios, usar transcricao; para prints, usar conteudo_extraido
  const preparedMessages = userMessages.map(m => ({
    ...m,
    textoAnalise: m.transcricao && m.transcricao !== null && !m.transcricao.startsWith('[ERRO')
      ? m.transcricao
      : m.conteudo_extraido || m.conteudo
  }));

  // Agrupar mensagens consecutivas do mesmo remetente
  const grouped = groupConsecutiveMessages(preparedMessages);

  // Identificar participantes
  const participants = [...new Set(grouped.map(m => m.remetente))];
  
  // Heurística de Atendimento: O cliente normalmente é o primeiro a mandar mensagem (inbound)
  const clientName = participants.length > 0 ? participants[0] : null;

  const qaList = [];

  for (let i = 0; i < grouped.length; i++) {
    if (i % 10 === 0) {
      onProgress(i, grouped.length);
    }

    const msg = grouped[i];
    
    // REGRA: Apenas analisar mensagens do Cliente como "Perguntas"
    if (clientName && msg.remetente !== clientName) continue;

    const textoAnalise = msg.textoAnalise || msg.conteudo;

    // Ignorar small talk
    if (isSmallTalk(textoAnalise)) continue;

    // Verificar se é uma pergunta relevante
    if (!isRelevantQuestion(textoAnalise)) continue;

    // Procurar resposta: próximo grupo de mensagem de remetente diferente
    let resposta = null;

    for (let j = i + 1; j < grouped.length; j++) {
      const nextMsg = grouped[j];

      // Mesmo remetente → pular
      if (nextMsg.remetente === msg.remetente) continue;

      const nextTexto = nextMsg.textoAnalise || nextMsg.conteudo;

      // Small talk do respondente → pular
      if (isSmallTalk(nextTexto)) continue;

      // Encontrou resposta — usar textoAnalise (com transcrição se áudio)
      resposta = nextTexto;
      break;
    }

    // Buscar mediaFilenames da resposta
    let mediaFilenamesResposta = [];
    for (let j = i + 1; j < grouped.length; j++) {
      if (grouped[j].remetente !== msg.remetente && !isSmallTalk(grouped[j].textoAnalise || grouped[j].conteudo)) {
        mediaFilenamesResposta = grouped[j].mediaFilenames || [];
        break;
      }
    }

    // Detectar categoria
    const categoria = detectCategory(textoAnalise);

    // Montar saída — texto com transcrições integradas
    qaList.push({
      data_pergunta: msg.data,
      hora_pergunta: msg.hora,
      remetente: msg.remetente,
      pergunta: textoAnalise,
      mediaFilenames_pergunta: msg.mediaFilenames || [],
      resposta: resposta || '[Sem resposta identificada]',
      mediaFilenames_resposta: mediaFilenamesResposta,
      categoria
    });
  }

  onProgress(grouped.length, grouped.length);

  // Contagem por categoria
  const categoriaCounts = {};
  for (const qa of qaList) {
    categoriaCounts[qa.categoria] = (categoriaCounts[qa.categoria] || 0) + 1;
  }

  return {
    qaList,
    roles: { participantes: participants },
    categorias: categoriaCounts,
    stats: {
      totalPerguntas: qaList.length,
      comResposta: qaList.filter(q => q.resposta !== '[Sem resposta identificada]').length,
      semResposta: qaList.filter(q => q.resposta === '[Sem resposta identificada]').length
    }
  };
}
