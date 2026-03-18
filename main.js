/**
 * Main.js — Orquestrador da Pipeline
 * 
 * Coordena o fluxo: Upload → Parser → Agente 1 → Agente 2 → Agente 3
 * Gerencia estado da aplicação e progresso de cada etapa
 */

import { parseZipFile, parseTxtFile } from './modules/parser.js';
import { executeAgent1 } from './modules/agent1-transcriber.js';
import { executeAgent2 } from './modules/agent2-reconstructor.js';
import { executeAgent3 } from './modules/agent3-analyst.js';
import {
  saveAnalysisToHistory,
  getHistoryStats,
  removeFromHistory,
  clearHistory
} from './modules/history.js';
import {
  updateAgentStatus,
  updateAgentProgress,
  renderAgent1Results,
  renderAgent2Results,
  renderAgent3Results,
  renderUploadSummary,
  renderHistoryDashboard,
  exportJSON,
  exportCSV,
  switchTab
} from './modules/ui.js';

// ===== STATE =====
let appState = {
  file: null,
  parseResult: null,
  agent1Output: null,
  agent2Output: null,
  agent3Output: null,
  isProcessing: false,
  mentoriaType: 'cleiton' // Padrão
};

// ===== CACHE (localStorage) =====
const CACHE_PREFIX = 'whatsfast_';

function getCacheKey(file) {
  return `${CACHE_PREFIX}${file.name}_${file.size}`;
}

function saveCache(file, stage, data) {
  try {
    const key = getCacheKey(file);
    const cache = JSON.parse(localStorage.getItem(key) || '{}');
    cache[stage] = data;
    cache._filename = file.name;
    cache._timestamp = Date.now();
    localStorage.setItem(key, JSON.stringify(cache));
    console.log(`Cache salvo: ${stage} (${file.name})`);
  } catch (e) {
    console.warn('Erro ao salvar cache:', e.message);
  }
}

function loadCache(file) {
  try {
    const key = getCacheKey(file);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    console.log(`Cache encontrado para: ${file.name} (salvo em ${new Date(cache._timestamp).toLocaleString()})`);
    return cache;
  } catch (e) {
    return null;
  }
}

function clearAllCache() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(CACHE_PREFIX)) keys.push(key);
  }
  keys.forEach(k => localStorage.removeItem(k));
  console.log(`Cache limpo: ${keys.length} entrada(s) removida(s)`);
}

// ===== DOM ELEMENTS =====
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const processBtn = document.getElementById('process-btn');
const resetBtn = document.getElementById('reset-btn');
const pipelineSection = document.getElementById('pipeline-section');
const resultsSection = document.getElementById('results-section');
const rerunBtn1 = document.getElementById('rerun-agent1');
const rerunBtn2 = document.getElementById('rerun-agent2');
const rerunBtn3 = document.getElementById('rerun-agent3');

// ===== UPLOAD HANDLING =====

// Drag & Drop
uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', () => {
  uploadZone.classList.remove('dragover');
});

uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFile(files[0]);
  }
});

// Click to upload
uploadZone.addEventListener('click', (e) => {
  if (e.target.tagName !== 'LABEL' && e.target.tagName !== 'INPUT') {
    fileInput.click();
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handleFile(e.target.files[0]);
  }
});



// Process button
processBtn.addEventListener('click', () => {
  if (!appState.isProcessing && appState.parseResult) {
    runPipeline();
  }
});

// Reset button
resetBtn.addEventListener('click', () => {
  resetApp();
});

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    switchTab(btn.dataset.tab);
  });
});

// Re-run buttons
rerunBtn1?.addEventListener('click', (e) => { e.stopPropagation(); rerunAgent(1); });
rerunBtn2?.addEventListener('click', (e) => { e.stopPropagation(); rerunAgent(2); });
rerunBtn3?.addEventListener('click', (e) => { e.stopPropagation(); rerunAgent(3); });

