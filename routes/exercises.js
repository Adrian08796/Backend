// routes/exercises.js

const express = require('express');
const router = express.Router();
const Exercise = require('../models/Exercise');
const User = require('../models/User');
const DeletedExercise = require('../models/DeletedExercise');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const CustomError = require('../utils/customError');

router.use(auth);

// Get all exercises and includes default exercises
router.get('/', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new CustomError('User not found', 404));
    }

    let exercises = await Exercise.find({
      $or: [
        { user: req.user.id },
        { isDefault: true },
        { user: { $exists: false } }
      ],
      _id: { $nin: user.deletedExercises }
    });

    // Merge user-specific data with exercises
    exercises = exercises.map(exercise => {
      const userExercise = user.userExercises.find(ue => ue.exerciseId.toString() === exercise._id.toString());
      if (userExercise) {
        return {
          ...exercise.toObject(),
          name: userExercise.name || exercise.name,
          description: userExercise.description || exercise.description,
          target: userExercise.target || exercise.target,
          imageUrl: userExercise.imageUrl || exercise.imageUrl,
          recommendations: {
            [user.experienceLevel]: userExercise.recommendation
          }
        };
      }
      return exercise;
    });

    res.json(exercises);
  } catch (err) {
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
    const { name, description, target, imageUrl, category, exerciseType, measurementType, recommendations } = req.body;
    
    const newExercise = new Exercise({
      name,
      description,
      target: Array.isArray(target) ? target : [target],
      imageUrl: imageUrl || undefined,
      category,
      exerciseType,
      measurementType,
      recommendations,
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
    const { name, description, target, imageUrl, category, recommendations } = req.body;
    
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
      user: req.user.id,
      recommendations: req.user.isAdmin ? recommendations : undefined
    });

    const savedExercise = await newExercise.save();

    if (!req.user.isAdmin && recommendations) {
      const user = await User.findById(req.user.id);
      user.userExercises.push({
        exerciseId: savedExercise._id,
        recommendation: recommendations[user.experienceLevel]
      });
      await user.save();
    }

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
router.get('/:id', auth, async (req, res, next) => {
  try {
    console.log('Fetching exercise with ID:', req.params.id);
    const exercise = await Exercise.findById(req.params.id);
    if (!exercise) {
      console.log('Exercise not found for ID:', req.params.id);
      return res.status(404).json({ message: 'Exercise not found' });
    }

    const user = await User.findById(req.user.id);
    const userExercise = user.userExercises.find(ue => ue.exerciseId.toString() === req.params.id);

    let responseExercise = exercise.toObject();

    if (userExercise) {
      responseExercise = {
        ...responseExercise,
        name: userExercise.name || responseExercise.name,
        description: userExercise.description || responseExercise.description,
        target: userExercise.target || responseExercise.target,
        imageUrl: userExercise.imageUrl || responseExercise.imageUrl,
        recommendations: {
          [user.experienceLevel]: userExercise.recommendation || responseExercise.recommendations[user.experienceLevel] || {}
        }
      };
    } else {
      responseExercise.recommendations = {
        [user.experienceLevel]: responseExercise.recommendations[user.experienceLevel] || {}
      };
    }

    // Always include the base exercise recommendations for reference
    responseExercise.baseRecommendations = exercise.recommendations;

    console.log('Sending response exercise:', responseExercise);
    res.json(responseExercise);
  } catch (err) {
    console.error('Error fetching exercise:', err);
    next(new CustomError('Error fetching exercise: ' + err.message, 500));
  }
});


// Update an exercise
router.put('/:id', auth, async (req, res, next) => {
  try {
    const exercise = await Exercise.findById(req.params.id);
    if (!exercise) {
      return next(new CustomError('Exercise not found', 404));
    }

    const { name, description, target, imageUrl, category, exerciseType, measurementType, recommendations } = req.body;

    if (req.user.isAdmin) {
      // Admin can update the exercise globally
      Object.assign(exercise, { name, description, target, imageUrl, category, exerciseType, measurementType, recommendations });
      await exercise.save();
      res.json(exercise);
    } else {
      // For normal users, update or create a user-specific exercise
      const user = await User.findById(req.user.id);
      let userExercise = user.userExercises.find(ue => ue.exerciseId.toString() === req.params.id);
      
      if (!userExercise) {
        userExercise = {
          exerciseId: exercise._id,
          name: name || exercise.name,
          description: description || exercise.description,
          target: target || exercise.target,
          imageUrl: imageUrl || exercise.imageUrl,
          recommendation: recommendations?.[user.experienceLevel] || exercise.recommendations?.[user.experienceLevel] || {}
        };
        user.userExercises.push(userExercise);
      } else {
        // Update existing user exercise, preserving existing values if not provided
        userExercise.name = name || userExercise.name;
        userExercise.description = description || userExercise.description;
        userExercise.target = target || userExercise.target;
        userExercise.imageUrl = imageUrl || userExercise.imageUrl;
        if (recommendations && recommendations[user.experienceLevel]) {
          userExercise.recommendation = {
            ...userExercise.recommendation,
            ...recommendations[user.experienceLevel]
          };
        }
      }

      await user.save();
      
      // Combine the base exercise with user-specific data
      const combinedExercise = {
        ...exercise.toObject(),
        name: userExercise.name,
        description: userExercise.description,
        target: userExercise.target,
        imageUrl: userExercise.imageUrl,
        isUserSpecific: true,
        recommendations: {
          [user.experienceLevel]: userExercise.recommendation
        }
      };

      res.json(combinedExercise);
    }
  } catch (err) {
    next(new CustomError('Error updating exercise: ' + err.message, 400));
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

// Route to update recommendation for a specific user
router.put('/:id/user-recommendation', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const recommendation = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return next(new CustomError('User not found', 404));
    }

    let exercise = await Exercise.findById(id);
    if (!exercise) {
      return next(new CustomError('Exercise not found', 404));
    }

    // Find the user-specific exercise data
    let userExercise = user.userExercises.find(ue => ue.exerciseId.toString() === id);

    if (!userExercise) {
      // If not found, create a new one
      userExercise = {
        exerciseId: id,
        recommendation: {}
      };
      user.userExercises.push(userExercise);
    }

    // Update the recommendation
    userExercise.recommendation = {
      ...userExercise.recommendation,
      ...recommendation
    };

    await user.save();

    res.json({ userRecommendation: userExercise.recommendation });
  } catch (error) {
    next(new CustomError('Error updating user recommendation: ' + error.message, 500));
  }
});

module.exports = router;