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
  getHistoryStats,
  getDetailedAnalytics,
  getAnalysisDetails,
  removeFromHistory,
  clearHistory,
  saveAnalysisToHistory
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
  exportWord,
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

// (Caching removido conforme solicitação: uso exclusivo de Supabase)

// ===== DOM ELEMENTS =====
const uploadZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const processBtn = document.getElementById('process-btn');
const resetBtn = document.getElementById('reset-btn');
const pipelineSection = document.getElementById('pipeline-section');
const resultsSection = document.getElementById('results-section');
const rerunBtn1 = document.getElementById('rerun-agent1');
const rerunBtn2 = document.getElementById('rerun-agent2');
const rerunBtn3 = document.getElementById('rerun-agent3');
const historyReloadSection = document.getElementById('history-reload-section');
const historySearchInput = document.getElementById('history-search-input');
const historyDropdownOptions = document.getElementById('history-dropdown-options');
const loadHistoryBtn = document.getElementById('load-history-btn');

// ===== UPLOAD HANDLING =====

// Drag & Drop
uploadZone?.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('dragover');
});

uploadZone?.addEventListener('dragleave', () => {
  uploadZone.classList.remove('dragover');
});

uploadZone?.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFile(files[0]);
  }
});

// Click to upload
uploadZone?.addEventListener('click', (e) => {
  if (e.target.tagName !== 'LABEL' && e.target.tagName !== 'INPUT') {
    fileInput.click();
  }
});

fileInput?.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handleFile(e.target.files[0]);
  }
});

// Process button
processBtn?.addEventListener('click', () => {
  if (!appState.isProcessing && appState.parseResult) {
    runPipeline();
  }
});

