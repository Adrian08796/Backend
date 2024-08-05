// routes/workoutPlans.js

const express = require('express');
const router = express.Router();
const WorkoutPlan = require('../models/WorkoutPlan');
const Workout = require('../models/Workout');
const auth = require('../middleware/auth');
const CustomError = require('../utils/customError');

router.use(auth);

// Get all workout plans
router.get('/', async (req, res, next) => {
  try {
    const workoutPlans = await WorkoutPlan.find({ user: req.user }).populate('exercises');
    res.json(workoutPlans);
  } catch (err) {
    next(new CustomError('Error fetching workout plans', 500));
  }
});

// Create a new workout plan
router.post('/', async (req, res, next) => {
  console.log('Received workout plan:', req.body);
  try {
    const { name, exercises } = req.body;
    if (!name || !exercises || !Array.isArray(exercises)) {
      return next(new CustomError('Invalid workout plan data', 400));
    }
    const newWorkoutPlan = new WorkoutPlan({ 
      user: req.user,
      name, 
      exercises 
    });
    const savedWorkoutPlan = await newWorkoutPlan.save();
    res.status(201).json(savedWorkoutPlan);
  } catch (err) {
    next(new CustomError('Error saving workout plan', 400));
  }
});

// Get a specific workout plan by ID
router.get('/:id', async (req, res, next) => {
  try {
    const workoutPlan = await WorkoutPlan.findOne({ _id: req.params.id, user: req.user }).populate('exercises');
    if (!workoutPlan) {
      return next(new CustomError('Workout plan not found', 404));
    }
    res.json(workoutPlan);
  } catch (err) {
    next(new CustomError('Error fetching workout plan', 500));
  }
});

// Update a workout plan
router.put('/:id', async (req, res, next) => {
  try {
    const updatedWorkoutPlan = await WorkoutPlan.findOneAndUpdate(
      { _id: req.params.id, user: req.user },
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedWorkoutPlan) {
      return next(new CustomError('Workout plan not found', 404));
    }
    res.json(updatedWorkoutPlan);
  } catch (err) {
    next(new CustomError('Error updating workout plan', 400));
  }
});

// Delete a workout plan
router.delete('/:id', async (req, res, next) => {
  try {
    console.log('Attempting to delete workout plan:', req.params.id);
    
    const workoutPlan = await WorkoutPlan.findOne({ _id: req.params.id, user: req.user });
    if (!workoutPlan) {
      return next(new CustomError('Workout plan not found', 404));
    }

    console.log('Workout plan found:', workoutPlan);

    // Remove the plan reference from associated workouts
    const updateResult = await Workout.handlePlanDeletion(req.params.id, workoutPlan.name);
    console.log('Update result for associated workouts:', updateResult);

    const deleteResult = await WorkoutPlan.deleteOne({ _id: req.params.id });
    console.log('Delete result:', deleteResult);

    if (deleteResult.deletedCount === 0) {
      return next(new CustomError('Workout plan not found or already deleted', 404));
    }

    res.json({ message: 'Workout plan deleted successfully', deleteResult });
  } catch (err) {
    next(new CustomError('Error deleting workout plan', 500));
  }
});

module.exports = router;