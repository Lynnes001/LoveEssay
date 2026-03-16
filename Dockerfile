FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

RUN mkdir -p /app/uploads

CMD ["npm", "start"]
