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
      const { name, description, target, imageUrl, category, exerciseType, measurementType, recommendations } = req.body;
      const updatedExercise = await Exercise.findByIdAndUpdate(
        req.params.id,
        { name, description, target, imageUrl, category, exerciseType, measurementType, recommendations },
        { new: true }
      );
      if (!updatedExercise) {
        return res.status(404).json({ message: 'Exercise not found' });
      }
      res.json(updatedExercise);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  };