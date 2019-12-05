const express = require('express');
const messageController = require('../controllers/message.controller');

const router = express.Router();

router
  .route('/messages')
  .get(messageController.getAllMessages)

module.exports = router;