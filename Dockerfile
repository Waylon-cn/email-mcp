# Use the official Node.js 18 Alpine image as a parent image
FROM node:18.20.5-alpine

# Set the working directory in the container
WORKDIR /app

# Set environment variables for email configuration (replace with your own values at runtime)
ENV EMAIL_USER=""
ENV EMAIL_PASSWORD=""
ENV EMAIL_TYPE="auto"

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Define the command to run the application
CMD ["npm", "start"]