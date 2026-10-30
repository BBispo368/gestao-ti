🌐 **English** | [Português](README.pt-BR.md)

# IT Asset Manager (Gestão de TI)

> A real-time IT asset management system I built and run as the sole IT professional at a diesel-pump service company in Brazil.

Before this project, the company tracked computers, peripherals and maintenance in scattered spreadsheets. Nobody knew for sure which machine was where, who was using it, or when it was last serviced.

This system replaces that with a single web dashboard plus a lightweight Windows agent that registers each PC automatically.

## What it does

**Web dashboard (admin)**
- **Live KPIs**: total assets, in use, in stock and under maintenance, updated in real time
- **Equipment**: full CRUD with search and filters by status and department
- **Peripherals**: monitors, keyboards, printers and other devices linked to each workstation
- **Movements log**: immutable history of every activation, transfer and maintenance event
- **Maintenance**: preventive and corrective work orders, with alerts for pending items

**Windows desktop agent (Python)**
- Full-screen kiosk login: the user identifies themselves before using a shared PC
- **Auto-registration**: reads the machine's MAC address and hostname and creates the asset record on first run
- **Offline mode**: logs are stored locally when the network is down and synced once it comes back
- **Self-update**: checks the published version and updates itself
- Runs at low process priority so it never slows the user down

**Tablet access app (Kivy)**: the same identification flow for Android tablets used on the shop floor.

## Tech stack

| Layer | Technology |
|---|---|
| Web dashboard | HTML, CSS, vanilla JavaScript (ES modules), Chart.js |
| Database | Firebase Firestore (real-time listeners) |
| Hosting | Firebase Hosting |
| Desktop agent | Python, CustomTkinter, `getmac`, Firestore REST API |
| Tablet app | Python, Kivy |

## Architecture

```
Windows PCs (Python agent) ──┐
                             ├──► Firestore ◄──► Web dashboard (admin)
Android tablets (Kivy app) ──┘
```

Each device identifies itself by MAC address. Every login, release and maintenance action is written to the `movimentacoes` collection, which is append-only by design (Firestore rules block updates and deletes).

## Project structure

```
├── index.html, equipamentos.html, perifericos.html,
│   movimentacoes.html, manutencoes.html   # Dashboard pages
├── js/                                    # One module per page + auth + Firebase config
├── css/style.css
├── firestore.rules                        # Database access rules
└── python/
    ├── login_screen.py                    # Windows kiosk agent
    ├── login_screen_lite.py               # Lightweight version for older PCs
    ├── main.py                            # Kivy tablet app
    └── build.bat / build-lite.bat         # PyInstaller builds
```

## Running locally

```bash
# Web dashboard
npm install -g firebase-tools
firebase login
firebase serve

# Desktop agent
cd python
pip install -r requirements.txt
python login_screen.py
```

## Roadmap

- [ ] Lock down Firestore rules: admin-only writes via Firebase Auth, and a per-device token for the agent
- [ ] Move compiled `.exe` builds to GitHub Releases
- [ ] Export reports (CSV/PDF) for audits
- [ ] Warranty and end-of-life tracking per asset

## Author

**Breno Bispo** — IT Support & Automation
[LinkedIn](https://www.linkedin.com/in/breno-bispo-5745411a8/) · [Portfolio / CV](https://bbispo368.github.io/desenvolve-introducao-web/CV/CV)
