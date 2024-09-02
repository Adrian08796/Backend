// models/TokenBlacklist.js

const mongoose = require('mongoose');

const TokenBlacklistSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: '15m' // Automatically remove the document after 15 minutes
  }
});

module.exports = mongoose.model('TokenBlacklist', TokenBlacklistSchema);