const User = require('../models/user.model');

exports.getAllUsers = async (req, res, next) => {
  const users = await User.find();

  try {
    res.status(200).json({
      users
  })
  } catch (err){
    res.status(404).json({
      status: 'fail',
      message: err
    });
  }
};
