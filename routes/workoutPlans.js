// routes/workoutPlans.js

const express = require('express');
const router = express.Router();
const WorkoutPlan = require('../models/WorkoutPlan');
const Exercise = require('../models/Exercise');
const User = require('../models/User');
const auth = require('../middleware/auth');
const CustomError = require('../utils/customError');
const crypto = require('crypto');
const mongoose = require('mongoose');
const adminAuth = require('../middleware/adminAuth');

router.use(auth);

// Get a specific workout plan
router.get('/:id', auth, async (req, res, next) => {
  try {
    const plan = await WorkoutPlan.findOne({ _id: req.params.id, user: req.user.id })
      .populate('exercises');
    
    if (!plan) {
      return next(new CustomError('Workout plan not found', 404));
    }
    
    res.json(plan);
  } catch (err) {
    next(new CustomError('Error fetching workout plan: ' + err.message, 500));
  }
});

// Get all workout plans including default plans
router.get('/', auth, async (req, res, next) => {
  try {
    const workoutPlans = await WorkoutPlan.find({ 
      $or: [
        { user: req.user.id },
        { isDefault: true }
      ]
    });
    res.json(workoutPlans);
  } catch (err) {
    next(new CustomError('Error fetching workout plans', 500));
  }
});

// Create a new workout plan
router.post('/', async (req, res, next) => {
  try {
    const { name, exercises, scheduledDate, type } = req.body;
    if (!name || !exercises || !Array.isArray(exercises)) {
      return next(new CustomError('Invalid workout plan data', 400));
    }
    const newWorkoutPlan = new WorkoutPlan({ 
      user: req.user.id,
      name, 
      exercises,
      scheduledDate,
      type
    });
    const savedWorkoutPlan = await newWorkoutPlan.save();
    const populatedPlan = await WorkoutPlan.findById(savedWorkoutPlan._id);
    res.status(201).json(populatedPlan);
  } catch (err) {
    next(new CustomError('Error saving workout plan', 400));
  }
});

// Update a workout plan
router.put('/:id', async (req, res, next) => {
  try {
    const { name, exercises, scheduledDate, type } = req.body;
    const updatedWorkoutPlan = await WorkoutPlan.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { name, exercises, scheduledDate, type },
      { new: true, runValidators: true }
    ).populate('exercises');
    if (!updatedWorkoutPlan) {
      return next(new CustomError('Workout plan not found', 404));
    }
    res.json(updatedWorkoutPlan);
  } catch (err) {
    next(new CustomError('Error updating workout plan', 400));
  }
});

// Admin route to create a default workout plan
router.post('/default', auth, adminAuth, async (req, res, next) => {
  try {
    const { name, exercises, scheduledDate, type } = req.body;
    if (!name || !exercises || !Array.isArray(exercises)) {
      return next(new CustomError('Invalid workout plan data', 400));
    }
    const newWorkoutPlan = new WorkoutPlan({ 
      name, 
      exercises,
      scheduledDate,
      type,
      isDefault: true
    });
    const savedWorkoutPlan = await newWorkoutPlan.save();
    res.status(201).json(savedWorkoutPlan);
  } catch (err) {
    next(new CustomError('Error saving default workout plan', 400));
  }
});

// Add an exercise to a workout plan
router.post('/:id/exercises', async (req, res, next) => {
  try {
    console.log('Received request to add exercise to plan:', req.params.id, req.body);
    const { exerciseId } = req.body;
    if (!exerciseId) {
      return next(new CustomError('Exercise ID is required', 400));
    }

    const exercise = await Exercise.findById(exerciseId);
    if (!exercise) {
      return next(new CustomError('Exercise not found', 404));
    }

    const workoutPlan = await WorkoutPlan.findOne({ _id: req.params.id, user: req.user.id });
    if (!workoutPlan) {
      return next(new CustomError('Workout plan not found', 404));
    }

    if (workoutPlan.exercises.includes(exerciseId)) {
      return next(new CustomError('Exercise already in the workout plan', 400));
    }

    workoutPlan.exercises.push(exerciseId);
    await workoutPlan.save();

    const updatedPlan = await WorkoutPlan.findById(workoutPlan._id).populate('exercises');
    console.log('Successfully added exercise to plan:', updatedPlan);
    res.json(updatedPlan);
  } catch (err) {
    console.error('Error adding exercise to workout plan:', err);
    next(new CustomError('Error adding exercise to workout plan', 400));
  }
});

