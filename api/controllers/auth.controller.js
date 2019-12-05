const User = require('./../models/user.model');
const jwt = require('jsonwebtoken');

const AppError = require('../utils/appError');

const signToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  })
}

exports.signup = async (req, res, next) => {
  const newUser = await User.create(req.body);

  const token = signToken(newUser._id)

  try {
    res.status(201).json({
    status: 'success',
    token,
    data: {
      user: newUser
    }
  })
  } catch (err){
    res.status(404).json({
      status: 'fail',
      message: err
    });
  }
}

exports.login = async (req, res, next) => {
  const { userName, userPassword } = req.body;

  // Check if name and password exists
  if (!userName || !userPassword) {
    return next(new AppError('Please provide name and password', 400))
  }
  // Check if user exiss && password correct
  const user = await User.findOne({ userName }).select('+password');

  try {
    if (!user || !(await user.correctPassword(userPassword, user.password))) {
      return next(new AppError('Incorrect name or password', 401));
    }
  } catch (err){
    res.status(404).json({
      status: 'fail',
      message: err
    });
  }

  //if everything is ok send token to client
  const token = signToken(user._id);
  res.status(200).json({
    status: 'success',
    token
  })
}
