/**
 * UI Module — Controle da interface
 * 
 * - Renderização dos resultados por agente
 * - Controle de abas e visualizações
 * - Exportação JSON/CSV
 * - Gerenciamento de progresso visual
 */

/**
 * Atualiza o status visual de um agente na pipeline
 * @param {number} agentNumber - 1, 2 ou 3
 * @param {'idle'|'running'|'done'|'error'} status
 * @param {string} message - Mensagem de status
 */
export function updateAgentStatus(agentNumber, status, message = '') {
  const card = document.getElementById(`agent${agentNumber}-card`);
  const statusEl = document.getElementById(`agent${agentNumber}-status`);
  const progressEl = document.getElementById(`agent${agentNumber}-progress`);
  
  if (!card) return;

  // Remover classes anteriores
  card.classList.remove('agent-idle', 'agent-running', 'agent-done', 'agent-error');
  card.classList.add(`agent-${status}`);

  if (statusEl) {
    const statusLabels = {
      idle: 'Aguardando',
      running: 'Processando...',
      done: 'Concluído ✓',
      error: 'Erro ✗'
    };
    statusEl.textContent = message || statusLabels[status];
  }

  if (progressEl) {
    if (status === 'running') {
      progressEl.classList.add('active');
    } else {
      progressEl.classList.remove('active');
    }
  }
}

/**
 * Atualiza a barra de progresso de um agente
 * @param {number} agentNumber - 1, 2 ou 3
 * @param {number} current - Progresso atual
 * @param {number} total - Total
 */
export function updateAgentProgress(agentNumber, current, total) {
  const progressBar = document.getElementById(`agent${agentNumber}-progress-bar`);
  const progressText = document.getElementById(`agent${agentNumber}-progress-text`);
  
  if (progressBar && total > 0) {
    const percent = Math.round((current / total) * 100);
    progressBar.style.width = `${percent}%`;
  }
  
  if (progressText) {
    progressText.textContent = total > 0 ? `${current}/${total}` : '';
  }
}

/**
 * Renderiza os resultados do Agente 1 (Transcrições)
 * @param {Array} transcriptions - Output do Agente 1
 */
