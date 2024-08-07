# server.js

```js
// server.js

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// Import routes
const authRoutes = require('./routes/auth');
const exerciseRoutes = require('./routes/exercises');
const workoutRoutes = require('./routes/workouts');
const workoutPlanRoutes = require('./routes/workoutPlans');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/workoutplans', workoutPlanRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: 'error',
    statusCode: statusCode,
    message: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 4500;

app.listen(PORT, '192.168.178.42', () => console.log(`Server running on port ${PORT}`));
```

# package.json

```json
{
  "name": "gym-app-backend",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "description": "",
  "dependencies": {
    "bcrypt": "^5.1.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^8.5.2"
  },
  "devDependencies": {
    "nodemon": "^3.1.4"
  }
}

```

# utils/customError.js

```js
class CustomError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
      this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
      this.isOperational = true;
  
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  module.exports = CustomError;
```

# routes/workouts.js

```js
// routes/workouts.js

const express = require('express');
const router = express.Router();
const Workout = require('../models/Workout');
const auth = require('../middleware/auth');
const CustomError = require('../utils/customError');

router.use(auth);
router.use((req, res, next) => {
  console.log('Workout route accessed:', req.method, req.path);
  console.log('User:', req.user);
  next();
});

// Get all workouts for the current user
router.get('/user', async (req, res, next) => {
  try {
    const workouts = await Workout.find({ user: req.user })
      .populate({
        path: 'plan',
        select: 'name exercises', // Select the fields you need from the plan
        populate: {
          path: 'exercises',
          select: 'name description target' // Select the fields you need from the exercises
        }
      })
      .populate('exercises.exercise')
      .sort({ startTime: -1 }); // Sort by startTime instead of date

    console.log('Fetched workouts:', JSON.stringify(workouts, null, 2));

    res.json(workouts);
  } catch (error) {
    console.error('Error fetching workouts:', error);
    next(new CustomError('Error fetching workouts', 500));
  }
});

// Add a new workout
router.post('/', async (req, res, next) => {
  try {
    console.log('Received workout data:', JSON.stringify(req.body, null, 2));
    const { plan, planName, exercises, startTime, endTime } = req.body;
    
    if (!planName || !exercises || !startTime || !endTime) {
      return next(new CustomError('Missing required fields', 400));
    }

    if (!Array.isArray(exercises) || exercises.length === 0) {
      return next(new CustomError('Invalid exercises data', 400));
    }

    const workout = new Workout({
      user: req.user,
      plan: plan, // Make sure this is the plan ID
      planName,
      exercises: exercises.map(exercise => ({
        exercise: exercise.exercise,
        sets: exercise.sets.map(set => ({
          ...set,
          completedAt: new Date(set.completedAt)
        })),
        completedAt: new Date(exercise.completedAt)
      })),
      startTime: new Date(startTime),
      endTime: new Date(endTime)
    });

    console.log('New workout object:', JSON.stringify(workout, null, 2));

    const newWorkout = await workout.save();
    console.log('Saved workout:', JSON.stringify(newWorkout, null, 2));

    const populatedWorkout = await Workout.findById(newWorkout._id)
      .populate('plan')
      .populate('exercises.exercise');
    res.status(201).json(populatedWorkout);
  } catch (error) {
    console.error('Server error:', error);
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return next(new CustomError('Validation error', 400, validationErrors));
    }
    next(new CustomError('Error creating workout', 500));
  }
});

// Get a specific workout
router.get('/:id', getWorkout, (req, res) => {
  res.json(res.workout);
});

// Update a workout
router.put('/:id', getWorkout, async (req, res, next) => {
  if (req.body.plan != null) {
    res.workout.plan = req.body.plan;
  }
  if (req.body.planName != null) {
    res.workout.planName = req.body.planName;
  }
  if (req.body.exercises != null) {
    res.workout.exercises = req.body.exercises;
  }
  if (req.body.startTime != null) {
    res.workout.startTime = new Date(req.body.startTime);
  }
  if (req.body.endTime != null) {
    res.workout.endTime = new Date(req.body.endTime);
  }
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

// Middleware function to get a workout by ID
async function getWorkout(req, res, next) {
  try {
    const workout = await Workout.findById(req.params.id)
      .populate('plan').populate('exercises.exercise');
    if (workout == null) {
      return next(new CustomError('Workout not found', 404));
    }
    if (workout.user.toString() !== req.user) {
      return next(new CustomError('Not authorized to access this workout', 403));
    }
    res.workout = workout;
    next();
  } catch (error) {
    next(new CustomError('Error fetching workout', 500));
  }
}

module.exports = router;
```

