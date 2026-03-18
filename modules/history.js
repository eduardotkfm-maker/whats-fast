/**
 * History Module — Persistência de Histórico de Análises
 * 
 * Salva e recupera dados acumulados de análises por mentoria,
 * permitindo visualizar indicadores históricos como:
 * - Quantidade de mentorados analisados
 * - Total de dúvidas por mês
 * - Dúvidas separadas por nicho
 */

const HISTORY_KEY = 'whatsfast_history';

/**
 * Retorna todos os registros do histórico
 * @returns {Array} Lista de registros
 */
export function getHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Erro ao ler histórico:', e);
    return [];
  }
}

/**
 * Salva o histórico completo
 * @param {Array} history
 */
function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.warn('Erro ao salvar histórico:', e);
  }
}

/**
 * Extrai o nome do mentorado a partir do nome do arquivo
 * "WhatsApp Chat - Isabella Rocha Leite2.zip" → "Isabella Rocha Leite"
 * @param {string} filename
 * @returns {string}
 */
export function extractMentoradoName(filename) {
  if (!filename) return 'Desconhecido';
  
  // Remover extensão
  let name = filename.replace(/\.(zip|txt)$/i, '');
  
  // Remover prefixo "WhatsApp Chat - " ou "Chat do WhatsApp com "
  name = name.replace(/^(WhatsApp Chat\s*-\s*|Chat do WhatsApp com\s*)/i, '');
  
  // Remover números finais (ex: "2" em "Isabella Rocha Leite2")
  name = name.replace(/\d+$/, '').trim();
  
  return name || 'Desconhecido';
}

/**
 * Salva uma análise concluída no histórico
 * @param {Object} params
 * @param {string} params.mentoria - 'cleiton' ou 'julia'
 * @param {string} params.filename - Nome do arquivo .zip
 * @param {string} params.nicho - Nicho do mentorado (ex: 'Dentista')
 * @param {Object} params.agent3Output - Saída do Agent 3
 */
export function saveAnalysisToHistory({ mentoria, filename, nicho, agent3Output }) {
  if (!agent3Output || !agent3Output.qaList) return;
  
  const mentorado = extractMentoradoName(filename);
  const { qaList, categorias, stats } = agent3Output;
  
  // Agrupar dúvidas por data
  const duvidaPorData = {};
  for (const qa of qaList) {
    const data = qa.data_pergunta || 'sem data';
    duvidaPorData[data] = (duvidaPorData[data] || 0) + 1;
  }
  
  const record = {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    mentoria: mentoria || 'cleiton',
    mentorado,
    nicho: (nicho || '').trim() || 'Não informado',
    filename,
    dataAnalise: new Date().toISOString().split('T')[0],
    totalDuvidas: stats.totalPerguntas,
    comResposta: stats.comResposta,
    semResposta: stats.semResposta,
    categorias: { ...categorias },
    duvidaPorData
  };
  
  const history = getHistory();
  
  // Evitar duplicatas: se já existe registro com mesmo mentorado + mentoria + mesmo arquivo, substituir
  const existingIdx = history.findIndex(h => 
    h.mentorado === record.mentorado && 
    h.mentoria === record.mentoria &&
    h.filename === record.filename
  );
  
  if (existingIdx >= 0) {
    history[existingIdx] = record;
  } else {
    history.push(record);
  }
  
  saveHistory(history);
  console.log(`Histórico salvo: ${mentorado} (${mentoria}) — ${stats.totalPerguntas} dúvidas`);
  
  return record;
}

/**
 * Retorna estatísticas agregadas do histórico
 * @param {string} [mentoria] - Filtrar por mentoria (opcional)
 * @returns {Object} Estatísticas agregadas
 */
export function getHistoryStats(mentoria) {
  let history = getHistory();
  
  if (mentoria) {
    history = history.filter(h => h.mentoria === mentoria);
  }
  
  if (history.length === 0) {
    return {
      totalMentorados: 0,
      totalDuvidas: 0,
      duvidaPorMes: {},
      duvidaPorNicho: {},
      categoriasTotais: {},
      registros: []
    };
  }
  
  // Total de mentorados únicos
  const mentoradosUnicos = new Set(history.map(h => h.mentorado));
  
  // Total de dúvidas
  const totalDuvidas = history.reduce((sum, h) => sum + h.totalDuvidas, 0);
  
  // Dúvidas por mês (agrupando todas as datas)
  const duvidaPorMes = {};
  for (const record of history) {
    for (const [data, count] of Object.entries(record.duvidaPorData || {})) {
      // Extrair mês/ano da data (formato dd/mm/yyyy)
      const parts = data.split('/');
      if (parts.length >= 3) {
        const mesAno = `${parts[1]}/${parts[2]}`;
        duvidaPorMes[mesAno] = (duvidaPorMes[mesAno] || 0) + count;
      }
    }
  }
  
  // Dúvidas por nicho
  const duvidaPorNicho = {};
  for (const record of history) {
    const nicho = record.nicho || 'Não informado';
    duvidaPorNicho[nicho] = (duvidaPorNicho[nicho] || 0) + record.totalDuvidas;
  }
  
  // Categorias totais acumuladas
  const categoriasTotais = {};
  for (const record of history) {
    for (const [cat, count] of Object.entries(record.categorias || {})) {
      categoriasTotais[cat] = (categoriasTotais[cat] || 0) + count;
    }
  }
  
  return {
    totalMentorados: mentoradosUnicos.size,
    totalDuvidas,
    duvidaPorMes,
    duvidaPorNicho,
    categoriasTotais,
    registros: history
  };
}

/**
 * Remove um registro do histórico pelo ID
 * @param {string} id
 */
export function removeFromHistory(id) {
  const history = getHistory().filter(h => h.id !== id);
  saveHistory(history);
}

/**
 * Limpa todo o histórico
 */
export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
  console.log('Histórico limpo.');
}
