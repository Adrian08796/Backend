// routes/workoutPlans.js

const express = require('express');
const router = express.Router();
const WorkoutPlan = require('../models/WorkoutPlan');
const Exercise = require('../models/Exercise');
const User = require('../models/User');
const auth = require('../middleware/auth');
const CustomError = require('../utils/customError');
const crypto = require('crypto');
const mongoose = require('mongoose');
const adminAuth = require('../middleware/adminAuth');

router.use(auth);

// User preferences show/hide default plans
router.put('/preferences/default-plans', auth, async (req, res, next) => {
  try {
    const { showDefaultPlans } = req.body;
    
    // Ensure preferences object exists before updating
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { 
        $set: { 
          'preferences.showDefaultPlans': showDefaultPlans 
        }
      },
      { 
        new: true,
        setDefaultsOnInsert: true
      }
    );

    if (!user) {
      return next(new CustomError('User not found', 404));
    }

    // Return the updated preference
    res.json({ 
      message: 'Preferences updated successfully',
      showDefaultPlans: user.preferences?.showDefaultPlans ?? true
    });
  } catch (error) {
    next(new CustomError('Error updating preferences: ' + error.message, 500));
  }
});

// Get a specific workout plan
router.get('/:id', auth, async (req, res, next) => {
  try {
    const plan = await WorkoutPlan.findOne({ _id: req.params.id, user: req.user.id })
      .populate('exercises');
    
    if (!plan) {
      return next(new CustomError('Workout plan not found', 404));
    }
    
    res.json(plan);
  } catch (err) {
    next(new CustomError('Error fetching workout plan: ' + err.message, 500));
  }
});

// Get all workout plans including default plans
router.get('/', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new CustomError('User not found', 404));
    }

    // Ensure preferences exists and has default value
    const showDefaultPlans = user.preferences?.showDefaultPlans ?? true;

    const query = {
      $or: [
        { user: req.user.id },
        ...(showDefaultPlans ? [{ isDefault: true, _id: { $nin: user.deletedWorkoutPlans } }] : [])
      ]
    };

    const workoutPlans = await WorkoutPlan.find(query).populate('exercises');

    // Always include preferences in the response
    res.json({ 
      plans: workoutPlans,
      preferences: {
        showDefaultPlans: user.preferences?.showDefaultPlans ?? true
      }
    });
  } catch (err) {
    next(new CustomError('Error fetching workout plans', 500));
  }
});

// Create a new workout plan
router.post('/', auth, async (req, res, next) => {
  try {
    console.log('Received request to create workout plan:', JSON.stringify(req.body, null, 2));
    const { name, exercises, scheduledDate, type, isDefault } = req.body;
    
    if (!name) {
      return next(new CustomError('Workout plan name is required', 400));
    }

    // Remove the check for exercises length

    // Validate exercise IDs if exercises are provided
    let exerciseIds = [];
    if (exercises && exercises.length > 0) {
      exerciseIds = exercises.filter(id => typeof id === 'string' && id.trim() !== '');
      const foundExercises = await Exercise.find({ _id: { $in: exerciseIds } });
      
      if (foundExercises.length !== exerciseIds.length) {
        console.log('Mismatch in exercise count. Found:', foundExercises.length, 'Expected:', exerciseIds.length);
        return next(new CustomError('One or more exercise IDs are invalid', 400));
      }
    }

    // Check if a plan with the same name already exists for this user or as a default plan
    const existingPlan = await WorkoutPlan.findOne({
      name,
      $or: [
        { user: req.user.id },
        { isDefault: true }
      ]
    });

    let savedPlan;
    if (existingPlan) {
      console.log('Updating existing plan:', existingPlan._id);
      existingPlan.exercises = exerciseIds;
      existingPlan.scheduledDate = scheduledDate;
      existingPlan.type = type;
      existingPlan.isDefault = req.user.isAdmin && isDefault;

      savedPlan = await existingPlan.save();
    } else {
      console.log('Creating new plan');
      const newWorkoutPlan = new WorkoutPlan({ 
        user: req.user.id,
        name, 
        exercises: exerciseIds,
        scheduledDate,
        type,
        isDefault: req.user.isAdmin && isDefault
      });

      savedPlan = await newWorkoutPlan.save();
    }

    await savedPlan.populate('exercises');
    console.log('Saved plan:', JSON.stringify(savedPlan.toObject(), null, 2));
    res.status(existingPlan ? 200 : 201).json(savedPlan);
  } catch (err) {
    console.error('Error saving workout plan:', err);
    next(new CustomError('Error saving workout plan: ' + err.message, 400));
  }
});

