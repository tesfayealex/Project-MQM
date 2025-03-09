
FROM node:16-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy project code and build
COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]