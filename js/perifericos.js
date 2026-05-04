import { db } from './firebase-config.js';
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, getDocs
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";

// ── Estado ───────────────────────────────────────────────────
let todosPerifericos = [];
let todosEquipamentos = [];
let periIdParaDeletar = null;
let modoEdicao = false;

// ── DOM refs ─────────────────────────────────────────────────
const tbody        = document.getElementById('periTableBody');
const kTotal       = document.getElementById('kTotal');
const kVinculados  = document.getElementById('kVinculados');
const kAvulsos     = document.getElementById('kAvulsos');
const subtitleCount= document.getElementById('subtitleCount');
const searchInput  = document.getElementById('searchInput');
const filterStatus = document.getElementById('filterStatus');

const modalOverlay = document.getElementById('modalOverlay');
const periForm     = document.getElementById('periForm');
const periId       = document.getElementById('periId');
const fVinculo     = document.getElementById('fVinculo');

// Campos
const F = (id) => document.getElementById(id);

// ── Carregar Opções de Vínculo ─────────────────────────────────
async function carregarEquipamentos() {
  const q = query(collection(db, 'equipamentos'), orderBy('nome'));
  const snap = await getDocs(q);
  todosEquipamentos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  fVinculo.innerHTML = '<option value="">Nenhum (Item Avulso)</option>';
  todosEquipamentos.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.id;
    opt.textContent = `${e.nome} (${e.nome_pc || 'Sem PC'})`;
    fVinculo.appendChild(opt);
  });
}

// ── Abrir Modal ──────────────────────────────────────────────
function abrirModal(modo = 'novo', dados = null) {
  modoEdicao = modo === 'editar';
  F('modalTitle').textContent = modoEdicao ? 'Editar Periférico' : 'Novo Periférico';
  periForm.reset();
  periId.value = '';

  if (modoEdicao && dados) {
    periId.value = dados.id;
    F('fNome').value = dados.nome || '';
    F('fMarca').value = dados.marca || '';
    F('fModelo').value = dados.modelo || '';
    F('fPatrimonio').value = dados.patrimonio || '';
    F('fNumSerie').value = dados.num_serie || '';
    F('fStatus').value = dados.status || 'Em Estoque';
    F('fVinculo').value = dados.equipamento_id || '';
    F('fObs').value = dados.observacoes || '';
  }
  modalOverlay.classList.add('open');
}

function fecharModal() { modalOverlay.classList.remove('open'); }

// ── Renderização ──────────────────────────────────────────────
function statusBadge(status, herdado = false) {
  const map = { 'Em Uso': 'badge-success', 'Em Estoque': 'badge-accent', 'Em Manutenção': 'badge-warning' };
  return `
    <div style="display:flex; flex-direction:column; align-items:flex-start; gap:2px;">
      <span class="badge ${map[status] || 'badge-muted'}">${status || '—'}</span>
      ${herdado ? '<span style="font-size:9px; color:var(--accent); font-weight:600; margin-left:4px;">(Kit)</span>' : ''}
    </div>`;
}

