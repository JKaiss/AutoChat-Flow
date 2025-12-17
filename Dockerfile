# Stage 1: Build the frontend
FROM node:20-alpine as builder

WORKDIR /app

# Accept API_KEY as a build argument to inject it during build
ARG API_KEY
ENV API_KEY=$API_KEY

COPY package*.json ./
RUN npm install

COPY . .

# Create .env file with the API key
# This is required so Vite can inline the key during 'npm run build'
# and so we can copy it to the production stage for the backend.
RUN echo "API_KEY=$API_KEY" > .env
RUN echo "PORT=3000" >> .env

# Build the React app (outputs to /app/dist)
RUN npm run build

# Stage 2: Setup the production environment
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies to keep image small
COPY package*.json ./
RUN npm install --production

# Copy built assets from builder
COPY --from=builder /app/dist ./dist

# Copy server code
COPY --from=builder /app/server ./server

# CRITICAL FIX: Copy the .env file from builder to production
# This ensures the Node.js backend can find process.env.API_KEY at runtime
COPY --from=builder /app/.env .

# Expose the port the server listens on
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