// Export buttons
document.getElementById('export-agent1-json')?.addEventListener('click', () => {
  if (appState.agent1Output) exportJSON(appState.agent1Output, 'agent1-transcricoes');
});
document.getElementById('export-agent1-csv')?.addEventListener('click', () => {
  if (appState.agent1Output) exportCSV(appState.agent1Output, 'agent1-transcricoes');
});
document.getElementById('export-agent2-json')?.addEventListener('click', () => {
  if (appState.agent2Output) exportJSON(appState.agent2Output, 'agent2-conversa-unificada');
});
document.getElementById('export-agent2-csv')?.addEventListener('click', () => {
  if (appState.agent2Output) exportCSV(appState.agent2Output, 'agent2-conversa-unificada');
});
document.getElementById('export-agent3-json')?.addEventListener('click', () => {
  if (appState.agent3Output) exportJSON(appState.agent3Output.qaList, 'agent3-perguntas-respostas');
});
document.getElementById('export-agent3-csv')?.addEventListener('click', () => {
  if (appState.agent3Output) exportCSV(appState.agent3Output.qaList, 'agent3-perguntas-respostas');
});

// Botão de Copiar Texto (Agente 3)
document.getElementById('copy-agent3-txt')?.addEventListener('click', async (e) => {
  if (!appState.agent3Output || !appState.agent3Output.qaList) return;
  
  const btn = e.target;
  const originalHtml = btn.innerHTML;
  btn.innerHTML = '⏳ Copiando...';
  
  try {
    let text = '--- PERGUNTAS E RESPOSTAS EXTRAÍDAS ---\n\n';
    appState.agent3Output.qaList.forEach((qa, idx) => {
      text += `[#${idx + 1}] ${qa.categoria.toUpperCase()}\n`;
      text += `Data: ${qa.data_pergunta} ${qa.hora_pergunta} | Cliente: ${qa.remetente}\n`;
      text += `PERGUNTA: ${qa.pergunta}\n`;
      text += `RESPOSTA: ${qa.resposta}\n`;
      text += `---------------------------------------------------\n\n`;
    });
    
    await navigator.clipboard.writeText(text);
    btn.innerHTML = '✅ Copiado!';
  } catch (err) {
    console.error('Erro ao copiar', err);
    btn.innerHTML = '❌ Erro!';
  }
  
  setTimeout(() => { btn.innerHTML = originalHtml; }, 2500);
});

// ===== FILE HANDLING =====

async function handleFile(file) {
  const validTypes = ['.zip', '.txt'];
  const extension = '.' + file.name.split('.').pop().toLowerCase();

  if (!validTypes.includes(extension)) {
    showError('Formato não suportado. Use .zip ou .txt exportado do WhatsApp.');
    return;
  }

  uploadZone.classList.add('has-file');
  uploadZone.querySelector('h2').textContent = file.name;

  // Verificar cache
  const cache = loadCache(file);
  const hasFullCache = cache && cache.agent1 && cache.agent2 && cache.agent3;

  if (hasFullCache) {
    uploadZone.querySelector('p').innerHTML = `<strong>${formatSize(file.size)}</strong> — Cache encontrado!`;
  } else {
    uploadZone.querySelector('p').innerHTML = `<strong>${formatSize(file.size)}</strong> — Pronto para processar`;
  }

  try {
    let result;
    if (extension === '.zip') {
      result = await parseZipFile(file);
    } else {
      result = await parseTxtFile(file);
    }

    appState.file = file;
    appState.parseResult = result;

    renderUploadSummary(result);
    processBtn.disabled = false;
    processBtn.classList.add('pulse-ready');

    // Se tem cache completo, restaurar resultados automaticamente
    if (hasFullCache) {
      restoreFromCache(cache);
    }

  } catch (error) {
    console.error('Erro ao parsear arquivo:', error);
    showError(`Erro ao processar arquivo: ${error.message}`);
  }
}

