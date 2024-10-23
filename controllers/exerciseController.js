// Backend: controllers/exerciseController.js

exports.createExercise = async (req, res) => {
    try {
      const { name, description, target, imageUrl, category, exerciseType, measurementType, recommendations } = req.body;
      const newExercise = new Exercise({
        name,
        description,
        target,
        imageUrl,
        category,
        exerciseType,
        measurementType,
        recommendations
      });
      const savedExercise = await newExercise.save();
      res.status(201).json(savedExercise);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  };
  
  exports.updateExercise = async (req, res) => {
    try {
      const { name, description, target, imageUrl, category, exerciseType, measurementType, recommendations, isDefault } = req.body;
      const exercise = await Exercise.findById(req.params.id);
      
      if (!exercise) {
        return res.status(404).json({ message: 'Exercise not found' });
      }
  
      // If user is admin and exercise is default, update all fields
      if (req.user.isAdmin && exercise.isDefault) {
        const updatedExercise = await Exercise.findByIdAndUpdate(
          req.params.id,
          { 
            name, 
            description, 
            target, 
            imageUrl, 
            category, 
            exerciseType, 
            measurementType, 
            recommendations,
            isDefault
          },
          { new: true }
        );
        return res.json(updatedExercise);
      }
  
      // For normal users or admins editing non-default exercises
      const updatedExercise = await Exercise.findOneAndUpdate(
        { _id: req.params.id },
        {
          $set: {
            name: exercise.isDefault ? exercise.name : name,
            description: exercise.isDefault ? exercise.description : description,
            target: exercise.isDefault ? exercise.target : target,
            imageUrl: exercise.isDefault ? exercise.imageUrl : imageUrl,
            category: exercise.isDefault ? exercise.category : category,
            exerciseType: exercise.isDefault ? exercise.exerciseType : exerciseType,
            measurementType: exercise.isDefault ? exercise.measurementType : measurementType,
            [`recommendations.${req.body.experienceLevel}`]: recommendations[req.body.experienceLevel]
          }
        },
        { new: true }
      );
  
      res.json(updatedExercise);
    } catch (error) {
      console.error('Error in updateExercise:', error);
      res.status(400).json({ message: error.message });
    }
  };