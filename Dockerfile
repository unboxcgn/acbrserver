ROM node:19-bullseye
 
WORKDIR /app

COPY package*.json .

RUN npm ci --only=production

COPY . .

RUN npm prune --production

EXPOSE 8080

CMD [ "node", "index.js" ]

