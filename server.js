// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// Import routes
const exerciseRoutes = require('./routes/exercises');
const workoutRoutes = require('./routes/workouts');
const workoutPlanRoutes = require('./routes/workoutPlans');
const authRoutes = require('./routes/auth');

// Use routes
app.use('/api/exercises', exerciseRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/workoutplans', workoutPlanRoutes);
app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 4500;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));