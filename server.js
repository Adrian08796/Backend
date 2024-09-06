// server.js

const express = require('express');
const mongoose = require('mongoose');
const app = express();
const cors = require('cors');
const http = require('http');
const https = require('https');
const fs = require('fs');
const jwt = require('jsonwebtoken');
require('dotenv').config();
require('newrelic');

// Middleware

app.use(cors({
  origin: [process.env.DEV_ORIGIN, process.env.PROD_ORIGIN,],
  credentials: true
}));
app.use(express.json());

// Verify that the JWT secrets are set
if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
  console.error('JWT secrets are not set. Please check your .env file.');
  process.exit(1);
}

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// Import routes
const authRoutes = require('./routes/auth');
const exerciseRoutes = require('./routes/exercises');
const workoutRoutes = require('./routes/workouts');
const workoutPlanRoutes = require('./routes/workoutPlans');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/workoutplans', workoutPlanRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: 'error',
    statusCode: statusCode,
    message: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 4500;

// Function to start HTTP server
const startHttpServer = (port) => {
  const server = http.createServer(app);
  server.listen(port, () => {
    console.log(`HTTP Server running on port ${port}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.log(`Port ${port} is already in use. Trying port ${port + 1}...`);
      startHttpServer(port + 1);
    } else {
      console.error('Error starting server:', error);
    }
  });
};

// Check if we're in production mode
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  // Production: Attempt to use HTTPS, fallback to HTTP if certificates are not found
  try {
    const privateKey = fs.readFileSync('/path/to/privkey.pem', 'utf8');
    const certificate = fs.readFileSync('/path/to/cert.pem', 'utf8');
    const ca = fs.readFileSync('/path/to/chain.pem', 'utf8');

    const credentials = {
      key: privateKey,
      cert: certificate,
      ca: ca
    };

    const httpsServer = https.createServer(credentials, app);

    httpsServer.listen(PORT, () => {
      console.log(`HTTPS Server running on port ${PORT}`);
    });

    httpsServer.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.log(`Port ${PORT} is already in use. Falling back to HTTP...`);
        startHttpServer(PORT);
      } else {
        console.error('Error starting HTTPS server:', error);
      }
    });
  } catch (error) {
    console.warn('SSL certificates not found, falling back to HTTP');
    startHttpServer(PORT);
  }
} else {
  // Development: Use HTTP
  startHttpServer(PORT);
}