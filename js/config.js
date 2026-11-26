/* Configuração da votação.
   Cole aqui os dados da aplicação web do Firebase (Consola Firebase > Definições do projecto > As suas aplicações).
   Enquanto apiKey ou databaseURL estiverem vazios, o site funciona em modo de demonstração:
   os votos ficam guardados só no navegador de quem testa. */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyDnTwB7aIeFjmZlyKHyLaUGw8dbjcEq67E",
  authDomain: "votacao-destaque-dpcm.firebaseapp.com",
  databaseURL: "https://votacao-destaque-dpcm-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "votacao-destaque-dpcm",
  storageBucket: "votacao-destaque-dpcm.firebasestorage.app",
  messagingSenderId: "224069840706",
  appId: "1:224069840706:web:0ee24b957d0ce281b922db"
};

/* Quantos nomes aparecem destacados na contagem de cada sector (empates no último lugar também contam). */
window.N_FINALISTAS = 3;

/* Título que aparece nas páginas. */
window.TITULO_VOTACAO = "Reconhecimento entre colegas 2026";
