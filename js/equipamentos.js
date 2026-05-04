// ============================================================
//  equipamentos.js — CRUD completo de Equipamentos
// ============================================================
import { db } from './firebase-config.js';
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";

// ── Estado ───────────────────────────────────────────────────
let todosEquipamentos = [];
let todosPerifericos = [];
let equipIdParaDeletar = null;
let modoEdicao = false;

// ── DOM refs ─────────────────────────────────────────────────
const tbody        = document.getElementById('equipTableBody');
const countDisplay = document.getElementById('countDisplay');
const subtitleCount= document.getElementById('subtitleCount');
const searchInput  = document.getElementById('searchInput');
const filterStatus = document.getElementById('filterStatus');
const filterSetor  = document.getElementById('filterSetor');

const kTotal     = document.getElementById('kTotal');
const kEmUso     = document.getElementById('kEmUso');
const kEstoque   = document.getElementById('kEstoque');
const kManutencao= document.getElementById('kManutencao');

// Modal form
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle   = document.getElementById('modalTitle');
const equipForm    = document.getElementById('equipForm');
const equipId      = document.getElementById('equipId');

// Campos do formulário
const F = (id) => document.getElementById(id);

// Confirm modal
const confirmOverlay = document.getElementById('confirmOverlay');
const confirmText    = document.getElementById('confirmText');

// ── Abrir / Fechar Modais ─────────────────────────────────────
function abrirModal(modo = 'novo', dados = null) {
  modoEdicao = modo === 'editar';
  modalTitle.textContent = modoEdicao ? 'Editar Equipamento' : 'Novo Equipamento';

  equipForm.reset();
  equipId.value = '';

  if (modoEdicao && dados) {
    equipId.value = dados.id;
    F('fNome').value  = dados.nome || '';
    F('fMarca').value = dados.marca || '';
    F('fModelo').value= dados.modelo || '';
    F('fNumSerie').value = dados.num_serie || '';
    F('fPatrimonio').value = dados.patrimonio || '';
    F('fStatus').value    = dados.status || 'Em Estoque';
    F('fSetor').value     = dados.setor_atual || '';
    F('fUsuario').value   = dados.usuario_atual || '';
    F('fMac').value       = dados.mac_address || '';
    F('fNomePc').value    = dados.nome_pc || '';
    F('fObs').value       = dados.observacoes || '';
    const mp = dados.manutencao_preventiva || {};
    F('fIntervalo').value         = mp.intervalo_dias || '';
    F('fUltimaManutencao').value  = mp.ultima_manutencao || '';
    F('fProximaManutencao').value = mp.proxima_manutencao || '';
  }

  modalOverlay.classList.add('open');
  F('fNome').focus();
}

function fecharModal() {
  modalOverlay.classList.remove('open');
}

function abrirConfirm(id, nome) {
  equipIdParaDeletar = id;
  confirmText.textContent = `Você está prestes a excluir "${nome}". Esta ação não pode ser desfeita.`;
  confirmOverlay.classList.add('open');
}

function fecharConfirm() {
  confirmOverlay.classList.remove('open');
  equipIdParaDeletar = null;
}

// ── Eventos dos botões ────────────────────────────────────────
document.getElementById('btnNovoEquipamento').addEventListener('click', () => abrirModal('novo'));
document.getElementById('modalClose').addEventListener('click', fecharModal);
document.getElementById('btnCancelar').addEventListener('click', fecharModal);
document.getElementById('btnConfirmNao').addEventListener('click', fecharConfirm);

modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) fecharModal(); });
confirmOverlay.addEventListener('click', (e) => { if (e.target === confirmOverlay) fecharConfirm(); });

// Calcular próxima manutenção automaticamente
F('fUltimaManutencao').addEventListener('change', calcularProxima);
F('fIntervalo').addEventListener('input', calcularProxima);

function calcularProxima() {
  const ultima = F('fUltimaManutencao').value;
  const intervalo = parseInt(F('fIntervalo').value);
  if (ultima && intervalo > 0) {
    const data = new Date(ultima + 'T00:00:00');
    data.setDate(data.getDate() + intervalo);
    F('fProximaManutencao').value = data.toISOString().split('T')[0];
  }
}