// Update a workout plan
router.put('/:id', async (req, res, next) => {
  try {
    console.log('Received request to update workout plan:', req.params.id, JSON.stringify(req.body, null, 2));
    const { name, exercises, scheduledDate, type } = req.body;
    const workoutPlan = await WorkoutPlan.findById(req.params.id);

    if (!workoutPlan) {
      return next(new CustomError('Workout plan not found', 404));
    }

    // Check if the user has permission to edit this plan
    if (workoutPlan.isDefault && !req.user.isAdmin) {
      return next(new CustomError('You do not have permission to edit this plan', 403));
    }

    // If it's not a default plan, ensure the user owns it
    if (!workoutPlan.isDefault && workoutPlan.user.toString() !== req.user.id) {
      return next(new CustomError('You do not have permission to edit this plan', 403));
    }

    // Remove the check for exercises length

    // Validate exercise IDs if exercises are provided
    let exerciseIds = [];
    if (exercises && exercises.length > 0) {
      exerciseIds = exercises.filter(id => typeof id === 'string' && id.trim() !== '');
      const foundExercises = await Exercise.find({ _id: { $in: exerciseIds } });
      
      if (foundExercises.length !== exerciseIds.length) {
        console.log('Mismatch in exercise count. Found:', foundExercises.length, 'Expected:', exerciseIds.length);
        return next(new CustomError('One or more exercise IDs are invalid', 400));
      }
    }

    // Update the plan
    workoutPlan.name = name;
    workoutPlan.exercises = exerciseIds;
    workoutPlan.scheduledDate = scheduledDate;
    workoutPlan.type = type;

    const updatedWorkoutPlan = await workoutPlan.save();
    await updatedWorkoutPlan.populate('exercises');
    
    console.log('Updated plan:', JSON.stringify(updatedWorkoutPlan.toObject(), null, 2));
    res.json(updatedWorkoutPlan);
  } catch (err) {
    console.error('Error updating workout plan:', err);
    next(new CustomError('Error updating workout plan: ' + err.message, 400));
  }
});

// Admin route to create a default workout plan
router.post('/default', auth, adminAuth, async (req, res, next) => {
  console.log('Creating default workout plan - User:', req.user);
  try {
    const { name, exercises, scheduledDate, type } = req.body;
    if (!name || !exercises || !Array.isArray(exercises)) {
      return next(new CustomError('Invalid workout plan data', 400));
    }
    const newWorkoutPlan = new WorkoutPlan({ 
      name, 
      exercises,
      scheduledDate,
      type,
      isDefault: true
      // Note: We're not setting the user field for default plans
    });
    const savedWorkoutPlan = await newWorkoutPlan.save();
    res.status(201).json(savedWorkoutPlan);
  } catch (err) {
    next(new CustomError('Error saving default workout plan: ' + err.message, 400));
  }
});

// Add an exercise to a workout plan
router.post('/:id/exercises', async (req, res, next) => {
  try {
    console.log('Received request to add exercise to plan:', req.params.id, req.body);
    const { exerciseId } = req.body;
    if (!exerciseId) {
      return next(new CustomError('Exercise ID is required', 400));
    }

    const exercise = await Exercise.findById(exerciseId);
    if (!exercise) {
      return next(new CustomError('Exercise not found', 404));
    }

    const workoutPlan = await WorkoutPlan.findOne({ _id: req.params.id });
    if (!workoutPlan) {
      return next(new CustomError('Workout plan not found', 404));
    }

    // Check if the exercise is already in the plan
    if (workoutPlan.exercises.some(ex => ex.toString() === exerciseId)) {
      return next(new CustomError('Exercise already in the workout plan', 400));
    }

    workoutPlan.exercises.push(exerciseId);
    await workoutPlan.save();

    const updatedPlan = await WorkoutPlan.findById(workoutPlan._id).populate('exercises');
    console.log('Successfully added exercise to plan:', updatedPlan);
    res.json(updatedPlan);
  } catch (err) {
    console.error('Error adding exercise to workout plan:', err);
    next(new CustomError('Error adding exercise to workout plan', 400));
  }
});

