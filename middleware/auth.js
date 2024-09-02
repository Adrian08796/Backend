// middleware/auth.js

const jwt = require('jsonwebtoken');
const CustomError = require('../utils/customError');
const User = require('../models/User'); // Adjust the path as needed

module.exports = async function(req, res, next) {
  const token = req.header('x-auth-token');
  if (!token) {
    return next(new CustomError('No token, authorization denied', 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    
    // Check if the token is blacklisted
    const user = await User.findById(decoded.id);
    if (user.blacklistedTokens.includes(token)) {
      return next(new CustomError('Token is blacklisted', 401));
    }

    req.user = decoded.id;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired', tokenExpired: true });
    }
    next(new CustomError('Token is not valid', 401));
  }
};