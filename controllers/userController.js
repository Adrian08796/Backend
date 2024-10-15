// controllers/userController.js

const User = require('../models/User');

exports.updateExperienceLevel = async (req, res) => {
  try {
    const { experienceLevel } = req.body;
    console.log('Updating experience level for user:', req.user.id);
    console.log('New experience level:', experienceLevel);

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { experienceLevel },
      { new: true, runValidators: true }
    );
    
    if (!updatedUser) {
      console.log('User not found:', req.user.id);
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log('User updated successfully:', updatedUser);
    res.json({ experienceLevel: updatedUser.experienceLevel });
  } catch (error) {
    console.error('Error updating experience level:', error);
    res.status(500).json({ message: error.message, stack: error.stack });
  }
};