// Reset button
resetBtn?.addEventListener('click', () => {
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
document.getElementById('export-agent3-docx')?.addEventListener('click', () => {
  if (appState.agent3Output) {
    let filename = 'Relatorio_Mentoria';
    if (appState.file && appState.file.name) {
      // Remove a extensão do arquivo e "Conversa do WhatsApp com "
      filename = appState.file.name.replace(/\.[^/.]+$/, "").replace(/^Conversa do WhatsApp com /i, "");
    }
    exportWord(appState.agent3Output.qaList, filename);
  }
});

// Botão de Copiar Texto (Agente 3)
document.getElementById('copy-agent3-txt')?.addEventListener('click', async (e) => {
  if (!appState.agent3Output || !appState.agent3Output.qaList) return;
  
  const btn = e.target;
  const originalHtml = btn.innerHTML;
  btn.innerHTML = '⏳ Copiando...';
  
  try {
    const nichoSelect = document.getElementById('search-nicho');
    const nichoName = nichoSelect && nichoSelect.value ? nichoSelect.options[nichoSelect.selectedIndex].text : 'Não especificado';

    const relatorio = [];
    let currentThread = null;

    for (const qa of appState.agent3Output.qaList) {
      if (currentThread && 
          currentThread.remetente === qa.remetente && 
          currentThread.categoria === qa.categoria && 
          currentThread.data === qa.data_pergunta) {
        currentThread.items.push(qa);
      } else {
        if (currentThread) relatorio.push(currentThread);
        currentThread = {
          remetente: qa.remetente,
          categoria: qa.categoria,
          data: qa.data_pergunta,
          items: [qa]
        };
      }
    }
    if (currentThread) relatorio.push(currentThread);

    const nomeCliente = relatorio.length > 0 ? relatorio[0].remetente : 'Cliente';

    let text = `NOME: ${nomeCliente}\n`;
    text += `NICHO: ${nichoName}\n\n\n`;

    relatorio.forEach(thread => {
      thread.items.forEach((item) => {
        text += `TIPO DE DÚVIDA: ${thread.categoria.toUpperCase()}\n`;
        text += `DATA: ${item.data_pergunta || 'Sem data'}\n`;
        text += `PERGUNTA: ${item.pergunta}\n`;
        text += `RESPOSTA: ${item.resposta}\n\n`;
      });
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

  if (uploadZone) {
    uploadZone.classList.add('has-file');
    uploadZone.querySelector('h2').textContent = file.name;
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
    if (processBtn) {
      processBtn.disabled = false;
      processBtn.classList.add('pulse-ready');
    }

  } catch (error) {
    console.error('Erro ao parsear arquivo:', error);
    showError(`Erro ao processar arquivo: ${error.message}`);
  }
}

// ===== PIPELINE ORCHESTRATION =====

async function runPipeline() {
  if (appState.isProcessing || !appState.parseResult) return;
  
  appState.isProcessing = true;
  if (processBtn) {
    processBtn.disabled = true;
    processBtn.innerHTML = '<span class="btn-icon-left">⏳</span> Processando...';
  }
  if (resultsSection) resultsSection.style.display = 'block';
  if (resetBtn) resetBtn.style.display = 'inline-flex';

  // Capturar mentoria selecionada no momento do início
  const selectedMentoria = document.querySelector('input[name="mentoria"]:checked')?.value || 'cleiton';
  appState.mentoriaType = selectedMentoria;

  const { messages, mediaFiles } = appState.parseResult;

  try {
    // ============================
    // 🟦 AGENTE 1: Transcribitor
    // ============================
    updateAgentStatus(1, 'running', 'Transcrevendo áudios...');

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

    // ============================
    // 🟨 AGENTE 2: Reconstrutor
    // ============================
    updateAgentStatus(2, 'running', 'Reconstruindo conversa...');
    
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

    // ============================
    // 🟩 AGENTE 3: Analista
    // ============================
    updateAgentStatus(3, 'running', 'Extraindo perguntas e respostas...');
    
    appState.agent3Output = await executeAgent3(
      appState.agent2Output || [],
      (current, total) => {
        updateAgentProgress(3, current, total);
      }
    );
    
    const stats = appState.agent3Output.stats;
    updateAgentStatus(3, 'done', `${stats.totalPerguntas} P&R extraída(s)`);
    renderAgent3Results(appState.agent3Output, mediaFiles, appState.mentoriaType);

    // Pipeline concluída
    if (processBtn) processBtn.innerHTML = '<span class="btn-icon-left">✅</span> Pipeline Concluída';
    
    // Salvar no histórico de forma automática (Supabase)
    const nichoInput = document.getElementById('nicho-input');
    const specialistInput = document.getElementById('specialist-input');
    const nicho = nichoInput ? nichoInput.value.trim() : '';
    const especialista = specialistInput ? specialistInput.value.trim() : '';

    if (appState.agent3Output) {
      await saveAnalysisToHistory({
        mentoria: appState.mentoriaType,
        filename: appState.file.name,
        nicho,
        especialista,
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
  if (processBtn) {
    processBtn.disabled = true;
    processBtn.innerHTML = '<span class="btn-icon-left">⏳</span> Processando...';
  }
  
  const { messages, mediaFiles } = appState.parseResult;

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
      if (rerunBtn2) rerunBtn2.style.display = 'block';
    }

    // Agent 3
    if (agentNumber <= 3) {
      if (rerunBtn3) rerunBtn3.style.display = 'none';
      switchTab('tab-agent3');
      updateAgentStatus(3, 'running', 'Extraindo perguntas e respostas...');
      appState.agent3Output = await executeAgent3(appState.agent2Output || [], (current, total) => updateAgentProgress(3, current, total));
      const stats = appState.agent3Output.stats;
      updateAgentStatus(3, 'done', `${stats.totalPerguntas} P&R extraída(s)`);
      renderAgent3Results(appState.agent3Output, mediaFiles, appState.mentoriaType);
      if (rerunBtn3) rerunBtn3.style.display = 'block';
    }

    if (processBtn) {
      processBtn.innerHTML = '<span class="btn-icon-left">✅</span> Refeito com Sucesso';
      setTimeout(() => { processBtn.innerHTML = '<span class="btn-icon-left">✅</span> Pipeline Concluída'; }, 3000);
    }
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
    isProcessing: false,
    mentoriaType: document.querySelector('input[name="mentoria"]:checked')?.value || 'cleiton'
  };

  // Reset upload
  if (uploadZone) {
    uploadZone.classList.remove('has-file');
    uploadZone.querySelector('h2').textContent = 'Arraste seu arquivo aqui';
    uploadZone.querySelector('p').innerHTML = 'Arquivo <strong>.zip</strong> exportado do WhatsApp (com mídia) ou <strong>.txt</strong>';
  }
  if (fileInput) fileInput.value = '';

  // Reset summary
  const summary = document.getElementById('upload-summary');
  if (summary) {
    summary.classList.remove('visible');
    summary.innerHTML = '';
  }

  // Reset agents
  for (let i = 1; i <= 3; i++) {
    updateAgentStatus(i, 'idle');
    updateAgentProgress(i, 0, 0);
  }

  // Reset buttons
  if (processBtn) {
    processBtn.disabled = true;
    processBtn.innerHTML = '<span class="btn-icon-left">▶</span> Iniciar Pipeline';
  }
  if (resetBtn) resetBtn.style.display = 'none';
  if (rerunBtn1) rerunBtn1.style.display = 'none';
  if (rerunBtn2) rerunBtn2.style.display = 'none';
  if (rerunBtn3) rerunBtn3.style.display = 'none';

  // Hide results
  if (resultsSection) resultsSection.style.display = 'none';

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
  const detailedStats = await getDetailedAnalytics(selectedMentoria);
  renderHistoryDashboard(stats, detailedStats, selectedMentoria);
  
  // Atualizar Dropdown de Histórico
  updateHistoryDropdown(stats.registros);
}

function updateHistoryDropdown(registros) {
  if (!historyReloadSection || !historyDropdownOptions) return;
  
  appState.historyRecords = registros || [];
  
  if (registros.length === 0) {
    historyReloadSection.style.display = 'none';
    return;
  }
  
  historyReloadSection.style.display = 'block';
  renderHistoryOptions(appState.historyRecords);
}

function renderHistoryOptions(options) {
  if (!historyDropdownOptions) return;
  
  if (options.length === 0) {
    historyDropdownOptions.innerHTML = '<div class="no-options">Nenhum histórico encontrado</div>';
    return;
  }
  
  let html = '';
  options.forEach(record => {
    const isSelected = appState.selectedHistoryId === record.id;
    html += `
      <div class="dropdown-option ${isSelected ? 'selected' : ''}" data-id="${record.id}">
        <strong>${record.mentorado}</strong>
        <span class="option-date">${record.nicho} — ${record.dataAnalise} (${record.totalDuvidas} dúvidas)</span>
      </div>
    `;
  });
  
  historyDropdownOptions.innerHTML = html;

  
  // Re-attach listeners
  historyDropdownOptions.querySelectorAll('.dropdown-option').forEach(opt => {
    opt.addEventListener('click', () => {
      appState.selectedHistoryId = opt.dataset.id;
      if (historySearchInput) {
        historySearchInput.value = opt.querySelector('strong').textContent;
      }
      historyDropdownOptions.classList.remove('visible');
      if (loadHistoryBtn) loadHistoryBtn.disabled = false;
      renderHistoryOptions(appState.historyRecords); // re-render to highlight selected
    });
  });
}

// Event Listeners for Dropdown
historySearchInput?.addEventListener('focus', () => {
  historyDropdownOptions?.classList.add('visible');
});

document.addEventListener('click', (e) => {
  if (!historySearchInput?.contains(e.target) && !historyDropdownOptions?.contains(e.target)) {
    historyDropdownOptions?.classList.remove('visible');
  }
});

historySearchInput?.addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  if (!appState.historyRecords) return;
  
  historyDropdownOptions?.classList.add('visible');
  const filtered = appState.historyRecords.filter(r => 
    r.mentorado.toLowerCase().includes(term) || r.nicho.toLowerCase().includes(term)
  );
  renderHistoryOptions(filtered);
});

// Load History Button
loadHistoryBtn?.addEventListener('click', async () => {
  if (!appState.selectedHistoryId) return;
  
  try {
    loadHistoryBtn.disabled = true;
    loadHistoryBtn.innerHTML = '⏳ Carregando...';
    
    const { analise, qaList } = await getAnalysisDetails(appState.selectedHistoryId);
    
    appState.agent3Output = {
      qaList,
      stats: {
        totalPerguntas: analise.total_duvidas,
        comResposta: analise.com_resposta,
        semResposta: analise.sem_resposta
      },
      categorias: analise.categorias || {}
    };
    
    const nichoInput = document.getElementById('nicho-input');
    if (nichoInput) nichoInput.value = analise.nicho;
    
    // Results section is hidden on load, display it
    const resultsSection = document.getElementById('results-section');
    if (resultsSection) resultsSection.style.display = 'block';
    
    renderAgent3Results(appState.agent3Output, new Map(), analise.mentoria);
    
    // Ajustar UI dos agentes para refletir que apenas o 3 está carregado do banco
    document.getElementById('agent1-card')?.classList.replace('agent-idle', 'agent-done');
    if (document.getElementById('agent1-status')) document.getElementById('agent1-status').textContent = 'Recuperado do DB';
    document.getElementById('agent2-card')?.classList.replace('agent-idle', 'agent-done');
    if (document.getElementById('agent2-status')) document.getElementById('agent2-status').textContent = 'Recuperado do DB';
    document.getElementById('agent3-card')?.classList.replace('agent-idle', 'agent-done');
    if (document.getElementById('agent3-status')) document.getElementById('agent3-status').textContent = 'Carregado do Histórico';
    
    switchTab('tab-agent3');
    
    // Scroll down to results
    resultsSection?.scrollIntoView({ behavior: 'smooth' });
    
  } catch (error) {
    showError('Erro ao carregar do histórico: ' + error.message);
  } finally {
    loadHistoryBtn.disabled = false;
    loadHistoryBtn.innerHTML = 'Carregar Histórico Selecionado';
  }
});

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

// --- Filtros Interativos do Dashboard ---
document.getElementById('history-dashboard')?.addEventListener('change', (e) => {
  const target = e.target;
  if (target.id === 'filter-month' || target.id === 'filter-nicho' || target.id === 'filter-specialist') {
    applyHistoryFilters();
  }
});

/**
 * Aplica filtros de Mês e Nicho na visualização atual do Dashboard
 */
function applyHistoryFilters() {
  const month = document.getElementById('filter-month')?.value || 'all';
  const niche = document.getElementById('filter-nicho')?.value || 'all';
  const specialist = document.getElementById('filter-specialist')?.value || 'all';
  
  const insightCards = document.querySelectorAll('.insight-nicho-card');
  const recordRows = document.querySelectorAll('.history-record');
  
  let visibleDuvidas = 0;
  let visibleMentorados = new Set();

  // Filtrar Cards de Insight (Nichos)
  insightCards.forEach(card => {
    const cardNicho = card.querySelector('h4')?.textContent || '';
    const isNicheMatch = (niche === 'all' || cardNicho === niche);
    
    // Dentro do card, filtrar meses
    const monthRows = card.querySelectorAll('.insight-month-row');
    let hasVisibleMonth = false;
    
    monthRows.forEach(row => {
      const rowMonth = row.querySelector('.month-label')?.textContent || '';
      const isMonthMatch = (month === 'all' || rowMonth === month);
      
      if (isNicheMatch && isMonthMatch) {
         row.style.display = 'flex';
         hasVisibleMonth = true;
         // Extrair count
         const countStr = row.querySelector('.month-count')?.textContent || '0';
         visibleDuvidas += parseInt(countStr) || 0;
      } else {
         row.style.display = 'none';
      }
    });

    card.style.display = hasVisibleMonth ? 'block' : 'none';
  });

  // Filtrar Linhas de Registro Individual
  recordRows.forEach(row => {
    const rowNicho = row.querySelector('.history-record-nicho')?.textContent || '';
    const rowDate = row.querySelector('.history-record-date')?.textContent || ''; // YYYY-MM-DD
    
    // Converter YYYY-MM-DD para MM/YYYY
    const dParts = rowDate.split('-');
    const rowMonthYear = dParts.length >= 2 ? `${dParts[1]}/${dParts[0]}` : '';

    // Obter especialista do atributo data se disponível (precisaremos adicionar no render)
    const rowSpecialist = row.dataset.specialist || 'Não informado';

    const isNicheMatch = (niche === 'all' || rowNicho === niche);
    const isMonthMatch = (month === 'all' || rowMonthYear === month);
    const isSpecialistMatch = (specialist === 'all' || rowSpecialist === specialist);

    if (isNicheMatch && isMonthMatch && isSpecialistMatch) {
      row.style.display = 'flex';
      visibleMentorados.add(row.querySelector('.history-record-name')?.textContent);
    } else {
      row.style.display = 'none';
    }
  });

  // Atualizar contadores no topo
  const statMentorados = document.getElementById('stat-total-mentorados');
  const statDuvidas = document.getElementById('stat-total-duvidas');
  if (statMentorados) statMentorados.textContent = visibleMentorados.size;
  if (statDuvidas) statDuvidas.textContent = visibleDuvidas;
}

// Lógica de Exportação Consolidada (DOCX)
document.getElementById('history-dashboard')?.addEventListener('click', async (e) => {
  const btn = e.target.closest('#btn-consolidated-export');
  if (!btn) return;

  const month = document.getElementById('filter-month')?.value || 'all';
  const niche = document.getElementById('filter-nicho')?.value || 'all';
  const specialist = document.getElementById('filter-specialist')?.value || 'all';

  if (month === 'all' && niche === 'all' && specialist === 'all') {
    alert('Por favor, selecione um Mês, Nicho ou Especialista específico para exportar o consolidado.');
    return;
  }
  
  const filterInfo = [
    month !== 'all' ? `Mês: ${month}` : '',
    niche !== 'all' ? `Nicho: ${niche}` : '',
    specialist !== 'all' ? `Especialista: ${specialist}` : ''
  ].filter(Boolean).join(' | ');

  try {
    btn.disabled = true;
    btn.innerHTML = '⏳ Gerando...';
    
    // Buscar todos os IDs visíveis
    const visibleRecordIds = Array.from(document.querySelectorAll('.history-record'))
      .filter(row => row.style.display !== 'none')
      .map(row => row.dataset.id);

    if (visibleRecordIds.length === 0) {
      alert('Nenhum registro encontrado para os filtros selecionados.');
      return;
    }

    // Coletar detalhes de todos
    let allQas = [];
    for (const id of visibleRecordIds) {
      const details = await getAnalysisDetails(id);
      allQas.push(...details.qaList.map(qa => ({ ...qa, mentorado: details.analise.mentorado })));
    }

    // Exportar via Word (reutilizando lógica da UI mas consolidada)
    const exportData = {
      qaList: allQas,
      stats: { totalPerguntas: allQas.length },
      isConsolidated: true,
      filterInfo: `Nicho: ${niche} | Período: ${month}`
    };
    
    exportWord(exportData);

  } catch (err) {
    showError('Erro na exportação consolidada: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon-left">📄</span> Exportar Consolidado';
  }
});

// Refresh history when switching mentoria
document.querySelectorAll('input[name="mentoria"]').forEach(input => {
  input.addEventListener('change', () => {
    refreshHistoryDashboard();
  });
});

// Renderizar dashboard histórico na inicialização (Supabase)
refreshHistoryDashboard().catch(console.error);
