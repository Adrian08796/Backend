// models/Workout.js

const mongoose = require('mongoose');

const workoutSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkoutPlan',
    required: false
  },
  exercises: [{
    exercise: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exercise',
      required: true
    },
    sets: [{
      weight: {
        type: Number,
        required: true
      },
      reps: {
        type: Number,
        required: true
      }
    }]
  }],
  date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

workoutSchema.statics.handlePlanDeletion = async function(planId) {
  return this.updateMany(
    { plan: planId },
    { $unset: { plan: "" } }
  );
};

module.exports = mongoose.model('Workout', workoutSchema);