# Votação "Funcionário em destaque 2026", DPCM

Site estático (GitHub Pages) com base de dados no Firebase Realtime Database.

- `index.html`: página onde cada funcionário vota com o seu código pessoal.
- `admin.html`: painel da organização (abrir fases, gerar e imprimir códigos, publicar finalistas, ver e exportar resultados).
- `js/dados.js`: lista de pessoal por sector, gerada a partir de `Lista_de_pessoal_DPCM_jr.xlsx`.
- `database.rules.json`: regras de segurança da base de dados.

Sem o Firebase configurado, o site abre em modo de demonstração (os votos ficam só no navegador). Serve para testar antes de ligar a base de dados.

## Como funciona

1. A organização gera um código de 6 caracteres para cada funcionário e entrega-o num cartão.
2. **1ª fase.** Cada funcionário entra com o código e vota num colega do seu sector. Os chefes (a amarelo na lista) não aparecem como candidatos e, por defeito, não votam nesta fase. Ninguém vota em si próprio.
3. A organização publica os finalistas: os 3 mais votados de cada sector (quem empata com o 3.º também passa).
4. **2ª fase.** Só os chefes votam, cada um nos finalistas do seu sector.
5. Resultado: ganha quem tem mais votos dos chefes; se houver empate, conta a 1ª fase. Na UGD não há chefes marcados, por isso decide a 1ª fase.

As regras do Firebase impedem, no servidor: votar duas vezes na mesma fase, votar num chefe, votar em alguém de outro sector, votar em si próprio, votar fora da fase aberta e (2ª fase) votar em quem não é finalista.

Sectores fora da votação: DRH (3 pessoas) e UGEA (4 pessoas). Para incluir um sector, mude `"participa": false` para `true` em `js/dados.js`.

## Instalação

### 1. Firebase

1. Em https://console.firebase.google.com crie um projecto (por exemplo `dpcm-votacao`) ou use um existente.
2. **Build > Realtime Database > Criar base de dados.** Escolha a localização `europe-west1` e o modo bloqueado.
3. **Build > Authentication > Começar > Email/Password > Activar.** Em *Users*, adicione o utilizador do administrador (ex.: ferao.mandlate@ins.gov.mz) e copie o **User UID**.
4. Abra `database.rules.json`, substitua `COLE_AQUI_O_UID_DO_ADMIN` pelo UID (aparece 9 vezes; use "substituir tudo") e cole o conteúdo no separador **Regras** da Realtime Database. Clique em **Publicar**.
5. **Definições do projecto > As suas aplicações > Web (</>)**. Registe a aplicação e copie `apiKey`, `authDomain`, `databaseURL`, `projectId` e `appId` para `js/config.js`.

Se reutilizar o projecto `ins-maputo-votacao` da votação das salas, as novas regras substituem as antigas e fecham os dados dessa votação. Exporte-os antes, se ainda precisar deles.

### 2. GitHub Pages

1. Crie um repositório (por exemplo `votacao-destaque-dpcm`) e envie todos os ficheiros desta pasta.
2. **Settings > Pages > Branch: main / root > Save.** O endereço fica `https://ferraomarty.github.io/votacao-destaque-dpcm/`.
3. Na Consola Firebase, **Authentication > Settings > Authorized domains**, acrescente `ferraomarty.github.io`.

### 3. Antes de abrir a votação

1. Abra `admin.html` e entre com a conta do administrador.
2. **Preparação e códigos:** clique em *Carregar* (candidatos) e depois em *Gerar* (códigos).
3. Imprima os cartões (10 por folha A4) ou exporte a lista para Excel.
4. Faça um teste com 2 ou 3 códigos, depois use *Apagar todos os votos* para limpar.
5. Em **Estado e participação**, passe para *1ª fase*.

Quando a 1ª fase terminar: **1ª fase e finalistas > Publicar finalistas**, depois mude para *2ª fase*. No fim, *Encerrada* e exporte os resultados.

## Notas

- Os votos ficam guardados com o código de quem votou. O painel mostra só totais, mas quem tem acesso à consola do Firebase consegue ligar votos a pessoas.
- Se um cartão se perder, procure a pessoa na lista de códigos do painel e entregue-lhe o mesmo código.
- Se a lista de pessoal mudar, gere de novo `js/dados.js` (o script `ferramentas/gerar_dados.py`, com `python3 ferramentas/gerar_dados.py Lista.xlsx js/dados.js`, lê o Excel e marca como chefe quem está a amarelo) e clique outra vez em *Carregar* e *Gerar*; quem já tem código mantém o mesmo.
