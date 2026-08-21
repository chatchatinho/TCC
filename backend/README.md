# Backend — Etapa 2 (Banco de Dados)

Nesta etapa o backend contém apenas a camada de banco de dados (Prisma): schema, migrations e seed.
A API (Express) será adicionada na Etapa 3.

## Pré-requisitos

- Node.js 20+
- PostgreSQL 16 rodando localmente

## Configuração

1. Crie um banco e um usuário no PostgreSQL, por exemplo:

   ```sql
   CREATE USER tcc_dev WITH PASSWORD 'sua_senha' CREATEDB;
   CREATE DATABASE tcc_dev OWNER tcc_dev;
   ```

   O `CREATEDB` é necessário porque o Prisma cria um "shadow database" temporário durante
   `prisma migrate dev` para detectar divergências de schema.

2. Copie `.env.example` para `.env` e preencha `DATABASE_URL` com as credenciais acima.

3. Instale as dependências:

   ```bash
   npm install
   ```

## Rodando as migrations

```bash
npm run prisma:migrate
```

Cria/atualiza as tabelas `users`, `devices`, `measurements`, `settings` e `alerts` conforme
`prisma/schema.prisma`. O modelo completo e as decisões de modelagem estão documentados em
`../docs/01-arquitetura-e-decisoes.md`.

## Populando dados de demonstração

```bash
npm run db:seed
```

Cria:

- 1 usuário de teste (`teste@tcc.local` / `Senha@Teste123`) — **apenas para ambiente local de
  desenvolvimento**, nunca use em produção;
- 1 dispositivo de teste (`ESP32-001`) com um token de API gerado na hora (impresso no console,
  não é reexibido depois — se perder, rode o seed de novo);
- 3 horas de medições simuladas (uma a cada 5 minutos), incluindo uma janela de ~20 minutos com
  temperatura fora do limite configurado;
- 1 alerta correspondente a essa janela (já resolvido, mas ainda não lido), para demonstrar a
  notificação "você possui alertas desde seu último acesso" já na Etapa 4.

## Explorando o banco visualmente

```bash
npm run prisma:studio
```

Abre uma interface web (Prisma Studio) para navegar pelos dados.
