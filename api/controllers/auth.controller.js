const jwt = require('jsonwebtoken');

const User = require('../models/user.model');
const AppError = require('../utils/appError');

const signToken = user => {
  return jwt.sign({ user }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
}

const verify = token => {
  return jwt.verify(token, process.env.JWT_SECRET);
}

exports.signup = async (req, res, next) => {
  const { name } = req.body;
  const user = await User.find({ name });

  try {
    if (user.length > 0) {
      return next(new AppError('User with this name already exist', 401));
    }
  } catch (err){
    res.status(404).json({
      status: 'fail',
      message: err
    });
  }

  const newUser = await User.create(req.body);
  const token = signToken(newUser);

  console.log('signup user', newUser)
  console.log('signup', token)
  res.status(201).json({
    status: 'success',
    token,
    user: newUser
  })
}


exports.authenticate = async (req, res, next) => {
    const { token } = req.body;
    let user;
    try {
      user = verify(token).user;
    } catch(err) {
      res.status(400).json({
        status: 'fail',
        message: err
      });
    }
    if(!user) {
      next(new AppError('Unauthirized', 401));
    }
    res.status(200).json({
      status: 'success',
      user
    })
}

exports.login = async (req, res, next) => {
  const { name, password } = req.body;

  if (!name || !password) {
    return next(new AppError('Please provide name and password', 400))
  } else {
    const user = await User.findOne({ name }).select('+password');

    try {
      if (!user || !(await user.correctPassword(password, user.password))) {
        return next(new AppError('Incorrect name or password', 401));
      }
    } catch (err){
      res.status(404).json({
        status: 'fail',
        message: err
      });
    }

    const token = signToken(user);
    res.status(200).json({
      status: 'success',
      token,
      user
    });
  }
}
