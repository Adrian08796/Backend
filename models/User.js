// models/User.js

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
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
  // Authentication fields
  activeRefreshTokens: [{ type: String }],
  username: { 
    type: String, 
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [30, 'Username cannot exceed 30 characters']
  },
  email: { 
    type: String, 
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },

  // Email verification fields
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,

  // User preferences
  experienceLevel: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },
  preferences: {
    showDefaultPlans: {
      type: Boolean,
      default: true
    },
    emailNotifications: {
      type: Boolean,
      default: true
    },
    language: {
      type: String,
      default: 'en'
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    }
  },

  // Exercise and workout related fields
  userExercises: [UserExerciseSchema],
  deletedExercises: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Exercise' 
  }],
  deletedExercisesDetails: [{
    exerciseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise' },
    exerciseData: {},
    deletedAt: { type: Date, default: Date.now }
  }],
  deletedWorkoutPlans: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'WorkoutPlan' 
  }],

  // User status fields
  isAdmin: { 
    type: Boolean, 
    default: false 
  },
  hasSeenGuide: {
    type: Boolean,
    default: false
  },
  accountStatus: {
    type: String,
    enum: ['active', 'suspended', 'deactivated'],
    default: 'active'
  },
  lastLogin: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index definitions
UserSchema.index({ email: 1 });
UserSchema.index({ username: 1 });
UserSchema.index({ 'userExercises.exerciseId': 1 });

// Token management methods
UserSchema.methods.addRefreshToken = function(token) {
  if (this.activeRefreshTokens.length >= MAX_ACTIVE_REFRESH_TOKENS) {
    this.activeRefreshTokens.shift();
  }
  this.activeRefreshTokens.push(token);
};

UserSchema.methods.removeRefreshToken = function(token) {
  const index = this.activeRefreshTokens.indexOf(token);
  if (index > -1) {
    this.activeRefreshTokens.splice(index, 1);
  }
};

// Exercise management methods
UserSchema.methods.updateExerciseRecommendation = function(exerciseId, newRecommendation) {
  const exerciseIndex = this.userExercises.findIndex(ex => 
    ex.exerciseId.toString() === exerciseId.toString()
  );
  
  if (exerciseIndex !== -1) {
    this.userExercises[exerciseIndex].recommendation = {
      ...this.userExercises[exerciseIndex].recommendation,
      ...newRecommendation
    };
  } else {
    this.userExercises.push({
      exerciseId: exerciseId,
      recommendation: newRecommendation
    });
  }
};

// Token generation methods
UserSchema.methods.generateVerificationToken = function() {
  const token = jwt.sign(
    { 
      userId: this._id,
      email: this.email,
      type: 'email-verification'
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '24h' }
  );
  
  this.emailVerificationToken = token;
  this.emailVerificationExpires = Date.now() + (24 * 60 * 60 * 1000);
  return token;
};

UserSchema.methods.generatePasswordResetToken = function() {
  const token = jwt.sign(
    { 
      userId: this._id,
      type: 'password-reset'
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '1h' }
  );
  
  this.passwordResetToken = token;
  this.passwordResetExpires = Date.now() + (60 * 60 * 1000);
  return token;
};

// Security methods
UserSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

UserSchema.methods.incrementLoginAttempts = function() {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: {
        loginAttempts: 1,
        lockUntil: Date.now() + (5 * 60 * 1000)
      }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  if (this.loginAttempts + 1 >= 5) {
    updates.$set = { lockUntil: Date.now() + (5 * 60 * 1000) };
  }
  
  return this.updateOne(updates);
};

UserSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 }
  });
};

// Pre-save middleware
UserSchema.pre('save', function(next) {
  if (this.isModified('email')) {
    this.isEmailVerified = false;
  }
  next();
});

module.exports = mongoose.model('User', UserSchema);