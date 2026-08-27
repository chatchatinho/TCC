# Para que serve cada coisa — Guia de Conceitos

> Este documento é um complemento do [`05-guia-teste-iniciante.md`](05-guia-teste-iniciante.md).
> Lá está o **passo a passo** de o que fazer; aqui está o **porquê** de cada coisa —
> pra que serve cada programa, cada comando e cada arquivo que aparece no guia.
> Segue a mesma ordem do guia 05, pra ser fácil de acompanhar os dois juntos.

## As 4 ferramentas que você instala

### Git

Programa que guarda o **histórico de versões** do projeto — cada vez que alguém salva
mudanças (um "commit"), o Git lembra exatamente o que mudou, quem mudou e quando. É
também o que permite **baixar** o projeto do GitHub para o seu computador (`git clone`)
e **enviar** suas próprias mudanças de volta (`git push`). Sem o Git, você teria que
trocar arquivos manualmente (por pen-drive, e-mail etc.) toda vez que algo mudasse.

### Visual Studio Code (VS Code)

É o **editor de código** — o programa onde você abre, lê e edita os arquivos do
projeto (parecido com o Word, mas pra código). Ele também tem um terminal embutido
(`` Ctrl+` ``), então dá pra escrever código e rodar comandos sem sair do programa.

### Node.js

É o que permite **rodar código JavaScript fora do navegador** — ou seja, no seu
computador, como um programa normal. O backend do ThermoSense (a parte que guarda os
dados e responde às perguntas do site) é escrito em JavaScript, então precisa do
Node.js pra funcionar. Instalar o Node.js também instala o **npm** junto (explicado
mais abaixo).

### PostgreSQL

É o **banco de dados** — o programa que armazena de verdade as informações do sistema:
usuários cadastrados, dispositivos, leituras de temperatura/umidade, configurações e
alertas. Ele fica rodando em segundo plano no seu computador (como um serviço do
Windows) e guarda tudo em disco, de forma permanente, mesmo depois de reiniciar o PC.

## Passo 5 — Por que mexer no PowerShell

O **PowerShell** é o terminal (a telinha preta/azul onde você digita comandos) que o
Windows usa por padrão. Por segurança, ele vem configurado pra **bloquear scripts**
por padrão — e alguns comandos que vamos usar (como `npm install`) tecnicamente contam
como scripts. O comando `Set-ExecutionPolicy` afrouxa essa trava só pro seu usuário,
permitindo rodar esses comandos sem bloqueio. Não afeta a segurança de outras coisas
do Windows, só scripts que você mesmo decidir rodar.

## Passo 6 — Baixando o projeto

- `git clone` — copia o projeto inteiro do GitHub pra dentro de uma pasta no seu
  computador (nesse caso, chamada `Software`).
- `git checkout claude/esp32-temp-humidity-monitoring-k1kgji` — o projeto no GitHub
  pode ter várias **branches** (like "versões paralelas" do mesmo projeto, usadas pra
  desenvolver coisas sem bagunçar a versão principal). Esse comando garante que você
  está olhando pra branch certa, com todo o código mais atualizado do ThermoSense.

## Passo 7 — Criando o banco de dados

- **SQL Shell (psql)** — é uma janela de comando específica do PostgreSQL, separada
  do terminal do VS Code, usada pra "conversar" diretamente com o banco de dados
  (criar usuários, criar bancos, apagar coisas, consultar dados).
- `CREATE USER tcc_dev ...` — cria um **usuário do banco de dados** próprio pro
  sistema usar (diferente do usuário `postgres`, que é o administrador geral). É uma
  boa prática não deixar a aplicação usar a conta de administrador do banco.
- `CREATE DATABASE tcc_dev ...` — cria o **banco de dados vazio** onde as tabelas do
  ThermoSense vão morar (usuários, dispositivos, leituras etc.). Nesse ponto ele
  existe mas está vazio — as tabelas só são criadas no Passo 9, pelo Prisma.

## Passo 8 — O arquivo `.env`

`.env` é um arquivo de **configurações sensíveis** — coisas como senhas e endereços
que mudam de computador pra computador, e que **nunca** devem ir pro GitHub (por isso
o Git ignora esse arquivo de propósito). Cada linha é uma configuração:

| Variável | Pra que serve |
|---|---|
| `DATABASE_URL` | O "endereço" completo do banco de dados: quem conecta (`tcc_dev`), com qual senha, em qual computador (`localhost` = o seu próprio PC) e qual banco (`tcc_dev`). É como o backend sabe onde procurar os dados. |
| `API_PORT` | A "porta" onde o backend vai escutar pedidos — pense nisso como o número de um apartamento num prédio; `3000` é só a porta escolhida para este projeto. |
| `JWT_SECRET` | Uma senha secreta que o backend usa pra **assinar** a sessão de login de cada usuário, garantindo que ninguém consiga forjar um login falso. Só o backend precisa saber esse valor. |
| `CORS_ORIGIN` | Diz ao backend **de qual endereço** ele deve aceitar pedidos (nesse caso, o frontend rodando em `http://localhost:5173`) — uma proteção contra sites desconhecidos tentarem usar sua API. |

O arquivo `.env.example` (que você copia pra virar `.env`) é só um **modelo** com
valores de exemplo — cada pessoa que roda o projeto localmente precisa ter o próprio
`.env` com seus próprios valores.

## Passo 9 — Instalando e rodando o backend

- `npm install` — lê o arquivo `package.json` do projeto (uma lista de "peças" que o
  código usa, como o Express e o Prisma) e **baixa e instala** cada uma delas na pasta
  `node_modules`. É parecido com instalar os aplicativos que um programa precisa pra
  funcionar.
- `npm run prisma:migrate` — cria de fato as **tabelas** dentro do banco de dados
  (usuários, dispositivos, medições, configurações, alertas), seguindo a estrutura
  definida em `backend/prisma/schema.prisma`. Sem rodar isso, o banco existe mas está
  vazio, sem nenhuma tabela.
- `npm run db:seed` — preenche o banco com **dados de demonstração**: um usuário de
  teste, um dispositivo de exemplo e um histórico simulado de leituras, pra você
  poder testar o sistema sem precisar cadastrar tudo na mão. ⚠️ Rodar esse comando de
  novo mais tarde **apaga tudo** que estiver no banco e recria só esses dados de
  exemplo — não use se já tiver dados seus que queira manter.
- `npm run dev` — liga o **backend de verdade**: o programa que fica escutando
  pedidos na porta 3000, respondendo perguntas como "faça login", "quais são minhas
  leituras" etc. Esse comando fica rodando sem parar (por isso o terminal "trava" —
  é esperado, ele está ativo, escutando).

