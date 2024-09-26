// routes/exercises.js

const express = require('express');
const router = express.Router();
const Exercise = require('../models/Exercise');
const User = require('../models/User');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const CustomError = require('../utils/customError');
const mongoose = require('mongoose');

router.use(auth);

// Get all exercises and includes default exercises
router.get('/', auth, async (req, res, next) => {
  try {
    console.log('GET /exercises route called');
    console.log('User:', req.user);
    const user = await User.findById(req.user.id);
    if (!user) {
      console.log('User not found');
      return next(new CustomError('User not found', 404));
    }

    console.log('User found:', user.username);
    console.log('Deleted exercises:', user.deletedExercises);

    let exercises;

    if (user.isAdmin) {
      console.log('Fetching all exercises (admin)');
      exercises = await Exercise.find({});
    } else {
      console.log('Fetching exercises for normal user');
      exercises = await Exercise.find({
        $or: [
          { user: req.user.id },
          { isDefault: true },
          { user: { $exists: false } } // This will include exercises without a user field (which are typically default exercises)
        ],
        _id: { $nin: user.deletedExercises || [] } // Exclude deleted exercises
      });
    }

    console.log(`Fetched ${exercises.length} exercises`);
    res.json(exercises);
  } catch (err) {
    console.error('Error in GET /exercises:', err);
    next(new CustomError('Error fetching exercises: ' + err.message, 500));
  }
});

// Admin route to create a default exercise
router.post('/default', auth, adminAuth, async (req, res, next) => {
  console.log('Creating default exercise - User:', req.user);
  try {
    const { name, description, target, imageUrl, category, exerciseType, measurementType } = req.body;
    
    const newExercise = new Exercise({
      name,
      description,
      target: Array.isArray(target) ? target : [target],
      imageUrl,
      category,
      exerciseType,
      measurementType,
      isDefault: true
    });

    const savedExercise = await newExercise.save();
    res.status(201).json(savedExercise);
  } catch (err) {
    next(new CustomError('Error creating default exercise: ' + err.message, 500));
  }
});

// Add a new exercise
router.post('/', auth, async (req, res, next) => {
  try {
    const { name, description, target, imageUrl, category } = req.body;
    
    let exerciseType, measurementType;
    if (category === 'Strength') {
      exerciseType = 'strength';
      measurementType = 'weight_reps';
    } else if (category === 'Cardio') {
      exerciseType = 'cardio';
      measurementType = 'duration';
    } else {
      exerciseType = 'strength';
      measurementType = 'duration';
    }

    const newExercise = new Exercise({
      name,
      description,
      target: Array.isArray(target) ? target : [target],
      imageUrl: imageUrl || undefined,
      category,
      exerciseType,
      measurementType,
      user: req.user.id
    });

    const savedExercise = await newExercise.save();
    res.status(201).json(savedExercise);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const validationErrors = Object.values(err.errors).map(error => error.message);
      return next(new CustomError(`Validation error: ${validationErrors.join(', ')}`, 400));
    }
    next(new CustomError('Error creating exercise', 500));
  }
});

// Recommendations update route 
router.put('/:id/recommendations', auth, async (req, res, next) => {
  try {
    const { level, recommendations } = req.body;
    const updatedExercise = await Exercise.findByIdAndUpdate(
      req.params.id,
      { $set: { [`recommendations.${level}`]: recommendations } },
      { new: true, runValidators: true }
    );
    if (!updatedExercise) {
      return next(new CustomError('Exercise not found', 404));
    }
    res.json(updatedExercise);
  } catch (err) {
    next(new CustomError('Error updating exercise recommendations', 400));
  }
});

// Get a specific exercise by ID
router.get('/:id', auth, async (req, res, next) => {
  try {
    console.log('Fetching exercise with ID:', req.params.id);
    const exercise = await Exercise.findById(req.params.id);
    if (!exercise) {
      console.log('Exercise not found for ID:', req.params.id);
      return res.status(404).json({ message: 'Exercise not found' });
    }
    res.json(exercise);
  } catch (err) {
    console.error('Error fetching exercise:', err);
    next(new CustomError('Error fetching exercise: ' + err.message, 500));
  }
});

// Update an exercise
router.put('/:id', async (req, res, next) => {
  try {
    const { target, category, exerciseType, measurementType } = req.body;
    if (target && !Array.isArray(target)) {
      req.body.target = [target];
    }
    const updatedExercise = await Exercise.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updatedExercise) {
      return next(new CustomError('Exercise not found', 404));
    }
    res.json(updatedExercise);
  } catch (err) {
    next(new CustomError('Error updating exercise', 400));
  }
});

// Delete an exercise
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const exercise = await Exercise.findById(req.params.id);
    
    if (!exercise) {
      return next(new CustomError('Exercise not found', 404));
    }

    const user = await User.findById(req.user.id);

    if (user.isAdmin) {
      // Admin can permanently delete the exercise
      await exercise.deleteOne();
      res.json({ message: 'Exercise deleted successfully' });
    } else if (exercise.isDefault) {
      // Normal user "deletes" a default exercise by adding it to their deletedExercises array
      user.deletedExercises.push(exercise._id);
      await user.save();
      res.json({ message: 'Exercise removed from your view' });
    } else if (exercise.user && exercise.user.toString() === req.user.id) {
      // Normal user deletes their own custom exercise
      await exercise.deleteOne();
      res.json({ message: 'Exercise deleted successfully' });
    } else {
      return next(new CustomError('Not authorized to delete this exercise', 403));
    }
  } catch (error) {
    next(new CustomError('Error deleting exercise: ' + error.message, 500));
  }
});

module.exports = router;