function restoreFromCache(cache) {
  console.log('Restaurando resultados do cache...');
  resultsSection.style.display = 'block';
  resetBtn.style.display = 'inline-flex';

  // Agente 1
  appState.agent1Output = cache.agent1;
  updateAgentStatus(1, 'done', `${cache.agent1.length} transcrição(ões) [cache]`);
  updateAgentProgress(1, cache.agent1.length, cache.agent1.length);
  renderAgent1Results(cache.agent1);
  if (rerunBtn1) rerunBtn1.style.display = 'block';

  // Agente 2
  appState.agent2Output = cache.agent2;
  updateAgentStatus(2, 'done', `${cache.agent2.length} mensagens unificadas [cache]`);
  updateAgentProgress(2, cache.agent2.length, cache.agent2.length);
  renderAgent2Results(cache.agent2, appState.parseResult ? appState.parseResult.mediaFiles : new Map());
  if (rerunBtn2) rerunBtn2.style.display = 'block';

  // Agente 3
  appState.agent3Output = cache.agent3;
  const stats = cache.agent3.stats;
  updateAgentStatus(3, 'done', `${stats.totalPerguntas} P&R extraída(s) [cache]`);
  renderAgent3Results(cache.agent3, appState.parseResult ? appState.parseResult.mediaFiles : new Map(), appState.mentoriaType);
  if (rerunBtn3) rerunBtn3.style.display = 'block';

  processBtn.innerHTML = '<span class="btn-icon-left">✅</span> Pipeline Concluída [Cache]';
  switchTab('tab-agent3');
}

// ===== PIPELINE ORCHESTRATION =====

async function runPipeline() {
  if (appState.isProcessing || !appState.parseResult) return;
  
  appState.isProcessing = true;
  processBtn.disabled = true;
  processBtn.innerHTML = '<span class="btn-icon-left">⏳</span> Processando...';
  resultsSection.style.display = 'block';
  resetBtn.style.display = 'inline-flex';

  // Capturar mentoria selecionada no momento do início
  const selectedMentoria = document.querySelector('input[name="mentoria"]:checked')?.value || 'cleiton';
  appState.mentoriaType = selectedMentoria;

  const { messages, mediaFiles } = appState.parseResult;

  // Verificar cache parcial (especialmente Agente 1 que é o mais demorado)
  const cache = loadCache(appState.file);

  try {
    // ============================
    // 🟦 AGENTE 1: Transcribitor
    // ============================
    if (cache && cache.agent1 && cache.agent1.length > 0) {
      // Usar cache do Agente 1
      appState.agent1Output = cache.agent1;
      updateAgentStatus(1, 'done', `${cache.agent1.length} transcrição(ões) [cache]`);
      updateAgentProgress(1, cache.agent1.length, cache.agent1.length);
      renderAgent1Results(cache.agent1);
      console.log('Agente 1: usando cache, pulando transcrição');
    } else {
      updateAgentStatus(1, 'running', 'Transcrevendo áudios...');

      try {
        appState.agent1Output = await executeAgent1(
          messages,
          mediaFiles,
          (current, total, filename) => {
            updateAgentProgress(1, current, total);
            updateAgentStatus(1, 'running', `Transcrevendo: ${filename || '...'}`);
          }
        );

        updateAgentStatus(1, 'done', `${appState.agent1Output.length} transcrição(ões)`);
        renderAgent1Results(appState.agent1Output);
        saveCache(appState.file, 'agent1', appState.agent1Output);
      } catch (error) {
        console.error('Erro no Agente 1:', error);
        updateAgentStatus(1, 'error', `Erro: ${error.message}`);
        appState.agent1Output = [];
      }
    }

    // ============================
    // 🟨 AGENTE 2: Reconstrutor
    // ============================
    updateAgentStatus(2, 'running', 'Reconstruindo conversa...');
    
    try {
      appState.agent2Output = executeAgent2(
        messages,
        appState.agent1Output || [],
        mediaFiles,
        (current, total) => {
          updateAgentProgress(2, current, total);
        }
      );
      
      updateAgentStatus(2, 'done', `${appState.agent2Output.length} mensagens unificadas`);
      renderAgent2Results(appState.agent2Output, mediaFiles);
      saveCache(appState.file, 'agent2', appState.agent2Output);
    } catch (error) {
      console.error('Erro no Agente 2:', error);
      updateAgentStatus(2, 'error', `Erro: ${error.message}`);
      appState.agent2Output = [];
    }

    // ============================
    // 🟩 AGENTE 3: Analista
    // ============================
    updateAgentStatus(3, 'running', 'Extraindo perguntas e respostas...');
    
    try {
      appState.agent3Output = executeAgent3(
        appState.agent2Output || [],
        (current, total) => {
          updateAgentProgress(3, current, total);
        }
      );
      
      const stats = appState.agent3Output.stats;
      updateAgentStatus(3, 'done', `${stats.totalPerguntas} P&R extraída(s)`);
      renderAgent3Results(appState.agent3Output, mediaFiles, appState.mentoriaType);
      saveCache(appState.file, 'agent3', appState.agent3Output);
    } catch (error) {
      console.error('Erro no Agente 3:', error);
      updateAgentStatus(3, 'error', `Erro: ${error.message}`);
    }

    // Pipeline concluída
    processBtn.innerHTML = '<span class="btn-icon-left">✅</span> Pipeline Concluída';
    
    // Salvar no histórico
    const nichoInput = document.getElementById('nicho-input');
    const nicho = nichoInput ? nichoInput.value.trim() : '';
    if (appState.agent3Output) {
      await saveAnalysisToHistory({
        mentoria: appState.mentoriaType,
        filename: appState.file.name,
        nicho,
        agent3Output: appState.agent3Output
      });
      await refreshHistoryDashboard();
    }
    
    // Mostrar botões de refazer
    if (rerunBtn1 && appState.agent1Output) rerunBtn1.style.display = 'block';
    if (rerunBtn2 && appState.agent2Output) rerunBtn2.style.display = 'block';
    if (rerunBtn3 && appState.agent3Output) rerunBtn3.style.display = 'block';

    // Auto-selecionar aba do Agente 3 (resultado final)
    switchTab('tab-agent3');

  } catch (error) {
    console.error('Erro na pipeline:', error);
    showError(`Erro na pipeline: ${error.message}`);
  }

  appState.isProcessing = false;
}