## Passo 10 — Configurando e rodando o frontend

O **frontend** é a parte visual — o site que você vê e clica no navegador (Dashboard,
Histórico, Configurações...). Ele roda **separado** do backend, numa porta diferente
(5173), e conversa com o backend por trás das cenas pra buscar/enviar dados. Por isso
tem uma segunda aba de terminal: são dois programas rodando ao mesmo tempo,
independentes um do outro. Se o backend não estiver rodando, o frontend abre
normalmente, mas nada de login/dados funciona (porque não tem ninguém pra responder
os pedidos dele).

## Passo 11 — Testando no navegador

`http://localhost:5173` é o **endereço local** do frontend — "localhost" quer dizer
"este mesmo computador" (só você consegue acessar esse endereço, de outro PC ele não
funcionaria). É por isso que, mais adiante, testar com um ESP32 físico exige trocar
esse endereço pelo IP da sua rede — o ESP32 não é "este computador", então não
entende "localhost".

## Resumo visual

```
Navegador (localhost:5173)
        │
        ▼
   Frontend (React)  ──conversa com──▶  Backend (Node/Express, localhost:3000)
                                                  │
                                                  ▼
                                       PostgreSQL (banco de dados)
```

O frontend nunca fala direto com o banco — sempre passa pelo backend, que é quem sabe
como validar login, checar permissões e gravar/consultar os dados corretamente.
