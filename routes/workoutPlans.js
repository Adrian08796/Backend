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
    const workoutPlans = await WorkoutPlan.find({
      $or: [
        { user: req.user.id },
        { isDefault: true, _id: { $nin: req.user.deletedWorkoutPlans } }
      ]
    }).populate('exercises');

    res.json({ plans: workoutPlans });
  } catch (err) {
    next(new CustomError('Error fetching workout plans', 500));
  }
});

// Create a new workout plan
router.post('/', auth, async (req, res, next) => {
  try {
    const { name, exercises, scheduledDate, type, isDefault } = req.body;
    if (!name) {
      return next(new CustomError('Workout plan name is required', 400));
    }

    // Check if a plan with the same name already exists for this user or as a default plan
    const existingPlan = await WorkoutPlan.findOne({
      name,
      $or: [
        { user: req.user.id },
        { isDefault: true }
      ]
    });

    if (existingPlan) {
      // Instead of returning an error, we'll update the existing plan
      existingPlan.exercises = exercises || [];
      existingPlan.scheduledDate = scheduledDate;
      existingPlan.type = type;
      existingPlan.isDefault = req.user.isAdmin && isDefault;

      const updatedPlan = await existingPlan.save();
      await updatedPlan.populate('exercises');
      return res.status(200).json(updatedPlan);
    }

    // If no existing plan, create a new one
    const newWorkoutPlan = new WorkoutPlan({ 
      user: req.user.id,
      name, 
      exercises: exercises || [],
      scheduledDate,
      type,
      isDefault: req.user.isAdmin && isDefault
    });

    const savedWorkoutPlan = await newWorkoutPlan.save();
    await savedWorkoutPlan.populate('exercises');
    res.status(201).json(savedWorkoutPlan);
  } catch (err) {
    console.error('Error saving workout plan:', err);
    next(new CustomError('Error saving workout plan: ' + err.message, 400));
  }
});

// Update a workout plan
router.put('/:id', async (req, res, next) => {
  try {
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

    // Update the plan
    workoutPlan.name = name;
    workoutPlan.exercises = exercises;
    workoutPlan.scheduledDate = scheduledDate;
    workoutPlan.type = type;

    const updatedWorkoutPlan = await workoutPlan.save();
    await updatedWorkoutPlan.populate('exercises');
    
    res.json(updatedWorkoutPlan);
  } catch (err) {
    next(new CustomError('Error updating workout plan', 400));
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

    const plan = await WorkoutPlan.findPlanById(req.params.id, req.user.id);
    
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

    plan.isShared = true;
    await plan.save();

    const shareLink = plan.getShareLink(process.env.FRONTEND_URL);
    
    console.log('Share link generated:', shareLink);

    res.json({ shareLink, plan });
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
    const sharedPlan = await WorkoutPlan.findByShareId(req.params.shareId).session(session);

    if (!sharedPlan) {
      throw new CustomError('Shared workout plan not found', 404);
    }

    const newExercises = await Promise.all(sharedPlan.exercises.map(async (exercise) => {
      let existingExercise = await Exercise.findOne({ 
        name: exercise.name, 
        user: { $in: [req.user.id, null] } 
      }).session(session);

      if (existingExercise) {
        return existingExercise;
      }

      const newExercise = new Exercise({
        ...exercise.toObject(),
        _id: undefined,
        user: req.user.id,
        importedFrom: {
          user: sharedPlan.user,
          username: (await User.findById(sharedPlan.user).select('username')).username,
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