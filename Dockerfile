ARG NODE_BASE_IMAGE=node:20-bookworm-slim
FROM ${NODE_BASE_IMAGE}

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

RUN mkdir -p /app/uploads

CMD ["npm", "start"]
