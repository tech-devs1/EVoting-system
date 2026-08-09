FROM node:20-alpine
WORKDIR /app

# Copy root and workspace package files
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install backend dependencies
RUN npm install --prefix backend

# Copy source code
COPY backend ./backend

# Environment setup
ENV NODE_ENV=production
EXPOSE 5000

CMD ["npm", "start", "--prefix", "backend"]