// ── Exportar CSV ──────────────────────────────────────────────
document.getElementById('btnExportar').addEventListener('click', () => {
  if (!todosEquipamentos.length) {
    showToast('Nenhum dado para exportar.', 'warning');
    return;
  }
  const headers = ['Nome','Marca','Modelo','Nº Série','Patrimônio','Status','Setor','Usuário','MAC Address','Nome PC','Próx. Manutenção','Observações'];
  const rows = todosEquipamentos.map(e => [
    e.nome, e.marca, e.modelo, e.num_serie, e.patrimonio,
    e.status, e.setor_atual, e.usuario_atual, e.mac_address, e.nome_pc,
    e.manutencao_preventiva?.proxima_manutencao || '',
    e.observacoes
  ].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(','));

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `equipamentos_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exportado com sucesso!');
});

// ── Filtros e Busca ───────────────────────────────────────────
function filtrarEExibir() {
  const termo   = searchInput.value.toLowerCase().trim();
  const status  = filterStatus.value;
  const setor   = filterSetor.value;

  let filtrados = todosEquipamentos.filter(e => {
    const matchTermo =
      !termo ||
      (e.nome        || '').toLowerCase().includes(termo) ||
      (e.modelo      || '').toLowerCase().includes(termo) ||
      (e.num_serie   || '').toLowerCase().includes(termo) ||
      (e.patrimonio  || '').toLowerCase().includes(termo) ||
      (e.marca       || '').toLowerCase().includes(termo) ||
      (e.nome_pc     || '').toLowerCase().includes(termo);
    const matchStatus = !status || e.status === status;
    const matchSetor  = !setor  || e.setor_atual === setor;
    return matchTermo && matchStatus && matchSetor;
  });

  renderTabela(filtrados);
}

searchInput.addEventListener('input', filtrarEExibir);
filterStatus.addEventListener('change', filtrarEExibir);
filterSetor.addEventListener('change', filtrarEExibir);

// ── Renderizar Tabela ─────────────────────────────────────────
function statusBadge(status) {
  const map = {
    'Em Uso':       'badge-success',
    'Em Estoque':   'badge-accent',
    'Em Manutenção':'badge-warning',
  };
  return `<span class="badge ${map[status] || 'badge-muted'}">${status || '—'}</span>`;
}

function manutencaoLabel(proxima) {
  if (!proxima) return '<span class="text-muted text-sm">—</span>';
  const hoje = new Date();
  const data = new Date(proxima + 'T00:00:00');
  const diff = Math.ceil((data - hoje) / (1000 * 60 * 60 * 24));
  const fmt  = data.toLocaleDateString('pt-BR');

  if (diff < 0)   return `<span class="badge badge-danger"><i class="fa-solid fa-circle-xmark"></i> Vencida (${fmt})</span>`;
  if (diff <= 7)  return `<span class="badge badge-warning"><i class="fa-solid fa-triangle-exclamation"></i> ${fmt}</span>`;
  return `<span class="text-sm" style="color:var(--text-secondary);">${fmt}</span>`;
}

function renderTabela(lista) {
  countDisplay.textContent = lista.length;

  if (!lista.length) {
    tbody.innerHTML = `
      <tr><td colspan="6">
        <div class="empty-state">
          <i class="fa-solid fa-magnifying-glass"></i>
          <h3>Nenhum equipamento encontrado</h3>
          <p>Tente ajustar os filtros ou cadastre um novo ativo.</p>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(e => `
    <tr>
      <td>
        <div class="equip-name">${e.nome || '—'}</div>
        <div class="equip-meta">${e.marca || ''}${e.modelo ? ' · ' + e.modelo : ''}</div>
      </td>
      <td>
        <div style="font-size:13px;">${e.num_serie || '—'}</div>
        <div class="equip-meta">${e.patrimonio ? 'Pat: ' + e.patrimonio : ''}</div>
        
        <!-- Exibição do Kit (Periféricos Vinculados) -->
        <div class="kit-container" style="margin-top:6px; display:flex; flex-wrap:wrap; gap:4px;">
          ${todosPerifericos.filter(p => p.equipamento_id === e.id).map(p => `
            <span class="badge badge-muted" style="font-size:9px; padding:1px 6px; border:1px solid var(--border-strong);">
              <i class="fa-solid fa-microchip" style="font-size:8px;"></i> ${p.nome}
            </span>
          `).join('')}
        </div>
      </td>
      <td>${statusBadge(e.status)}</td>
      <td>
        <div>${e.usuario_atual || '—'}</div>
        <div class="equip-meta">${e.setor_atual || ''}</div>
      </td>
      <td>${manutencaoLabel(e.manutencao_preventiva?.proxima_manutencao)}</td>
      <td style="text-align:center;">
        <div class="action-btns" style="justify-content:center;">
          ${e.status === 'Em Uso' 
          ? `<button class="btn-icon-sm done" title="Finalizar Uso" onclick="finalizarUso('${e.id}')">
              <i class="fa-solid fa-right-from-bracket"></i>
             </button>`
          : e.status === 'Em Estoque'
            ? `<button class="btn-icon-sm" style="color:var(--success); border-color:var(--success-light);" title="Iniciar Uso" onclick="abrirLoginManual('${e.id}')">
                <i class="fa-solid fa-right-to-bracket"></i>
               </button>`
            : ''
        }
        <button class="btn-icon-sm" title="Editar" onclick="editarEquipamento('${e.id}')">
          <i class="fa-solid fa-pen"></i>
        </button>
          <button class="btn-icon-sm del" title="Excluir" onclick="deletarEquipamento('${e.id}','${(e.nome||'').replace(/'/g,"\\'")}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>`).join('');
}

// ── Finalizar Uso (Logoff Manual) ─────────────────────────────
window.finalizarUso = async (id) => {
  const e = todosEquipamentos.find(item => item.id === id);
  if (!e) return;

  if (!confirm(`Deseja finalizar o uso de "${e.nome}" pelo usuário "${e.usuario_atual}"?`)) return;

  try {
    const agora = new Date();
    
    // 1. Atualizar Equipamento
    await updateDoc(doc(db, 'equipamentos', id), {
      status: 'Em Estoque',
      usuario_atual: '',
      setor_atual: '',
      data_atualizacao: serverTimestamp()
    });

    // 2. Gerar Movimentação de Logoff
    await addDoc(collection(db, 'movimentacoes'), {
      equipamento_id: id,
      nome_pc: e.nome_pc || '',
      mac_address: e.mac_address || '',
      usuario_nome: e.usuario_atual || 'N/A',
      usuario_setor: e.setor_atual || 'N/A',
      acao: 'logoff',
      timestamp: serverTimestamp(),
      origem: 'painel_web'
    });

    showToast(`Uso de "${e.nome}" finalizado com sucesso!`);
  } catch (err) {
    console.error(err);
    showToast('Erro ao finalizar uso.', 'error');
  }
};

// ── Atualizar KPIs e Setor Filter ────────────────────────────
function atualizarKpisEFiltros(lista) {
  let total = 0, emUso = 0, estoque = 0, manutencao = 0;
  const setores = new Set();
  lista.forEach(e => {
    total++;
    if (e.status === 'Em Uso')           emUso++;
    else if (e.status === 'Em Estoque')  estoque++;
    else if (e.status === 'Em Manutenção') manutencao++;
    if (e.setor_atual) setores.add(e.setor_atual);
  });

  kTotal.textContent      = total;
  kEmUso.textContent      = emUso;
  kEstoque.textContent    = estoque;
  kManutencao.textContent = manutencao;
  subtitleCount.textContent = `${total} ativo(s) cadastrado(s)`;

  // Atualiza select de setor preservando seleção atual
  const setorAtual = filterSetor.value;
  filterSetor.innerHTML = '<option value="">Todos os setores</option>';
  [...setores].sort().forEach(s => {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    if (s === setorAtual) opt.selected = true;
    filterSetor.appendChild(opt);
  });
}

// ── Listener Firestore (tempo real) ──────────────────────────
const q = query(collection(db, 'equipamentos'), orderBy('data_cadastro', 'desc'));

onSnapshot(q, (snap) => {
  todosEquipamentos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  atualizarKpisEFiltros(todosEquipamentos);
  filtrarEExibir();
}, (err) => {
  console.error(err);
  showToast('Erro ao carregar dados do Firebase.', 'error');
  document.getElementById('connectionStatus').textContent = 'Erro';
  document.querySelector('.status-dot').style.background = '#ef4444';
});

// Listener de Periféricos (para atualizar os kits em tempo real)
onSnapshot(collection(db, 'perifericos'), (snap) => {
  todosPerifericos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  filtrarEExibir();
});

// ── Salvar (criar ou editar) ──────────────────────────────────
equipForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const nome = F('fNome').value.trim();
  if (!nome) { showToast('O campo "Nome" é obrigatório.', 'warning'); return; }

  const btnSalvar = document.getElementById('btnSalvar');
  btnSalvar.disabled = true;
  btnSalvar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

  const dados = {
    nome:          F('fNome').value.trim(),
    marca:         F('fMarca').value.trim(),
    modelo:        F('fModelo').value.trim(),
    num_serie:     F('fNumSerie').value.trim(),
    patrimonio:    F('fPatrimonio').value.trim(),
    status:        F('fStatus').value,
    setor_atual:   F('fSetor').value.trim(),
    usuario_atual: F('fUsuario').value.trim(),
    mac_address:   F('fMac').value.trim().toUpperCase(),
    nome_pc:       F('fNomePc').value.trim().toUpperCase(),
    observacoes:   F('fObs').value.trim(),
    manutencao_preventiva: {
      intervalo_dias:      parseInt(F('fIntervalo').value) || null,
      ultima_manutencao:   F('fUltimaManutencao').value || null,
      proxima_manutencao:  F('fProximaManutencao').value || null,
    }
  };

  try {
    if (modoEdicao) {
      const id = equipId.value;
      await updateDoc(doc(db, 'equipamentos', id), {
        ...dados,
        data_atualizacao: serverTimestamp()
      });
      showToast('Equipamento atualizado com sucesso!');
      const docRef = await addDoc(collection(db, 'equipamentos'), {
        ...dados,
        data_cadastro: serverTimestamp(),
        data_ultima_ativacao: null,
        matricula_atual: null
      });
      showToast('Equipamento cadastrado com sucesso!');
      await registrarMovimentacao(docRef.id, 'ativacao', 'Equipamento cadastrado manualmente');
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

// ── Editar (exposto globalmente) ──────────────────────────────
window.editarEquipamento = (id) => {
  const equip = todosEquipamentos.find(e => e.id === id);
  if (equip) abrirModal('editar', equip);
};

// ── Deletar ───────────────────────────────────────────────────
window.deletarEquipamento = (id, nome) => abrirConfirm(id, nome);

document.getElementById('btnConfirmSim').addEventListener('click', async () => {
  if (!equipIdParaDeletar) return;
  const btn = document.getElementById('btnConfirmSim');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  try {
    await deleteDoc(doc(db, 'equipamentos', equipIdParaDeletar));
    showToast('Equipamento excluído.', 'warning');
    fecharConfirm();
  } catch (err) {
    console.error(err);
    showToast('Erro ao excluir.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-trash"></i> Excluir';
  }
});

// ── Registro de Movimentação ──────────────────────────────────
async function registrarMovimentacao(equipId, acao, obs = '') {
  try {
    const equip = todosEquipamentos.find(e => e.id === equipId);
    await addDoc(collection(db, 'movimentacoes'), {
      equipamento_id:   equipId,
      equipamento_nome: equip?.nome || F('fNome').value || 'Novo Equipamento',
      usuario_nome:     'Sistema',
      usuario_setor:    equip?.setor_atual || F('fSetor').value || 'TI',
      acao:             acao,
      nome_pc:          equip?.nome_pc || F('fNomePc').value || '',
      mac_address:      equip?.mac_address || F('fMac').value || '',
      origem:           'painel_web',
      observacoes:      obs,
      timestamp:        serverTimestamp()
    });
  } catch (err) { console.error('Erro ao registrar log:', err); }
}

// ── Login Manual via Web ─────────────────────────────────────
window.abrirLoginManual = (id) => {
  document.getElementById('loginEquipId').value = id;
  document.getElementById('loginManualOverlay').classList.add('open');
};

window.fecharLoginManual = () => {
  document.getElementById('loginManualOverlay').classList.remove('open');
  document.getElementById('loginManualForm').reset();
};

document.getElementById('loginManualForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('loginEquipId').value;
  const user = document.getElementById('lUsuario').value.trim();
  const setor = document.getElementById('lSetor').value.trim();
  
  try {
    const equip = todosEquipamentos.find(item => item.id === id);
    await updateDoc(doc(db, 'equipamentos', id), {
      status: 'Em Uso',
      usuario_atual: user,
      setor_atual: setor,
      data_ultima_ativacao: serverTimestamp(),
      data_atualizacao: serverTimestamp()
    });

    // Registrar no Histórico
    await addDoc(collection(db, 'movimentacoes'), {
      equipamento_id:   id,
      equipamento_nome: equip?.nome || 'Manual',
      usuario_nome:     user,
      usuario_setor:    setor,
      acao:             'login',
      origem:           'painel_web',
      nome_pc:          equip?.nome_pc || '',
      mac_address:      equip?.mac_address || '',
      timestamp:        serverTimestamp()
    });

    showToast(`Uso iniciado para ${user}!`);
    fecharLoginManual();
  } catch (err) {
    console.error(err);
    showToast('Erro ao processar login manual.', 'error');
  }
});

F('refreshBtn').addEventListener('click', () => location.reload());
