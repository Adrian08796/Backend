// routes/workouts.js

const express = require('express');
const router = express.Router();
const Workout = require('../models/Workout');
const WorkoutPlan = require('../models/WorkoutPlan');
const WorkoutProgress = require('../models/WorkoutProgress');
const Exercise = require('../models/Exercise');
const auth = require('../middleware/auth');
const CustomError = require('../utils/customError');
const mongoose = require('mongoose');

router.use(auth);

// Get all workouts for the current user
router.get('/user', async (req, res, next) => {
  try {
    const workouts = await Workout.find({ user: req.user.id })
      .populate({
        path: 'plan',
        select: 'name exercises',
        populate: {
          path: 'exercises',
          select: 'name description target'
        }
      })
      .populate('exercises.exercise')
      .sort({ startTime: -1 });

    res.json(workouts);
  } catch (error) {
    next(new CustomError('Error fetching workouts', 500));
  }
});

// Add a new workout
router.post('/', async (req, res, next) => {
  try {
    const { plan, planName, exercises, startTime, endTime, totalPauseTime, skippedPauses, progression } = req.body;

    if (!planName || !exercises || !startTime || !endTime) {
      return next(new CustomError('Missing required fields', 400));
    }

    if (!Array.isArray(exercises) || exercises.length === 0) {
      return next(new CustomError('Invalid exercises data', 400));
    }

    const workout = new Workout({
      user: req.user.id,
      plan,
      planName,
      exercises: exercises.map(exercise => ({
        exercise: exercise.exercise,
        sets: exercise.sets.map(set => ({
          ...set,
          completedAt: new Date(set.completedAt)
        })),
        completedAt: new Date(exercise.completedAt),
        notes: exercise.notes
      })),
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      totalPauseTime,
      skippedPauses,
      progression
    });

    const newWorkout = await workout.save();
    const populatedWorkout = await Workout.findById(newWorkout._id)
      .populate('plan')
      .populate('exercises.exercise');
    res.status(201).json(populatedWorkout);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return next(new CustomError('Validation error', 400, validationErrors));
    }
    next(new CustomError('Error creating workout', 500));
  }
});

// Get the last workout for a specific plan
router.get('/last/:planId', async (req, res, next) => {
  try {
    const workout = await Workout.findOne({ 
      user: req.user.id, 
      plan: req.params.planId 
    })
    .sort({ startTime: -1 })
    .populate('plan')
    .populate('exercises.exercise');

    if (!workout) {
      return res.status(200).json({ message: 'No workouts found for this plan' });
    }

    res.json(workout);
  } catch (error) {
    next(new CustomError('Error fetching last workout', 500));
  }
});

// Get exercise history
router.get('/exercise-history/:exerciseId', auth, async (req, res, next) => {
  try {
    const { exerciseId } = req.params;
    console.log(`Fetching exercise history for exerciseId: ${exerciseId}`);

    if (!exerciseId || exerciseId === 'undefined') {
      return res.status(400).json({ message: 'Invalid exercise ID provided' });
    }

    if (!mongoose.Types.ObjectId.isValid(exerciseId)) {
      return res.status(400).json({ message: 'Invalid exercise ID format' });
    }

    // Check if the exercise exists
    const exercise = await Exercise.findById(exerciseId);
    if (!exercise) {
      console.log(`Exercise not found for id: ${exerciseId}`);
      return res.status(404).json({ message: 'Exercise not found' });
    }

    const workouts = await Workout.find({ 
      user: req.user.id,
      'exercises.exercise': exerciseId
    })
    .sort({ startTime: -1 })
    .limit(5);

    console.log(`Found ${workouts.length} workouts for exercise history`);

    const exerciseHistory = workouts.map(workout => {
      const exerciseData = workout.exercises.find(e => e.exercise.toString() === exerciseId);
      return {
        date: workout.startTime,
        sets: exerciseData.sets,
        notes: exerciseData.notes
      };
    });

    res.json(exerciseHistory);
  } catch (error) {
    console.error('Error fetching exercise history:', error);
    next(new CustomError(`Error fetching exercise history: ${error.message}`, 500));
  }
});

