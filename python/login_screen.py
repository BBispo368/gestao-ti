import tkinter as tk
import customtkinter as ctk
import requests
import json
import socket
import threading
import os
from getmac import get_mac_address
from datetime import datetime

# ============================================================
# CONFIGURAÇÕES DO FIREBASE
# ============================================================
FIREBASE_PROJECT_ID = "gestao-ti-bd"
FIREBASE_API_KEY    = "AIzaSyBgscAf7JfiiEwLNC2QC5HMLiWo_lKvMvI"
BASE_URL = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents"
OFFLINE_FILE = "offline_log.json"

def get_pc_info():
    try:
        mac = get_mac_address().upper()
        hostname = socket.gethostname().upper()
        return mac, hostname
    except:
        return "00:00:00:00:00:00", "UNKNOWN"

class LoginKiosk(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("Sistema de Acesso - Gestão de Ativos")
        self.attributes("-fullscreen", True)
        self.attributes("-topmost", True)
        self.protocol("WM_DELETE_WINDOW", lambda: None)
        
        self.mac, self.hostname = get_pc_info()
        self.equipamento_id = None
        self.is_offline_mode = False
        self.logo_clicks = 0 # Contador para o segredo
        
        # Dados do usuário anterior para auto-logoff
        self.last_user = None
        self.last_setor = None
        self.last_status = None
        
        # Dados do usuário atual (para logoff no shutdown)
        self.logged_user = None
        self.logged_setor = None

        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")

        self.setup_ui()
        
        # Define ícone da janela
        if os.path.exists("app_icon.ico"):
            try: self.iconbitmap("app_icon.ico")
            except: pass
        
        # Tenta sincronizar dados pendentes antes de começar
        threading.Thread(target=self.sync_offline_data, daemon=True).start()
        self.check_registration()

    def setup_ui(self):
        self.main_frame = ctk.CTkFrame(self, width=400, height=500, corner_radius=20)
        self.main_frame.place(relx=0.5, rely=0.5, anchor="center")

        # Label do Logo com evento de clique secreto
        self.title_label = ctk.CTkLabel(self.main_frame, text="💻 ACESSO TI", font=("Inter", 24, "bold"), cursor="hand2")
        self.title_label.pack(pady=(40, 10))
        self.title_label.bind("<Button-1>", self.secret_bypass_click)

        self.subtitle_label = ctk.CTkLabel(self.main_frame, text="Identifique-se para liberar o uso", font=("Inter", 14), text_color="gray")
        self.subtitle_label.pack(pady=(0, 30))

        self.entry_nome = ctk.CTkEntry(self.main_frame, placeholder_text="Nome Completo", width=300, height=45)
        self.entry_nome.pack(pady=10)

        self.entry_setor = ctk.CTkEntry(self.main_frame, placeholder_text="Setor", width=300, height=45)
        self.entry_setor.pack(pady=10)

        self.btn_acessar = ctk.CTkButton(self.main_frame, text="LIBERAR COMPUTADOR", font=("Inter", 14, "bold"), 
                                        width=300, height=50, corner_radius=10, command=self.handle_login)
        self.btn_acessar.pack(pady=(30, 20))

        self.info_label = ctk.CTkLabel(self.main_frame, text=f"PC: {self.hostname} | MAC: {self.mac}", font=("Inter", 10), text_color="gray")
        self.info_label.pack(side="bottom", pady=20)

    def check_registration(self):
        self.btn_acessar.configure(state="disabled", text="VERIFICANDO CONEXÃO...")
        threading.Thread(target=self._query_mac_with_fallback, daemon=True).start()

    def _query_mac_with_fallback(self):
        try:
            url = f"{BASE_URL}:runQuery?key={FIREBASE_API_KEY}"
            payload = {"structuredQuery": {"from": [{"collectionId": "equipamentos"}], "where": {"fieldFilter": {"field": {"fieldPath": "mac_address"}, "op": "EQUAL", "value": {"stringValue": self.mac}}}, "limit": 1}}
            
            response = requests.post(url, json=payload, timeout=5)
            results = response.json()

            if results and 'document' in results[0]:
                doc = results[0]['document']
                fields = doc.get('fields', {})
                self.equipamento_id = doc['name'].split('/')[-1]
                
                # Armazena estado atual para auto-logoff
                self.last_user = fields.get('usuario_atual', {}).get('stringValue')
                self.last_setor = fields.get('setor_atual', {}).get('stringValue')
                self.last_status = fields.get('status', {}).get('stringValue')
                
                self.after(0, lambda: self.btn_acessar.configure(state="normal", text="LIBERAR COMPUTADOR"))
            else:
                self._auto_register()
        except Exception:
            # FALHA DE CONEXÃO -> ENTRAR EM MODO OFFLINE
            self.is_offline_mode = True
            self.after(0, self.enable_offline_mode)

    def enable_offline_mode(self):
        self.title_label.configure(text="💻 ACESSO OFFLINE", text_color="#f59e0b")
        self.subtitle_label.configure(text="Sem internet. Seus dados serão\nsincronizados depois.", text_color="#f59e0b")
        self.btn_acessar.configure(state="normal", text="LIBERAR (OFFLINE)", fg_color="#f59e0b", hover_color="#d97706")

    def _auto_register(self):
        try:
            now = datetime.utcnow().isoformat() + "Z"
            url = f"{BASE_URL}/equipamentos?key={FIREBASE_API_KEY}"
            payload = {"fields": {"nome": {"stringValue": f"NOVO: {self.hostname}"}, "marca": {"stringValue": "AUTO-DETECT"}, "mac_address": {"stringValue": self.mac}, "nome_pc": {"stringValue": self.hostname}, "status": {"stringValue": "Em Estoque"}, "data_cadastro": {"timestampValue": now}}}
            response = requests.post(url, json=payload, timeout=5)
            res_data = response.json()
            if 'name' in res_data:
                self.equipamento_id = res_data['name'].split('/')[-1]
                self.after(0, lambda: self.btn_acessar.configure(state="normal", text="LIBERAR COMPUTADOR"))
        except Exception:
            self.is_offline_mode = True
            self.after(0, self.enable_offline_mode)

    def handle_login(self):
        nome = self.entry_nome.get().strip()
        setor = self.entry_setor.get().strip()
        if not nome or not setor: return

        if self.is_offline_mode:
            self.save_offline_log(nome, setor)
            self.release_pc()
        else:
            self.btn_acessar.configure(state="disabled", text="CONECTANDO...")
            threading.Thread(target=self._perform_online_login, args=(nome, setor), daemon=True).start()

    def _perform_online_login(self, nome, setor):
        try:
            now = datetime.utcnow().isoformat() + "Z"
            
            # 1. Finalizar sessão anterior se outro usuário estava logado
            if self.last_status == "Em Uso" and self.last_user and self.last_user != nome:
                try:
                    mov_url = f"{BASE_URL}/movimentacoes?key={FIREBASE_API_KEY}"
                    requests.post(mov_url, json={"fields": {
                        "equipamento_id": {"stringValue": self.equipamento_id},
                        "nome_pc": {"stringValue": self.hostname},
                        "mac_address": {"stringValue": self.mac},
                        "usuario_nome": {"stringValue": self.last_user},
                        "usuario_setor": {"stringValue": self.last_setor or "N/A"},
                        "acao": {"stringValue": "logoff"},
                        "timestamp": {"timestampValue": now},
                        "origem": {"stringValue": "auto_logoff_on_login"}
                    }}, timeout=5)
                except: pass

            # 2. Atualiza Equipamento
            update_url = f"{BASE_URL}/equipamentos/{self.equipamento_id}?updateMask.fieldPaths=status&updateMask.fieldPaths=usuario_atual&updateMask.fieldPaths=setor_atual&updateMask.fieldPaths=data_ultima_ativacao&key={FIREBASE_API_KEY}"
            requests.patch(update_url, json={"fields": {"status": {"stringValue": "Em Uso"}, "usuario_atual": {"stringValue": nome}, "setor_atual": {"stringValue": setor}, "data_ultima_ativacao": {"timestampValue": now}}}, timeout=5)
            
            # 3. Registra Movimentação de Login
            mov_url = f"{BASE_URL}/movimentacoes?key={FIREBASE_API_KEY}"
            requests.post(mov_url, json={"fields": {"equipamento_id": {"stringValue": self.equipamento_id}, "nome_pc": {"stringValue": self.hostname}, "mac_address": {"stringValue": self.mac}, "usuario_nome": {"stringValue": nome}, "usuario_setor": {"stringValue": setor}, "acao": {"stringValue": "login"}, "timestamp": {"timestampValue": now}, "origem": {"stringValue": "script_desktop"}}}, timeout=5)
            
            # Salva para logoff posterior
            self.logged_user = nome
            self.logged_setor = setor
            
            self.after(0, self.release_pc)
        except Exception:
            self.save_offline_log(nome, setor)
            self.after(0, self.release_pc)

    def save_offline_log(self, nome, setor):
        log_entry = {
            "nome": nome, "setor": setor,
            "mac": self.mac, "hostname": self.hostname,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
        logs = []
        if os.path.exists(OFFLINE_FILE):
            with open(OFFLINE_FILE, "r") as f:
                try: logs = json.load(f)
                except: logs = []
        
        logs.append(log_entry)
        with open(OFFLINE_FILE, "w") as f:
            json.dump(logs, f)

    def sync_offline_data(self):
        if not os.path.exists(OFFLINE_FILE): return
        
        # Tenta verificar conexão rápida
        try:
            requests.get("https://www.google.com", timeout=3)
        except: return

        with open(OFFLINE_FILE, "r") as f:
            logs = json.load(f)
        
        remaining_logs = []
        for log in logs:
            try:
                # 1. Buscar ID do PC pelo MAC do log
                url_query = f"{BASE_URL}:runQuery?key={FIREBASE_API_KEY}"
                payload = {"structuredQuery": {"from": [{"collectionId": "equipamentos"}], "where": {"fieldFilter": {"field": {"fieldPath": "mac_address"}, "op": "EQUAL", "value": {"stringValue": log['mac']}}}, "limit": 1}}
                res = requests.post(url_query, json=payload, timeout=5).json()
                
                e_id = None
                if res and 'document' in res[0]: e_id = res[0]['document']['name'].split('/')[-1]
                else:
                    # Auto-registra se não existir
                    reg = requests.post(f"{BASE_URL}/equipamentos?key={FIREBASE_API_KEY}", json={"fields": {"nome": {"stringValue": f"NOVO: {log['hostname']}"}, "mac_address": {"stringValue": log['mac']}, "nome_pc": {"stringValue": log['hostname']}, "status": {"stringValue": "Em Uso"}}}, timeout=5).json()
                    e_id = reg['name'].split('/')[-1]

                # 2. Enviar Movimentação
                mov_url = f"{BASE_URL}/movimentacoes?key={FIREBASE_API_KEY}"
                requests.post(mov_url, json={"fields": {"equipamento_id": {"stringValue": e_id}, "nome_pc": {"stringValue": log['hostname']}, "mac_address": {"stringValue": log['mac']}, "usuario_nome": {"stringValue": log['nome']}, "usuario_setor": {"stringValue": log['setor']}, "acao": {"stringValue": "login_offline"}, "timestamp": {"timestampValue": log['timestamp']}, "origem": {"stringValue": "script_offline"}}}, timeout=5)
            except:
                remaining_logs.append(log)

        if not remaining_logs: os.remove(OFFLINE_FILE)
        else:
            with open(OFFLINE_FILE, "w") as f: json.dump(remaining_logs, f)

    def release_pc(self):
        self.btn_acessar.configure(text="ACESSO LIBERADO!", fg_color="#10b981")
        self.after(1000, self.destroy)

    def secret_bypass_click(self, event):
        """Segredo para encerrar o script: 10 cliques no logo"""
        self.logo_clicks += 1
        
        # Reset automático após 2 segundos sem clicar
        if hasattr(self, '_reset_timer'):
            self.after_cancel(self._reset_timer)
        self._reset_timer = self.after(2000, self._reset_clicks)

        if self.logo_clicks >= 10:
            print("Bypass acionado pelo Administrador.")
            self.destroy()

    def _reset_clicks(self):
        self.logo_clicks = 0

if __name__ == "__main__":
    LoginKiosk().mainloop()
