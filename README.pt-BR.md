🌐 [English](README.md) | **Português**

# Gestão de Ativos de TI

> Sistema de gestão de ativos de TI em tempo real, que eu desenvolvi e mantenho como único profissional de TI de uma empresa de bombas diesel no Brasil.

Antes deste projeto, a empresa controlava computadores, periféricos e manutenções em planilhas espalhadas. Ninguém sabia ao certo qual máquina estava onde, quem estava usando ou quando foi a última manutenção.

O sistema substitui isso por um painel web único e um agente leve para Windows que cadastra cada computador automaticamente.

## O que ele faz

**Painel web (administrador)**
- **Indicadores ao vivo**: total de ativos, em uso, em estoque e em manutenção, atualizados em tempo real
- **Equipamentos**: cadastro completo com busca e filtros por status e setor
- **Periféricos**: monitores, teclados, impressoras e outros dispositivos vinculados a cada estação
- **Movimentações**: histórico imutável de cada ativação, transferência e manutenção
- **Manutenções**: ordens preventivas e corretivas, com alertas de pendências

**Agente desktop para Windows (Python)**
- Tela de login em modo quiosque: o usuário se identifica antes de usar um computador compartilhado
- **Autocadastro**: lê o endereço MAC e o nome da máquina e cria o registro do ativo na primeira execução
- **Modo offline**: guarda os registros localmente quando a rede cai e sincroniza quando ela volta
- **Atualização automática**: verifica a versão publicada e se atualiza sozinho
- Roda com prioridade baixa de processo para não deixar o computador lento

**App de acesso para tablet (Kivy)**: o mesmo fluxo de identificação para os tablets Android usados na operação.

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Painel web | HTML, CSS, JavaScript puro (ES modules), Chart.js |
| Banco de dados | Firebase Firestore (atualização em tempo real) |
| Hospedagem | Firebase Hosting |
| Agente desktop | Python, CustomTkinter, `getmac`, API REST do Firestore |
| App de tablet | Python, Kivy |

## Arquitetura

```
Computadores Windows (agente Python) ──┐
                                       ├──► Firestore ◄──► Painel web (admin)
Tablets Android (app Kivy) ────────────┘
```

Cada dispositivo se identifica pelo endereço MAC. Todo login, liberação e manutenção é gravado na coleção `movimentacoes`, que só aceita inclusões (as regras do Firestore bloqueiam edição e exclusão).

## Estrutura do projeto

```
├── index.html, equipamentos.html, perifericos.html,
│   movimentacoes.html, manutencoes.html   # Páginas do painel
├── js/                                    # Um módulo por página + autenticação + config do Firebase
├── css/style.css
├── firestore.rules                        # Regras de acesso ao banco
└── python/
    ├── login_screen.py                    # Agente de quiosque para Windows
    ├── login_screen_lite.py               # Versão leve para computadores antigos
    ├── main.py                            # App Kivy para tablet
    └── build.bat / build-lite.bat         # Geração dos executáveis (PyInstaller)
```

## Como rodar localmente

```bash
# Painel web
npm install -g firebase-tools
firebase login
firebase serve

# Agente desktop
cd python
pip install -r requirements.txt
python login_screen.py
```

## Próximos passos

- [ ] Restringir as regras do Firestore: escrita só para administradores via Firebase Auth e token por dispositivo para o agente
- [ ] Mover os executáveis `.exe` para o GitHub Releases
- [ ] Exportar relatórios (CSV/PDF) para auditoria
- [ ] Controle de garantia e fim de vida útil de cada ativo

## Autor

**Breno Bispo** — Suporte de TI e Automação
[LinkedIn](https://www.linkedin.com/in/breno-bispo-5745411a8/) · [Portfólio / Currículo](https://bbispo368.github.io/desenvolve-introducao-web/CV/CV)
