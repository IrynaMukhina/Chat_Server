const mongoose = require('mongoose');

const CHAT_MODEL = 'Chat';

/**
 * @swagger
 * definitions:
 *  Chat:
 *    type: object
 *    properties:
 *      title: 
 *        type: string
 *        example: 'My chat'
 *      creator:
 *        type: object,
 *        properties:
 *          userName:
 *            type: string
 *            example: 'Andrii'
 *          userColour:
 *            type: string
 *            example: '#ffffff'
 *      participants: 
 *        type: array
 *        items:
 *          type: object
 *          properties:
 *            userName: 
 *              type: string
 *              example: 'Andrii'
 *            userColour:
 *              type: string
 *              example: '#ffffff'
 *      key: 
 *        type: string
 *        example: 'secret key'
 */

const chatSchema = new mongoose.Schema(
  {
    title: String,
    participants: Array,
    key: String
  }
);

const Chat = mongoose.model(CHAT_MODEL, chatSchema);

module.exports = Chat;
