// models/DeletedExercise.js

const mongoose = require('mongoose');

const DeletedExerciseSchema = new mongoose.Schema({
  exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise' },
  exerciseData: {}, // This will store the complete exercise object
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: Date.now },
  isDefault: { type: Boolean, default: false }
});

module.exports = mongoose.model('DeletedExercise', DeletedExerciseSchema);