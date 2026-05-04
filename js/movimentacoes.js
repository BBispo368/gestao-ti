// ============================================================
//  movimentacoes.js — Histórico de Movimentações
// ============================================================
import { db } from './firebase-config.js';
import {
  collection, onSnapshot, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";

// ── Estado ───────────────────────────────────────────────────
let todasMovimentacoes = [];
let filtradas          = [];
let paginaAtual        = 0;

// ── DOM refs ─────────────────────────────────────────────────
const tbody         = document.getElementById('movTableBody');
const countDisplay  = document.getElementById('countDisplay');
const subtitleCount = document.getElementById('subtitleCount');
const searchInput   = document.getElementById('searchInput');
const filterAcao    = document.getElementById('filterAcao');
const filterSetor   = document.getElementById('filterSetor');
const filterDe      = document.getElementById('filterDe');
const filterAte     = document.getElementById('filterAte');
const filterLimite  = document.getElementById('filterLimite');
const paginationInfo= document.getElementById('paginationInfo');
const paginationBtns= document.getElementById('paginationBtns');

// Stats
const sTotal      = document.getElementById('sTotal');
const sLogins     = document.getElementById('sLogins');
const sAtivacoes  = document.getElementById('sAtivacoes');
const sManutencoes= document.getElementById('sManutencoes');
const sLogoffs    = document.getElementById('sLogoffs');

// ── Helpers ───────────────────────────────────────────────────
function tsToDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  return new Date(ts);
}

function formatDate(d) {
  if (!d) return '—';
  return d.toLocaleDateString('pt-BR');
}

