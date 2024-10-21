// models/User.js

const mongoose = require('mongoose');

const MAX_ACTIVE_REFRESH_TOKENS = 5;

// Schema for user-specific exercise data
const UserExerciseSchema = new mongoose.Schema({
  exerciseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise' },
  name: String,
  description: String,
  target: [String],
  imageUrl: String,
  recommendation: {
    weight: Number,
    reps: Number,
    sets: Number,
    duration: Number,
    distance: Number,
    intensity: Number,
    incline: Number
  },
  category: String,
  exerciseType: String,
  measurementType: String
}, { _id: false });

// Main User Schema
const UserSchema = new mongoose.Schema({
  activeRefreshTokens: [{ type: String }],
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  experienceLevel: { 
    type: String, 
    enum: ['beginner', 'intermediate', 'advanced'], 
    default: 'beginner' 
  },
  userExercises: [UserExerciseSchema],
  deletedExercises: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Exercise' }],
  deletedExercisesDetails: [{
    exerciseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise' },
    exerciseData: {},
    deletedAt: { type: Date, default: Date.now }
  }],
  deletedWorkoutPlans: [{ type: mongoose.Schema.Types.ObjectId, ref: 'WorkoutPlan' }],
  isAdmin: { type: Boolean, default: false },
  hasSeenGuide: { 
    type: Boolean, 
    default: false 
  },
}, { timestamps: true }); // Add timestamps for createdAt and updatedAt

// Method to add a new refresh token
UserSchema.methods.addRefreshToken = function(token) {
  if (this.activeRefreshTokens.length >= MAX_ACTIVE_REFRESH_TOKENS) {
    this.activeRefreshTokens.shift(); // Remove the oldest token
  }
  this.activeRefreshTokens.push(token);
};

// Method to remove a specific refresh token
UserSchema.methods.removeRefreshToken = function(token) {
  const index = this.activeRefreshTokens.indexOf(token);
  if (index > -1) {
    this.activeRefreshTokens.splice(index, 1);
  }
};

// Method to update exercise recommendation
UserSchema.methods.updateExerciseRecommendation = function(exerciseId, newRecommendation) {
  const exerciseIndex = this.userExercises.findIndex(ex => ex.exerciseId.toString() === exerciseId.toString());
  if (exerciseIndex !== -1) {
    this.userExercises[exerciseIndex].recommendation = {
      ...this.userExercises[exerciseIndex].recommendation,
      ...newRecommendation
    };
  } else {
    // If the exercise doesn't exist in userExercises, add it
    this.userExercises.push({
      exerciseId: exerciseId,
      recommendation: newRecommendation
    });
  }
};

module.exports = mongoose.model('User', UserSchema);