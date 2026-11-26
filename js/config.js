/* Configuração da votação.
   Cole aqui os dados da aplicação web do Firebase (Consola Firebase > Definições do projecto > As suas aplicações).
   Enquanto apiKey ou databaseURL estiverem vazios, o site funciona em modo de demonstração:
   os votos ficam guardados só no navegador de quem testa. */
window.FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  databaseURL: "",
  projectId: "",
  appId: ""
};

/* Quantos finalistas por sector passam da 1ª para a 2ª fase (empates no último lugar também passam). */
window.N_FINALISTAS = 3;

/* Título que aparece nas páginas e nos cartões. */
window.TITULO_VOTACAO = "Funcionário em destaque 2026";
