// routes/workouts.js

const express = require('express');
const router = express.Router();
const Workout = require('../models/Workout');
const auth = require('../middleware/auth');
const CustomError = require('../utils/customError');

router.use(auth);
router.use((req, res, next) => {
  console.log('Workout route accessed:', req.method, req.path);
  console.log('User:', req.user);
  next();
});

// Get all workouts for the current user
router.get('/user', async (req, res, next) => {
  try {
    const workouts = await Workout.find({ user: req.user })
      .populate({
        path: 'plan',
        select: 'name exercises', // Select the fields you need from the plan
        populate: {
          path: 'exercises',
          select: 'name description target' // Select the fields you need from the exercises
        }
      })
      .populate('exercises.exercise')
      .sort({ startTime: -1 }); // Sort by startTime instead of date

    console.log('Fetched workouts:', JSON.stringify(workouts, null, 2));

    res.json(workouts);
  } catch (error) {
    console.error('Error fetching workouts:', error);
    next(new CustomError('Error fetching workouts', 500));
  }
});

// Add a new workout
router.post('/', async (req, res, next) => {
  try {
    console.log('Received workout data:', JSON.stringify(req.body, null, 2));
    const { plan, planName, exercises, startTime, endTime } = req.body;
    
    if (!planName || !exercises || !startTime || !endTime) {
      return next(new CustomError('Missing required fields', 400));
    }

    if (!Array.isArray(exercises) || exercises.length === 0) {
      return next(new CustomError('Invalid exercises data', 400));
    }

    const workout = new Workout({
      user: req.user,
      plan: plan, // Make sure this is the plan ID
      planName,
      exercises: exercises.map(exercise => ({
        exercise: exercise.exercise,
        sets: exercise.sets.map(set => ({
          ...set,
          completedAt: new Date(set.completedAt)
        })),
        completedAt: new Date(exercise.completedAt)
      })),
      startTime: new Date(startTime),
      endTime: new Date(endTime)
    });

    console.log('New workout object:', JSON.stringify(workout, null, 2));

    const newWorkout = await workout.save();
    console.log('Saved workout:', JSON.stringify(newWorkout, null, 2));

    const populatedWorkout = await Workout.findById(newWorkout._id)
      .populate('plan')
      .populate('exercises.exercise');
    res.status(201).json(populatedWorkout);
  } catch (error) {
    console.error('Server error:', error);
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return next(new CustomError('Validation error', 400, validationErrors));
    }
    next(new CustomError('Error creating workout', 500));
  }
});

// Get a specific workout
router.get('/:id', getWorkout, (req, res) => {
  res.json(res.workout);
});

// Update a workout
router.put('/:id', getWorkout, async (req, res, next) => {
  if (req.body.plan != null) {
    res.workout.plan = req.body.plan;
  }
  if (req.body.planName != null) {
    res.workout.planName = req.body.planName;
  }
  if (req.body.exercises != null) {
    res.workout.exercises = req.body.exercises;
  }
  if (req.body.startTime != null) {
    res.workout.startTime = new Date(req.body.startTime);
  }
  if (req.body.endTime != null) {
    res.workout.endTime = new Date(req.body.endTime);
  }
  try {
    const updatedWorkout = await res.workout.save();
    res.json(updatedWorkout);
  } catch (error) {
    next(new CustomError('Error updating workout', 400));
  }
});

// Delete a workout
router.delete('/:id', getWorkout, async (req, res, next) => {
  try {
    await res.workout.deleteOne();
    res.json({ message: 'Workout deleted successfully' });
  } catch (error) {
    next(new CustomError('Error deleting workout', 500));
  }
});

// Middleware function to get a workout by ID
async function getWorkout(req, res, next) {
  try {
    const workout = await Workout.findById(req.params.id)
      .populate('plan').populate('exercises.exercise');
    if (workout == null) {
      return next(new CustomError('Workout not found', 404));
    }
    if (workout.user.toString() !== req.user) {
      return next(new CustomError('Not authorized to access this workout', 403));
    }
    res.workout = workout;
    next();
  } catch (error) {
    next(new CustomError('Error fetching workout', 500));
  }
}

module.exports = router;