# routes/workoutPlans.js

```js
// routes/workoutPlans.js

const express = require('express');
const router = express.Router();
const WorkoutPlan = require('../models/WorkoutPlan');
const Exercise = require('../models/Exercise');
const auth = require('../middleware/auth');
const CustomError = require('../utils/customError');

router.use(auth);

// Get all workout plans
router.get('/', async (req, res, next) => {
  try {
    const workoutPlans = await WorkoutPlan.find({ user: req.user })
      .populate({
        path: 'exercises',
        select: 'name description target imageUrl'
      });
    res.json(workoutPlans);
  } catch (err) {
    next(new CustomError('Error fetching workout plans', 500));
  }
});

// Create a new workout plan
router.post('/', async (req, res, next) => {
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
    const populatedPlan = await WorkoutPlan.findById(savedWorkoutPlan._id).populate('exercises');
    res.status(201).json(populatedPlan);
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
    const { name, exercises } = req.body;
    const updatedWorkoutPlan = await WorkoutPlan.findOneAndUpdate(
      { _id: req.params.id, user: req.user },
      { name, exercises },
      { new: true, runValidators: true }
    ).populate('exercises');
    if (!updatedWorkoutPlan) {
      return next(new CustomError('Workout plan not found', 404));
    }
    res.json(updatedWorkoutPlan);
  } catch (err) {
    next(new CustomError('Error updating workout plan', 400));
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

    const workoutPlan = await WorkoutPlan.findOne({ _id: req.params.id, user: req.user });
    if (!workoutPlan) {
      return next(new CustomError('Workout plan not found', 404));
    }

    if (workoutPlan.exercises.includes(exerciseId)) {
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
router.delete('/:id', async (req, res, next) => {
  try {
    const workoutPlan = await WorkoutPlan.findOneAndDelete({ _id: req.params.id, user: req.user });
    if (!workoutPlan) {
      return next(new CustomError('Workout plan not found', 404));
    }
    res.json({ message: 'Workout plan deleted successfully' });
  } catch (err) {
    next(new CustomError('Error deleting workout plan', 500));
  }
});

module.exports = router;
```

# routes/exercises.js

```js
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
  const { name, description, target, imageUrl } = req.body;
  const newExercise = new Exercise({
    name,
    description,
    target,
    imageUrl: imageUrl || undefined
  });
  try {
    const savedExercise = await newExercise.save();
    res.status(201).json(savedExercise);
  } catch (err) {
    next(new CustomError('Error creating exercise', 400));
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
    const updatedExercise = await Exercise.findByIdAndUpdate(req.params.id, req.body, { new: true });
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
```

# routes/auth.js

```js
// routes/auth.js

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const CustomError = require('../utils/customError');
const auth = require('../middleware/auth');

// Registration
router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return next(new CustomError('User already exists', 400));
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      username,
      email,
      password: hashedPassword
    });

    await user.save();

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    next(new CustomError('Error registering user', 500));
  }
});

// Login
// Login
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return next(new CustomError('Invalid credentials', 400));
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return next(new CustomError('Invalid credentials', 400));
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ 
      token, 
      user: {
        id: user._id,
        username: user.username,
        email: user.email
        // Add any other non-sensitive user data you need
      }
    });
  } catch (error) {
    next(new CustomError('Error logging in', 500));
  }
});

// Get current user
router.get('/user', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user).select('-password');
    if (!user) {
      return next(new CustomError('User not found', 404));
    }
    res.json(user);
  } catch (error) {
    next(new CustomError('Error fetching user', 500));
  }
});

module.exports = router;
```