// Delete a workout plan
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const workoutPlan = await WorkoutPlan.findById(req.params.id);
    
    if (!workoutPlan) {
      return next(new CustomError('Workout plan not found', 404));
    }

    if (workoutPlan.isDefault && !req.user.isAdmin) {
      // For normal users, just remove the plan from their view
      await User.findByIdAndUpdate(req.user.id, {
        $addToSet: { deletedWorkoutPlans: workoutPlan._id }
      });
      return res.json({ message: 'Workout plan removed from your view' });
    }

    // For admins or user's own custom plans, delete the plan
    if (req.user.isAdmin || (!workoutPlan.isDefault && workoutPlan.user.toString() === req.user.id)) {
      await workoutPlan.deleteOne();
      return res.json({ message: 'Workout plan deleted successfully' });
    }

    return next(new CustomError('Not authorized to delete this workout plan', 403));
  } catch (error) {
    next(new CustomError('Error deleting workout plan: ' + error.message, 500));
  }
});

// Add an exercise to a workout plan
router.post('/:id/exercises', auth, async (req, res, next) => {
  try {
    const { exerciseId } = req.body;
    if (!exerciseId) {
      return next(new CustomError('Exercise ID is required', 400));
    }

    const workoutPlan = await WorkoutPlan.findById(req.params.id);
    if (!workoutPlan) {
      return next(new CustomError('Workout plan not found', 404));
    }

    // Check if the user has permission to modify this plan
    if (workoutPlan.isDefault && !req.user.isAdmin) {
      return next(new CustomError('You do not have permission to modify this plan', 403));
    }

    if (!workoutPlan.isDefault && workoutPlan.user.toString() !== req.user.id) {
      return next(new CustomError('You do not have permission to modify this plan', 403));
    }

    // Check if the exercise is already in the plan
    if (workoutPlan.exercises.includes(exerciseId)) {
      return next(new CustomError('Exercise already in the workout plan', 400));
    }

    workoutPlan.exercises.push(exerciseId);
    await workoutPlan.save();

    const updatedPlan = await WorkoutPlan.findById(workoutPlan._id).populate('exercises');
    res.json(updatedPlan);
  } catch (error) {
    next(new CustomError('Error adding exercise to workout plan: ' + error.message, 500));
  }
});

// Remove an exercise from a workout plan
router.delete('/:planId/exercises/:exerciseId', auth, async (req, res, next) => {
  try {
    const { planId, exerciseId } = req.params;
    console.log(`Attempting to remove exercise ${exerciseId} from plan ${planId}`);

    const plan = await WorkoutPlan.findOne({ _id: planId });

    if (!plan) {
      return next(new CustomError('Workout plan not found', 404));
    }

    // Check if the exercise exists in the plan
    const exerciseIndex = plan.exercises.findIndex(ex => 
      ex.toString() === exerciseId || ex._id.toString() === exerciseId
    );

    if (exerciseIndex === -1) {
      return next(new CustomError('Exercise not found in the workout plan', 404));
    }

    // Remove the exercise
    plan.exercises.splice(exerciseIndex, 1);
    await plan.save();

    // Populate the exercises field before sending the response
    await plan.populate('exercises');

    res.json(plan);
  } catch (err) {
    console.error('Error removing exercise from workout plan:', err);
    next(new CustomError('Error removing exercise from workout plan', 500));
  }
});

