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
  },
  shareId: {
    type: String,
    unique: true,
    sparse: true
  },
  isShared: {
    type: Boolean,
    default: false
  },
  importedFrom: {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    username: String,
    importDate: {
      type: Date,
      default: Date.now
    },
    shareId: String
  }
}, {
  timestamps: true
});

// Add this pre-find middleware
WorkoutPlanSchema.pre('find', function(next) {
  this.populate({
    path: 'exercises',
    match: { $or: [{ user: this.getQuery().user }, { user: { $exists: false } }] }
  });
  next();
});

WorkoutPlanSchema.pre('findOne', function(next) {
  this.populate({
    path: 'exercises',
    match: { $or: [{ user: this.getQuery().user }, { user: { $exists: false } }] }
  });
  next();
});

module.exports = mongoose.model('WorkoutPlan', WorkoutPlanSchema);