# models/WorkoutPlan.js

```js
const mongoose = require('mongoose');

const WorkoutPlanSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  exercises: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exercise'
  }]
}, {
  timestamps: true // This will automatically add and manage createdAt and updatedAt fields
});

module.exports = mongoose.model('WorkoutPlan', WorkoutPlanSchema);
```

# models/Workout.js

```js
// models/Workout.js

const mongoose = require('mongoose');

const workoutSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkoutPlan',
    required: false
  },
  planName: {
    type: String,
    required: true
  },
  exercises: [{
    exercise: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exercise',
      required: true
    },
    sets: [{
      weight: {
        type: Number,
        required: true
      },
      reps: {
        type: Number,
        required: true
      },
      completedAt: {
        type: Date,
        required: true
      }
    }],
    completedAt: {
      type: Date,
      required: true
    }
  }],
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

workoutSchema.statics.handlePlanDeletion = async function(planId, planName) {
  return this.updateMany(
    { plan: planId },
    { 
      $set: { planDeleted: true, planName: planName },
      $unset: { plan: "" }
    }
  );
};

module.exports = mongoose.model('Workout', workoutSchema);
```

# models/User.js

```js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

module.exports = mongoose.model('User', UserSchema);
```

# models/Exercise.js

```js
// models/Exercise.js

const mongoose = require('mongoose');

const ExerciseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Exercise name is required'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  description: {
    type: String,
    required: [true, 'Exercise description is required'],
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  target: {
    type: String,
    required: [true, 'Target muscle group is required'],
    trim: true
  },
  imageUrl: {
    type: String,
    default: 'https://www.inspireusafoundation.org/wp-content/uploads/2023/03/barbell-bench-press-side-view.gif'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Exercise', ExerciseSchema);
```

# middleware/auth.js

```js
// middleware/auth.js

const jwt = require('jsonwebtoken');
const CustomError = require('../utils/customError');

module.exports = function(req, res, next) {
  const token = req.header('x-auth-token');
  if (!token) {
    return next(new CustomError('No token, authorization denied', 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.id;
    next();
  } catch (error) {
    next(new CustomError('Token is not valid', 401));
  }
};
```

# controllers/workoutController.js

```js
// controllers/workoutController.js

const Workout = require('../models/Workout');

exports.createWorkout = async (req, res) => {
  try {
    console.log('Received workout data:', JSON.stringify(req.body, null, 2));
    const { plan, planName, exercises, startTime, endTime } = req.body;
    
    if (!planName || !exercises || !startTime || !endTime) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!Array.isArray(exercises) || exercises.length === 0) {
      return res.status(400).json({ message: 'Invalid exercises data' });
    }

    const newWorkout = new Workout({
      user: req.user.id,
      plan,
      planName,
      exercises: exercises.map(exercise => ({
        exercise: exercise.exercise,
        sets: exercise.sets.map(set => ({
          ...set,
          completedAt: new Date(set.completedAt)
        })),
        completedAt: new Date(exercise.completedAt)
      })),
      startTime: new Date(startTime),
      endTime: new Date(endTime)
    });

    console.log('New workout object:', JSON.stringify(newWorkout, null, 2));

    const savedWorkout = await newWorkout.save();
    console.log('Saved workout:', JSON.stringify(savedWorkout, null, 2));

    const populatedWorkout = await Workout.findById(savedWorkout._id)
      .populate('plan')
      .populate('exercises.exercise');

    res.status(201).json(populatedWorkout);
  } catch (error) {
    console.error('Error creating workout:', error);
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: 'Validation error', errors: validationErrors });
    }
    res.status(500).json({ message: 'Error creating workout', error: error.message });
  }
};

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
```

# assets/images/Cable Flye.webp

This is a binary file of the type: Image

# assets/images/Barbell Bench Press.webp

This is a binary file of the type: Image

