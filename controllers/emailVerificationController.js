// controllers/emailVerificationController.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { resendVerificationEmail } = require('../utils/emailService');
const CustomError = require('../utils/customError');

// Rate limiting setup
const rateLimit = require('express-rate-limit');
const resendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per IP
  message: 'Too many verification requests. Please try again later.'
});

const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;
    
    // Verify token using EMAIL_VERIFICATION_SECRET
    const decoded = jwt.verify(token, process.env.EMAIL_VERIFICATION_SECRET);
    
    // Find user with matching token that hasn't expired
    const user = await User.findOne({
      _id: decoded.userId,
      email: decoded.email,
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      throw new CustomError('Invalid or expired verification token', 400);
    }

    // Update user verification status
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({ 
      message: 'Email verified successfully! You can now log in.',
      email: user.email
    });
  } catch (error) {
    console.error('Verification error:', error);
    if (error.name === 'TokenExpiredError') {
      return next(new CustomError('Verification link has expired', 400));
    }
    if (error.name === 'JsonWebTokenError') {
      return next(new CustomError('Invalid verification token', 400));
    }
    next(new CustomError('Error verifying email: ' + error.message, 500));
  }
};

const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
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
    
    if (Date.now() - lastSentTime < 5 * 60 * 1000) { // 5 minutes cooldown
      return next(new CustomError('Please wait 5 minutes before requesting another verification email', 429));
    }

    await resendVerificationEmail(user);

    res.json({ 
      message: 'Verification email sent successfully',
      email: user.email
    });
  } catch (error) {
    next(new CustomError('Error resending verification email: ' + error.message, 500));
  }
};

module.exports = {
  verifyEmail,
  resendVerification,
  resendLimiter
};