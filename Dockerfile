# Use an official Node.js image
FROM node:alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (if present)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the entire application code into the container
COPY . .

RUN mkdir /data

# Expose the port used by the application (here, 5000)
EXPOSE 5000

# Run the initialization script and then start the application
CMD ["node", "index.js"]
