# Stage 1: Build the frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy all files from the current directory
COPY . ./
RUN echo "API_KEY=PLACEHOLDER" > ./.env
RUN echo "GEMINI_API_KEY=AIzaSyBgUU0j_A1GDF4ku-UzNCTi3cu_lAtw960" >> ./.env
RUN echo "FACEBOOK_APP_ID=1878405926098711" >> ./.env
RUN echo "FACEBOOK_APP_SECRET=c5163d3ee03e5b51c1ffca36cf9f0f5a" >> ./.env

# Copy package files and install all dependencies (including devDependencies for Vite)
COPY package*.json ./
RUN npm install

# Copy the rest of the source code
COPY . .

# Build the React app (outputs to /app/dist)
RUN npm run build

# Stage 2: Setup the production backend
FROM node:20-alpine

WORKDIR /app

# Copy package files again
COPY package*.json ./

# Install only production dependencies (skips Vite, etc.)
RUN npm install --omit=dev

# Copy the built frontend assets from the builder stage
COPY --from=builder /app/dist ./dist

# Copy the backend server code
COPY server ./server

# Expose the port the app runs on
EXPOSE 3000

# Start the server
CMD ["node", "server/server.js"]
