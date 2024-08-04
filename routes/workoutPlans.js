// routes/workoutPlans.js

const express = require('express');
const router = express.Router();
const WorkoutPlan = require('../models/WorkoutPlan');
const Workout = require('../models/Workout');
const auth = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(auth);

// Get all workout plans
router.get('/', async (req, res) => {
  try {
    const workoutPlans = await WorkoutPlan.find({ user: req.user }).populate('exercises');
    res.json(workoutPlans);
  } catch (err) {
    console.error('Error fetching workout plans:', err);
    res.status(500).json({ message: 'Error fetching workout plans', error: err.message });
  }
});

// Create a new workout plan
router.post('/', async (req, res) => {
  console.log('Received workout plan:', req.body);
  try {
    const { name, exercises } = req.body;
    if (!name || !exercises || !Array.isArray(exercises)) {
      return res.status(400).json({ message: 'Invalid workout plan data' });
    }
    const newWorkoutPlan = new WorkoutPlan({ 
      user: req.user,
      name, 
      exercises 
    });
    const savedWorkoutPlan = await newWorkoutPlan.save();
    res.status(201).json(savedWorkoutPlan);
  } catch (err) {
    console.error('Error saving workout plan:', err);
    res.status(400).json({ message: 'Error saving workout plan', error: err.message });
  }
});

// Get a specific workout plan by ID
router.get('/:id', async (req, res) => {
  try {
    const workoutPlan = await WorkoutPlan.findOne({ _id: req.params.id, user: req.user }).populate('exercises');
    if (!workoutPlan) {
      return res.status(404).json({ message: 'Workout plan not found' });
    }
    res.json(workoutPlan);
  } catch (err) {
    console.error('Error fetching workout plan:', err);
    res.status(500).json({ message: 'Error fetching workout plan', error: err.message });
  }
});

// Update a workout plan
router.put('/:id', async (req, res) => {
  try {
    const updatedWorkoutPlan = await WorkoutPlan.findOneAndUpdate(
      { _id: req.params.id, user: req.user },
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedWorkoutPlan) {
      return res.status(404).json({ message: 'Workout plan not found' });
    }
    res.json(updatedWorkoutPlan);
  } catch (err) {
    console.error('Error updating workout plan:', err);
    res.status(400).json({ message: 'Error updating workout plan', error: err.message });
  }
});

// Delete a workout plan
router.delete('/:id', async (req, res) => {
  try {
    console.log('Attempting to delete workout plan:', req.params.id);
    
    const workoutPlan = await WorkoutPlan.findOne({ _id: req.params.id, user: req.user });
    if (!workoutPlan) {
      return res.status(404).json({ message: 'Workout plan not found' });
    }

    console.log('Workout plan found:', workoutPlan);

    // Remove the plan reference from associated workouts
    const updateResult = await Workout.handlePlanDeletion(req.params.id, workoutPlan.name);
    console.log('Update result for associated workouts:', updateResult);

    // Use deleteOne instead of remove
    const deleteResult = await WorkoutPlan.deleteOne({ _id: req.params.id });
    console.log('Delete result:', deleteResult);

    if (deleteResult.deletedCount === 0) {
      return res.status(404).json({ message: 'Workout plan not found or already deleted' });
    }

    res.json({ message: 'Workout plan deleted successfully', deleteResult });
  } catch (err) {
    console.error('Server error when deleting workout plan:', err);
    res.status(500).json({ message: 'Error deleting workout plan', error: err.message, stack: err.stack });
  }
});

module.exports = router;