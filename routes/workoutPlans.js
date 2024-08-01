// routes/workoutPlans.js
const express = require('express');
const router = express.Router();
const WorkoutPlan = require('../models/WorkoutPlan');

// Get all workout plans
router.get('/', async (req, res) => {
  try {
    const workoutPlans = await WorkoutPlan.find().populate('exercises');
    res.json(workoutPlans);
  } catch (err) {
    res.status(400).json('Error: ' + err);
  }
});

// Create a new workout plan
router.post('/', async (req, res) => {
  console.log('Received workout plan:', req.body); // Log the received data
  try {
    const { name, exercises } = req.body;
    if (!name || !exercises || !Array.isArray(exercises)) {
      return res.status(400).json({ message: 'Invalid workout plan data' });
    }
    const newWorkoutPlan = new WorkoutPlan({ name, exercises });
    const savedWorkoutPlan = await newWorkoutPlan.save();
    res.json(savedWorkoutPlan);
  } catch (err) {
    console.error('Error saving workout plan:', err);
    res.status(400).json({ message: 'Error saving workout plan', error: err.message });
  }
});

// Get a specific workout plan by ID
router.get('/:id', async (req, res) => {
  try {
    const workoutPlan = await WorkoutPlan.findById(req.params.id).populate('exercises');
    if (!workoutPlan) {
      return res.status(404).json('Workout plan not found');
    }
    res.json(workoutPlan);
  } catch (err) {
    res.status(400).json('Error: ' + err);
  }
});

// Update a workout plan
router.put('/:id', async (req, res) => {
  try {
    const updatedWorkoutPlan = await WorkoutPlan.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true, runValidators: true }
    );
    if (!updatedWorkoutPlan) {
      return res.status(404).json('Workout plan not found');
    }
    res.json(updatedWorkoutPlan);
  } catch (err) {
    res.status(400).json('Error: ' + err);
  }
});

// Delete a workout plan
router.delete('/:id', async (req, res) => {
  console.log('Workout plan deleted successfully:', req.body); // Log the deleted data
  try {
    const deletedWorkoutPlan = await WorkoutPlan.findByIdAndDelete(req.params.id);
    if (!deletedWorkoutPlan) {
      return res.status(404).json('Workout plan not found');
    }
    res.json('Workout plan deleted successfully');
  } catch (err) {
    res.status(400).json('Error: ' + err);
  }
});

module.exports = router;