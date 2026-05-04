// ============================================================
//  manutencoes.js — CRUD completo de Manutenções
// ============================================================
import { db } from './firebase-config.js';
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";

// ── Estado ───────────────────────────────────────────────────
let todasManutencoes  = [];
let todosEquipamentos = [];
let filtradas         = [];
let tabAtiva          = 'todas';
let manIdParaDeletar  = null;
let modoEdicao        = false;

// ── DOM refs ─────────────────────────────────────────────────
const tbody         = document.getElementById('manTableBody');
const countDisplay  = document.getElementById('countDisplay');
const subtitleCount = document.getElementById('subtitleCount');
const searchInput   = document.getElementById('searchInput');
const filterStatus  = document.getElementById('filterStatus');
const filterEquip   = document.getElementById('filterEquip');

const sTotal      = document.getElementById('sTotal');
const sAgendadas  = document.getElementById('sAgendadas');
const sConcluidas = document.getElementById('sConcluidas');
const sPendentes  = document.getElementById('sPendentes');
const sVencidas   = document.getElementById('sVencidas');

const modalOverlay   = document.getElementById('modalOverlay');
const confirmOverlay = document.getElementById('confirmOverlay');
const modalTitle     = document.getElementById('modalTitle');
const manForm        = document.getElementById('manForm');
const manId          = document.getElementById('manId');
const confirmText    = document.getElementById('confirmText');
const atualizarWrap  = document.getElementById('atualizarEquipWrap');

const F = (id) => document.getElementById(id);

// ── Helpers ───────────────────────────────────────────────────
function parseDate(str) {
  if (!str) return null;
  return new Date(str + 'T00:00:00');
}

function formatDate(str) {
  if (!str) return '—';
  return parseDate(str).toLocaleDateString('pt-BR');
}

