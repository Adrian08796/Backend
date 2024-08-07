// models/WorkoutPlan.js

const mongoose = require('mongoose');

const WorkoutPlanSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  exercises: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exercise'
  }],
  scheduledDate: {
    type: Date
  },
  type: {
    type: String,
    enum: ['strength', 'cardio', 'flexibility', 'other'],
    default: 'other'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('WorkoutPlan', WorkoutPlanSchema);