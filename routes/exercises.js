// routes/exercises.js

const router = require('express').Router();
const Exercise = require('../models/Exercise');
const CustomError = require('../utils/customError');
const auth = require('../middleware/auth');

router.use(auth);

// Get all exercises
router.get('/', async (req, res, next) => {
  try {
    const exercises = await Exercise.find();
    res.json(exercises);
  } catch (err) {
    next(new CustomError('Error fetching exercises', 500));
  }
});

// Add a new exercise
router.post('/', async (req, res, next) => {
  try {
    const { name, description, target, imageUrl, category } = req.body;
    
    // Determine exerciseType and measurementType based on category
    let exerciseType, measurementType;
    if (category === 'Strength') {
      exerciseType = 'strength';
      measurementType = 'weight_reps';
    } else if (category === 'Cardio') {
      exerciseType = 'cardio';
      measurementType = 'duration'; // Default to duration for cardio
    } else {
      // For Flexibility, we'll set default values
      exerciseType = 'strength'; // or another appropriate default
      measurementType = 'duration'; // or another appropriate default
    }

    const newExercise = new Exercise({
      name,
      description,
      target: Array.isArray(target) ? target : [target],
      imageUrl: imageUrl || undefined,
      category,
      exerciseType,
      measurementType
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

// Get a specific exercise by ID
router.get('/:id', async (req, res, next) => {
  try {
    const exercise = await Exercise.findById(req.params.id);
    if (!exercise) {
      return next(new CustomError('Exercise not found', 404));
    }
    res.json(exercise);
  } catch (err) {
    next(new CustomError('Error fetching exercise', 500));
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