// ===== RE-RUN AGENTS =====

async function rerunAgent(agentNumber) {
  if (appState.isProcessing || !appState.parseResult) return;
  
  if (agentNumber > 1 && (!appState.agent1Output || appState.agent1Output.length === 0)) {
    showError("Agente 1 incompleto.");
    return;
  }
  if (agentNumber > 2 && (!appState.agent2Output || appState.agent2Output.length === 0)) {
    showError("Agente 2 incompleto.");
    return;
  }

  appState.isProcessing = true;
  processBtn.disabled = true;
  processBtn.innerHTML = '<span class="btn-icon-left">⏳</span> Processando...';
  
  const { messages, mediaFiles } = appState.parseResult;
  let cache = loadCache(appState.file) || {};
  const cacheKey = getCacheKey(appState.file);

  try {
    // Agent 1
    if (agentNumber === 1) {
      if (rerunBtn1) rerunBtn1.style.display = 'none';
      updateAgentStatus(1, 'running', 'Transcrevendo áudios...');
      switchTab('tab-agent1');
      appState.agent1Output = await executeAgent1(messages, mediaFiles, (current, total, filename) => {
        updateAgentProgress(1, current, total);
        updateAgentStatus(1, 'running', `Transcrevendo: ${filename || '...'}`);
      });
      updateAgentStatus(1, 'done', `${appState.agent1Output.length} transcrição(ões)`);
      renderAgent1Results(appState.agent1Output);
      saveCache(appState.file, 'agent1', appState.agent1Output);
      if (rerunBtn1) rerunBtn1.style.display = 'block';
    }

    // Agent 2
    if (agentNumber <= 2) {
      if (rerunBtn2) rerunBtn2.style.display = 'none';
      if (agentNumber === 2) switchTab('tab-agent2');
      updateAgentStatus(2, 'running', 'Reconstruindo conversa...');
      appState.agent2Output = executeAgent2(messages, appState.agent1Output || [], mediaFiles, (current, total) => updateAgentProgress(2, current, total));
      updateAgentStatus(2, 'done', `${appState.agent2Output.length} mensagens unificadas`);
      renderAgent2Results(appState.agent2Output, mediaFiles);
      saveCache(appState.file, 'agent2', appState.agent2Output);
      if (rerunBtn2) rerunBtn2.style.display = 'block';
    }

    // Agent 3
    if (agentNumber <= 3) {
      if (rerunBtn3) rerunBtn3.style.display = 'none';
      switchTab('tab-agent3');
      updateAgentStatus(3, 'running', 'Extraindo perguntas e respostas...');
      appState.agent3Output = executeAgent3(appState.agent2Output || [], (current, total) => updateAgentProgress(3, current, total));
      const stats = appState.agent3Output.stats;
      updateAgentStatus(3, 'done', `${stats.totalPerguntas} P&R extraída(s)`);
      renderAgent3Results(appState.agent3Output, mediaFiles, appState.mentoriaType);
      saveCache(appState.file, 'agent3', appState.agent3Output);
      if (rerunBtn3) rerunBtn3.style.display = 'block';
    }

    processBtn.innerHTML = '<span class="btn-icon-left">✅</span> Refeito com Sucesso';
    setTimeout(() => { processBtn.innerHTML = '<span class="btn-icon-left">✅</span> Pipeline Concluída'; }, 3000);
  } catch (error) {
    console.error('Erro ao refazer agente:', error);
    showError(`Erro: ${error.message}`);
  }

  appState.isProcessing = false;
}

