// routes/exercises.js

const router = require('express').Router();
const Exercise = require('../models/Exercise');
const CustomError = require('../utils/customError');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');

router.use(auth);

// Get all exercises
router.get('/', auth, async (req, res, next) => {
  try {
    const exercises = await Exercise.find({ 
      $or: [
        { user: req.user.id },
        { user: { $exists: false } }  // This will include exercises without a user
      ]
    });
    res.json(exercises);
  } catch (err) {
    next(new CustomError('Error fetching exercises', 500));
  }
});

// Add a new exercise
router.post('/', auth, async (req, res, next) => {
  try {
    const { name, description, target, imageUrl, category } = req.body;
    
    // Determine exerciseType and measurementType based on category
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
      user: req.user.id  // Add this line to include the user ID
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

// Reccomentations update route 
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
router.delete('/:id', async (req, res, next) => {
  try {
    const deletedExercise = await Exercise.findByIdAndDelete(req.params.id);
    if (!deletedExercise) {
      return next(new CustomError('Exercise not found', 404));
    }
    res.json({ message: 'Exercise deleted successfully' });
  } catch (err) {
    next(new CustomError('Error deleting exercise', 500));
  }
});

module.exports = router;