function formatCusto(v) {
  if (!v && v !== 0) return '—';
  return `R$ ${parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function isVencida(agendamento, status) {
  if (status === 'Concluída') return false;
  if (!agendamento) return false;
  return parseDate(agendamento) < new Date();
}

// ── Badges ────────────────────────────────────────────────────
function statusBadge(status, agendamento) {
  if (isVencida(agendamento, status)) {
    return `<span class="badge badge-danger"><i class="fa-solid fa-circle-xmark"></i> Vencida</span>`;
  }
  const map = {
    'Agendada':  `<span class="badge badge-info"><i class="fa-solid fa-calendar-check"></i> Agendada</span>`,
    'Concluída': `<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> Concluída</span>`,
    'Pendente':  `<span class="badge badge-warning"><i class="fa-solid fa-hourglass-half"></i> Pendente</span>`,
  };
  return map[status] || `<span class="badge badge-muted">${status}</span>`;
}

function tipoBadge(tipo) {
  if (tipo === 'Preventiva')
    return `<span class="badge badge-accent"><i class="fa-solid fa-shield-heart"></i> Preventiva</span>`;
  return `<span class="badge badge-danger"><i class="fa-solid fa-hammer"></i> Corretiva</span>`;
}

function agendamentoLabel(agendamento, status) {
  if (!agendamento) return '<span class="venc-none">—</span>';
  const hoje = new Date();
  const data = parseDate(agendamento);
  const fmt  = formatDate(agendamento);
  const diff = Math.ceil((data - hoje) / (1000 * 60 * 60 * 24));

  if (status === 'Concluída') return `<span class="venc-ok">${fmt}</span>`;
  if (diff < 0)  return `<span class="venc-vencida"><i class="fa-solid fa-circle-xmark"></i> ${fmt}</span>`;
  if (diff <= 7) return `<span class="venc-urgente"><i class="fa-solid fa-triangle-exclamation"></i> ${fmt} (${diff}d)</span>`;
  return `<span class="venc-ok">${fmt}</span>`;
}

// ── Tabs ──────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    tabAtiva = btn.dataset.tab;
    aplicarFiltros();
  });
});

// ── Filtros ───────────────────────────────────────────────────
function aplicarFiltros() {
  const termo  = searchInput.value.toLowerCase().trim();
  const status = filterStatus.value;
  const equip  = filterEquip.value;
  const hoje   = new Date();

  filtradas = todasManutencoes.filter(m => {
    // Tab
    if (tabAtiva === 'preventiva' && m.tipo !== 'Preventiva') return false;
    if (tabAtiva === 'corretiva'  && m.tipo !== 'Corretiva')  return false;
    if (tabAtiva === 'vencidas'   && !isVencida(m.data_agendamento, m.status_manutencao)) return false;

    // Filtros de select
    if (status && m.status_manutencao !== status) return false;
    if (equip  && m.equipamento_id !== equip)     return false;

    // Busca texto
    if (termo) {
      const campos = [
        m.equipamento_nome, m.descricao, m.observacoes, m.tipo
      ].map(v => (v || '').toLowerCase());
      if (!campos.some(c => c.includes(termo))) return false;
    }
    return true;
  });

  atualizarStats();
  renderTabela();
}

[searchInput, filterStatus, filterEquip].forEach(el => {
  el.addEventListener('input',  aplicarFiltros);
  el.addEventListener('change', aplicarFiltros);
});

// ── Stats ─────────────────────────────────────────────────────
function atualizarStats() {
  const base = todasManutencoes;
  sTotal.textContent      = base.length;
  sAgendadas.textContent  = base.filter(m => m.status_manutencao === 'Agendada').length;
  sConcluidas.textContent = base.filter(m => m.status_manutencao === 'Concluída').length;
  sPendentes.textContent  = base.filter(m => m.status_manutencao === 'Pendente').length;
  sVencidas.textContent   = base.filter(m => isVencida(m.data_agendamento, m.status_manutencao)).length;

  subtitleCount.textContent = `${base.length} manutenção(ões) registrada(s)`;
}

// ── Equipamentos select dinâmico ──────────────────────────────
function atualizarSelectEquipamentos() {
  const selForm   = F('fEquipamento');
  const selFilter = filterEquip;
  const valAtual  = selFilter.value;

  selForm.innerHTML = '<option value="">Selecione o equipamento...</option>';
  selFilter.innerHTML = '<option value="">Todos os equipamentos</option>';

  todosEquipamentos
    .slice()
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
    .forEach(e => {
      const label = `${e.nome || '—'}${e.patrimonio ? ' [' + e.patrimonio + ']' : ''}`;
      selForm.innerHTML += `<option value="${e.id}">${label}</option>`;
      const opt = document.createElement('option');
      opt.value = e.id; opt.textContent = label;
      if (e.id === valAtual) opt.selected = true;
      selFilter.appendChild(opt);
    });
}

// ── Renderizar Tabela ─────────────────────────────────────────
function renderTabela() {
  countDisplay.textContent = filtradas.length;

  if (!filtradas.length) {
    tbody.innerHTML = `
      <tr><td colspan="9">
        <div class="empty-state">
          <i class="fa-solid fa-screwdriver-wrench"></i>
          <h3>Nenhuma manutenção encontrada</h3>
          <p>Ajuste os filtros ou cadastre uma nova manutenção.</p>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = filtradas.map(m => `
    <tr>
      <td>
        <div class="equip-name">${m.equipamento_nome || '—'}</div>
        <div class="equip-meta">${m.equipamento_id ? 'ID: ' + m.equipamento_id.slice(0,8) + '…' : ''}</div>
      </td>
      <td>${tipoBadge(m.tipo)}</td>
      <td>
        <div style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px;">
          ${m.descricao || '—'}
        </div>
      </td>
      <td>${agendamentoLabel(m.data_agendamento, m.status_manutencao)}</td>
      <td>
        ${m.data_execucao
          ? `<span style="font-size:13px;">${formatDate(m.data_execucao)}</span>`
          : '<span class="text-muted text-sm">—</span>'}
      </td>
      <td>${statusBadge(m.status_manutencao, m.data_agendamento)}</td>
      <td>
        <div class="action-btns">
          ${m.status_manutencao !== 'Concluída'
            ? `<button class="btn-icon-sm done" title="Marcar como Concluída" onclick="concluirManutencao('${m.id}')">
                <i class="fa-solid fa-check"></i>
               </button>`
            : ''}
          <button class="btn-icon-sm" title="Editar" onclick="editarManutencao('${m.id}')">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn-icon-sm del" title="Excluir" onclick="deletarManutencao('${m.id}','${(m.equipamento_nome||'').replace(/'/g,"\\'")}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>`).join('');
}

