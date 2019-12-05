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
 *      participants: 
 *        type: array
 *        items:
 *          type: object
 *          properties:
 *            name: 
 *              type: string
 *              example: 'Andrii'
 *            status:
 *              type: boolean
 *              example: true
 *            bgColor:
 *              type: string
 *              example: '#ffffff'
 *      key: 
 *        type: string
 *        example: 'secret key'
 * 
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
