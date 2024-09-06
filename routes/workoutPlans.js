// routes/workoutPlans.js

const express = require('express');
const router = express.Router();
const WorkoutPlan = require('../models/WorkoutPlan');
const Exercise = require('../models/Exercise');
const auth = require('../middleware/auth');
const CustomError = require('../utils/customError');
const crypto = require('crypto');

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
router.post('/:id/share', async (req, res, next) => {
  try {
    const plan = await WorkoutPlan.findOne({ _id: req.params.id, user: req.user.id });
    if (!plan) {
      return next(new CustomError('Workout plan not found', 404));
    }

    if (!plan.shareId) {
      plan.shareId = crypto.randomBytes(8).toString('hex');
    }
    plan.isShared = true;
    await plan.save();

    res.json({ shareLink: `${process.env.FRONTEND_URL}/import/${plan.shareId}` });
  } catch (err) {
    next(new CustomError('Error sharing workout plan', 500));
  }
});

// Import a shared workout plan
router.post('/import/:shareId', auth, async (req, res, next) => {
  try {
    console.log('Importing workout plan with shareId:', req.params.shareId);
    const sharedPlan = await WorkoutPlan.findOne({ shareId: req.params.shareId }).populate('exercises');
    if (!sharedPlan) {
      console.log('Shared workout plan not found');
      return next(new CustomError('Shared workout plan not found', 404));
    }

    console.log('Found shared plan:', sharedPlan);

    const newExercises = await Promise.all(sharedPlan.exercises.map(async (exercise) => {
      const existingExercise = await Exercise.findOne({ name: exercise.name, user: req.user.id });
      if (existingExercise) {
        return existingExercise._id;
      } else {
        const newExercise = new Exercise({
          ...exercise.toObject(),
          _id: undefined,
          user: req.user.id
        });
        const savedExercise = await newExercise.save();
        return savedExercise._id;
      }
    }));

    const newPlan = new WorkoutPlan({
      ...sharedPlan.toObject(),
      _id: undefined,
      user: req.user.id,
      exercises: newExercises,
      isShared: false,
      shareId: undefined
    });

    const savedPlan = await newPlan.save();
    console.log('Imported plan saved:', savedPlan);
    res.status(201).json(savedPlan);
  } catch (err) {
    console.error('Error importing workout plan:', err);
    next(new CustomError('Error importing workout plan: ' + err.message, 500));
  }
});

module.exports = router;