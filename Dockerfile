# Stage 1: Build the Frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for Vite build)
RUN npm install

# Copy the rest of the source code
COPY . .

# Build the React frontend (outputs to /dist)
RUN npm run build

# Stage 2: Setup the Production Server
FROM node:20-alpine

WORKDIR /app

# Copy package.json to install production dependencies
COPY package*.json ./

# Install ONLY production dependencies (keeps image light)
RUN npm install --only=production

# Copy the build output from the builder stage
COPY --from=builder /app/dist ./dist

# Copy the server directory
COPY --from=builder /app/server ./server

# Set environment to production
ENV NODE_ENV=production
ENV PORT=3000

# Expose the port
EXPOSE 3000

# Start the application
CMD ["node", "server/server.js"]
