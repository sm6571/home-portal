FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p /app/data
ENV NODE_ENV=production
ENV DB_PATH=/app/data/home_portal.db
ENV PORT=3000
EXPOSE 3000
CMD ["node", "app.js"]