// ===== RESET =====

function resetApp() {
  appState = {
    file: null,
    parseResult: null,
    agent1Output: null,
    agent2Output: null,
    agent3Output: null,
    isProcessing: false
  };

  // Reset upload
  uploadZone.classList.remove('has-file');
  uploadZone.querySelector('h2').textContent = 'Arraste seu arquivo aqui';
  uploadZone.querySelector('p').innerHTML = 'Arquivo <strong>.zip</strong> exportado do WhatsApp (com mídia) ou <strong>.txt</strong>';
  fileInput.value = '';

  // Reset summary
  const summary = document.getElementById('upload-summary');
  summary.classList.remove('visible');
  summary.innerHTML = '';

  // Reset agents
  for (let i = 1; i <= 3; i++) {
    updateAgentStatus(i, 'idle');
    updateAgentProgress(i, 0, 0);
  }

  // Reset buttons
  processBtn.disabled = true;
  processBtn.innerHTML = '<span class="btn-icon-left">▶</span> Iniciar Pipeline';
  resetBtn.style.display = 'none';
  if (rerunBtn1) rerunBtn1.style.display = 'none';
  if (rerunBtn2) rerunBtn2.style.display = 'none';
  if (rerunBtn3) rerunBtn3.style.display = 'none';

  // Hide results
  resultsSection.style.display = 'none';

  // Reset tab contents
  document.querySelectorAll('.results-content').forEach(el => {
    el.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">⏳</span>
        <p>Aguardando processamento...</p>
      </div>
    `;
  });

  // Reset to first tab
  switchTab('tab-agent1');
}

// ===== HELPERS =====

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function showError(message) {
  // Simple alert for now, could be enhanced with a toast system
  const errDiv = document.createElement('div');
  errDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    max-width: 400px;
    padding: 16px 20px;
    background: linear-gradient(135deg, #FF6B6B, #ee5a24);
    color: white;
    border-radius: 12px;
    font-family: 'Inter', sans-serif;
    font-size: 0.9rem;
    box-shadow: 0 8px 32px rgba(255, 107, 107, 0.3);
    z-index: 9999;
    animation: slideDown 0.3s ease;
  `;
  errDiv.textContent = message;
  document.body.appendChild(errDiv);
  
  setTimeout(() => {
    errDiv.style.opacity = '0';
    errDiv.style.transition = 'opacity 0.3s ease';
    setTimeout(() => errDiv.remove(), 300);
  }, 5000);
}

// ===== HISTORY DASHBOARD =====

async function refreshHistoryDashboard() {
  const selectedMentoria = document.querySelector('input[name="mentoria"]:checked')?.value || 'cleiton';
  const stats = await getHistoryStats(selectedMentoria);
  renderHistoryDashboard(stats, selectedMentoria);
}

// Clear history button
document.getElementById('clear-history-btn')?.addEventListener('click', async () => {
  if (confirm('Tem certeza que deseja limpar todo o histórico de análises no Supabase?')) {
    await clearHistory();
    await refreshHistoryDashboard();
  }
});

// Delete individual record from history dashboard
document.getElementById('history-dashboard')?.addEventListener('delete-record', async (e) => {
  const id = e.detail?.id;
  if (id) {
    await removeFromHistory(id);
    await refreshHistoryDashboard();
  }
});

// Refresh history when switching mentoria
document.querySelectorAll('input[name="mentoria"]').forEach(input => {
  input.addEventListener('change', () => {
    refreshHistoryDashboard();
  });
});

// ===== INIT =====
// Renderizar dashboard histórico na inicialização (Supabase)
refreshHistoryDashboard().catch(console.error);
