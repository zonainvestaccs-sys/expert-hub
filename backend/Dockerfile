FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --include=dev

# precisa copiar o schema antes de gerar
COPY prisma ./prisma
RUN npx prisma generate

COPY . .

RUN npm run build

EXPOSE 3000
CMD ["npm","run","start:prod"]
