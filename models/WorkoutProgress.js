// /workspace/models/WorkoutProgress.js

const mongoose = require('mongoose');

const SetSchema = new mongoose.Schema({
  weight: Number,
  reps: Number,
  duration: Number,
  distance: Number,
  intensity: Number,
  incline: Number,
  completedAt: {
    type: Date,
    required: true
  },
  skippedRest: {
    type: Boolean,
    default: false
  }
});

const ExerciseProgressSchema = new mongoose.Schema({
  exercise: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exercise',
    required: true
  },
  sets: [SetSchema],
  notes: String,
  requiredSets: {
    type: Number,
    default: 3
  }
});

const WorkoutProgressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkoutPlan',
    required: true
  },
  exercises: [ExerciseProgressSchema],
  currentExerciseIndex: {
    type: Number,
    default: 0
  },
  startTime: {
    type: Date,
    required: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  totalPauseTime: {
    type: Number,
    default: 0
  },
  skippedPauses: {
    type: Number,
    default: 0
  },
  lastSetValues: {
    type: mongoose.Schema.Types.Mixed
  },
  completedSets: {
    type: Number,
    default: 0
  },
  totalSets: {
    type: Number,
    default: 0
  },
  notes: [String]
});

module.exports = mongoose.model('WorkoutProgress', WorkoutProgressSchema);