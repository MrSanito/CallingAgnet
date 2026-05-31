FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package configuration files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy application source code
COPY . .

# Expose server port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Default command runs the HTTP server.
# To run the worker in production, run the container with command: "npm run start:worker"
CMD ["npm", "start"]
