import kivy
from kivy.app import App
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.label import Label
from kivy.uix.textinput import TextInput
from kivy.uix.button import Button
from kivy.clock import Clock
from kivy.core.window import Window
from kivy.graphics import Color, RoundedRectangle
from kivy.utils import get_color_from_hex
import requests
import threading
import json
import os
from datetime import datetime

# Configurações do Firebase (Mesmas do seu sistema atual)
FIREBASE_PROJECT_ID = "gestao-ti-bd"
FIREBASE_API_KEY    = "AIzaSyBgscAf7JfiiEwLNC2QC5HMLiWo_lKvMvI"
BASE_URL = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents"

class LoginScreen(BoxLayout):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.orientation = 'vertical'
        self.padding = [40, 60]
        self.spacing = 20
        
        # Background dark
        with self.canvas.before:
            Color(rgba=get_color_from_hex('#0f172a'))
            self.rect = RoundedRectangle(size=self.size, pos=self.pos)
        self.bind(size=self._update_rect, pos=self._update_rect)

        # Logo/Icon (Simulado com texto por enquanto)
        self.add_widget(Label(
            text="💻", 
            font_size='80sp',
            size_hint_y=None,
            height='100dp'
        ))

        self.add_widget(Label(
            text="ACESSO TABLET",
            font_size='24sp',
            bold=True,
            color=get_color_from_hex('#ffffff'),
            size_hint_y=None,
            height='40dp'
        ))

        self.add_widget(Label(
            text="Identifique-se para liberar o uso",
            font_size='14sp',
            color=get_color_from_hex('#94a3b8'),
            size_hint_y=None,
            height='30dp'
        ))

        # Inputs
        self.nome_input = TextInput(
            hint_text="Seu Nome Completo",
            multiline=False,
            size_hint_y=None,
            height='50dp',
            background_color=[1, 1, 1, 0.05],
            foreground_color=[1, 1, 1, 1],
            padding=[15, 15]
        )
        self.add_widget(self.nome_input)

        self.setor_input = TextInput(
            hint_text="Seu Setor",
            multiline=False,
            size_hint_y=None,
            height='50dp',
            background_color=[1, 1, 1, 0.05],
            foreground_color=[1, 1, 1, 1],
            padding=[15, 15]
        )
        self.add_widget(self.setor_input)

        # Botão
        self.login_btn = Button(
            text="LIBERAR TABLET",
            size_hint_y=None,
            height='60dp',
            background_color=[0, 0, 0, 0], # Transparente para usar o canvas
            bold=True
        )
        with self.login_btn.canvas.before:
            self.btn_color = Color(rgba=get_color_from_hex('#3b82f6'))
            self.btn_bg = RoundedRectangle(size=self.login_btn.size, pos=self.login_btn.pos, radius=[12])
        
        self.login_btn.bind(size=self._update_btn_bg, pos=self._update_btn_bg)
        self.login_btn.bind(on_press=self._on_btn_press, on_release=self._on_btn_release)
        self.add_widget(self.login_btn)

        # Info Label (ID do Dispositivo)
        self.info_label = Label(
            text="Verificando ID...",
            font_size='10sp',
            color=get_color_from_hex('#64748b'),
            size_hint_y=None,
            height='40dp'
        )
        self.add_widget(self.info_label)

    def _update_rect(self, *args):
        self.rect.pos = self.pos
        self.rect.size = self.size

    def _update_btn_bg(self, *args):
        self.btn_bg.pos = self.login_btn.pos
        self.btn_bg.size = self.login_btn.size

    def _on_btn_press(self, instance):
        self.btn_color.rgba = get_color_from_hex('#2563eb') # Cor mais escura ao apertar

    def _on_btn_release(self, instance):
        self.btn_color.rgba = get_color_from_hex('#3b82f6') # Volta ao normal
        if hasattr(self, 'parent_app'):
            self.parent_app.handle_login(instance)

