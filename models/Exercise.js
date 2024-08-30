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
  },
  exerciseType: {
    type: String,
    required: [true, 'Exercise type is required'],
    enum: ['strength', 'cardio'],
    validate: {
      validator: function(v) {
        if (this.category === 'Strength') return v === 'strength';
        if (this.category === 'Cardio') return v === 'cardio';
        return true; // For Flexibility, we don't strictly enforce a type
      },
      message: 'Exercise type must match the category'
    }
  },
  measurementType: {
    type: String,
    required: [true, 'Measurement type is required'],
    enum: ['weight_reps', 'duration', 'distance', 'intensity', 'incline'],
    validate: {
      validator: function(v) {
        if (this.category === 'Strength') return v === 'weight_reps';
        if (this.category === 'Cardio') return ['duration', 'distance', 'intensity', 'incline'].includes(v);
        return true; // For Flexibility, we don't strictly enforce a measurement type
      },
      message: 'Measurement type must be appropriate for the exercise category'
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Exercise', ExerciseSchema);