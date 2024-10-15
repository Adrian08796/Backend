// models/WorkoutPlan.js

const mongoose = require('mongoose');
const crypto = require('crypto');

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

  // Generate shareId if the plan is being shared and doesn't have a shareId
  if (this.isShared && !this.shareId) {
    this.shareId = crypto.randomBytes(8).toString('hex');
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

// Method to generate share link
WorkoutPlanSchema.methods.getShareLink = function(baseUrl) {
  if (!this.isShared) {
    throw new Error('This plan is not shared');
  }
  
  // Generate shareId if it doesn't exist
  if (!this.shareId) {
    this.shareId = crypto.randomBytes(8).toString('hex');
    this.save(); // Note: In production, handle this save operation properly
  }
  
  return `${baseUrl}/import/${this.shareId}`;
};

// Static method to find a plan by its shareId
WorkoutPlanSchema.statics.findByShareId = function(shareId) {
  return this.findOne({ shareId, isShared: true }).populate('exercises');
};

// Method to create a copy of the plan for importing
WorkoutPlanSchema.methods.createImportCopy = function(userId, username) {
  const importedPlan = new this.constructor({
    ...this.toObject(),
    _id: undefined,
    user: userId,
    isDefault: false,
    isShared: false,
    shareId: undefined,
    importedFrom: {
      user: this.user,
      username: username,
      importDate: new Date(),
      shareId: this.shareId
    }
  });
  return importedPlan;
};

// Static method to find a plan by id, considering both user-specific and default plans
WorkoutPlanSchema.statics.findPlanById = function(planId, userId) {
  console.log('Finding plan with ID:', planId);
  console.log('User ID:', userId);
  
  return this.findOne({
    _id: planId,
    $or: [
      { user: userId },
      { isDefault: true }
    ]
  }).populate('exercises').then(plan => {
    console.log('Found plan:', plan);
    return plan;
  });
};

module.exports = mongoose.model('WorkoutPlan', WorkoutPlanSchema);