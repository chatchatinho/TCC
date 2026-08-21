FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate

EXPOSE 3000

# Aplica migrations pendentes (idempotente — seguro rodar toda vez que o container sobe)
# e então inicia a API. O seed de dados de demonstração é opcional e manual (ver README),
# para não apagar dados reais do usuário a cada `docker compose up`.
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
