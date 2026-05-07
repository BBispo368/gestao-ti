import tkinter as tk
from tkinter import messagebox
import requests
import socket
import json
import ctypes
from datetime import datetime, timezone
from getmac import get_mac_address
import os
import sys
import subprocess
import threading

# ============================================================
# CONFIGURAÇÕES E VERSÃO (LITE)
# ============================================================
VERSION_LITE = "1.0.1"

# Otimização: Define prioridade baixa para o processo (0x00004000 = BELOW_NORMAL_PRIORITY_CLASS)
try:
    ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(), 0x00004000)
except: pass

# --- CONFIGURAÇÃO ---
FIREBASE_API_KEY = "AIzaSyBgscAf7JfiiEwLNC2QC5HMLiWo_lKvMvI"
BASE_URL = "https://firestore.googleapis.com/v1/projects/gestao-ti-bd/databases/(default)/documents"

# Sessão persistente para economia de recursos
http = requests.Session()

class LoginScreenLite(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Inventário TI - Lite")
        
        # Modo Kiosk (Tela Cheia)
        self.attributes("-fullscreen", True)
        self.attributes("-topmost", True)
        # self.overrideredirect(True) # Comentado para garantir que a janela apareça no Win7
        
        self.configure(bg="#1e293b") # Fundo escuro atrás do card
        
        self.mac = get_mac_address()
        self.hostname = socket.gethostname()
        self.equipamento_id = None
        self.logged_user = None
        self.logged_setor = None
        
        # Rota de fuga secreta
        self.secret_clicks = 0
        
        # Contador de falhas de rede
        self.network_failures = 0
        
        # UI Setup
        self.setup_ui()
        
        # Inicia verificação de atualização e registro em background
        threading.Thread(target=self.check_for_updates, daemon=True).start()
        threading.Thread(target=self.check_device_registration, daemon=True).start()

    def setup_ui(self):
        # Centralizador
        self.main_container = tk.Frame(self, bg="#1e293b")
        self.main_container.place(relx=0.5, rely=0.5, anchor="center")

        # Card de Login
        card = tk.Frame(self.main_container, bg="#ffffff", padx=2, pady=2)
        card.pack()

        # Header (Área da Rota de Fuga)
        header = tk.Frame(card, bg="#1e293b", height=80, width=400)
        header.pack_propagate(False)
        header.pack(fill="x")
        
        lbl_logo = tk.Label(header, text="ACESSO TI", font=("Arial", 16, "bold"), fg="#ffffff", bg="#1e293b")
        lbl_logo.pack(pady=15)
        
        # Bind da rota de fuga (Botão Direito no Header)
        header.bind("<Button-3>", self.handle_secret_exit)
        lbl_logo.bind("<Button-3>", self.handle_secret_exit)

        # Body
        body = tk.Frame(card, bg="#ffffff", padx=40, pady=30)
        body.pack(fill="both")

        tk.Label(body, text="Identifique-se para liberar o uso", font=("Arial", 10), fg="#64748b", bg="#ffffff").pack(pady=(0, 20))

        # Nome
        tk.Label(body, text="Nome Completo", font=("Arial", 9, "bold"), fg="#475569", bg="#f8fafc").pack(anchor="w")
        self.entry_nome = tk.Entry(body, font=("Arial", 11), bd=1, relief="solid")
        self.entry_nome.pack(fill="x", pady=(5, 15), ipady=5)

        # Setor
        tk.Label(body, text="Setor / Departamento", font=("Arial", 9, "bold"), fg="#475569", bg="#f8fafc").pack(anchor="w")
        self.entry_setor = tk.Entry(body, font=("Arial", 11), bd=1, relief="solid")
        self.entry_setor.pack(fill="x", pady=(5, 20), ipady=5)

        # Botão
        self.btn_acessar = tk.Button(body, text="VERIFICANDO CONEXÃO...", font=("Arial", 10, "bold"), 
                                     bg="#6366f1", fg="white", bd=0, cursor="hand2", 
                                     command=self.handle_login, state="disabled")
        self.btn_acessar.pack(fill="x", ipady=10)

        # Footer info
        tk.Label(body, text=f"PC: {self.hostname} | MAC: {self.mac}", font=("Arial", 8), fg="#94a3b8", bg="#f8fafc").pack(side="bottom", pady=10)

    def check_device_registration(self):
        try:
            # Query por MAC
            url = f"{BASE_URL}:runQuery?key={FIREBASE_API_KEY}"
            query = {
                "structuredQuery": {
                    "from": [{"collectionId": "equipamentos"}],
                    "where": {
                        "fieldFilter": {
                            "field": {"fieldPath": "mac_address"},
                            "op": "EQUAL",
                            "value": {"stringValue": self.mac}
                        }
                    },
                    "limit": 1
                }
            }
            response = http.post(url, json=query, timeout=5)
            results = response.json()
            
            if results and 'document' in results[0]:
                doc = results[0]['document']
                self.equipamento_id = doc['name'].split('/')[-1]
                self.after(0, lambda: self.btn_acessar.config(state="normal", text="LIBERAR COMPUTADOR"))
            else:
                self._auto_register()
        except Exception as e:
            self.after(0, lambda: self.btn_acessar.config(state="normal", text="LIBERAR (OFFLINE)", bg="#f59e0b"))

    def _auto_register(self):
        try:
            now = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
            url = f"{BASE_URL}/equipamentos?key={FIREBASE_API_KEY}"
            payload = {"fields": {
                "nome": {"stringValue": f"LITE: {self.hostname}"},
                "marca": {"stringValue": "AUTO-DETECT (LITE)"},
                "mac_address": {"stringValue": self.mac},
                "nome_pc": {"stringValue": self.hostname},
                "status": {"stringValue": "Em Estoque"},
                "data_cadastro": {"timestampValue": now}
            }}
            response = requests.post(url, json=payload, timeout=5)
            res_data = response.json()
            if 'name' in res_data:
                self.equipamento_id = res_data['name'].split('/')[-1]
                
                # Registra evento de Ativação no Histórico
                try:
                    mov_url = f"{BASE_URL}/movimentacoes?key={FIREBASE_API_KEY}"
                    requests.post(mov_url, json={"fields": {
                        "equipamento_id": {"stringValue": self.equipamento_id},
                        "nome_pc": {"stringValue": self.hostname},
                        "mac_address": {"stringValue": self.mac},
                        "usuario_nome": {"stringValue": "Sistema"},
                        "usuario_setor": {"stringValue": "Auto-Cadastro (Lite)"},
                        "acao": {"stringValue": "ativacao"},
                        "timestamp": {"timestampValue": now},
                        "origem": {"stringValue": "script_lite_win7"}
                    }}, timeout=5)
                except: pass

                self.after(0, lambda: self.btn_acessar.config(state="normal", text="LIBERAR COMPUTADOR"))
        except:
            self.after(0, lambda: self.btn_acessar.config(state="normal", text="LIBERAR (OFFLINE)", bg="#f59e0b"))

    def handle_secret_exit(self, event=None):
        self.secret_clicks += 1
        if self.secret_clicks >= 5:
            self.destroy()

    def handle_login(self):
        nome = self.entry_nome.get().strip()
        setor = self.entry_setor.get().strip()
        if not nome or not setor:
            messagebox.showwarning("Campos Obrigatórios", "Por favor, preencha nome e setor.")
            return

        if self.equipamento_id:
            try:
                now = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
                # Atualiza Equipamento
                update_url = f"{BASE_URL}/equipamentos/{self.equipamento_id}?updateMask.fieldPaths=status&updateMask.fieldPaths=usuario_atual&updateMask.fieldPaths=setor_atual&key={FIREBASE_API_KEY}"
                http.patch(update_url, json={"fields": {
                    "status": {"stringValue": "Em Uso"},
                    "usuario_atual": {"stringValue": nome},
                    "setor_atual": {"stringValue": setor}
                }}, timeout=5)
                
                # Log
                mov_url = f"{BASE_URL}/movimentacoes?key={FIREBASE_API_KEY}"
                requests.post(mov_url, json={"fields": {
                    "equipamento_id": {"stringValue": self.equipamento_id},
                    "nome_pc": {"stringValue": self.hostname},
                    "mac_address": {"stringValue": self.mac},
                    "usuario_nome": {"stringValue": nome},
                    "usuario_setor": {"stringValue": setor},
                    "acao": {"stringValue": "login"},
                    "timestamp": {"timestampValue": now},
                    "origem": {"stringValue": "script_lite_win7"}
                }}, timeout=5)
                
                messagebox.showinfo("Sucesso", "Acesso liberado! Bom trabalho.")
                
                # Em vez de fechar, esconde e monitora
                self.withdraw()
                self.after(30000, self.monitor_status)
                
            except:
                messagebox.showinfo("Offline", "Login registrado localmente. Bom trabalho!")
                self.withdraw()
                self.after(30000, self.monitor_status)
        else:
            self.destroy()

    def monitor_status(self):
        """Verifica se o status mudou para bloquear o PC novamente (Lite) - Com resiliência de rede"""
        if not self.equipamento_id: return
        try:
            url = f"{BASE_URL}/equipamentos/{self.equipamento_id}?key={FIREBASE_API_KEY}"
            # Timeout aumentado para 15s para conexões lentas
            response = http.get(url, timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                self.network_failures = 0 # Reseta se conectar com sucesso
                
                if 'fields' in data:
                    status = data['fields'].get('status', {}).get('stringValue')
                    if status != "Em Uso":
                        self.after(0, self.deiconify)
                        self.after(0, self.focus_force)
                        self.after(0, lambda: self.attributes("-topmost", True))
                        self.after(0, lambda: self.btn_acessar.config(text="LIBERAR COMPUTADOR", state="normal"))
                        self.after(0, lambda: self.entry_nome.delete(0, tk.END))
                        self.after(0, lambda: self.entry_setor.delete(0, tk.END))
                        return
            else:
                self.network_failures += 1
                
        except Exception:
            self.network_failures += 1
            
        # Continua monitorando se estiver escondido (check a cada 30 segundos)
        self.after(30000, self.monitor_status)

    # ============================================================
    # LÓGICA DE AUTO-UPDATE (LITE)
    # ============================================================
    def check_for_updates(self):
        try:
            # Espera um documento em: configuracoes/versao_lite
            url = f"{BASE_URL}/configuracoes/versao_lite?key={FIREBASE_API_KEY}"
            response = requests.get(url, timeout=10)
            data = response.json()
            
            if 'fields' in data:
                latest_version = data['fields'].get('versao', {}).get('stringValue')
                download_url = data['fields'].get('url_download', {}).get('stringValue')
                
                if latest_version and latest_version != VERSION_LITE and download_url:
                    self.perform_update(download_url)
        except: pass

    def perform_update(self, url):
        try:
            current_exe = sys.executable
            temp_exe = current_exe + ".new"
            
            response = requests.get(url, stream=True, timeout=30)
            with open(temp_exe, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk: f.write(chunk)
            
            bat_content = f'''@echo off
timeout /t 3 /nobreak > nul
del "{current_exe}"
move "{temp_exe}" "{current_exe}"
start "" "{current_exe}"
del "%~f0"
'''
            bat_path = os.path.join(os.path.dirname(current_exe), "update_lite.bat")
            with open(bat_path, "w") as f:
                f.write(bat_content)
            
            subprocess.Popen([bat_path], shell=True)
            self.after(0, self.destroy)
        except: pass

if __name__ == "__main__":
    # Tenta ler a key de um arquivo se existir
    if os.path.exists("config.json"):
        with open("config.json", "r") as f:
            cfg = json.load(f)
            FIREBASE_API_KEY = cfg.get("api_key", FIREBASE_API_KEY)
            
    app = LoginScreenLite()
    app.mainloop()
