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
  const newWorkoutPlan = new WorkoutPlan(req.body);
  try {
    const savedWorkoutPlan = await newWorkoutPlan.save();
    res.json(savedWorkoutPlan);
  } catch (err) {
    res.status(400).json('Error: ' + err);
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