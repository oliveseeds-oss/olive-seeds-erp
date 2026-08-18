FROM node:20-alpine
WORKDIR /app
# Install dependencies
COPY package*.json ./
RUN npm install --production
# Copy source
COPY . .
# Create upload directories
RUN mkdir -p uploads/company \
uploads/signatures \
uploads/products \
uploads/bulk \
uploads/import \
uploads/docs \
logs
EXPOSE 5000
CMD ["node", "server.js"]