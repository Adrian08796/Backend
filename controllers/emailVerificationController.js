// controllers/emailVerificationController.js

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

    const decoded = jwt.verify(token, process.env.EMAIL_VERIFICATION_SECRET);
    
    const user = await User.findOne({
      _id: decoded.userId,
      email: decoded.email,
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return next(new CustomError('Invalid or expired verification token', 400));
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({ 
      message: 'Email verified successfully! You can now log in.',
      email: user.email
    });
  } catch (error) {
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

    // Check if we can resend (minimum 5 minutes between attempts)
    const lastSent = user.emailVerificationExpires 
      ? new Date(user.emailVerificationExpires).getTime() - (24 * 60 * 60 * 1000)
      : 0;
    
    if (Date.now() - lastSent < 5 * 60 * 1000) {
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