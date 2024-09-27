// models/Exercise.js

const mongoose = require('mongoose');

const RecommendationSchema = new mongoose.Schema({
  weight: { type: Number, default: 0 },
  reps: { type: Number, default: 0 },
  sets: { type: Number, default: 0 },
  duration: { type: Number }, // for cardio exercises
  distance: { type: Number }, // for cardio exercises
  intensity: { type: Number }, // for cardio exercises
  incline: { type: Number }  // for cardio exercises
}, { _id: false });

const UserExerciseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: String,
  description: String,
  target: [String],
  imageUrl: String,
  recommendation: RecommendationSchema
}, { _id: false });

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
  },
  measurementType: {
    type: String,
    required: [true, 'Measurement type is required'],
    enum: ['weight_reps', 'duration', 'distance', 'intensity', 'incline'],
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  }, 
  importedFrom: {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    username: String,
    importDate: {
      type: Date,
      default: Date.now
    }
  },
  recommendations: {
    beginner: {
      weight: Number,
      reps: Number,
      sets: Number,
      duration: Number,
      distance: Number,
      intensity: Number,
      incline: Number
    },
    intermediate: {
      weight: Number,
      reps: Number,
      sets: Number,
      duration: Number,
      distance: Number,
      intensity: Number,
      incline: Number,
    },
    advanced: {
      weight: Number,
      reps: Number,
      sets: Number,
      duration: Number,
      distance: Number,
      intensity: Number,
      incline: Number,
    },
  },
  userExercises: [UserExerciseSchema],
  isDefault: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// You might want to add some pre-save middleware to ensure consistency
ExerciseSchema.pre('save', function(next) {
  if (this.isDefault) {
    this.user = undefined; // Default exercises should not have a user
  }
  next();
});

// You could also add some instance methods or static methods if needed
ExerciseSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('Exercise', ExerciseSchema);