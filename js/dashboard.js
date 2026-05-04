// ============================================================
//  dashboard.js — Lógica do Dashboard Principal
// ============================================================
import { db } from './firebase-config.js';
import {
  collection, onSnapshot, query, orderBy, limit, where, Timestamp
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";

// ── Referências DOM ──────────────────────────────────────────
const kpiTotal      = document.getElementById('kpiTotal');
const kpiEmUso      = document.getElementById('kpiEmUso');
const kpiEstoque    = document.getElementById('kpiEstoque');
const kpiManutencao = document.getElementById('kpiManutencao');
const alertsList    = document.getElementById('alertsList');
const alertBadge    = document.getElementById('alertBadge');
const movBody       = document.getElementById('movimentacoesBody');
const lastUpdate    = document.getElementById('lastUpdate');
const connStatus    = document.getElementById('connectionStatus');

// ── Gráfico de Status ────────────────────────────────────────
let statusChart = null;

function initChart(emUso, estoque, manutencao) {
  const ctx = document.getElementById('statusChart').getContext('2d');
  const data = {
    labels: ['Em Uso', 'Em Estoque', 'Em Manutenção'],
    datasets: [{
      data: [emUso, estoque, manutencao],
      backgroundColor: [
        'rgba(16,185,129,0.85)',
        'rgba(99,102,241,0.85)',
        'rgba(245,158,11,0.85)'
      ],
      borderColor: [
        'rgba(16,185,129,1)',
        'rgba(99,102,241,1)',
        'rgba(245,158,11,1)'
      ],
      borderWidth: 2,
      hoverOffset: 8
    }]
  };

  if (statusChart) {
    statusChart.data.datasets[0].data = [emUso, estoque, manutencao];
    statusChart.update();
    return;
  }

  statusChart = new Chart(ctx, {
    type: 'doughnut',
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#94a3b8',
            padding: 16,
            font: { family: 'Inter', size: 12 },
            usePointStyle: true,
            pointStyleWidth: 8
          }
        },
        tooltip: {
          backgroundColor: '#1e2438',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          titleColor: '#e2e8f0',
          bodyColor: '#94a3b8',
          padding: 12,
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.raw} equipamento(s)`
          }
        }
      }
    }
  });
}

// ── Carregar Equipamentos (tempo real) ───────────────────────
function loadEquipamentos() {
  const q = collection(db, 'equipamentos');

  onSnapshot(q, (snap) => {
    let total = 0, emUso = 0, estoque = 0, manutencao = 0;
    const hoje = new Date();
    const em7dias = new Date();
    em7dias.setDate(hoje.getDate() + 7);

    const alertas = [];

    snap.forEach(doc => {
      const d = doc.data();
      total++;
      if (d.status === 'Em Uso')         emUso++;
      else if (d.status === 'Em Estoque') estoque++;
      else if (d.status === 'Em Manutenção') manutencao++;

      // Verificar manutenção preventiva
      const proxima = d.manutencao_preventiva?.proxima_manutencao;
      if (proxima) {
        const dataProxima = new Date(proxima + 'T00:00:00');
        if (dataProxima <= em7dias) {
          const vencida = dataProxima < hoje;
          alertas.push({
            nome: d.nome || 'Sem nome',
            patrimonio: d.patrimonio || '—',
            proxima,
            vencida
          });
        }
      }
    });

    // Atualiza KPIs
    kpiTotal.textContent      = total;
    kpiEmUso.textContent      = emUso;
    kpiEstoque.textContent    = estoque;
    kpiManutencao.textContent = manutencao;

    // Atualiza gráfico
    initChart(emUso, estoque, manutencao);

    // Atualiza alertas
    renderAlertas(alertas);

    // Atualiza status de conexão e timestamp
    connStatus.textContent = 'Conectado';
    const now = new Date();
    lastUpdate.textContent = `Atualizado em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}`;

  }, (err) => {
    console.error('Erro ao carregar equipamentos:', err);
    connStatus.textContent = 'Erro de conexão';
    connStatus.parentElement.style.borderColor = 'rgba(239,68,68,0.5)';
    document.querySelector('.status-dot').style.background = '#ef4444';
    document.querySelector('.status-dot').style.boxShadow = '0 0 6px #ef4444';
    showToast('Erro ao conectar ao Firebase. Verifique as credenciais.', 'error');
  });
}

// ── Renderizar Alertas ───────────────────────────────────────
function renderAlertas(alertas) {
  alertBadge.style.display = alertas.length ? 'flex' : 'none';
  alertBadge.textContent   = alertas.length;

  if (!alertas.length) {
    alertsList.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-circle-check" style="color:var(--success);opacity:1;font-size:32px;margin-bottom:12px;"></i>
        <h3>Nenhum alerta pendente</h3>
        <p>Todas as manutenções preventivas estão em dia.</p>
      </div>`;
    return;
  }

  alertsList.innerHTML = alertas.map(a => {
    const tipo = a.vencida ? 'danger' : 'warning';
    const label = a.vencida ? 'Vencida' : 'Vence em breve';
    const icon  = a.vencida ? 'fa-circle-xmark' : 'fa-triangle-exclamation';
    const dataFmt = new Date(a.proxima + 'T00:00:00').toLocaleDateString('pt-BR');
    return `
      <div class="alert-box ${tipo}">
        <i class="fa-solid ${icon}"></i>
        <div class="alert-body">
          <strong>${a.nome}</strong>
          — Patrimônio: ${a.patrimonio}
          <br><span><i class="fa-regular fa-calendar" style="margin-right:4px;"></i>${label}: ${dataFmt}</span>
        </div>
        <span class="badge badge-${tipo}" style="margin-left:auto;white-space:nowrap;">${label}</span>
      </div>`;
  }).join('');
}

