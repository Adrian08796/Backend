// models/User.js

const mongoose = require('mongoose');

const MAX_ACTIVE_REFRESH_TOKENS = 5;

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  activeRefreshTokens: [{ type: String }]
});

UserSchema.methods.addRefreshToken = function(token) {
  this.activeRefreshTokens.push(token);
  if (this.activeRefreshTokens.length > MAX_ACTIVE_REFRESH_TOKENS) {
    this.activeRefreshTokens.shift(); // Remove the oldest token
  }
};

UserSchema.methods.removeRefreshToken = function(token) {
  this.activeRefreshTokens = this.activeRefreshTokens.filter(t => t !== token);
};

module.exports = mongoose.model('User', UserSchema);