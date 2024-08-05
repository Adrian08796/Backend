// controllers/workoutController.js

const Workout = require('../models/Workout');

exports.getUserWorkouts = async (req, res) => {
  try {
    const workouts = await Workout.find({ user: req.user.id })
      .populate('plan')
      .populate('exercises.exercise')
      .sort({ date: -1 });
    res.json(workouts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching workouts', error: error.message });
  }
};

exports.getWorkout = async (req, res) => {
  try {
    const workout = await Workout.findById(req.params.id)
      .populate('plan')
      .populate('exercises.exercise');
    if (!workout) {
      return res.status(404).json({ message: 'Workout not found' });
    }
    res.json(workout);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching workout', error: error.message });
  }
};

exports.createWorkout = async (req, res) => {
  try {
    const newWorkout = new Workout({
      user: req.user.id,
      ...req.body
    });
    const savedWorkout = await newWorkout.save();
    const populatedWorkout = await Workout.findById(savedWorkout._id)
      .populate('plan')
      .populate('exercises.exercise');
    res.status(201).json(populatedWorkout);
  } catch (error) {
    res.status(400).json({ message: 'Error creating workout', error: error.message });
  }
};

exports.updateWorkout = async (req, res) => {
  try {
    const updatedWorkout = await Workout.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('plan').populate('exercises.exercise');
    if (!updatedWorkout) {
      return res.status(404).json({ message: 'Workout not found' });
    }
    res.json(updatedWorkout);
  } catch (error) {
    res.status(400).json({ message: 'Error updating workout', error: error.message });
  }
};

exports.deleteWorkout = async (req, res) => {
  try {
    const workout = await Workout.findByIdAndDelete(req.params.id);
    if (!workout) {
      return res.status(404).json({ message: 'Workout not found' });
    }
    res.json({ message: 'Workout deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting workout', error: error.message });
  }
};