function renderTabela(lista) {
  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">Nenhum item encontrado.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(p => {
    const equip = todosEquipamentos.find(e => e.id === p.equipamento_id);
    
    // Lógica de Prioridade de Status: Se tem vínculo, segue o equipamento
    const statusFinal = equip ? equip.status : p.status;
    const isHerdado = !!equip;

    return `
      <tr>
        <td>
          <div class="equip-name">${p.nome || '—'}</div>
          <div class="equip-meta">${p.marca || ''} ${p.modelo || ''}</div>
        </td>
        <td>
          <div style="font-size:13px;">S/N: ${p.num_serie || '—'}</div>
          <div class="equip-meta">Pat: ${p.patrimonio || '—'}</div>
        </td>
        <td>${statusBadge(statusFinal, isHerdado)}</td>
        <td>
          ${equip ? `
            <div class="vinculo-tag" title="Vinculado a: ${equip.nome}">
              <i class="fa-solid fa-link"></i> ${equip.nome}
            </div>
          ` : '<span class="text-muted text-sm">— Avulso —</span>'}
        </td>
        <td>
          <div class="action-btns" style="justify-content:center;">
            <button class="btn-icon-sm" onclick="editarPeri('${p.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="btn-icon-sm del" onclick="deletarPeri('${p.id}', '${p.nome}')"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function atualizarStats(lista) {
  let total = lista.length;
  let vinculados = lista.filter(p => p.equipamento_id).length;
  kTotal.textContent = total;
  kVinculados.textContent = vinculados;
  kAvulsos.textContent = total - vinculados;
  subtitleCount.textContent = `${total} periférico(s) cadastrado(s)`;
}

function filtrar() {
  const termo = searchInput.value.toLowerCase();
  const statusFiltro = filterStatus.value;

  const filtrados = todosPerifericos.filter(p => {
    // Busca o status herdado se houver vínculo
    const equip = todosEquipamentos.find(e => e.id === p.equipamento_id);
    const statusReal = equip ? equip.status : p.status;

    const matchTermo = !termo || 
      p.nome.toLowerCase().includes(termo) || 
      p.patrimonio.toLowerCase().includes(termo) || 
      p.num_serie.toLowerCase().includes(termo);
      
    const matchStatus = !statusFiltro || statusReal === statusFiltro;
    
    return matchTermo && matchStatus;
  });
  renderTabela(filtrados);
}

// ── CRUD ──────────────────────────────────────────────────────
periForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = F('btnSalvar');
  btn.disabled = true;
  
  const dados = {
    nome: F('fNome').value.trim(),
    marca: F('fMarca').value.trim(),
    modelo: F('fModelo').value.trim(),
    patrimonio: F('fPatrimonio').value.trim(),
    num_serie: F('fNumSerie').value.trim(),
    status: F('fStatus').value,
    equipamento_id: F('fVinculo').value || null,
    observacoes: F('fObs').value.trim(),
    data_atualizacao: serverTimestamp()
  };

  try {
    if (modoEdicao) {
      await updateDoc(doc(db, 'perifericos', periId.value), dados);
      showToast('Periférico atualizado!');
    } else {
      await addDoc(collection(db, 'perifericos'), { ...dados, data_cadastro: serverTimestamp() });
      showToast('Periférico cadastrado!');
    }
    fecharModal();
  } catch (err) {
    console.error(err);
    showToast('Erro ao salvar.', 'error');
  } finally { btn.disabled = false; }
});

window.editarPeri = (id) => {
  const item = todosPerifericos.find(p => p.id === id);
  if (item) abrirModal('editar', item);
};

window.deletarPeri = (id, nome) => {
  periIdParaDeletar = id;
  F('confirmText').textContent = `Deseja excluir "${nome}"?`;
  F('confirmOverlay').classList.add('open');
};

F('btnConfirmSim').addEventListener('click', async () => {
  try {
    await deleteDoc(doc(db, 'perifericos', periIdParaDeletar));
    showToast('Item excluído.', 'warning');
    F('confirmOverlay').classList.remove('open');
  } catch (err) { console.error(err); }
});

// ── Inicialização ──────────────────────────────────────────────
async function init() {
  try {
    await carregarEquipamentos();
  } catch (err) {
    console.error('Erro ao carregar equipamentos:', err);
  }

  const q = query(collection(db, 'perifericos'), orderBy('data_cadastro', 'desc'));
  
  onSnapshot(q, (snap) => {
    todosPerifericos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    atualizarStats(todosPerifericos);
    filtrar();
  }, (err) => {
    console.error('Erro no listener de periféricos:', err);
    // Tenta carregar sem o orderBy caso seja erro de índice
    if (err.code === 'failed-precondition' || err.message.includes('index')) {
      onSnapshot(collection(db, 'perifericos'), (s) => {
        todosPerifericos = s.docs.map(d => ({ id: d.id, ...d.data() }));
        atualizarStats(todosPerifericos);
        filtrar();
      });
    } else {
      tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">Erro ao carregar dados.</div></td></tr>`;
    }
  });
}

init();

F('btnNovoPeriferico').addEventListener('click', () => abrirModal('novo'));
F('modalClose').addEventListener('click', fecharModal);
F('btnCancelar').addEventListener('click', fecharModal);
F('btnConfirmNao').addEventListener('click', () => F('confirmOverlay').classList.remove('open'));
searchInput.addEventListener('input', filtrar);
filterStatus.addEventListener('change', filtrar);
