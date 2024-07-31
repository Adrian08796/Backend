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
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// Import routes
const exerciseRoutes = require('./routes/exercises');
const workoutRoutes = require('./routes/workouts');
const workoutPlanRoutes = require('./routes/workoutPlans');

// Use routes
app.use('/api/exercises', exerciseRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/workoutplans', workoutPlanRoutes);

const PORT = process.env.PORT || 4500;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));