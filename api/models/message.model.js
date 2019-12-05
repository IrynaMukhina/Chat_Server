const mongoose = require('mongoose');

const MESSAGE_MODEL = 'Message';

/**
 * @swagger
 * definitions:
 *  Message:
 *    type: object
 *    properties:
 *      chatId:
 *        type: string
 *        example: '5db179b634a29600172f6e8a'
 *      user:
 *        type: object
 *        properties:
 *          name: 
 *            type: string
 *            example: 'Andrii'
 *          status:
 *            type: boolean
 *            example: true
 *          bgColor:
 *            type: string
 *            example: '#ffffff'
 *      content: 
 *        type: string
 *        example: 'This is my message'
 *      createdAt:
 *        type: string
 *        format: date-time
 *      updatedAt:
 *        type: string
 *        format: date-time
 */

const messageSchema = new mongoose.Schema(
  {
    chatId: String,
    user: {
      name: String,
      status: Boolean,
      bgColor: String
    },
    content: String
  },
  {
    timestamps: true
  }
);

const Message = mongoose.model(MESSAGE_MODEL, messageSchema);

module.exports = Message;
