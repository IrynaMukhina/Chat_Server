const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const USER_MODEL = 'User';

const userSchema = new mongoose.Schema({
  userName: {
    type: String,
    required: [true, 'Please provide us your name'],
    unique: true,
    lowercase: true,
    validate: [validator.isAlphanumeric, 'Please provide a valid name']
  },
  userPassword: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 8,
    select: false
  },
  userColour: {
    type: String,
    required: [true, 'Please provide a colour'],
  }
});

userSchema.pre('save', async function(next) {
  // TODO only run this password if password was actyally modified
  // if(!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.correctPassword = async (
  candidatePassword,
  userPassword
) => {
  return await bcrypt.compare(candidatePassword, userPassword);
};

const User = mongoose.model(USER_MODEL, userSchema);

module.exports = User;