export function renderAgent1Results(transcriptions) {
  const container = document.getElementById('agent1-results');
  if (!container) return;

  if (transcriptions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🎤</span>
        <p>Nenhum arquivo de áudio encontrado no ZIP</p>
      </div>
    `;
    return;
  }

  let html = `
    <div class="results-header">
      <h3>📝 Transcrições de Áudio</h3>
      <span class="badge">${transcriptions.length} áudio(s)</span>
    </div>
    <div class="results-table-wrap">
      <table class="results-table">
        <thead>
          <tr>
            <th>Áudio</th>
            <th>Data/Hora</th>
            <th>Remetente</th>
            <th>Transcrição</th>
            <th>Contexto</th>
          </tr>
        </thead>
        <tbody>
  `;

  for (const t of transcriptions) {
    const isError = t.transcricao.startsWith('[ERRO');
    html += `
      <tr class="${isError ? 'row-error' : ''}">
        <td class="cell-mono">${t.audio_id}</td>
        <td class="cell-nowrap">${t.data} ${t.hora}</td>
        <td>${t.remetente}</td>
        <td class="cell-content ${isError ? 'text-error' : ''}">${escapeHtml(t.transcricao)}</td>
        <td class="cell-context">
          ${t.mensagem_anterior ? `<div class="ctx-before">⬆ ${escapeHtml(truncate(t.mensagem_anterior, 60))}</div>` : ''}
          ${t.mensagem_posterior ? `<div class="ctx-after">⬇ ${escapeHtml(truncate(t.mensagem_posterior, 60))}</div>` : ''}
        </td>
      </tr>
    `;
  }

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

/**
 * Renderiza os resultados do Agente 2 (Conversa Unificada)
 * @param {Array} conversation - Model de Conversa Unificada
 */
export function renderAgent2Results(conversation, mediaFiles = new Map()) {
  const container = document.getElementById('agent2-results');
  if (!container) return;

  if (conversation.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📋</span>
        <p>Nenhuma mensagem processada</p>
      </div>
    `;
    return;
  }

  // Agrupar por tipo para as estatísticas
  const stats = {
    texto: conversation.filter(m => m.tipo === 'texto').length,
    audio: conversation.filter(m => m.tipo === 'audio').length,
    imagem: conversation.filter(m => m.tipo === 'imagem_print' || m.tipo === 'imagem_comum').length,
    video: conversation.filter(m => m.tipo === 'video').length,
    documento: conversation.filter(m => m.tipo === 'documento').length,
    apagada: conversation.filter(m => m.tipo === 'apagada').length,
    sistema: conversation.filter(m => m.tipo === 'sistema').length
  };

  let html = `
    <div class="results-header">
      <h3>🔗 Conversa Unificada</h3>
      <div class="stats-row">
        <span class="badge badge-text">${stats.texto} texto</span>
        <span class="badge badge-audio">${stats.audio} áudio</span>
        <span class="badge badge-image">${stats.imagem} imagem</span>
        ${stats.video ? `<span class="badge badge-video">${stats.video} vídeo</span>` : ''}
        ${stats.documento ? `<span class="badge badge-doc">${stats.documento} doc</span>` : ''}
        ${stats.apagada ? `<span class="badge badge-deleted">${stats.apagada} apagada</span>` : ''}
        <span class="badge badge-system">${stats.sistema} sistema</span>
      </div>
    </div>
    <div class="chat-timeline">
  `;

  let lastDate = '';
  for (const msg of conversation) {
    // Separador de data
    if (msg.data !== lastDate) {
      html += `<div class="date-separator"><span>${msg.data}</span></div>`;
      lastDate = msg.data;
    }

    if (msg.tipo === 'sistema') {
      html += `<div class="chat-msg chat-system"><span>${escapeHtml(msg.conteudo)}</span></div>`;
      continue;
    }

    const typeIcon = getTypeIcon(msg.tipo);
    const typeClass = getTypeClass(msg.tipo);

    // Montar conteúdo com transcrição se for áudio
    let contentHtml = escapeHtml(msg.conteudo);

    // Se tiver arquivo de mídia (imagem), tentar carregar o Blob
    if ((msg.tipo === 'imagem_comum' || msg.tipo === 'imagem_print') && msg.mediaFilename) {
      const media = mediaFiles.get(msg.mediaFilename);
      if (media && media.blob) {
        const imageUrl = URL.createObjectURL(media.blob);
        contentHtml = `
          <div class="msg-image-container">
            <img src="${imageUrl}" alt="Imagem do chat" class="chat-img" onclick="window.openImageModal('${imageUrl}')">
          </div>
          <div class="msg-media-label">${escapeHtml(msg.conteudo)}</div>
        `;
      }
    }

    if (msg.tipo === 'audio' && msg.transcricao) {
      contentHtml += `<div class="msg-transcription"><em>Transcrição:</em> ${escapeHtml(msg.transcricao)}</div>`;
    }
    if (msg.tipo === 'imagem_print' && msg.conteudo_extraido) {
      contentHtml += `<div class="msg-transcription">${escapeHtml(msg.conteudo_extraido)}</div>`;
    }

    html += `
      <div class="chat-msg ${typeClass}">
        <div class="msg-header">
          <span class="msg-sender">${escapeHtml(msg.remetente)}</span>
          <span class="msg-time">${msg.hora}</span>
          <span class="msg-type-badge">${typeIcon}</span>
        </div>
        <div class="msg-content">${contentHtml}</div>
      </div>
    `;
  }

  html += '</div>';
  container.innerHTML = html;
}

/**
 * Cores por categoria
 */
const CATEGORY_COLORS = {
  'Marketing': '#f472b6',
  'Comercial': '#34d399',
  'Sucesso do Cliente': '#60a5fa',
  'Mentalidade': '#fbbf24',
  'Identidade Visual': '#a78bfa',
  'Produção de Conteúdo': '#fb923c',
  'Contratação': '#2dd4bf',
  'Acesso': '#cbd5e1',
  'Gestão': '#f87171',
  'Dúvidas Gerais': '#94a3b8'
};

/**
 * Renderiza os resultados do Agente 3 (Perguntas e Respostas)
 * @param {Object} result - Output do Agente 3 { qaList, roles, stats, categorias }
 */