function formatTime(d) {
  if (!d) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const acaoCfg = {
  login:      { label: 'Login',      cls: 'badge-success', icon: 'fa-right-to-bracket',    dot: '#10b981' },
  logoff:     { label: 'Logoff',     cls: 'badge-muted',   icon: 'fa-right-from-bracket',  dot: '#64748b' },
  ativacao:   { label: 'Ativação',   cls: 'badge-accent',  icon: 'fa-plug-circle-check',   dot: '#6366f1' },
  manutencao: { label: 'Manutenção', cls: 'badge-warning', icon: 'fa-wrench',              dot: '#f59e0b' },
};

function acaoBadge(acao) {
  const cfg = acaoCfg[acao] || { label: acao || '—', cls: 'badge-muted', icon: 'fa-circle', dot: '#64748b' };
  return `<span class="badge ${cfg.cls}">
    <i class="fa-solid ${cfg.icon}"></i> ${cfg.label}
  </span>`;
}

function origemBadge(origem) {
  if (!origem) return '<span class="text-muted text-sm">—</span>';
  const isDesktop = origem === 'script_desktop';
  return isDesktop
    ? `<span class="badge badge-muted"><i class="fa-solid fa-desktop" style="margin-right:4px;"></i>Script</span>`
    : `<span class="badge badge-muted"><i class="fa-solid fa-globe" style="margin-right:4px;"></i>Web</span>`;
}

let todosEquipamentos = [];
let todasManutencoes  = [];

function consolidarDados() {
  const logs = todasMovimentacoes.map(m => ({ ...m, source: 'log' }));
  
  const mans = todasManutencoes.map(m => {
    const equip = todosEquipamentos.find(e => e.id === m.equipamento_id);
    return {
      id:               m.id,
      timestamp:        m.data_cadastro || m.data_atualizacao,
      equipamento_id:   m.equipamento_id,
      equipamento_nome: equip?.nome || 'Equipamento',
      nome_pc:          equip?.nome_pc || '',
      mac_address:      equip?.mac_address || '',
      usuario_nome:     'Técnico',
      usuario_setor:    'TI',
      acao:             'manutencao',
      origem:           'painel_web',
      observacoes:      `${m.tipo}: ${m.descricao} (${m.status_manutencao})`,
      source:           'manutencao'
    };
  });

  const base = [...logs, ...mans];
  base.sort((a, b) => {
    const tA = tsToDate(a.timestamp)?.getTime() || 0;
    const tB = tsToDate(b.timestamp)?.getTime() || 0;
    return tB - tA;
  });

  todasMovimentacoesConsolidadas = base;
  aplicarFiltros();
}

let todasMovimentacoesConsolidadas = [];

function aplicarFiltros() {
  const termo  = searchInput.value.toLowerCase().trim();
  const acao   = filterAcao.value;
  const setor  = filterSetor.value;

  let de  = filterDe.value  ? new Date(filterDe.value  + 'T00:00:00') : null;
  let ate = filterAte.value ? new Date(filterAte.value + 'T23:59:59') : null;

  filtradas = todasMovimentacoesConsolidadas.filter(m => {
    const ts = tsToDate(m.timestamp);
    if (de  && ts && ts < de)  return false;
    if (ate && ts && ts > ate) return false;
    if (acao  && m.acao !== acao)             return false;
    if (setor && m.usuario_setor !== setor)   return false;
    if (termo) {
      const campos = [
        m.equipamento_nome, m.usuario_nome,
        m.nome_pc, m.mac_address, m.usuario_setor, m.observacoes
      ].map(v => (v || '').toLowerCase());
      if (!campos.some(c => c.includes(termo))) return false;
    }
    return true;
  });

  paginaAtual = 0;
  atualizarStats();
  atualizarFiltroSetor();
  renderTabela();
}

// Atalhos de data
function setDateRange(de, ate) {
  filterDe.value  = de  ? de.toISOString().split('T')[0]  : '';
  filterAte.value = ate ? ate.toISOString().split('T')[0] : '';
  aplicarFiltros();
}

document.getElementById('btnHoje').addEventListener('click', () => {
  const hoje = new Date();
  setDateRange(hoje, hoje);
});
document.getElementById('btnSemana').addEventListener('click', () => {
  const hoje = new Date();
  const inicio = new Date(hoje);
  inicio.setDate(hoje.getDate() - hoje.getDay());
  setDateRange(inicio, hoje);
});
document.getElementById('btnMes').addEventListener('click', () => {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  setDateRange(inicio, hoje);
});
document.getElementById('btnLimpar').addEventListener('click', () => {
  searchInput.value  = '';
  filterAcao.value   = '';
  filterSetor.value  = '';
  filterDe.value     = '';
  filterAte.value    = '';
  aplicarFiltros();
});

// Eventos
[searchInput, filterAcao, filterSetor, filterDe, filterAte, filterLimite].forEach(el => {
  el.addEventListener('change', aplicarFiltros);
});
searchInput.addEventListener('input', aplicarFiltros);

// ── Stats ─────────────────────────────────────────────────────
function atualizarStats() {
  sTotal.textContent      = filtradas.length;
  sLogins.textContent     = filtradas.filter(m => m.acao === 'login').length;
  sAtivacoes.textContent  = filtradas.filter(m => m.acao === 'ativacao').length;
  sManutencoes.textContent= filtradas.filter(m => m.acao === 'manutencao').length;
  sLogoffs.textContent    = filtradas.filter(m => m.acao === 'logoff').length;
}

// ── Setor filter dinâmico ─────────────────────────────────────
function atualizarFiltroSetor() {
  const setorAtual = filterSetor.value;
  const setores = new Set(todasMovimentacoesConsolidadas.map(m => m.usuario_setor).filter(Boolean));
  filterSetor.innerHTML = '<option value="">Todos os setores</option>';
  [...setores].sort().forEach(s => {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    if (s === setorAtual) opt.selected = true;
    filterSetor.appendChild(opt);
  });
}

// ── Paginação ─────────────────────────────────────────────────
function getPaginado() {
  const limite = parseInt(filterLimite.value) || 0;
  if (limite === 0) return { pagina: filtradas, totalPags: 1 };
  const totalPags = Math.max(1, Math.ceil(filtradas.length / limite));
  if (paginaAtual >= totalPags) paginaAtual = totalPags - 1;
  const inicio = paginaAtual * limite;
  return { pagina: filtradas.slice(inicio, inicio + limite), totalPags, inicio, limite };
}

function renderPaginacao(totalPags) {
  const limite = parseInt(filterLimite.value) || 0;
  if (limite === 0 || totalPags <= 1) {
    paginationBtns.innerHTML = '';
    paginationInfo.textContent = `${filtradas.length} registro(s) no total`;
    return;
  }
  const inicio = paginaAtual * limite;
  const fim = Math.min(inicio + limite, filtradas.length);
  paginationInfo.textContent = `${inicio + 1}–${fim} de ${filtradas.length}`;

  const maxBtns = 5;
  let html = `<button class="page-btn" id="prevPage" ${paginaAtual === 0 ? 'disabled' : ''}>
    <i class="fa-solid fa-chevron-left"></i></button>`;

  let start = Math.max(0, paginaAtual - Math.floor(maxBtns / 2));
  let end   = Math.min(totalPags, start + maxBtns);
  if (end - start < maxBtns) start = Math.max(0, end - maxBtns);

  for (let i = start; i < end; i++) {
    html += `<button class="page-btn ${i === paginaAtual ? 'active' : ''}" data-page="${i}">${i + 1}</button>`;
  }
  html += `<button class="page-btn" id="nextPage" ${paginaAtual >= totalPags - 1 ? 'disabled' : ''}>
    <i class="fa-solid fa-chevron-right"></i></button>`;
  paginationBtns.innerHTML = html;

  document.getElementById('prevPage')?.addEventListener('click', () => { paginaAtual--; renderTabela(); });
  document.getElementById('nextPage')?.addEventListener('click', () => { paginaAtual++; renderTabela(); });
  paginationBtns.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => { paginaAtual = parseInt(btn.dataset.page); renderTabela(); });
  });
}

