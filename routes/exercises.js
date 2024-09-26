// routes/exercises.js

const express = require('express');
const router = express.Router();
const Exercise = require('../models/Exercise');
const User = require('../models/User');
const DeletedExercise = require('../models/DeletedExercise');  // Add this line
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const CustomError = require('../utils/customError');

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
    console.log('Deleted exercises:', user.deletedExercises.length);

    let exercises;

    if (user.isAdmin) {
      console.log('Fetching all non-deleted exercises (admin)');
      exercises = await Exercise.find({
        _id: { $nin: user.deletedExercises }
      });
    } else {
      console.log('Fetching exercises for normal user');
      exercises = await Exercise.find({
        $or: [
          { user: req.user.id },
          { isDefault: true },
          { user: { $exists: false } }
        ],
        _id: { $nin: user.deletedExercises }
      });
    }

    console.log(`Fetched ${exercises.length} exercises`);
    res.json(exercises);
  } catch (err) {
    console.error('Error in GET /exercises:', err);
    next(new CustomError('Error fetching exercises: ' + err.message, 500));
  }
});

// Admin route to restore all deleted exercises
router.post('/restore/:id', auth, async (req, res, next) => {
  try {
    const deletedExercise = await DeletedExercise.findById(req.params.id);

    if (!deletedExercise) {
      return next(new CustomError('Deleted exercise not found', 404));
    }

    if (!req.user.isAdmin && deletedExercise.deletedBy.toString() !== req.user.id) {
      return next(new CustomError('Not authorized to restore this exercise', 403));
    }

    const restoredExercise = new Exercise(deletedExercise.exerciseData);
    await restoredExercise.save();

    if (!req.user.isAdmin) {
      // Remove from user's deletedExercises array if not admin
      await User.findByIdAndUpdate(req.user.id, {
        $pull: { deletedExercises: deletedExercise.exercise }
      });
    }

    await DeletedExercise.findByIdAndDelete(req.params.id);

    res.json({ message: 'Exercise restored successfully', exercise: restoredExercise });
  } catch (error) {
    next(new CustomError('Error restoring exercise: ' + error.message, 500));
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

// Update user recommendation for an exercise
router.put('/:id/user-recommendation', auth, async (req, res, next) => {
  try {
    const { weight, reps, sets } = req.body;
    const exercise = await Exercise.findById(req.params.id);

    if (!exercise) {
      return next(new CustomError('Exercise not found', 404));
    }

    const userRecommendationIndex = exercise.userRecommendations.findIndex(
      rec => rec.user.toString() === req.user.id
    );

    if (userRecommendationIndex > -1) {
      exercise.userRecommendations[userRecommendationIndex].recommendation = { weight, reps, sets };
    } else {
      exercise.userRecommendations.push({
        user: req.user.id,
        recommendation: { weight, reps, sets }
      });
    }

    await exercise.save();
    res.json({ message: 'User recommendation updated successfully' });
  } catch (error) {
    next(new CustomError('Error updating user recommendation: ' + error.message, 500));
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

    // Create a DeletedExercise record
    try {
      const deletedExercise = new DeletedExercise({
        exercise: exercise._id,
        exerciseData: exercise.toObject(),
        deletedBy: user._id,
        isDefault: exercise.isDefault || false
      });

      await deletedExercise.save();
    } catch (error) {
      console.error('Error saving deleted exercise:', error);
      // Continue with the deletion process even if saving to DeletedExercise fails
    }

    // Add the exercise ID to the user's deletedExercises array
    if (!user.deletedExercises.includes(exercise._id)) {
      user.deletedExercises.push(exercise._id);
    }

    // Store the full exercise details in the user's document
    if (!user.deletedExercisesDetails) {
      user.deletedExercisesDetails = [];
    }
    user.deletedExercisesDetails.push({
      exerciseId: exercise._id,
      exerciseData: exercise.toObject(),
      deletedAt: new Date()
    });

    await user.save();

    if (user.isAdmin || (!exercise.isDefault && exercise.user && exercise.user.toString() === req.user.id)) {
      // Admin or user deleting their own custom exercise
      await exercise.deleteOne();
      res.json({ message: 'Exercise deleted successfully' });
    } else if (exercise.isDefault) {
      // Normal user "deletes" a default exercise (it's already added to their deletedExercises array)
      res.json({ message: 'Exercise removed from your view' });
    } else {
      return next(new CustomError('Not authorized to delete this exercise', 403));
    }
  } catch (error) {
    console.error('Error in delete exercise route:', error);
    next(new CustomError('Error deleting exercise: ' + error.message, 500));
  }
});

// Route to view all deleted exercises
router.get('/deleted', auth, async (req, res, next) => {
  try {
    if (!req.user.isAdmin) {
      return next(new CustomError('Access denied', 403));
    }

    const deletedExercises = await DeletedExercise.find().sort('-deletedAt');
    res.json(deletedExercises);
  } catch (error) {
    next(new CustomError('Error fetching deleted exercises: ' + error.message, 500));
  }
});

module.exports = router;