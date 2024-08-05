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
      .populate('plan')
      .populate('exercises.exercise')
      .sort({ date: -1 });
    res.json(workouts);
  } catch (error) {
    next(new CustomError('Error fetching workouts', 500));
  }
});

// Add a new workout
router.post('/', async (req, res, next) => {
  try {
    console.log('Received workout data:', req.body);
    const { plan, planName, exercises } = req.body;
    const workout = new Workout({
      user: req.user,
      plan,
      planName,
      exercises
    });
    const newWorkout = await workout.save();
    const populatedWorkout = await Workout.findById(newWorkout._id)
      .populate('plan')
      .populate('exercises.exercise');
    res.status(201).json(populatedWorkout);
  } catch (error) {
    console.error('Server error:', error);
    next(new CustomError('Error creating workout', 400));
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
    await res.workout.remove();
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