// ── Renderizar Tabela ─────────────────────────────────────────
function renderTabela() {
  countDisplay.textContent = filtradas.length;

  const { pagina, totalPags } = getPaginado();
  renderPaginacao(totalPags);

  if (!pagina.length) {
    tbody.innerHTML = `
      <tr><td colspan="6">
        <div class="empty-state">
          <i class="fa-solid fa-filter-circle-xmark"></i>
          <h3>Nenhum registro encontrado</h3>
          <p>Ajuste os filtros ou aguarde novos registros do script desktop.</p>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = pagina.map(m => {
    const ts   = tsToDate(m.timestamp);
    const data = formatDate(ts);
    const hora = formatTime(ts);
    return `
      <tr>
        <td>
          <div style="font-weight:600;font-size:13px;">${data}</div>
          <div style="font-size:11px;color:var(--text-muted);">${hora}</div>
        </td>
        <td>
          <div class="equip-name">${m.equipamento_nome || '—'}</div>
          <div class="equip-meta">${m.nome_pc || m.mac_address || ''}</div>
        </td>
        <td>
          <div style="font-weight:500;">${m.usuario_nome || '—'}</div>
        </td>
        <td>
          <span class="badge badge-muted">${m.usuario_setor || '—'}</span>
        </td>
        <td>${acaoBadge(m.acao)}</td>
        <td>${origemBadge(m.origem)}</td>
      </tr>`;
  }).join('');
}

// ── Exportar CSV ──────────────────────────────────────────────
document.getElementById('btnExportar').addEventListener('click', () => {
  const lista = filtradas.length ? filtradas : todasMovimentacoes;
  if (!lista.length) { showToast('Nenhum dado para exportar.', 'warning'); return; }

  const headers = ['Data','Hora','Equipamento','Nome PC','Usuário','Setor','Ação','Status Anterior','Status Novo','Origem'];
  const rows = lista.map(m => {
    const ts   = tsToDate(m.timestamp);
    return [
      formatDate(ts), formatTime(ts),
      m.equipamento_nome, m.nome_pc,
      m.usuario_nome, m.usuario_setor,
      m.acao, m.status_anterior, m.status_novo, m.origem
    ].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',');
  });

  const csv  = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `movimentacoes_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`${lista.length} registros exportados com sucesso!`);
});

// ── Listeners Firestore ───────────────────────────────────────
onSnapshot(collection(db, 'equipamentos'), (snap) => {
  todosEquipamentos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  consolidarDados();
});

onSnapshot(collection(db, 'manutencoes'), (snap) => {
  todasManutencoes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  consolidarDados();
});

onSnapshot(collection(db, 'movimentacoes'), (snap) => {
  todasMovimentacoes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  consolidarDados();
}, (err) => {
  console.error(err);
  document.getElementById('connectionStatus').textContent = 'Erro';
  document.querySelector('.status-dot').style.background = '#ef4444';
});
