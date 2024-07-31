// models/Workout.js
const mongoose = require('mongoose');

const WorkoutSchema = new mongoose.Schema({
  exercise: { type: String, required: true },
  sets: { type: Number, required: true },
  reps: { type: Number, required: true },
  weight: { type: Number, required: true },
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Workout', WorkoutSchema);