# Votação "Funcionário em destaque 2026", DPCM

Site estático (GitHub Pages) com contas e base de dados no Firebase (Authentication + Realtime Database).

- `index.html`: página de registo e de voto.
- `admin.html`: painel da organização (fases, registos, finalistas, resultados).
- `js/dados.js`: lista de pessoal por sector, gerada a partir de `Lista_de_pessoal_DPCM_jr.xlsx`.
- `database.rules.json`: regras de segurança da base de dados.

Sem o Firebase configurado, o site abre em modo de demonstração: as contas e os votos ficam só no navegador.

## Como funciona

A votação está sempre aberta: não há estado "por abrir", e quem conclui o registo segue directamente para o boletim da fase em curso.

1. **Registo.** No formulário de registo, cada funcionário selecciona o sector e o nome em listas, indica o e-mail @ins.gov.mz e uma palavra-passe. Em seguida vê os dados escolhidos, já bloqueados, conclui o registo e segue para a votação. Não há confirmação por e-mail. Cada nome só pode ficar ligado a uma conta, e o sector e o nome não podem ser alterados depois.
2. **1.ª fase.** Cada funcionário escolhe numa lista um colega do seu sector e confirma o voto num ecrã que mostra o nome, a categoria e o sector da pessoa escolhida. Os chefes (a amarelo na lista) também votam, mas não aparecem como candidatos. Ninguém vota em si próprio.
3. A organização publica os finalistas: os 3 mais votados de cada sector (quem empata com o 3.º também passa).
4. **2.ª fase.** Só os chefes votam, cada um nos finalistas do seu sector.
5. **Resultado.** Ganha quem tem mais votos dos chefes; se houver empate, conta a 1.ª fase. Na UGD não há chefes marcados, por isso decide a 1.ª fase.

As regras do Firebase impedem, no servidor: contas de outros domínios,  registar um nome já ocupado ou mudar de nome depois do registo, votar duas vezes, votar num chefe ou em alguém de outro sector, votar em si próprio, votar fora da fase aberta e (2.ª fase) votar em quem não é finalista.

O que as regras não conseguem saber é se o e-mail pertence mesmo à pessoa cujo nome foi escolhido. Para isso, o separador **Registos** do painel mostra o e-mail ligado a cada nome, assinala os casos em que o e-mail não lembra o nome e permite **Anular** um registo (os votos dessa conta são apagados).

Sectores fora da votação: DRH (3 pessoas) e UGEA (4 pessoas). Para incluir um sector, mude `"participa": false` para `true` em `js/dados.js`.

## Instalação

### 1. Firebase

1. Em https://console.firebase.google.com crie um projecto (por exemplo `dpcm-votacao`).
2. **Build > Authentication > Começar > Email/Password > Activar.**
4. **Build > Realtime Database > Criar base de dados**, localização `europe-west1`, modo bloqueado.
5. **Definições do projecto > As suas aplicações > Web (</>)**. Registe a aplicação e copie `apiKey`, `authDomain`, `databaseURL`, `projectId` e `appId` para `js/config.js`.

### 2. GitHub Pages

1. Crie um repositório (por exemplo `votacao-destaque-dpcm`) e envie todos os ficheiros desta pasta.
2. **Settings > Pages > Branch: main / root > Save.** O endereço fica `https://ferraomarty.github.io/votacao-destaque-dpcm/`.
3. Na Consola Firebase, **Authentication > Settings > Authorized domains**, acrescente `ferraomarty.github.io`.

### 3. Conta do administrador

1. Abra o site e registe-se como qualquer funcionário, com o seu e-mail @ins.gov.mz. Confirme o e-mail.
2. Na Consola Firebase, em **Authentication > Users**, copie o **User UID** da sua conta.
3. Abra `database.rules.json`, substitua `COLE_AQUI_O_UID_DO_ADMIN` pelo UID (aparece 10 vezes; use "substituir tudo") e cole o conteúdo no separador **Regras** da Realtime Database. Clique em **Publicar**.

A mesma conta serve para votar e para entrar em `admin.html`.

### 4. Antes de abrir a votação

1. Em `admin.html`, separador **Registos**, clique em *Carregar* (lista de pessoal). Sem isto ninguém consegue registar-se.
2. Faça um teste com 2 ou 3 colegas, depois use *Apagar todos os votos*. Anule os registos de teste que não sejam reais.
3. Divulgue o endereço do site. A 1.ª fase está aberta desde o primeiro acesso.

Quando a 1.ª fase terminar: **1.ª fase e finalistas > Publicar finalistas**, depois mude para *2.ª fase*. No fim, *Encerrada* e exporte os resultados.

## Notas

- A mensagem de recuperação da palavra-passe sai de `noreply@<projecto>.firebaseapp.com`. Se o servidor de correio do INS a bloquear, o administrador pode redefinir a palavra-passe na consola Firebase (Authentication > Users).
- Quem esquecer a palavra-passe usa "Esqueci a palavra-passe" na página de entrada.
- Os votos ficam guardados com a conta de quem votou. O painel mostra só totais, mas quem tem acesso à consola do Firebase consegue ligar votos a pessoas.
- Se a lista de pessoal mudar, gere de novo `js/dados.js` com `python3 ferramentas/gerar_dados.py Lista.xlsx js/dados.js` (marca como chefe quem está a amarelo) e clique outra vez em *Carregar*.
