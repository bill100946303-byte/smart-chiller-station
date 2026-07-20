FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
ENV BFF_PORT=8787
EXPOSE 8787
CMD ["npm","run","start"]