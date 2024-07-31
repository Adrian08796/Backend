// routes/workouts.js
const router = require('express').Router();
const Workout = require('../models/Workout');

router.get('/', async (req, res) => {
  try {
    const workouts = await Workout.find();
    res.json(workouts);
  } catch (err) {
    res.status(400).json('Error: ' + err);
  }
});

router.post('/', async (req, res) => {
  const newWorkout = new Workout(req.body);
  try {
    const savedWorkout = await newWorkout.save();
    res.json(savedWorkout);
  } catch (err) {
    res.status(400).json('Error: ' + err);
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updatedWorkout = await Workout.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedWorkout);
  } catch (err) {
    res.status(400).json('Error: ' + err);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Workout.findByIdAndDelete(req.params.id);
    res.json('Workout deleted.');
  } catch (err) {
    res.status(400).json('Error: ' + err);
  }
});

// Add routes for update and delete as needed

module.exports = router;