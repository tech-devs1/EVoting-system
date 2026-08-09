FROM node:20-alpine
WORKDIR /app

# Copy package manifests
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

# Install dependencies for monorepo
RUN npm install

# Copy codebase
COPY . .

# Build Next.js frontend production bundle
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --prefix frontend

EXPOSE 3000

# Make start script executable
RUN chmod +x ./scripts/start-monorepo.sh

CMD ["./scripts/start-monorepo.sh"]
