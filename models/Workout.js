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
  planName: {
    type: String,
    required: true
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
      },
      completedAt: {
        type: Date,
        required: true
      }
    }],
    completedAt: {
      type: Date,
      required: true
    },
    notes: {
      type: String,
      default: ''
    }
  }],
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

workoutSchema.statics.handlePlanDeletion = async function(planId, planName) {
  return this.updateMany(
    { plan: planId },
    { 
      $set: { planDeleted: true, planName: planName },
      $unset: { plan: "" }
    }
  );
};

module.exports = mongoose.model('Workout', workoutSchema);