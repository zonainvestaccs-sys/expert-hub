FROM node:20-alpine

WORKDIR /app

# Prisma precisa de openssl no alpine
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci

# Copia schema do prisma e gera o client ANTES do build
COPY prisma ./prisma
RUN npx prisma generate

# Agora copia o resto do código e builda o Nest
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["node", "dist/main.js"]