export function renderAgent3Results(result, mediaFiles = new Map(), mentoriaType = 'cleiton') {
  const container = document.getElementById('agent3-results');
  if (!container) return;

  const { qaList, stats, categorias } = result;

  if (qaList.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">❓</span>
        <p>Nenhuma pergunta e resposta identificada</p>
      </div>
    `;
    return;
  }

  // Header com stats
  let html = `
    <div class="results-header">
      <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
        <h3>Perguntas & Respostas Extraídas</h3>
        <div class="stats-row" style="margin-left: auto;">
          <span class="badge badge-question">${stats.totalPerguntas} pergunta(s)</span>
          <span class="badge badge-answer">${stats.comResposta} com resposta</span>
          <span class="badge badge-no-answer">${stats.semResposta} sem resposta</span>
        </div>
      </div>
    </div>
    
    <!-- Dashboard de Indicadores -->
    ${renderAgent3Dashboard(categorias, mentoriaType)}
  `;

  // Sub-abas por categoria
  const categoryKeys = Object.keys(categorias || {}).sort((a, b) => (categorias[b] || 0) - (categorias[a] || 0));

  html += `<div class="qa-subtabs">`;
  html += `<button class="qa-subtab active" data-category="todas">Todas (${qaList.length})</button>`;
  for (const cat of categoryKeys) {
    const color = CATEGORY_COLORS[cat] || '#94a3b8';
    html += `<button class="qa-subtab" data-category="${cat}" style="--cat-color: ${color}">${cat} (${categorias[cat]})</button>`;
  }
  html += `</div>`;

  // Lista de Q&A
  html += `<div class="qa-list">`;

  for (let i = 0; i < qaList.length; i++) {
    const qa = qaList[i];
    const noAnswer = qa.resposta === '[Sem resposta identificada]';
    const catColor = CATEGORY_COLORS[qa.categoria] || '#94a3b8';

    html += `
      <div class="qa-card ${noAnswer ? 'qa-no-answer' : ''}" data-category="${qa.categoria}">
        <div class="qa-card-header">
          <div class="qa-number">#${i + 1}</div>
          <span class="qa-category-badge" style="--cat-color: ${catColor}">${qa.categoria}</span>
        </div>
        <div class="qa-meta">
          <span class="qa-date">${qa.data_pergunta} ${qa.hora_pergunta}</span>
          ${qa.remetente ? `<span class="qa-sender">${escapeHtml(qa.remetente)}</span>` : ''}
        </div>
        <div class="qa-question">
          <div class="qa-title-row">
            <div class="qa-label">PERGUNTA</div>
            ${renderMediaButtons(qa.mediaFilenames_pergunta, mediaFiles)}
          </div>
          <div class="qa-text">${escapeHtml(qa.pergunta)}</div>
        </div>
        <div class="qa-answer ${noAnswer ? 'qa-answer-missing' : ''}">
          <div class="qa-title-row">
            <div class="qa-label">RESPOSTA</div>
            ${renderMediaButtons(qa.mediaFilenames_resposta, mediaFiles)}
          </div>
          <div class="qa-text">${escapeHtml(qa.resposta)}</div>
        </div>
      </div>
    `;
  }

  html += '</div>';
  container.innerHTML = html;

  // Event listeners para sub-abas
  container.querySelectorAll('.qa-subtab').forEach(btn => {
    btn.addEventListener('click', () => {
      // Ativar sub-aba
      container.querySelectorAll('.qa-subtab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const category = btn.dataset.category;
      const cards = container.querySelectorAll('.qa-card');

      cards.forEach(card => {
        if (category === 'todas' || card.dataset.category === category) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

/**
 * Renderiza o resumo do upload
 * @param {Object} parseResult - Resultado do parser
 */
export function renderUploadSummary(parseResult) {
  const container = document.getElementById('upload-summary');
  if (!container) return;

  const { stats, chatFileName } = parseResult;

  container.innerHTML = `
    <div class="summary-grid">
      <div class="summary-item">
        <div class="summary-value">${stats.totalMessages}</div>
        <div class="summary-label">Mensagens</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${stats.audioFiles}</div>
        <div class="summary-label">Áudios</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${stats.imageFiles}</div>
        <div class="summary-label">Imagens</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${stats.textMessages}</div>
        <div class="summary-label">Texto</div>
      </div>
    </div>
    <div class="summary-file">📄 ${escapeHtml(chatFileName)}</div>
  `;
  container.classList.add('visible');
}

/**
 * Exporta dados como JSON
 * @param {Object} data - Dados a exportar
 * @param {string} filename - Nome do arquivo
 */
export function exportJSON(data, filename) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, `${filename}.json`);
}

/**
 * Exporta dados como CSV
 * @param {Array} data - Array de objetos
 * @param {string} filename - Nome do arquivo
 */
export function exportCSV(data, filename) {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(';'),
    ...data.map(row =>
      headers.map(h => {
        const val = String(row[h] || '').replace(/"/g, '""');
        return `"${val}"`;
      }).join(';')
    )
  ];

  const csv = '\ufeff' + csvRows.join('\n'); // BOM for Excel
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `${filename}.csv`);
}

/**
 * Exporta dados como documento do Word (DOC) estruturado em Threads
 * @param {Object|Array} result - Objeto com {qaList, isConsolidated, filterInfo} ou array simples qaList
 * @param {string} filename - Nome do arquivo (opcional)
 */
export function exportWord(result, filename = 'relatorio_consolidado') {
  const qaList = Array.isArray(result) ? result : result.qaList;
  const isConsolidated = result.isConsolidated || false;
  const filterInfo = result.filterInfo || '';

  if (!qaList || qaList.length === 0) return;

  const nichoSelect = document.getElementById('search-nicho');
  const nichoName = nichoSelect && nichoSelect.value ? nichoSelect.options[nichoSelect.selectedIndex].text : 'Não especificado';

  const relatorio = [];
  let currentThread = null;

  for (const qa of qaList) {
    // No modo consolidado, agrupamos também por mentorado
    const canGroup = currentThread && 
                     currentThread.categoria === qa.categoria && 
                     currentThread.data === qa.data_pergunta &&
                     (!isConsolidated || currentThread.mentorado === qa.mentorado);

    if (canGroup) {
      currentThread.items.push(qa);
    } else {
      if (currentThread) relatorio.push(currentThread);
      currentThread = {
        mentorado: qa.mentorado || 'Cliente',
        remetente: qa.remetente,
        categoria: qa.categoria,
        data: qa.data_pergunta,
        items: [qa]
      };
    }
  }
  if (currentThread) relatorio.push(currentThread);

  const nomeExibicao = (isConsolidated) ? 'RELATÓRIO CONSOLIDADO' : (relatorio.length > 0 ? relatorio[0].remetente : 'Cliente');

  let html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
  <head><meta charset='utf-8'><title>Relatório</title>
  <style>
    body { font-family: 'Arial', sans-serif; font-size: 11pt; }
    p { margin-bottom: 0px; margin-top: 0px; line-height: 1.5; }
    br { mso-data-placement: same-cell; }
    .header-box { border: 1px solid #ccc; padding: 10px; margin-bottom: 20px; background: #f9f9f9; }
  </style>
  </head><body>`;

  html += `<div class="header-box">`;
  html += `<p><strong>${escapeHtml(nomeExibicao)}</strong></p>`;
  if (isConsolidated && filterInfo) html += `<p>FILTROS: ${escapeHtml(filterInfo)}</p>`;
  html += `<p>NICHO: ${escapeHtml(nichoName)}</p>`;
  html += `<p>DATA EXPORTAÇÃO: ${new Date().toLocaleDateString('pt-BR')}</p>`;
  html += `</div><br>`;

  relatorio.forEach(thread => {
    const isSpecialistHeader = isConsolidated ? `<p style="color: #666; font-size: 0.9em;"><strong>MENTORADO: ${escapeHtml(thread.mentorado)}</strong></p>` : '';
    html += isSpecialistHeader;

    thread.items.forEach((item) => {
      const pText = escapeHtml(item.pergunta).replace(/\n/g, '<br>');
      const rText = escapeHtml(item.resposta).replace(/\n/g, '<br>');
      const dateText = item.data_pergunta || 'Sem data';

      html += `<p><strong>TIPO DE DÚVIDA: ${escapeHtml(thread.categoria.toUpperCase())}</strong></p>`;
      html += `<p>DATA: ${escapeHtml(dateText)}</p>`;
      html += `<p>PERGUNTA: ${pText}</p>`;
      html += `<p>RESPOSTA: ${rText}</p>`;
      html += `<br>`;
    });
    html += `<br><br>`;
  });

  html += `</body></html>`;

  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Alterna visibilidade de abas
 * @param {string} tabId - ID da aba a ativar
 */
export function switchTab(tabId) {
  // Desativar todas as abas
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

  // Ativar aba selecionada
  const btn = document.querySelector(`[data-tab="${tabId}"]`);
  const content = document.getElementById(tabId);
  
  if (btn) btn.classList.add('active');
  if (content) content.classList.add('active');
}

// ===== HELPERS =====

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '...' : str;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getTypeIcon(tipo) {
  const icons = {
    texto: '💬',
    audio: '🎧',
    imagem_print: '📸',
    imagem_comum: '📷',
    video: '🎥',
    documento: '📄',
    apagada: '❌',
    media_omitida: '📎',
    sistema: '⚙️'
  };
  return icons[tipo] || '📝';
}

function getTypeClass(tipo) {
  const classes = {
    texto: 'msg-text',
    audio: 'msg-audio',
    imagem_print: 'msg-image-print',
    imagem_comum: 'msg-image',
    video: 'msg-video',
    documento: 'msg-doc',
    apagada: 'msg-deleted',
    media_omitida: 'msg-media',
    sistema: 'chat-system'
  };
  return classes[tipo] || 'msg-text';
}

/**
 * Helper para renderizar botão de mídia dentro de um card de Q&A
 */
function renderMediaButtons(filenames, mediaFiles) {
  if (!filenames || !filenames.length || !mediaFiles) return '';
  
  let html = '';
  for (const filename of filenames) {
    const media = mediaFiles.get(filename);
    if (!media || !media.blob || media.type !== 'image') continue;
    
    const imageUrl = URL.createObjectURL(media.blob);
    html += `
      <button class="qa-image-btn" onclick="window.openImageModal('${imageUrl}')" title="Ver imagem anexada">
        📷 Ver Imagem
      </button>
    `;
  }
  return html;
}

/**
 * Renderiza o Dashboard de Indicadores (cards de métricas)
 */
function renderAgent3Dashboard(categorias, mentoriaType = 'cleiton') {
  if (!categorias) return '';

  const icons = {
    'Marketing': '🎯',
    'Comercial': '💰',
    'Sucesso do Cliente': '⭐',
    'Mentalidade': '🧠',
    'Identidade Visual': '✨',
    'Produção de Conteúdo': '📱',
    'Contratação': '👥',
    'Acesso': '🔑',
    'Gestão': '⚙️'
  };

  // Pilares de cada mentoria
  const cleitonPillars = ['Marketing', 'Comercial', 'Sucesso do Cliente', 'Mentalidade', 'Contratação', 'Gestão'];
  const juliaPillars = ['Identidade Visual', 'Produção de Conteúdo', 'Acesso'];

  // Determinar quais categorias mostrar
  // 1. Mostrar os pilares da mentoria selecionada (se count > 0)
  // 2. Mostrar outros pilares de mentorias cruzadas (se count > 0)
  // 3. Manter a regra de não mostrar se o valor for 0
  
  const currentPillars = mentoriaType === 'julia' ? juliaPillars : cleitonPillars;
  const otherPillars = mentoriaType === 'julia' ? cleitonPillars : juliaPillars;

  // Filtrar e ordenar: primeiro os da mentoria atual, depois os outros
  const activeCategories = [
    ...currentPillars.filter(cat => (categorias[cat] || 0) > 0),
    ...otherPillars.filter(cat => (categorias[cat] || 0) > 0)
  ];

  if (activeCategories.length === 0) return '';

  let html = '<div class="qa-dashboard">';
  
  activeCategories.forEach(cat => {
    const count = categorias[cat];
    const icon = icons[cat] || '📋';
    html += `
      <div class="indicator-card">
        <div class="indicator-icon">${icon}</div>
        <div class="indicator-value">${count}</div>
        <div class="indicator-label">${cat}</div>
      </div>
    `;
  });

  html += '</div>';
  return html;
}

/**
 * Renderiza o Dashboard Histórico de Análises
 * @param {Object} stats - Estatísticas do getHistoryStats()
 * @param {Object} detailedStats - Insights do getDetailedAnalytics()
 * @param {string} mentoriaLabel - Label da mentoria ativa
 */
export function renderHistoryDashboard(stats, detailedStats = {}, mentoriaLabel = 'Todas') {
  const container = document.getElementById('history-dashboard');
  if (!container) return;

  if (!stats || !stats.totalMentorados) {
    container.innerHTML = `
      <div class="history-empty">
        <p>📊 Nenhuma análise registrada ainda.</p>
        <p style="font-size: 0.8rem; margin-top: 0.5rem;">Processe uma conversa para começar a acumular dados aqui.</p>
      </div>
    `;
    return;
  }

  // Extrair meses e nichos únicos para os filtros
  const uniqueMonths = [...new Set(Object.keys(stats.duvidaPorMes))].sort((a,b) => {
     const [ma, ya] = a.split('/'); const [mb, yb] = b.split('/');
     return (yb + mb).localeCompare(ya + ma);
  });
  const uniqueNiches = [...new Set(Object.keys(stats.duvidaPorNicho))].sort();
  const uniqueSpecialists = [...new Set(Object.keys(stats.duvidaPorEspecialista || {}))].sort();

  let html = `
    <div class="history-controls">
      <div class="filter-group">
        <label>Período:</label>
        <select id="filter-month">
          <option value="all">Todos os Meses</option>
          ${uniqueMonths.map(m => `<option value="${m}">${m}</option>`).join('')}
        </select>
      </div>
      <div class="filter-group">
        <label>Nicho:</label>
        <select id="filter-nicho">
          <option value="all">Todos os Nichos</option>
          ${uniqueNiches.map(n => `<option value="${n}">${n}</option>`).join('')}
        </select>
      </div>
      <div class="filter-group">
        <label>Especialista:</label>
        <select id="filter-specialist">
          <option value="all">Todos</option>
          ${uniqueSpecialists.map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
      </div>
      <button id="btn-consolidated-export" class="btn-secondary btn-small" style="margin-left: auto;">
        <span class="btn-icon-left">📄</span> Exportar Consolidado
      </button>
    </div>
  `;

  // === Cards de Resumo principal (que serão atualizados via JS) ===
  html += `
    <div class="history-stats-grid" id="history-summary-cards">
      <div class="history-stat-card">
        <div class="history-stat-value" id="stat-total-mentorados">${stats.totalMentorados}</div>
        <div class="history-stat-label">Mentorados</div>
      </div>
      <div class="history-stat-card">
        <div class="history-stat-value" id="stat-total-duvidas">${stats.totalDuvidas}</div>
        <div class="history-stat-label">Total de Dúvidas</div>
      </div>
    </div>
  `;

  // === Dúvidas por Nicho ===
  const nichoEntries = Object.entries(stats.duvidaPorNicho)
    .sort((a, b) => b[1] - a[1]);

  if (nichoEntries.length > 0) {
    html += `
      <div class="history-nicho-section">
        <h3>Dúvidas por Nicho</h3>
        <div class="history-nicho-list">
    `;

    for (const [nicho, count] of nichoEntries) {
      html += `
        <div class="history-nicho-item">
          <span class="history-nicho-name">${escapeHtml(nicho)}</span>
          <span class="history-nicho-count">${count} dúvida${count !== 1 ? 's' : ''} mensal</span>
        </div>
      `;
    }

    html += '</div></div>';
  }

  // === Dúvidas por Mês ===
  const monthEntries = Object.entries(stats.duvidaPorMes)
    .sort((a, b) => {
      const [ma, ya] = a[0].split('/');
      const [mb, yb] = b[0].split('/');
      return (yb + mb).localeCompare(ya + ma);
    });

  if (monthEntries.length > 0) {
    html += `
      <div class="history-monthly-section">
        <h3>Dúvidas por Mês</h3>
        <div class="history-monthly-grid">
    `;

    const meses = {
      '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
      '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
      '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez'
    };

    for (const [mesAno, count] of monthEntries) {
      const [mes, ano] = mesAno.split('/');
      const mesLabel = meses[mes] || mes;
      html += `
        <div class="history-month-card">
          <div class="history-month-value">${count}</div>
          <div class="history-month-label">${mesLabel}/${ano}</div>
        </div>
      `;
    }

    html += '</div></div>';
  }

  // === Insights Detalhados (Nicho -> Mês -> Categorias) ===
  const nichoDetails = Object.entries(detailedStats).sort();
  if (nichoDetails.length > 0) {
    html += `
      <div class="history-insights-section">
        <h3>💡 Insights Estratégicos</h3>
        <p style="font-size: 0.8rem; color: var(--text-tertiary); margin-bottom: 1rem;">Tendências de dúvidas por nicho e período.</p>
        <div class="insights-container">
    `;

    for (const [nicho, meses] of nichoDetails) {
      html += `
        <div class="insight-nicho-card">
          <div class="insight-nicho-header">
            <h4>${escapeHtml(nicho)}</h4>
          </div>
          <div class="insight-months-list">
      `;

      const sortedMonths = Object.entries(meses).sort((a, b) => {
        const [ma, ya] = a[0].split('/');
        const [mb, yb] = b[0].split('/');
        return (yb + mb).localeCompare(ya + ma);
      });

      for (const [mesAno, data] of sortedMonths) {
        html += `
          <div class="insight-month-row">
            <div class="insight-month-info">
              <span class="month-label">${mesAno}</span>
              <span class="month-count">${data.total} dúvida${data.total !== 1 ? 's' : ''}</span>
            </div>
            <div class="insight-categories">
        `;

        const sortedCats = Object.entries(data.categorias).sort((a, b) => b[1] - a[1]);
        for (const [cat, count] of sortedCats) {
          const color = CATEGORY_COLORS[cat] || '#94a3b8';
          html += `
            <span class="insight-cat-tag" style="--cat-color: ${color}">
              ${cat}: <strong>${count}</strong>
            </span>
          `;
        }

        html += `</div></div>`;
      }

      html += `</div></div>`;
    }

    html += '</div></div>';
  }

  // === Lista de Registros ===
  if (stats.registros.length > 0) {
    html += `
      <div class="history-records-section">
        <h3>Registros Individuais</h3>
    `;

    for (const rec of stats.registros.slice().reverse()) {
      html += `
        <div class="history-record" data-id="${rec.id}" data-specialist="${escapeHtml(rec.especialista || 'Não informado')}">
          <span class="history-record-name">${escapeHtml(rec.mentorado)}</span>
          <span class="history-record-nicho">${escapeHtml(rec.nicho)}</span>
          <span class="history-record-date">${rec.dataAnalise}</span>
          <span class="history-record-count">${rec.totalDuvidas} dúvida${rec.totalDuvidas !== 1 ? 's' : ''}</span>
          <button class="history-record-delete" title="Remover" data-delete-id="${rec.id}">✕</button>
        </div>
      `;
    }

    html += '</div>';
  }

  container.innerHTML = html;

  // Event listeners para deletar registros
  container.querySelectorAll('.history-record-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.deleteId;
      if (id) {
        // Dispatch custom event to be handled by main.js
        container.dispatchEvent(new CustomEvent('delete-record', { detail: { id } }));
      }
    });
  });
}
// ===== IMAGE MODAL HANDLING =====
document.addEventListener('DOMContentLoaded', () => {
  const imageModal = document.getElementById('image-modal');
  const modalImg = document.getElementById('expanded-img');
  const closeModalBtn = document.getElementById('close-image-modal');

  // Adicionando evento de fechamento no botão X
  if (closeModalBtn && imageModal) {
    closeModalBtn.addEventListener('click', () => {
      imageModal.classList.remove('visible');
    });
  }

  // Fechar ao clicar fora da imagem
  if (imageModal) {
    imageModal.addEventListener('click', (e) => {
      if (e.target === imageModal) {
        imageModal.classList.remove('visible');
      }
    });
  }

  // Expor a função globalmente para usar via onclick no HTML renderizado
  window.openImageModal = function(src) {
    if (imageModal && modalImg) {
      modalImg.src = src;
      imageModal.classList.add('visible');
    }
  };
});
