// models/WorkoutPlan.js
const mongoose = require('mongoose');

const WorkoutPlanSchema = new mongoose.Schema({
  name: { type: String, required: true },
  exercises: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Exercise' }],
});

module.exports = mongoose.model('WorkoutPlan', WorkoutPlanSchema);