const mongoose = require('mongoose');

const workoutSchema = new mongoose.Schema({
  plan: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'WorkoutPlan', 
    required: true 
  },
  exercises: [{
    exercise: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Exercise', 
      required: true 
    },
    sets: [{
      weight: { type: Number, required: true },
      reps: { type: Number, required: true }
    }]
  }],
  date: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('Workout', workoutSchema);