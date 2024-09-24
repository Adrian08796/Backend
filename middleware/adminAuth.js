// middleware/adminAuth.js

const CustomError = require('../utils/customError');

const adminAuth = async (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return next(new CustomError('Access denied. Admin rights required.', 403));
  }
  next();
};

module.exports = adminAuth;