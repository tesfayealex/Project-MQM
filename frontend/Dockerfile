FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy project code and build
COPY . .
RUN npm run lint --fix || :
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]