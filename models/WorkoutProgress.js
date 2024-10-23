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
    default: 3,
    min: 1,
    max: 100
  },
  recommendations: {
    weight: Number,
    reps: Number,
    sets: Number,
    duration: Number,
    distance: Number,
    intensity: Number,
    incline: Number
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
    default: 0,
    min: 0
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
    default: 0,
    min: 0
  },
  skippedPauses: {
    type: Number,
    default: 0,
    min: 0
  },
  lastSetValues: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: () => new Map()
  },
  requiredSets: {
    type: Map,
    of: Number,
    default: () => new Map()
  },
  completedSets: {
    type: Number,
    default: 0,
    min: 0
  },
  totalSets: {
    type: Number,
    default: 0,
    min: 0
  },
  notes: [String],
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'cancelled'],
    default: 'in_progress'
  },
  __v: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Add index for better query performance
WorkoutProgressSchema.index({ user: 1, plan: 1, startTime: -1 });

// Middleware to update lastUpdated timestamp
WorkoutProgressSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

// Method to calculate progress percentage
WorkoutProgressSchema.methods.calculateProgress = function() {
  if (this.totalSets === 0) return 0;
  return Math.min((this.completedSets / this.totalSets) * 100, 100);
};

// Method to validate sets against requirements
WorkoutProgressSchema.methods.validateSets = function() {
  return this.exercises.every(exercise => {
    if (exercise.sets.length > exercise.requiredSets) {
      return false;
    }
    return true;
  });
};

// Static method to find latest user progress
WorkoutProgressSchema.statics.findLatestUserProgress = function(userId) {
  return this.findOne({ 
    user: userId,
    status: 'in_progress'
  })
  .sort({ startTime: -1 })
  .populate('plan')
  .populate('exercises.exercise');
};

// Method to update exercise sets
WorkoutProgressSchema.methods.updateExerciseSets = function(exerciseIndex, newSet) {
  if (exerciseIndex >= 0 && exerciseIndex < this.exercises.length) {
    const exercise = this.exercises[exerciseIndex];
    
    // For cardio exercises, replace existing set
    if (exercise.exercise.category === 'Cardio') {
      exercise.sets = [newSet];
    } else {
      // For strength exercises, add to existing sets if not exceeding requiredSets
      if (exercise.sets.length < exercise.requiredSets) {
        exercise.sets.push(newSet);
      }
    }
    
    // Update completedSets count
    this.completedSets = this.exercises.reduce((total, ex) => total + ex.sets.length, 0);
    
    return true;
  }
  return false;
};

// Ensure version key is set
WorkoutProgressSchema.set('versionKey', '__v');

// Add timestamps for createdAt and updatedAt
WorkoutProgressSchema.set('timestamps', true);

// Create the model
const WorkoutProgress = mongoose.model('WorkoutProgress', WorkoutProgressSchema);

// Add validation for required sets
WorkoutProgress.schema.path('exercises').validate(function(exercises) {
  return exercises.every(exercise => {
    return exercise.requiredSets >= 1 && exercise.requiredSets <= 100;
  });
}, 'Required sets must be between 1 and 100');

module.exports = WorkoutProgress;