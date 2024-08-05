// routes/workouts.js

const express = require('express');
const router = express.Router();
const Workout = require('../models/Workout');
const auth = require('../middleware/auth');

router.use(auth);
router.use((req, res, next) => {
  console.log('Workout route accessed:', req.method, req.path);
  console.log('User:', req.user);
  next();
});

// Get all workouts for the current user
router.get('/user', async (req, res) => {
  try {
    const workouts = await Workout.find({ user: req.user })
      .populate('plan')
      .populate('exercises.exercise')
      .sort({ date: -1 });
    res.json(workouts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching workouts', error: error.message });
  }
});

// Add a new workout
router.post('/', async (req, res) => {
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
    res.status(400).json({ message: 'Error creating workout', error: error.message });
  }
});

// Get a specific workout
router.get('/:id', getWorkout, (req, res) => {
  res.json(res.workout);
});

// Update a workout
router.put('/:id', getWorkout, async (req, res) => {
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
    res.status(400).json({ message: 'Error updating workout', error: error.message });
  }
});

// Delete a workout
router.delete('/:id', getWorkout, async (req, res) => {
  try {
    await res.workout.remove();
    res.json({ message: 'Workout deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting workout', error: error.message });
  }
});

// Middleware function to get a workout by ID
async function getWorkout(req, res, next) {
  try {
    const workout = await Workout.findById(req.params.id)
      .populate('plan').populate('exercises.exercise');
      if (workout == null) {
        return res.status(404).json({ message: 'Workout not found' });
      }
      if (workout.user.toString() !== req.user) {
        return res.status(403).json({ message: 'Not authorized to access this workout' });
      }
      res.workout = workout;
      next();
    } catch (error) {
      return res.status(500).json({ message: 'Error fetching workout', error: error.message });
    }
  }
  
  module.exports = router;