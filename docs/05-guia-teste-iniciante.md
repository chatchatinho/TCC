# Guia de Instalação e Teste — Do Zero (Windows)

> Guia para quem nunca configurou um ambiente de desenvolvimento antes, num computador
> novo, sem nada instalado. Escreva/cole os comandos exatamente como estão.
> Este guia usa o caminho manual (Node.js + PostgreSQL) em vez de Docker, porque muitas
> máquinas Windows não têm virtualização habilitada por padrão — o que faz o Docker
> Desktop falhar. Se você já sabe que sua máquina roda Docker sem problemas, veja a
> alternativa mais curta na seção "Opção A — Docker" do [`README.md`](../README.md).

## O que você vai instalar (nessa ordem)

1. Git
2. Visual Studio Code
3. Node.js
4. PostgreSQL

## 1. Instalar o Git

Baixe em **https://git-scm.com/downloads** → execute o instalador → pode clicar em
"Next" em todas as telas, as opções padrão servem → "Install" → "Finish".

## 2. Instalar o VS Code

Baixe em **https://code.visualstudio.com/** → execute o instalador → opções padrão →
"Install" → "Finish" (marque "Launch Visual Studio Code" para já abrir).

## 3. Instalar o Node.js

Baixe a versão **LTS** em **https://nodejs.org** → execute o instalador → opções
padrão → "Install" → "Finish".

## 4. Instalar o PostgreSQL

Baixe em **https://www.postgresql.org/download/windows/** → execute o instalador.

Durante a instalação:
- Vai pedir uma **senha para o usuário `postgres`** — digite algo que você vai lembrar
  (ex. `PostgresAdmin123!`) e **anote em algum lugar**. Essa senha é só do banco, não do
  sistema web.
- Pode deixar a porta padrão `5432`.
- No final, pode **desmarcar** "Stack Builder" (não é necessário) e finalizar.

## 5. Preparar o PowerShell (evita um erro comum)

Antes de qualquer coisa, no VS Code, abra um terminal (`` Terminal → New Terminal ``, ou
`` Ctrl+` ``) e cole este comando:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Quando perguntar `Deseja alterar a política de execução?`, digite `S` e aperte Enter.

*(Sem isso, comandos como `npm install` falham com um erro tipo "não pode ser
carregado porque a execução de scripts foi desabilitada". Fazendo esse passo agora,
você evita esse erro mais adiante.)*

## 6. Baixar o projeto

Ainda no terminal do VS Code:

```powershell
cd $env:USERPROFILE\Desktop
git clone https://github.com/chatchatinho/TCC.git Software
cd Software
git checkout claude/esp32-temp-humidity-monitoring-k1kgji
```

*(O repositório no GitHub pode continuar se chamando `TCC` — o `Software` no fim do comando `git clone` só define o nome da pasta local, que é o que importa aqui. Se você renomeou o repositório no GitHub também, troque a URL por `https://github.com/chatchatinho/Software.git`.)*

Agora abra a pasta no VS Code: **File → Open Folder** → selecione `Desktop\Software`.

## 7. Criar o banco de dados do projeto

Abra o programa **"SQL Shell (psql)"** pelo menu Iniciar do Windows (não é no VS Code,
é um programa separado que veio com o PostgreSQL).

Ele vai perguntar `Server`, `Database`, `Port`, `Username` — aperte **Enter** nos
quatro (são os valores padrão). Por último pede a **senha do `postgres`** (a que você
definiu no passo 4).

> **Atenção**: ao digitar a senha, **nada aparece na tela** — nem letras, nem
> asteriscos. Isso é normal (proteção de segurança do próprio psql). Digite a senha
> "às cegas" e aperte Enter.

Quando aparecer o prompt `postgres=#`, cole (um comando de cada vez, Enter após cada um):

```sql
CREATE USER tcc_dev WITH PASSWORD 'ChatSenha123!' CREATEDB;
```

```sql
CREATE DATABASE tcc_dev OWNER tcc_dev;
```

```sql
\q
```

*(Pode trocar `ChatSenha123!` por outra senha, mas use a mesma no próximo passo.)*

## 8. Configurar o backend

De volta ao terminal do VS Code:

```powershell
cd $env:USERPROFILE\Desktop\Software\backend
copy .env.example .env
```

Na barra lateral do VS Code, dentro da pasta `backend`, clique no arquivo `.env` para
abri-lo. Apague todo o conteúdo e cole:

```
DATABASE_URL="postgresql://tcc_dev:ChatSenha123!@localhost:5432/tcc_dev"
API_PORT=3000
JWT_SECRET="ChatSenha123!"
CORS_ORIGIN="http://localhost:5173"
```

Salve com `Ctrl+S`.

## 9. Instalar e rodar o backend

No terminal (ainda dentro da pasta `backend`), rode um comando de cada vez e espere
cada um terminar antes do próximo:

```powershell
npm install
```

```powershell
npm run prisma:migrate
```

```powershell
npm run db:seed
```

```powershell
npm run dev
```

Esse último comando **fica rodando** (não termina sozinho) — deve aparecer
`API rodando em http://localhost:3000`. **Não feche esse terminal.**

## 10. Configurar e rodar o frontend

No VS Code, clique no ícone **`+`** no painel do terminal para abrir uma **segunda
aba de terminal** (sem fechar a primeira):

```powershell
cd $env:USERPROFILE\Desktop\Software\frontend
copy .env.example .env
npm install
npm run dev
```

Vai aparecer um link parecido com `http://localhost:5173`. **Não feche esse terminal
também.**

## 11. Testar no navegador

Abra **http://localhost:5173**.

Faça login com o usuário de demonstração (criado no passo 9 pelo `db:seed`):

- **E-mail**: `teste@tcc.local`
- **Senha**: `Senha@Teste123`

No Dashboard, use os botões **"Simular leitura normal"** e **"Simular leitura fora do
limite"** para gerar dados e ver os gráficos e alertas funcionando — sem precisar do
ESP32 físico.

## Problemas comuns e soluções

| Erro | Solução |
|---|---|
| `... não pode ser carregado porque a execução de scripts foi desabilitada` | Rode o comando do Passo 5 (`Set-ExecutionPolicy`) e tente de novo. |
| SQL Shell parece travado ao pedir senha | Normal — a senha não aparece na tela. Digite e aperte Enter mesmo sem ver nada. |
| `role "tcc_dev" already exists` ao criar o usuário | Já existe de uma tentativa anterior. Apague antes: no SQL Shell, `DROP DATABASE IF EXISTS tcc_dev; DROP USER IF EXISTS tcc_dev;` e recrie. |
| Frontend abre mas não consegue logar | Confirme que o terminal do backend (Passo 9) ainda está rodando e mostrando `API rodando em http://localhost:3000`. |
| `ECONNREFUSED` ao rodar `prisma:migrate` | O PostgreSQL não está rodando, ou a senha em `backend/.env` está diferente da que você definiu no Passo 7. |
| Docker Desktop: "Virtualization support not detected" | Esse guia não usa Docker — pode ignorar esse erro e seguir pelo caminho manual acima. |
