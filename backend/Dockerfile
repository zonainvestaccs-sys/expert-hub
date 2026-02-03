FROM node:20-slim

WORKDIR /app

# 1) instala dependências
COPY package*.json ./
RUN npm ci

# 2) copia o prisma e gera o client ANTES do build
COPY prisma ./prisma
RUN npx prisma generate

# 3) copia o resto e builda
COPY . .
RUN npm run build

EXPOSE 3000

# 4) aplica migrations e inicia
CMD ["sh","-c","npx prisma migrate deploy && node dist/main.js"]