// Delete a workout plan
router.delete('/:id', async (req, res, next) => {
  try {
    const workoutPlan = await WorkoutPlan.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!workoutPlan) {
      return next(new CustomError('Workout plan not found', 404));
    }
    res.json({ message: 'Workout plan deleted successfully' });
  } catch (err) {
    next(new CustomError('Error deleting workout plan', 500));
  }
});

// Remove an exercise from a workout plan
router.delete('/:planId/exercises/:exerciseId', auth, async (req, res, next) => {
  try {
    const { planId, exerciseId } = req.params;
    const plan = await WorkoutPlan.findOne({ _id: planId, user: req.user.id });

    if (!plan) {
      return next(new CustomError('Workout plan not found', 404));
    }

    // Check if the exercise exists in the plan
    const exerciseIndex = plan.exercises.findIndex(ex => 
      ex.toString() === exerciseId || ex._id.toString() === exerciseId
    );

    if (exerciseIndex === -1) {
      return next(new CustomError('Exercise not found in the workout plan', 404));
    }

    // Remove the exercise
    plan.exercises.splice(exerciseIndex, 1);
    await plan.save();

    // Populate the exercises field before sending the response
    await plan.populate('exercises');

    res.json(plan);
  } catch (err) {
    console.error('Error removing exercise from workout plan:', err);
    next(new CustomError('Error removing exercise from workout plan', 500));
  }
});

// Generate a share link for a workout plan
router.post('/:id/share', auth, async (req, res, next) => {
  try {
    const plan = await WorkoutPlan.findOne({ _id: req.params.id, user: req.user.id }).populate('exercises');
    
    if (!plan) {
      return next(new CustomError('Workout plan not found', 404));
    }

    if (!plan.shareId) {
      plan.shareId = crypto.randomBytes(8).toString('hex');
    }
    
    plan.isShared = true;

    await plan.save();

    const shareLink = `${process.env.FRONTEND_URL}/import/${plan.shareId}`;
    
    res.json({ shareLink, plan });
  } catch (err) {
    next(new CustomError('Error sharing workout plan: ' + err.message, 500));
  }
});

// Import a shared workout plan
router.post('/import/:shareId', auth, async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const sharedPlan = await WorkoutPlan.findOne({ shareId: req.params.shareId })
      .populate('exercises')
      .populate('user', 'username')
      .session(session);

    if (!sharedPlan) {
      throw new CustomError('Shared workout plan not found', 404);
    }

    const newExercises = await Promise.all(sharedPlan.exercises.map(async (exercise) => {
      let existingExercise = await Exercise.findOne({ 
        name: exercise.name, 
        user: { $in: [req.user.id, null] } 
      }).session(session);

      if (existingExercise) {
        return existingExercise;
      }

      const newExercise = new Exercise({
        ...exercise.toObject(),
        _id: undefined,
        user: req.user.id,
        importedFrom: {
          user: sharedPlan.user._id,
          username: sharedPlan.user.username,
          importDate: new Date()
        }
      });

      return await newExercise.save({ session });
    }));

    const newPlan = new WorkoutPlan({
      ...sharedPlan.toObject(),
      _id: undefined,
      user: req.user.id,
      exercises: newExercises.map(e => e._id),
      isShared: false,
      shareId: undefined,
      importedFrom: {
        user: sharedPlan.user._id,
        username: sharedPlan.user.username,
        importDate: new Date(),
        shareId: req.params.shareId
      }
    });

    await newPlan.save({ session });

    await session.commitTransaction();

    // Populate the exercises before sending the response
    await newPlan.populate('exercises');

    res.status(201).json(newPlan);
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
});

module.exports = router;