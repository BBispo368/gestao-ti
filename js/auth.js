import { auth } from './firebase-config.js';
import { 
  signInWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut,
  updateProfile 
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";

// ============================================================
//  Auth Module
// ============================================================

const loginForm = document.getElementById('loginForm');
const btnLogin = document.getElementById('btnLogin');
const errorMessage = document.getElementById('errorMessage');

// 1. Handle Login
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Reset UI
    errorMessage.style.display = 'none';
    btnLogin.classList.add('loading');
    btnLogin.disabled = true;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Success: Firebase onAuthStateChanged will handle redirect
      window.location.href = 'index.html';
    } catch (error) {
      console.error("Erro no login:", error);
      errorMessage.textContent = 'E-mail ou senha incorretos. Tente novamente.';
      errorMessage.style.display = 'block';
      btnLogin.classList.remove('loading');
      btnLogin.disabled = false;
    }
  });
}

// 2. Global Auth Check
export function checkAuth() {
  onAuthStateChanged(auth, (user) => {
    const isLoginPage = window.location.pathname.includes('login.html');
    
    if (user) {
      // User is logged in
      if (isLoginPage) {
        window.location.href = 'index.html';
      }
      updateUserInfo(user);
    } else {
      // User is logged out
      if (!isLoginPage) {
        window.location.href = 'login.html';
      }
    }
  });
}

// 3. Handle Logout
export async function logout() {
  try {
    await signOut(auth);
    window.location.href = 'login.html';
  } catch (error) {
    console.error("Erro ao sair:", error);
  }
}

// 4. Update UI with user info
function updateUserInfo(user) {
  const userNameEl = document.querySelector('.user-name');
  const userAvatarEl = document.querySelector('.user-avatar');
  
  const displayName = user.displayName || user.email.split('@')[0];

  if (userNameEl) {
    userNameEl.textContent = displayName;
  }
  if (userAvatarEl) {
    userAvatarEl.textContent = displayName.charAt(0).toUpperCase();
  }
}

// 5. Profile Update Logic
export async function handleProfileUpdate(newName) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    await updateProfile(user, { displayName: newName });
    updateUserInfo(user);
    if (window.showToast) window.showToast("Perfil atualizado com sucesso!", "success");
    closeProfileModal();
  } catch (error) {
    console.error("Erro ao atualizar perfil:", error);
    if (window.showToast) window.showToast("Erro ao atualizar perfil.", "error");
  }
}

function openProfileModal() {
  const modal = document.getElementById('profileModal');
  const input = document.getElementById('profileNameInput');
  if (modal && auth.currentUser) {
    input.value = auth.currentUser.displayName || "";
    modal.classList.add('open');
  }
}

function closeProfileModal() {
  const modal = document.getElementById('profileModal');
  if (modal) modal.classList.remove('open');
}

// Global Exports
window.logout = logout;
window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;
window.handleProfileUpdate = () => {
  const newName = document.getElementById('profileNameInput').value;
  handleProfileUpdate(newName);
};

// Auto-run check on module load
if (!window.location.pathname.includes('login.html')) {
  checkAuth();
}
