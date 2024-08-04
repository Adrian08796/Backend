const express = require('express');
const router = express.Router();
const Workout = require('../models/Workout');

// Get all workouts
router.get('/', async (req, res) => {
  try {
    const workouts = await Workout.find().populate('plan').populate('exercises.exercise');
    res.json(workouts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add a new workout
router.post('/', async (req, res) => {
  const workout = new Workout({
    plan: req.body.plan,
    exercises: req.body.exercises
  });

  try {
    const newWorkout = await workout.save();
    res.status(201).json(newWorkout);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get a specific workout
router.get('/:id', getWorkout, (req, res) => {
  res.json(res.workout);
});

// Middleware function to get a workout by ID
async function getWorkout(req, res, next) {
  let workout;
  try {
    workout = await Workout.findById(req.params.id).populate('plan').populate('exercises.exercise');
    if (workout == null) {
      return res.status(404).json({ message: 'Workout not found' });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }

  res.workout = workout;
  next();
}

module.exports = router;