router.post('/progress', auth, async (req, res, next) => {
  try {
    const { 
      plan, 
      exercises, 
      currentExerciseIndex, 
      lastSetValues, 
      startTime, 
      totalPauseTime, 
      skippedPauses, 
      completedSets, 
      totalSets,
      __v
    } = req.body;
    
    let progress = await WorkoutProgress.findOne({ user: req.user.id });
    if (progress) {
      // Update existing progress
      progress.plan = plan;
      progress.exercises = exercises.map(exercise => ({
        ...exercise,
        sets: exercise.sets.map(set => ({
          ...set,
          completedAt: set.completedAt || new Date()
        }))
      }));
      progress.currentExerciseIndex = currentExerciseIndex;
      progress.lastSetValues = lastSetValues;
      progress.startTime = startTime || progress.startTime;
      progress.totalPauseTime = totalPauseTime;
      progress.skippedPauses = skippedPauses;
      progress.completedSets = completedSets;
      progress.totalSets = totalSets;
      progress.lastUpdated = new Date();

      if (__v !== undefined) {
        progress.__v = __v;
      }
    } else {
      // Create new progress
      progress = new WorkoutProgress({
        user: req.user.id,
        plan,
        exercises: exercises.map(exercise => ({
          ...exercise,
          sets: exercise.sets.map(set => ({
            ...set,
            completedAt: set.completedAt || new Date()
          }))
        })),
        currentExerciseIndex,
        lastSetValues,
        startTime: startTime || new Date(),
        totalPauseTime,
        skippedPauses,
        completedSets,
        totalSets
      });
    }

    // Validate the progress object before saving
    await progress.validate();

    try {
      await progress.save();
      res.json({ message: 'Progress saved successfully', progress });
    } catch (saveError) {
      if (saveError.name === 'VersionError') {
        res.status(409).json({ message: 'Data is out of sync. Please refresh and try again.' });
      } else {
        throw saveError;
      }
    }
  } catch (error) {
    console.error('Error saving progress:', error);
    next(new CustomError('Error saving progress: ' + error.message, 500));
  }
});

router.post('/progress/new', auth, async (req, res, next) => {
  try {
    const { 
      plan, 
      exercises, 
      currentExerciseIndex, 
      lastSetValues, 
      startTime, 
      totalPauseTime, 
      skippedPauses, 
      completedSets, 
      totalSets 
    } = req.body;

    const newProgress = new WorkoutProgress({
      user: req.user.id,
      plan,
      exercises: exercises.map(exercise => ({
        ...exercise,
        sets: exercise.sets.map(set => ({
          ...set,
          completedAt: set.completedAt || new Date()
        }))
      })),
      currentExerciseIndex,
      lastSetValues,
      startTime: startTime || new Date(),
      totalPauseTime,
      skippedPauses,
      completedSets,
      totalSets
    });

    await newProgress.validate();
    await newProgress.save();

    res.status(201).json({ message: 'New progress created successfully', progress: newProgress });
  } catch (error) {
    console.error('Error creating new progress:', error);
    next(new CustomError('Error creating new progress: ' + error.message, 500));
  }
});

// Clear progress
router.delete('/progress', auth, async (req, res, next) => {
  try {
    await WorkoutProgress.findOneAndDelete({ user: req.user.id });
    res.json({ message: 'Workout progress cleared successfully' });
  } catch (error) {
    console.error('Error clearing workout progress:', error);
    next(new CustomError('Error clearing workout progress: ' + error.message, 500));
  }
});


// Get active plan (progress)
router.get('/progress', auth, async (req, res, next) => {
  console.log("😤",req.user);
  try {
    const progress = await WorkoutProgress.findOne({ user: req.user.id })
      .populate({
        path: 'plan',
        populate: {
          path: 'exercises',
          model: 'Exercise'
        }
      })
      .populate('exercises.exercise');
      console.log("😤", "PROGRESS IN BACKEND", progress);
    
    if (progress) {
      res.json(progress);
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error('Error fetching active plan:', error);
    next(new CustomError('Error fetching active plan: ' + error.message, 500));
  }
});

// Middleware function to get a workout by ID
async function getWorkout(req, res, next) {
  try {
    const workout = await Workout.findById(req.params.id)
      .populate('plan').populate('exercises.exercise');
    
    if (!workout) {
      return next(new CustomError('Workout not found', 404));
    }
    
    if (workout.user.toString() !== req.user.id) {
      return next(new CustomError('Not authorized to access this workout', 403));
    }
    
    res.workout = workout;
    next();
  } catch (error) {
    console.error('Error in getWorkout:', error);
    next(new CustomError('Error fetching workout', 500));
  }
}

// Get a specific workout
router.get('/:id', getWorkout, (req, res) => {
  res.json(res.workout);
});

// Update a workout
router.put('/:id', getWorkout, async (req, res, next) => {
  const { plan, planName, exercises, startTime, endTime, totalPauseTime, skippedPauses, progression } = req.body;

  if (plan != null) res.workout.plan = plan;
  if (planName != null) res.workout.planName = planName;
  if (exercises != null) res.workout.exercises = exercises;
  if (startTime != null) res.workout.startTime = new Date(startTime);
  if (endTime != null) res.workout.endTime = new Date(endTime);
  if (totalPauseTime != null) res.workout.totalPauseTime = totalPauseTime;
  if (skippedPauses != null) res.workout.skippedPauses = skippedPauses;
  if (progression != null) res.workout.progression = progression;

  try {
    const updatedWorkout = await res.workout.save();
    res.json(updatedWorkout);
  } catch (error) {
    next(new CustomError('Error updating workout', 400));
  }
});

// Delete a workout
router.delete('/:id', getWorkout, async (req, res, next) => {
  try {
    await res.workout.deleteOne();
    res.json({ message: 'Workout deleted successfully' });
  } catch (error) {
    next(new CustomError('Error deleting workout', 500));
  }
});

module.exports = router;