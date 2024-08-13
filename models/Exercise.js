// models/Exercise.js

// models/Exercise.js

const mongoose = require('mongoose');

const ExerciseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Exercise name is required'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  description: {
    type: String,
    required: [true, 'Exercise description is required'],
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  target: {
    type: [String],
    required: [true, 'Target muscle group is required'],
    validate: {
      validator: function(v) {
        return Array.isArray(v) && v.length > 0;
      },
      message: 'At least one target muscle group must be specified'
    }
  },
  imageUrl: {
    type: String,
    default: 'https://www.inspireusafoundation.org/wp-content/uploads/2023/03/barbell-bench-press-side-view.gif'
  },
  category: {
    type: String,
    required: [true, 'Exercise category is required'],
    enum: ['Strength', 'Cardio', 'Flexibility'],
    default: 'Strength'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Exercise', ExerciseSchema);