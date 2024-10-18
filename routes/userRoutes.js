// routes/userRoutes.js

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const User = require('../models/User'); // Add this line to import the User model

router.put('/experience-level', auth, userController.updateExperienceLevel);

router.put('/update', auth, async (req, res) => {
    try {
        const updates = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update only allowed fields
        if (updates.hasSeenGuide !== undefined) {
            user.hasSeenGuide = updates.hasSeenGuide;
        }
        // Add other fields that are allowed to be updated here

        await user.save();

        res.json({ 
            message: 'User updated successfully', 
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                isAdmin: user.isAdmin,
                experienceLevel: user.experienceLevel,
                hasSeenGuide: user.hasSeenGuide,
                deletedWorkoutPlans: user.deletedWorkoutPlans
            } 
        });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(400).json({ message: 'Error updating user', error: error.message });
    }
});

module.exports = router;