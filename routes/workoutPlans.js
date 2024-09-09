// routes/workoutPlans.js

const express = require('express');
const router = express.Router();
const WorkoutPlan = require('../models/WorkoutPlan');
const Exercise = require('../models/Exercise');
const User = require('../models/User');
const auth = require('../middleware/auth');
const CustomError = require('../utils/customError');
const crypto = require('crypto'); // Add this line to import the crypto module
const mongoose = require('mongoose');

router.use(auth);

// Get all workout plans
router.get('/', async (req, res, next) => {
  try {
    const workoutPlans = await WorkoutPlan.find({ user: req.user.id })
      .populate({
        path: 'exercises',
        select: 'name description target imageUrl category exerciseType measurementType'
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
    const populatedPlan = await WorkoutPlan.findById(savedWorkoutPlan._id).populate('exercises');
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

// Generate a share link for a workout plan
router.post('/:id/share', auth, async (req, res, next) => {
  try {
    console.log('Sharing workout plan with ID:', req.params.id);
    const plan = await WorkoutPlan.findOne({ _id: req.params.id, user: req.user.id });
    
    if (!plan) {
      console.log('Workout plan not found');
      return next(new CustomError('Workout plan not found', 404));
    }

    if (!plan.shareId) {
      plan.shareId = crypto.randomBytes(8).toString('hex');
      console.log('Generated new shareId:', plan.shareId);
    }
    
    plan.isShared = true;
    await plan.save();

    const shareLink = `${process.env.FRONTEND_URL}/import/${plan.shareId}`;
    console.log('Share link generated:', shareLink);
    
    res.json({ shareLink });
  } catch (err) {
    console.error('Error sharing workout plan:', err);
    next(new CustomError('Error sharing workout plan: ' + err.message, 500));
  }
});

// Import a shared workout plan
router.post('/import/:shareId', auth, async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log('Importing workout plan with shareId:', req.params.shareId);
    const sharedPlan = await WorkoutPlan.findOne({ shareId: req.params.shareId })
      .populate('exercises')
      .populate('user', 'username')
      .session(session);

    if (!sharedPlan) {
      await session.abortTransaction();
      session.endSession();
      console.log('Shared workout plan not found');
      return next(new CustomError('Shared workout plan not found', 404));
    }

    console.log('Found shared plan:', sharedPlan);

    // Check if the user has already imported this plan
    const existingImportedPlan = await WorkoutPlan.findOne({
      user: req.user.id,
      'importedFrom.shareId': req.params.shareId
    }).session(session);

    if (existingImportedPlan) {
      await session.abortTransaction();
      session.endSession();
      console.log('User has already imported this plan');
      return res.status(409).json({ message: 'You have already imported this workout plan' });
    }

    const newExercises = await Promise.all(sharedPlan.exercises.map(async (exercise) => {
      let existingExercise = await Exercise.findOne({ name: exercise.name, user: req.user.id }).session(session);
      if (existingExercise) {
        return existingExercise._id;
      } else {
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
        existingExercise = await newExercise.save({ session });
        return existingExercise._id;
      }
    }));

    const newPlan = new WorkoutPlan({
      ...sharedPlan.toObject(),
      _id: undefined,
      user: req.user.id,
      exercises: newExercises,
      isShared: false,
      shareId: undefined,
      importedFrom: {
        user: sharedPlan.user._id,
        username: sharedPlan.user.username,
        importDate: new Date(),
        shareId: req.params.shareId
      }
    });

    const savedPlan = await newPlan.save({ session });
    await session.commitTransaction();
    session.endSession();

    console.log('Imported plan saved:', savedPlan);
    res.status(201).json(savedPlan);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error importing workout plan:', err);
    next(new CustomError('Error importing workout plan: ' + err.message, 500));
  }
});

module.exports = router;