// ── Carregar Movimentações Recentes ──────────────────────────
function loadMovimentacoes() {
  const q = query(
    collection(db, 'movimentacoes'),
    orderBy('timestamp', 'desc'),
    limit(8)
  );

  onSnapshot(q, (snap) => {
    if (snap.empty) {
      movBody.innerHTML = `
        <tr><td colspan="5">
          <div class="empty-state">
            <i class="fa-solid fa-clock-rotate-left"></i>
            <h3>Nenhuma movimentação registrada</h3>
            <p>As ativações dos PCs aparecerão aqui automaticamente.</p>
          </div>
        </td></tr>`;
      return;
    }

    movBody.innerHTML = snap.docs.map(doc => {
      const d = doc.data();
      const ts = d.timestamp?.toDate ? d.timestamp.toDate() : new Date(d.timestamp);
      const dataFmt = ts.toLocaleDateString('pt-BR');
      const horaFmt = ts.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });

      const acaoBadge = {
        'login':      '<span class="badge badge-success">Login</span>',
        'logoff':     '<span class="badge badge-muted">Logoff</span>',
        'ativacao':   '<span class="badge badge-accent">Ativação</span>',
        'manutencao': '<span class="badge badge-warning">Manutenção</span>',
      };

      return `
        <tr>
          <td>
            <div style="font-weight:600;">${d.equipamento_nome || '—'}</div>
            <div style="font-size:11px;color:var(--text-muted);">${d.nome_pc || ''}</div>
          </td>
          <td>
            <div>${d.usuario_nome || '—'}</div>
            <div style="font-size:11px;color:var(--text-muted);">Mat: ${d.usuario_matricula || '—'}</div>
          </td>
          <td><span class="badge badge-muted">${d.usuario_setor || '—'}</span></td>
          <td>${acaoBadge[d.acao] || `<span class="badge badge-muted">${d.acao}</span>`}</td>
          <td>
            <div>${dataFmt}</div>
            <div style="font-size:11px;color:var(--text-muted);">${horaFmt}</div>
          </td>
        </tr>`;
    }).join('');
  }, (err) => {
    console.error('Erro ao carregar movimentações:', err);
  });
}

// ── Inicialização ────────────────────────────────────────────
loadEquipamentos();
loadMovimentacoes();
