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

// Add the verification route - PUT THIS AT THE TOP OF YOUR ROUTES
router.get('/verify-email/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    console.log('Verifying token:', token);

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.EMAIL_VERIFICATION_SECRET);
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError);
      return res.status(400).json({ 
        message: jwtError.name === 'TokenExpiredError' 
          ? 'Verification link has expired' 
          : 'Invalid verification token'
      });
    }

    const user = await User.findOne({
      _id: decoded.userId,
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      console.log('User not found or token mismatch');
      return res.status(400).json({ message: 'Invalid or expired verification token' });
    }

    // Update user verification status
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    console.log('User verified successfully:', user.email);
    res.json({ 
      message: 'Email verified successfully! You can now log in.',
      email: user.email
    });
  } catch (error) {
    console.error('Verification error:', error);
    next(new CustomError('Error verifying email: ' + error.message, 500));
  }
});


// Registration
router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return next(new CustomError('All fields are required', 400));
    }

    // Check for existing user
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return next(new CustomError('User with this email or username already exists', 400));
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user without verification first
    const user = new User({
      username,
      email,
      password: hashedPassword,
      hasSeenGuide: false,
      isEmailVerified: false
    });

    // Generate verification token after user creation
    const verificationToken = generateVerificationToken(user._id, user.email);
    
    // Set verification token and expiry
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await user.save();
    console.log('User created with verification token:', verificationToken);

    try {
      // Send verification email first
      await sendVerificationEmail(email, verificationToken);
      console.log('Verification email sent successfully');
      
      // Send welcome email after verification email
      await sendWelcomeEmail(email, username);
      console.log('Welcome email sent successfully');
    } catch (emailError) {
      console.error('Error sending emails:', emailError);
      // Don't fail registration if emails fail
    }

    res.status(201).json({ 
      message: 'Registration successful! Please check your email to verify your account.',
      requiresVerification: true
    });
  } catch (error) {
    console.error('Registration error:', error);
    next(new CustomError('Error registering user: ' + error.message, 500));
  }
});

// Email verification
router.post('/resend-verification', async (req, res, next) => {
  try {
    const { email } = req.body;
    console.log('Resending verification email for:', email);

    const user = await User.findOne({ email });
    if (!user) {
      return next(new CustomError('No account found with this email', 404));
    }

    if (user.isEmailVerified) {
      return next(new CustomError('Email is already verified', 400));
    }

    // Check cooldown period
    const lastSentTime = user.emailVerificationExpires 
      ? new Date(user.emailVerificationExpires).getTime() - (24 * 60 * 60 * 1000)
      : 0;
    
    if (Date.now() - lastSentTime < 5 * 60 * 1000) {
      return next(new CustomError('Please wait 5 minutes before requesting another verification email', 429));
    }

    // Generate new verification token
    const verificationToken = generateVerificationToken(user._id, user.email);
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    await user.save();
    console.log('New verification token generated:', verificationToken);

    await sendVerificationEmail(user.email, verificationToken);
    console.log('Verification email resent successfully');

    res.json({ 
      message: 'Verification email sent successfully',
      email: user.email
    });
  } catch (error) {
    console.error('Error resending verification:', error);
    next(new CustomError('Error sending verification email: ' + error.message, 500));
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

    // Check email verification status first
    if (!user.isEmailVerified) {
      // Generate and set new verification token
      const verificationToken = jwt.sign(
        { 
          userId: user._id,
          email: user.email,
          type: 'email-verification'
        },
        process.env.EMAIL_VERIFICATION_SECRET,
        { expiresIn: '24h' }
      );
      
      user.emailVerificationToken = verificationToken;
      user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await user.save();

      // Send new verification email
      try {
        await sendVerificationEmail(user.email, verificationToken);
      } catch (emailError) {
        console.error('Error sending verification email:', emailError);
      }

      return res.status(403).json({
        message: 'Please verify your email before logging in. A new verification email has been sent.',
        requiresVerification: true
      });
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