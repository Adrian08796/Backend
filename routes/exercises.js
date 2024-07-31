// routes/exercises.js
const router = require('express').Router();
const Exercise = require('../models/Exercise');

router.get('/', async (req, res) => {
  try {
    const exercises = await Exercise.find();
    res.json(exercises);
  } catch (err) {
    res.status(400).json('Error: ' + err);
  }
});

router.post('/', async (req, res) => {
  const newExercise = new Exercise(req.body);
  try {
    const savedExercise = await newExercise.save();
    res.json(savedExercise);
  } catch (err) {
    res.status(400).json('Error: ' + err);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const exercise = await Exercise.findById(req.params.id);
    res.json(exercise);
  } catch (err) {
    res.status(400).json('Error: ' + err);
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updatedExercise = await Exercise.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedExercise);
  } catch (err) {
    res.status(400).json('Error: ' + err);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Exercise.findByIdAndDelete(req.params.id);
    res.json('Exercise deleted.');
  } catch (err) {
    res.status(400).json('Error: ' + err);
  }
});

module.exports = router;