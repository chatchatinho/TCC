**TERMINAL CMD**

Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

**PSQL:**

**ENTER EM TUDO, NA SENHA USAR 'ChatSenha123!'**

```sql
CREATE USER tcc_dev WITH PASSWORD 'ChatSenha123!' CREATEDB;
```

```sql
CREATE DATABASE tcc_dev OWNER tcc_dev;
```

```sql
\q
```
 
**Terminal CMD**
cd backend
copy .env.example .env


**COLAR NO .ENV**
DATABASE_URL="postgresql://tcc_dev:ChatSenha123!@localhost:5432/tcc_dev"
API_PORT=3000
JWT_SECRET="ChatSenha123!"
CORS_ORIGIN="http://localhost:5173"


**TERMINAL BACKEND**
```powershell
npm install
```

```powershell
npm run prisma:migrate
```

```powershell
npm run db:seed (APENAS SE QUISER EXCLUIR O BANCO DE DADOS ANTERIOR)
```

```powershell
npm run dev
```





**ABRIR NOVO TERMINAL SEM FECHAR O OUTRO**

cd frontend
copy .env.example .env
npm install
npm run dev