// ── Modal ─────────────────────────────────────────────────────
function abrirModal(modo = 'novo', dados = null) {
  modoEdicao = modo === 'editar';
  modalTitle.textContent = modoEdicao ? 'Editar Manutenção' : 'Nova Manutenção';
  manForm.reset();
  manId.value = '';
  atualizarWrap.style.display = 'none';

  if (modoEdicao && dados) {
    manId.value = dados.id;
    F('fEquipamento').value = dados.equipamento_id    || '';
    F('fTipo').value        = dados.tipo              || 'Preventiva';
    F('fStatusMan').value   = dados.status_manutencao || 'Agendada';
    F('fAgendamento').value = dados.data_agendamento  || '';
    F('fExecucao').value    = dados.data_execucao     || '';
    F('fDescricao').value   = dados.descricao         || '';
    F('fObsMan').value      = dados.observacoes       || '';
    // Mostra opção de sync se for Concluída
    if (F('fStatusMan').value === 'Concluída') atualizarWrap.style.display = 'block';
  }

  modalOverlay.classList.add('open');
  F('fEquipamento').focus();
}

F('fStatusMan').addEventListener('change', () => {
  atualizarWrap.style.display = F('fStatusMan').value === 'Concluída' ? 'block' : 'none';
  if (F('fStatusMan').value === 'Concluída' && !F('fExecucao').value) {
    F('fExecucao').value = new Date().toISOString().split('T')[0];
  }
});

function fecharModal() { modalOverlay.classList.remove('open'); }

document.getElementById('btnNovaManutencao').addEventListener('click', () => abrirModal('novo'));
document.getElementById('modalClose').addEventListener('click', fecharModal);
document.getElementById('btnCancelar').addEventListener('click', fecharModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) fecharModal(); });

// Confirm
function abrirConfirm(id, nome) {
  manIdParaDeletar = id;
  confirmText.textContent = `Excluindo manutenção do equipamento "${nome}". Esta ação não pode ser desfeita.`;
  confirmOverlay.classList.add('open');
}
function fecharConfirm() { confirmOverlay.classList.remove('open'); manIdParaDeletar = null; }
document.getElementById('btnConfirmNao').addEventListener('click', fecharConfirm);
confirmOverlay.addEventListener('click', (e) => { if (e.target === confirmOverlay) fecharConfirm(); });

// ── Salvar ────────────────────────────────────────────────────
manForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const equipId  = F('fEquipamento').value;
  const descricao = F('fDescricao').value.trim();
  if (!equipId)   { showToast('Selecione um equipamento.', 'warning'); return; }
  if (!descricao) { showToast('Informe a descrição do serviço.', 'warning'); return; }

  const equipSel = todosEquipamentos.find(eq => eq.id === equipId);
  const btnSalvar = F('btnSalvar');
  btnSalvar.disabled = true;
  btnSalvar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

  const dados = {
    equipamento_id:    equipId,
    equipamento_nome:  equipSel?.nome || '',
    tipo:              F('fTipo').value,
    status_manutencao: F('fStatusMan').value,
    data_agendamento:  F('fAgendamento').value || null,
    data_execucao:     F('fExecucao').value    || null,
    descricao,
    observacoes:       F('fObsMan').value.trim(),
  };

  try {
    if (modoEdicao) {
      await updateDoc(doc(db, 'manutencoes', manId.value), {
        ...dados, data_atualizacao: serverTimestamp()
      });
      showToast('Manutenção atualizada com sucesso!');
    } else {
      await addDoc(collection(db, 'manutencoes'), {
        ...dados, data_cadastro: serverTimestamp()
      });
      showToast('Manutenção cadastrada com sucesso!');
    }

    // ── SINCRONIZAÇÃO DE STATUS DO EQUIPAMENTO ──
    // Se a manutenção está ativa (Agendada/Pendente), o PC vai para "Em Manutenção"
    // Se foi concluída agora, o PC volta para "Em Estoque"
    let novoStatusEquip = null;
    if (dados.status_manutencao === 'Concluída') {
        novoStatusEquip = 'Em Estoque';
    } else {
        novoStatusEquip = 'Em Manutenção';
    }

    if (novoStatusEquip) {
        await updateDoc(doc(db, 'equipamentos', equipId), {
            status: novoStatusEquip,
            data_atualizacao: serverTimestamp()
        });
    }

    // Sincronizar próxima manutenção no equipamento (se Concluída)
    if (dados.status_manutencao === 'Concluída' && F('chkAtualizarEquip').checked && dados.data_execucao) {
      const equipDoc = todosEquipamentos.find(eq => eq.id === equipId);
      const intervalo = equipDoc?.manutencao_preventiva?.intervalo_dias;
      if (intervalo) {
        const proxima = new Date(dados.data_execucao + 'T00:00:00');
        proxima.setDate(proxima.getDate() + intervalo);
        const proximaStr = proxima.toISOString().split('T')[0];
        await updateDoc(doc(db, 'equipamentos', equipId), {
          'manutencao_preventiva.ultima_manutencao':  dados.data_execucao,
          'manutencao_preventiva.proxima_manutencao': proximaStr,
        });
        showToast(`Próxima manutenção do equipamento atualizada para ${proxima.toLocaleDateString('pt-BR')}.`);
      }
    }

    fecharModal();
  } catch (err) {
    console.error(err);
    showToast('Erro ao salvar. Verifique o Firebase.', 'error');
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar';
  }
});

