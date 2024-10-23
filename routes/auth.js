// routes/auth.js

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Workout = require('../models/Workout');
const WorkoutPlan = require('../models/WorkoutPlan');
const Exercise = require('../models/Exercise');
const CustomError = require('../utils/customError');
const auth = require('../middleware/auth');
const { generateAccessToken, generateRefreshToken } = require('../utils/tokenUtils');
const TokenBlacklist = require('../models/TokenBlacklist');
const { sendVerificationEmail, sendWelcomeEmail, generateVerificationToken } = require('../utils/emailService');

// Registration
router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return next(new CustomError('All fields are required', 400));
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return next(new CustomError('User with this email or username already exists', 400));
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user with verification token
    const user = new User({
      username,
      email,
      password: hashedPassword,
      hasSeenGuide: false,
      isEmailVerified: false
    });

    // Generate and set verification token with proper expiry
    const verificationToken = generateVerificationToken(user._id, user.email);
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await user.save();

    // Send verification and welcome emails
    await Promise.all([
      sendVerificationEmail(email, verificationToken),
      sendWelcomeEmail(email, username)
    ]);

    res.status(201).json({ 
      message: 'Registration successful! Please check your email to verify your account.',
      requiresVerification: true
    });
  } catch (error) {
    console.error('Error registering user:', error);
    next(new CustomError('Error registering user: ' + error.message, 500));
  }
});

// Email verification
router.get('/verify-email/:token', async (req, res, next) => {
  try {
    const { token } = req.params;

    const decoded = jwt.verify(token, process.env.EMAIL_VERIFICATION_SECRET);
    
    const user = await User.findOne({
      _id: decoded.userId,
      email: decoded.email,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return next(new CustomError('Invalid or expired verification token', 400));
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully! You can now log in.' });
  } catch (error) {
    console.error('Error verifying email:', error);
    next(new CustomError('Error verifying email: ' + error.message, 500));
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    console.log('Received login request:', req.body);
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      console.log('Invalid credentials: User not found');
      return next(new CustomError('Invalid credentials', 400));
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('Invalid credentials: Password does not match');
      return next(new CustomError('Invalid credentials', 400));
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Clear old refresh tokens and add the new one
    user.activeRefreshTokens = [];
    user.addRefreshToken(refreshToken);
    await user.save();

    console.log('Login successful. Active refresh tokens:', user.activeRefreshTokens);

    res.json({ 
      accessToken, 
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
        experienceLevel: user.experienceLevel,
        hasSeenGuide: user.hasSeenGuide || false,
        deletedWorkoutPlans: user.deletedWorkoutPlans
      }
    });
  } catch (error) {
    next(error);
  }
});

// Token refresh
router.post('/refresh-token', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    console.log('Received refresh token:', refreshToken);

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    // Check if token is blacklisted
    const isBlacklisted = await TokenBlacklist.findOne({ token: refreshToken });
    if (isBlacklisted) {
      return res.status(401).json({ message: 'Token has been invalidated' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      console.log('Decoded refresh token:', decoded);
    } catch (error) {
      console.error('Error verifying refresh token:', error);
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      console.log('User not found for id:', decoded.id);
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify token is in active list
    const tokenIndex = user.activeRefreshTokens.indexOf(refreshToken);
    if (tokenIndex === -1) {
      console.log('Refresh token not found in active tokens');
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    // Generate new tokens
    const accessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    // Update refresh tokens
    user.activeRefreshTokens.splice(tokenIndex, 1);
    user.addRefreshToken(newRefreshToken);
    await user.save();

    // Add old refresh token to blacklist
    await TokenBlacklist.create({ 
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });

    console.log('New tokens generated:', { accessToken, newRefreshToken });
    console.log('Active refresh tokens:', user.activeRefreshTokens);

    res.json({ 
      accessToken, 
      refreshToken: newRefreshToken,
      expiresIn: 900 // 15 minutes in seconds
    });
  } catch (error) {
    console.error('Error in refresh token route:', error);
    next(error);
  }
});

// Logout
router.post('/logout', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new CustomError('User not found', 404));
    }

    const refreshToken = req.body.refreshToken;
    if (refreshToken) {
      user.removeRefreshToken(refreshToken);
      // Add refresh token to blacklist with proper expiry
      await TokenBlacklist.create({ 
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      });
    }

    // Blacklist the current access token
    const accessToken = req.header('x-auth-token');
    await TokenBlacklist.create({ 
      token: accessToken,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    });

    await user.save();

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(new CustomError('Error logging out', 500));
  }
});

// Get current user
router.get('/user', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return next(new CustomError('User not found', 404));
    }
    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      experienceLevel: user.experienceLevel,
      hasSeenGuide: user.hasSeenGuide,
      deletedWorkoutPlans: user.deletedWorkoutPlans
    });
  } catch (error) {
    next(new CustomError('Error fetching user', 500));
  }
});

// Update user
router.put('/user', auth, async (req, res, next) => {
  try {
    const { username, email, experienceLevel } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return next(new CustomError('User not found', 404));
    }

    if (username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return next(new CustomError('Username is already taken', 400));
      }
    }

    if (email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return next(new CustomError('Email is already taken', 400));
      }
    }

    user.username = username;
    user.email = email;
    if (experienceLevel) {
      user.experienceLevel = experienceLevel;
    }

    await user.save();

    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      experienceLevel: user.experienceLevel,
      isAdmin: user.isAdmin,
      deletedWorkoutPlans: user.deletedWorkoutPlans,
      hasSeenGuide: user.hasSeenGuide,
    });
  } catch (error) {
    next(new CustomError('Error updating user: ' + error.message, 500));
  }
});

// Change password
router.put('/change-password', auth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return next(new CustomError('User not found', 404));
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return next(new CustomError('Current password is incorrect', 400));
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(new CustomError('Error changing password: ' + error.message, 500));
  }
});

// Delete user account
router.delete('/user', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new CustomError('User not found', 404));
    }

    // Delete all user data
    await Promise.all([
      Workout.deleteMany({ user: req.user.id }),
      WorkoutPlan.deleteMany({ user: req.user.id }),
      Exercise.deleteMany({ user: req.user.id }),
      User.findByIdAndDelete(req.user.id)
    ]);

    res.json({ message: 'User account and associated data deleted successfully' });
  } catch (error) {
    next(new CustomError('Error deleting user account: ' + error.message, 500));
  }
});

module.exports = router;