class TabletLoginApp(App):
    def build(self):
        self.device_id = self.get_device_id()
        self.equipamento_id = None
        self.status_atual = "Verificando"
        
        self.root_layout = BoxLayout()
        self.login_screen = LoginScreen()
        self.login_screen.parent_app = self
        self.login_screen.info_label.text = f"Device ID: {self.device_id}"
        
        # Tela de "Acesso Liberado" (Label simples que fica por trás)
        self.unlocked_label = Label(text="Tablet Liberado\nBom Trabalho!", font_size='20sp', halign='center', color=get_color_from_hex('#ffffff'))

        # Inicia com a tela de login
        self.root_layout.add_widget(self.login_screen)
        
        # Thread de monitoramento
        threading.Thread(target=self.monitor_firestore, daemon=True).start()
        
        return self.root_layout

    def get_device_id(self):
        """Tenta pegar o Android ID, se falhar (ex: rodando no PC), gera um ID baseado no nome do host"""
        try:
            from jnius import autoclass
            Context = autoclass('android.content.Context')
            PythonActivity = autoclass('org.kivy.android.PythonActivity')
            Secure = autoclass('android.provider.Settings$Secure')
            content_resolver = PythonActivity.mActivity.getContentResolver()
            return Secure.getString(content_resolver, Secure.ANDROID_ID)
        except Exception:
            import socket
            return f"DEBUG-{socket.gethostname()}"

    def monitor_firestore(self):
        """Loop de monitoramento para bloquear/desbloquear o app"""
        while True:
            try:
                # 1. Busca o documento pelo Device ID (usando query no Firestore)
                url = f"{BASE_URL}:runQuery?key={FIREBASE_API_KEY}"
                payload = {
                    "structuredQuery": {
                        "from": [{"collectionId": "equipamentos"}],
                        "where": {
                            "fieldFilter": {
                                "field": {"fieldPath": "mac_address"}, # Usamos o campo mac_address para guardar o ID
                                "op": "EQUAL",
                                "value": {"stringValue": self.device_id}
                            }
                        },
                        "limit": 1
                    }
                }
                
                response = requests.post(url, json=payload, timeout=10)
                results = response.json()

                if results and 'document' in results[0]:
                    doc = results[0]['document']
                    self.equipamento_id = doc['name'].split('/')[-1]
                    status = doc.get('fields', {}).get('status', {}).get('stringValue', 'Desconhecido')
                    
                    if status != self.status_atual:
                        self.status_atual = status
                        Clock.schedule_once(lambda dt: self.update_ui_state(status))
                else:
                    # Auto-registro se não encontrar
                    self._auto_register_device()

            except Exception as e:
                print(f"Erro monitoramento: {e}")
            
            import time
            time.sleep(15) # Verifica a cada 15 segundos

    def _auto_register_device(self):
        """Cria um novo registro no Firebase para este tablet/dispositivo"""
        try:
            print(f"Auto-registrando dispositivo: {self.device_id}")
            now = datetime.utcnow().isoformat() + "Z"
            url = f"{BASE_URL}/equipamentos?key={FIREBASE_API_KEY}"
            
            # Pega o hostname para facilitar a identificação no painel
            import socket
            hostname = socket.gethostname()
            
            payload = {
                "fields": {
                    "nome": {"stringValue": f"TABLET: {hostname}"},
                    "mac_address": {"stringValue": self.device_id},
                    "nome_pc": {"stringValue": hostname},
                    "status": {"stringValue": "Em Estoque"},
                    "data_cadastro": {"timestampValue": now}
                }
            }
            
            response = requests.post(url, json=payload, timeout=10)
            data = response.json()
            
            if 'name' in data:
                self.equipamento_id = data['name'].split('/')[-1]
                self.status_atual = "Em Estoque"
                print(f"Dispositivo registrado com sucesso. ID: {self.equipamento_id}")
                Clock.schedule_once(lambda dt: self.update_ui_state("Em Estoque"))
                
        except Exception as e:
            print(f"Falha no auto-registro: {e}")

    def update_ui_state(self, status):
        """Alterna entre tela de login e tela liberada"""
        self.root_layout.clear_widgets()
        if status == "Em Estoque" or status == "Manutenção":
            self.root_layout.add_widget(self.login_screen)
            # No Android, traria o app para o topo aqui (se possível)
        else:
            self.root_layout.add_widget(self.unlocked_label)

    def handle_login(self, instance):
        nome = self.login_screen.nome_input.text.strip()
        setor = self.login_screen.setor_input.text.strip()
        
        if not nome or not setor or not self.equipamento_id:
            return

        self.login_screen.login_btn.disabled = True
        self.login_screen.login_btn.text = "CONECTANDO..."
        
        threading.Thread(target=self._perform_login, args=(nome, setor)).start()

    def _perform_login(self, nome, setor):
        try:
            now = datetime.utcnow().isoformat() + "Z"
            
            # 1. Atualiza Equipamento
            update_url = f"{BASE_URL}/equipamentos/{self.equipamento_id}?updateMask.fieldPaths=status&updateMask.fieldPaths=usuario_atual&updateMask.fieldPaths=setor_atual&updateMask.fieldPaths=data_ultima_ativacao&key={FIREBASE_API_KEY}"
            payload = {
                "fields": {
                    "status": {"stringValue": "Em Uso"},
                    "usuario_atual": {"stringValue": nome},
                    "setor_atual": {"stringValue": setor},
                    "data_ultima_ativacao": {"timestampValue": now}
                }
            }
            requests.patch(update_url, json=payload, timeout=10)
            
            # 2. Registra Movimentação
            mov_url = f"{BASE_URL}/movimentacoes?key={FIREBASE_API_KEY}"
            mov_payload = {
                "fields": {
                    "equipamento_id": {"stringValue": self.equipamento_id},
                    "mac_address": {"stringValue": self.device_id},
                    "usuario_nome": {"stringValue": nome},
                    "usuario_setor": {"stringValue": setor},
                    "acao": {"stringValue": "login_android"},
                    "timestamp": {"timestampValue": now},
                    "origem": {"stringValue": "android_app"}
                }
            }
            requests.post(mov_url, json=mov_payload, timeout=10)
            
            # Sucesso: A UI vai atualizar no próximo loop do monitor_firestore ou forçamos agora
            self.status_atual = "Em Uso"
            Clock.schedule_once(lambda dt: self.update_ui_state("Em Uso"))
            
        except Exception as e:
            print(f"Erro login: {e}")
            Clock.schedule_once(lambda dt: self._reset_btn())

    def _reset_btn(self):
        self.login_screen.login_btn.disabled = False
        self.login_screen.login_btn.text = "LIBERAR TABLET"

if __name__ == '__main__':
    TabletLoginApp().run()