// ── Concluir rápido ───────────────────────────────────────────
window.concluirManutencao = async (id) => {
  const man = todasManutencoes.find(m => m.id === id);
  if (!man) return;
  try {
    const hoje = new Date().toISOString().split('T')[0];
    await updateDoc(doc(db, 'manutencoes', id), {
      status_manutencao: 'Concluída',
      data_execucao:     hoje,
      data_atualizacao:  serverTimestamp()
    });
    // Atualizar equipamento automaticamente
    if (man.equipamento_id) {
      const equipDoc = todosEquipamentos.find(eq => eq.id === man.equipamento_id);
      const intervalo = equipDoc?.manutencao_preventiva?.intervalo_dias;
      if (intervalo) {
        const proxima = new Date(hoje + 'T00:00:00');
        proxima.setDate(proxima.getDate() + intervalo);
        await updateDoc(doc(db, 'equipamentos', man.equipamento_id), {
          'manutencao_preventiva.ultima_manutencao':  hoje,
          'manutencao_preventiva.proxima_manutencao': proxima.toISOString().split('T')[0],
          'status': 'Em Estoque',
          'data_atualizacao': serverTimestamp()
        });
      } else {
        // Mesmo sem intervalo, volta o status para Estoque
        // ── ATUALIZA DATA DA ÚLTIMA MANUTENÇÃO NO EQUIPAMENTO ──
        const equipRef = doc(db, 'equipamentos', man.equipamento_id);
        await updateDoc(equipRef, {
          status: 'Em Estoque', // Garante que volta pro estoque ao concluir
          data_ultima_manutencao: serverTimestamp()
        });
      }
    }
    showToast('Manutenção marcada como Concluída!');
  } catch (err) {
    console.error(err);
    showToast('Erro ao concluir.', 'error');
  }
};

// ── Editar ────────────────────────────────────────────────────
window.editarManutencao = (id) => {
  const man = todasManutencoes.find(m => m.id === id);
  if (man) abrirModal('editar', man);
};

// ── Deletar ───────────────────────────────────────────────────
window.deletarManutencao = (id, nome) => abrirConfirm(id, nome);

document.getElementById('btnConfirmSim').addEventListener('click', async () => {
  if (!manIdParaDeletar) return;
  const btn = F('btnConfirmSim');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  try {
    await deleteDoc(doc(db, 'manutencoes', manIdParaDeletar));
    showToast('Manutenção excluída.', 'warning');
    fecharConfirm();
  } catch (err) {
    console.error(err);
    showToast('Erro ao excluir.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-trash"></i> Excluir';
  }
});

// ── Exportar CSV ──────────────────────────────────────────────
document.getElementById('btnExportar').addEventListener('click', () => {
  const lista = filtradas.length ? filtradas : todasManutencoes;
  if (!lista.length) { showToast('Nenhum dado para exportar.', 'warning'); return; }

  const headers = ['Equipamento','Tipo','Descrição','Agendamento','Execução','Status','Observações'];
  const rows = lista.map(m => [
    m.equipamento_nome, m.tipo, m.descricao,
    formatDate(m.data_agendamento), formatDate(m.data_execucao),
    m.status_manutencao, m.observacoes
  ].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(','));

  const csv  = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `manutencoes_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`${lista.length} registros exportados!`);
});

// ── Listeners Firestore ───────────────────────────────────────
// Equipamentos (para popular selects)
onSnapshot(
  query(collection(db, 'equipamentos'), orderBy('nome')),
  (snap) => {
    todosEquipamentos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    atualizarSelectEquipamentos();
  }
);

// Manutenções (tempo real)
onSnapshot(
  query(collection(db, 'manutencoes'), orderBy('data_agendamento', 'desc')),
  (snap) => {
    todasManutencoes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    aplicarFiltros();
  },
  (err) => {
    console.error(err);
    document.getElementById('connectionStatus').textContent = 'Erro';
    document.querySelector('.status-dot').style.background = '#ef4444';
    showToast('Erro ao conectar ao Firebase.', 'error');
  }
);
