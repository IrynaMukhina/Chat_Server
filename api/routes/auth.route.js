const express = require('express');

const { signup, login, authenticate } = require('../controllers/auth.controller');

const router = express.Router();

router
  .post('/signup', signup)
  .post('/login', login)
  .post('/authenticate', authenticate);

module.exports = router;