// models/User.js

const mongoose = require('mongoose');

const MAX_ACTIVE_REFRESH_TOKENS = 5;

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  activeRefreshTokens: [{ type: String }],
  experienceLevel: { 
    type: String, 
    enum: ['beginner', 'intermediate', 'advanced'], 
    default: 'beginner' 
  },
  isAdmin: { type: Boolean, default: false },
  deletedExercises: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Exercise' }],
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