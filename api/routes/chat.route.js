const express = require('express');
const chatController = require('../controllers/chat.controller');

const router = express.Router();

router
  .route('/chats')
  .get(chatController.getAllChats)

module.exports = router;