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
  },
  totalPauseTime: {
    type: Number,
    default: 0
  },
  skippedPauses: {
    type: Number,
    default: 0
  },
  progression: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  }
}, {
  timestamps: true
});

workoutSchema.index({ user: 1, plan: 1, startTime: -1 });

workoutSchema.pre('save', function(next) {
  if (!this.planName && this.plan) {
    this.planName = 'Unnamed Plan';
  }
  next();
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