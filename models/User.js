// models/User.js

const mongoose = require('mongoose');

const MAX_ACTIVE_REFRESH_TOKENS = 5;

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
});

UserSchema.methods.addRefreshToken = function(token) {
  if (this.activeRefreshTokens.length >= MAX_ACTIVE_REFRESH_TOKENS) {
    this.activeRefreshTokens.shift(); // Remove the oldest token
  }
  this.activeRefreshTokens.push(token);
};

UserSchema.methods.removeRefreshToken = function(token) {
  const index = this.activeRefreshTokens.indexOf(token);
  if (index > -1) {
    this.activeRefreshTokens.splice(index, 1);
  }
};

module.exports = mongoose.model('User', UserSchema);