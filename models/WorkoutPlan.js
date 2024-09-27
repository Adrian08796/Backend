// models/WorkoutPlan.js

const mongoose = require('mongoose');

const WorkoutPlanSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() { return !this.isDefault; }
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  exercises: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exercise'
  }],
  scheduledDate: {
    type: Date
  },
  type: {
    type: String,
    enum: ['strength', 'cardio', 'flexibility', 'other'],
    default: 'other'
  },
  shareId: {
    type: String,
    unique: true,
    sparse: true
  },
  isShared: {
    type: Boolean,
    default: false
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
    },
    shareId: String
  },
}, {
  timestamps: true
});

WorkoutPlanSchema.index({ name: 1, user: 1 }, { unique: true, partialFilterExpression: { isDefault: false } });

// Pre-find middleware to populate exercises
WorkoutPlanSchema.pre('find', function(next) {
  this.populate('exercises');
  next();
});

WorkoutPlanSchema.pre('findOne', function(next) {
  this.populate('exercises');
  next();
});

// Pre-save middleware to ensure uniqueness of name for user or default plans
WorkoutPlanSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('name')) {
    const query = {
      name: this.name,
      $or: [
        { user: this.user },
        { isDefault: true }
      ]
    };

    if (!this.isNew) {
      query._id = { $ne: this._id };
    }

    const existingPlan = await this.constructor.findOne(query);

    if (existingPlan) {
      return next(new Error('A plan with this name already exists for this user or as a default plan'));
    }
  }
  next();
});

// Static method to handle plan deletion
WorkoutPlanSchema.statics.handlePlanDeletion = async function(planId) {
  const plan = await this.findById(planId);
  if (!plan) {
    throw new Error('Plan not found');
  }

  // If it's a default plan, only admins should be able to delete it
  if (plan.isDefault) {
    // This check should be done in the route handler
    // throw new Error('Default plans can only be deleted by admins');
  }

  await plan.deleteOne();
};

module.exports = mongoose.model('WorkoutPlan', WorkoutPlanSchema);