// Generate a share link for a workout plan
router.post('/:id/share', auth, async (req, res, next) => {
  try {
    console.log('Sharing plan with ID:', req.params.id);
    console.log('User ID:', req.user.id);

    // Find and populate the plan with all exercise details
    const plan = await WorkoutPlan.findOne({
      _id: req.params.id,
      $or: [
        { user: req.user.id },
        { isDefault: true }
      ]
    }).populate({
      path: 'exercises',
      select: '-__v',
      populate: {
        path: 'recommendations'
      }
    });
    
    console.log('Found plan:', plan);

    if (!plan) {
      console.log('Plan not found');
      return next(new CustomError('Workout plan not found', 404));
    }

    // If it's a default plan, ensure the user has permission to share it
    if (plan.isDefault && !req.user.isAdmin) {
      console.log('User does not have permission to share default plan');
      return next(new CustomError('You do not have permission to share this plan', 403));
    }

    // Ensure all exercises have their full data
    const exercisesWithFullData = await Promise.all(plan.exercises.map(async (exercise) => {
      // Get the user's custom exercise data if it exists
      const user = await User.findById(req.user.id);
      const userExercise = user.userExercises.find(ue => 
        ue.exerciseId.toString() === exercise._id.toString()
      );

      // If user has custom data for this exercise, merge it with the original
      if (userExercise) {
        return {
          ...exercise.toObject(),
          name: userExercise.name || exercise.name,
          description: userExercise.description || exercise.description,
          target: userExercise.target || exercise.target,
          imageUrl: userExercise.imageUrl || exercise.imageUrl,
          recommendations: {
            beginner: {
              weight: userExercise.recommendation?.weight || exercise.recommendations?.beginner?.weight || 0,
              reps: userExercise.recommendation?.reps || exercise.recommendations?.beginner?.reps || 8,
              sets: userExercise.recommendation?.sets || exercise.recommendations?.beginner?.sets || 3,
              duration: userExercise.recommendation?.duration || exercise.recommendations?.beginner?.duration || 7,
              distance: userExercise.recommendation?.distance || exercise.recommendations?.beginner?.distance || 2,
              intensity: userExercise.recommendation?.intensity || exercise.recommendations?.beginner?.intensity || 1,
              incline: userExercise.recommendation?.incline || exercise.recommendations?.beginner?.incline || 1
            },
            intermediate: {
              weight: exercise.recommendations?.intermediate?.weight || 0,
              reps: exercise.recommendations?.intermediate?.reps || 8,
              sets: exercise.recommendations?.intermediate?.sets || 3,
              duration: exercise.recommendations?.intermediate?.duration || 7,
              distance: exercise.recommendations?.intermediate?.distance || 2,
              intensity: exercise.recommendations?.intermediate?.intensity || 1,
              incline: exercise.recommendations?.intermediate?.incline || 1
            },
            advanced: {
              weight: exercise.recommendations?.advanced?.weight || 0,
              reps: exercise.recommendations?.advanced?.reps || 8,
              sets: exercise.recommendations?.advanced?.sets || 3,
              duration: exercise.recommendations?.advanced?.duration || 7,
              distance: exercise.recommendations?.advanced?.distance || 2,
              intensity: exercise.recommendations?.advanced?.intensity || 1,
              incline: exercise.recommendations?.advanced?.incline || 1
            }
          }
        };
      }

      // If no custom data, return the original exercise with complete recommendations
      return {
        ...exercise.toObject(),
        recommendations: {
          beginner: {
            weight: exercise.recommendations?.beginner?.weight || 0,
            reps: exercise.recommendations?.beginner?.reps || 8,
            sets: exercise.recommendations?.beginner?.sets || 3,
            duration: exercise.recommendations?.beginner?.duration || 7,
            distance: exercise.recommendations?.beginner?.distance || 2,
            intensity: exercise.recommendations?.beginner?.intensity || 1,
            incline: exercise.recommendations?.beginner?.incline || 1
          },
          intermediate: {
            weight: exercise.recommendations?.intermediate?.weight || 0,
            reps: exercise.recommendations?.intermediate?.reps || 8,
            sets: exercise.recommendations?.intermediate?.sets || 3,
            duration: exercise.recommendations?.intermediate?.duration || 7,
            distance: exercise.recommendations?.intermediate?.distance || 2,
            intensity: exercise.recommendations?.intermediate?.intensity || 1,
            incline: exercise.recommendations?.intermediate?.incline || 1
          },
          advanced: {
            weight: exercise.recommendations?.advanced?.weight || 0,
            reps: exercise.recommendations?.advanced?.reps || 8,
            sets: exercise.recommendations?.advanced?.sets || 3,
            duration: exercise.recommendations?.advanced?.duration || 7,
            distance: exercise.recommendations?.advanced?.distance || 2,
            intensity: exercise.recommendations?.advanced?.intensity || 1,
            incline: exercise.recommendations?.advanced?.incline || 1
          }
        }
      };
    }));

    // Update the plan with the full exercise data before sharing
    plan.exercises = exercisesWithFullData;

    plan.isShared = true;
    await plan.save();

    const shareLink = plan.getShareLink(process.env.FRONTEND_URL);
    console.log('Share link generated:', shareLink);

    res.json({ 
      shareLink, 
      plan: {
        ...plan.toObject(),
        exercises: exercisesWithFullData
      }
    });
  } catch (err) {
    console.error('Error in share route:', err);
    next(new CustomError('Error sharing workout plan: ' + err.message, 500));
  }
});

