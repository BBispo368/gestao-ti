// ============================================================
//  firebase-config.js
//  Substitua com suas credenciais do Firebase Console
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey:            "AIzaSyBgscAf7JfiiEwLNC2QC5HMLiWo_lKvMvI",
  authDomain:        "gestao-ti-bd.firebaseapp.com",
  projectId:         "gestao-ti-bd",
  storageBucket:     "gestao-ti-bd.firebasestorage.app",
  messagingSenderId: "732212547065",
  appId:             "1:732212547065:web:6216deea596ee4c3be8128",
  measurementId:     "G-SYGW9EP9PS"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };

