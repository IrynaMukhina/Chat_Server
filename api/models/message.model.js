const mongoose = require('mongoose');

const MESSAGE_MODEL = 'Message';
// const NOTIFICATION = {
//   enter: 'enter',
//   leave: 'leave'
// };
// const MESSAGE_TYPES = ['message', NOTIFICATION];


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
 *          userName: 
 *            type: string
 *            example: 'Andrii'
 *          userColour:
 *            type: string
 *            example: '#ffffff'
 *      content: 
 *        type: string
 *        example: 'This is my message'
 *      type: MESSAGES_TYPE
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
      userId: String,
      userName: String,
      userColour: String
    },
    content: String,
    type: String
  },
  {
    timestamps: true
  }
);

const Message = mongoose.model(MESSAGE_MODEL, messageSchema);

module.exports = Message;