// Import a shared workout plan
router.post('/import/:shareId', auth, async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const sharedPlan = await WorkoutPlan.findByShareId(req.params.shareId)
      .populate({
        path: 'exercises',
        // Ensure we get all exercise fields including recommendations
        select: '-__v'
      })
      .session(session);

    if (!sharedPlan) {
      throw new CustomError('Shared workout plan not found', 404);
    }

    // Get the sharing user's details
    const sharingUser = await User.findById(sharedPlan.user).select('username');

    const newExercises = await Promise.all(sharedPlan.exercises.map(async (originalExercise) => {
      // First check if the exercise already exists for this user
      let existingExercise = await Exercise.findOne({ 
        name: originalExercise.name, 
        user: { $in: [req.user.id, null] } 
      }).session(session);

      if (existingExercise) {
        // If the exercise exists but was created by the current user, update it with the shared recommendations
        if (existingExercise.user && existingExercise.user.toString() === req.user.id) {
          existingExercise.recommendations = {
            beginner: {
              weight: originalExercise.recommendations?.beginner?.weight || 0,
              reps: originalExercise.recommendations?.beginner?.reps || 8,
              sets: originalExercise.recommendations?.beginner?.sets || 3,
              duration: originalExercise.recommendations?.beginner?.duration || 7,
              distance: originalExercise.recommendations?.beginner?.distance || 2,
              intensity: originalExercise.recommendations?.beginner?.intensity || 1,
              incline: originalExercise.recommendations?.beginner?.incline || 1
            },
            intermediate: {
              weight: originalExercise.recommendations?.intermediate?.weight || 0,
              reps: originalExercise.recommendations?.intermediate?.reps || 10,
              sets: originalExercise.recommendations?.intermediate?.sets || 3,
              duration: originalExercise.recommendations?.intermediate?.duration || 7,
              distance: originalExercise.recommendations?.intermediate?.distance || 2,
              intensity: originalExercise.recommendations?.intermediate?.intensity || 1,
              incline: originalExercise.recommendations?.intermediate?.incline || 1
            },
            advanced: {
              weight: originalExercise.recommendations?.advanced?.weight || 0,
              reps: originalExercise.recommendations?.advanced?.reps || 12,
              sets: originalExercise.recommendations?.advanced?.sets || 4,
              duration: originalExercise.recommendations?.advanced?.duration || 7,
              distance: originalExercise.recommendations?.advanced?.distance || 2,
              intensity: originalExercise.recommendations?.advanced?.intensity || 1,
              incline: originalExercise.recommendations?.advanced?.incline || 1
            }
          };
          await existingExercise.save({ session });
        }
        return existingExercise;
      }

      // Create new exercise with complete copied data
      const newExercise = new Exercise({
        name: originalExercise.name,
        description: originalExercise.description,
        target: originalExercise.target,
        imageUrl: originalExercise.imageUrl,
        category: originalExercise.category,
        exerciseType: originalExercise.exerciseType,
        measurementType: originalExercise.measurementType,
        user: req.user.id,
        recommendations: {
          beginner: {
            weight: originalExercise.recommendations?.beginner?.weight || 0,
            reps: originalExercise.recommendations?.beginner?.reps || 8,
            sets: originalExercise.recommendations?.beginner?.sets || 3,
            duration: originalExercise.recommendations?.beginner?.duration || 7,
            distance: originalExercise.recommendations?.beginner?.distance || 2,
            intensity: originalExercise.recommendations?.beginner?.intensity || 1,
            incline: originalExercise.recommendations?.beginner?.incline || 0
          },
          intermediate: {
            weight: originalExercise.recommendations?.intermediate?.weight || 0,
            reps: originalExercise.recommendations?.intermediate?.reps || 10,
            sets: originalExercise.recommendations?.intermediate?.sets || 3,
            duration: originalExercise.recommendations?.intermediate?.duration || 7,
            distance: originalExercise.recommendations?.intermediate?.distance || 2,
            intensity: originalExercise.recommendations?.intermediate?.intensity || 1,
            incline: originalExercise.recommendations?.intermediate?.incline || 1
          },
          advanced: {
            weight: originalExercise.recommendations?.advanced?.weight || 0,
            reps: originalExercise.recommendations?.advanced?.reps || 12,
            sets: originalExercise.recommendations?.advanced?.sets || 4,
            duration: originalExercise.recommendations?.advanced?.duration || 7,
            distance: originalExercise.recommendations?.advanced?.distance || 2,
            intensity: originalExercise.recommendations?.advanced?.intensity || 1,
            incline: originalExercise.recommendations?.advanced?.incline || 1
          }
        },
        importedFrom: {
          user: sharedPlan.user,
          username: sharingUser.username,
          importDate: new Date()
        }
      });

      return await newExercise.save({ session });
    }));

    const importingUser = await User.findById(req.user.id).select('username');
    const newPlan = sharedPlan.createImportCopy(req.user.id, importingUser.username);
    newPlan.exercises = newExercises.map(e => e._id);

    await newPlan.save({ session });
    await session.commitTransaction();

    // Populate the exercises before sending the response
    await newPlan.populate('exercises');

    res.status(201).json(newPlan);
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
});

module.exports = router;