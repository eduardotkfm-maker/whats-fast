/**
 * History Module — Persistência de Histórico de Análises (Supabase)
 * 
 * Agora utiliza o Supabase para salvar e recuperar os dados,
 * permitindo persistência entre diferentes dispositivos.
 */

import { supabase } from './supabase.js';

/**
 * Retorna todos os registros do histórico do Supabase
 * @returns {Promise<Array>} Lista de registros
 */
export async function getHistory() {
  try {
    const { data, error } = await supabase
      .from('analises')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (e) {
    console.warn('Erro ao ler histórico do Supabase:', e.message);
    return [];
  }
}

/**
 * Extrai o nome do mentorado a partir do nome do arquivo
 * @param {string} filename
 * @returns {string}
 */
export function extractMentoradoName(filename) {
  if (!filename) return 'Desconhecido';
  let name = filename.replace(/\.(zip|txt)$/i, '');
  name = name.replace(/^(WhatsApp Chat\s*-\s*|Chat do WhatsApp com\s*)/i, '');
  name = name.replace(/\d+$/, '').trim();
  return name || 'Desconhecido';
}

/**
 * Salva uma análise concluída no Supabase
 * @param {Object} params
 */
export async function saveAnalysisToHistory({ mentoria, filename, nicho, agent3Output }) {
  if (!agent3Output || !agent3Output.qaList) return;
  
  const mentorado = extractMentoradoName(filename);
  const { qaList, categorias, stats } = agent3Output;
  
  // Agrupar dúvidas por data para o resumo
  const duvidaPorData = {};
  for (const qa of qaList) {
    const data = qa.data_pergunta || 'sem data';
    duvidaPorData[data] = (duvidaPorData[data] || 0) + 1;
  }
  
  const record = {
    mentoria: mentoria || 'cleiton',
    mentorado,
    nicho: (nicho || '').trim() || 'Não informado',
    filename,
    data_analise: new Date().toISOString().split('T')[0],
    total_duvidas: stats.totalPerguntas,
    com_resposta: stats.comResposta,
    sem_resposta: stats.semResposta,
    categorias: { ...categorias },
    duvida_por_data: duvidaPorData
  };

  try {
    // 1. Inserir na tabela 'analises'
    const { data: analysisData, error: analysisError } = await supabase
      .from('analises')
      .insert([record])
      .select()
      .single();

    if (analysisError) throw analysisError;

    // 2. Inserir todas as P&R na tabela 'perguntas_respostas'
    const qaRecords = qaList.map(qa => ({
      analise_id: analysisData.id,
      categoria: qa.categoria,
      data_pergunta: qa.data_pergunta,
      hora_pergunta: qa.hora_pergunta,
      remetente: qa.remetente,
      pergunta: qa.pergunta,
      resposta: qa.resposta
    }));

    const { error: qaError } = await supabase
      .from('perguntas_respostas')
      .insert(qaRecords);

    if (qaError) console.warn('Erro ao salvar P&R individuais:', qaError.message);

    console.log(`Análise salva no Supabase: ${mentorado} (${mentoria})`);
    return analysisData;

  } catch (e) {
    console.error('Erro ao salvar no Supabase:', e.message);
    throw e;
  }
}

/**
 * Retorna estatísticas agregadas do histórico (Supabase)
 * @param {string} [mentoria] - Filtrar por mentoria
 */
export async function getHistoryStats(mentoria) {
  let history = await getHistory();
  
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
  
  const mentoradosUnicos = new Set(history.map(h => h.mentorado));
  const totalDuvidas = history.reduce((sum, h) => sum + (h.total_duvidas || 0), 0);
  
  const duvidaPorMes = {};
  for (const record of history) {
    for (const [data, count] of Object.entries(record.duvida_por_data || {})) {
      const parts = data.split('/');
      if (parts.length >= 3) {
        const mesAno = `${parts[1]}/${parts[2]}`;
        duvidaPorMes[mesAno] = (duvidaPorMes[mesAno] || 0) + count;
      }
    }
  }
  
  const duvidaPorNicho = {};
  for (const record of history) {
    const nicho = record.nicho || 'Não informado';
    duvidaPorNicho[nicho] = (duvidaPorNicho[nicho] || 0) + (record.total_duvidas || 0);
  }
  
  const categoriasTotais = {};
  for (const record of history) {
    for (const [cat, count] of Object.entries(record.categorias || {})) {
      categoriasTotais[cat] = (categoriasTotais[cat] || 0) + count;
    }
  }
  
  // Mapear campos do banco para o formato esperado pela UI (se necessário)
  const registrosFormatados = history.map(h => ({
    ...h,
    totalDuvidas: h.total_duvidas,
    comResposta: h.com_resposta,
    semResposta: h.sem_resposta,
    dataAnalise: h.data_analise
  }));
  
  return {
    totalMentorados: mentoradosUnicos.size,
    totalDuvidas,
    duvidaPorMes,
    duvidaPorNicho,
    categoriasTotais,
    registros: registrosFormatados
  };
}

/**
 * Remove um registro do histórico pelo ID
 */
export async function removeFromHistory(id) {
  try {
    const { error } = await supabase
      .from('analises')
      .delete()
      .eq('id', id);
    if (error) throw error;
  } catch (e) {
    console.error('Erro ao deletar do Supabase:', e.message);
  }
}

/**
 * Limpa todo o histórico
 */
export async function clearHistory() {
  try {
    // Nota: sem WHERE deleta tudo se as políticas permitirem
    const { error } = await supabase
      .from('analises')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // hack para delete all no supabase via client
    if (error) throw error;
  } catch (e) {
    console.error('Erro ao limpar Supabase:', e.message);
  }
}
