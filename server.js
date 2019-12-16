// @ts-nocheck
const path = require('path');
const cors = require('cors');
const pino = require('pino');
const express = require('express');
const expressPino = require('express-pino-logger');
const socket = require('socket.io');
const ObjectId = require('mongodb').ObjectID;

const Message = require('./api/models/message.model');
const Chat = require('./api/models/chat.model');
const User = require('./api/models/user.model');
// mongodb connection & env variables
process.env.NODE_ENV !== 'production' && require('dotenv').config();
require('./db');

const router = require('./api/routes');
const app = express();

const port = process.env.PORT || 5000;
const staticDir = path.resolve('static');

const logger = pino();
const expressLogger = expressPino({ logger });

app.use(cors())
  .use(express.json())
  .use(express.static(staticDir))
  .use(express.urlencoded({ extended:false }))  
  .use(expressLogger)
  .use(router);

app.all('*', (req, res, next) => {
  const err = new Error(`Cant find ${req.originalUrl} on server!`);
  err.status = 'not found';
  err.statusCode = 404;

  next(err);
});

app.use((err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  res.status(err.statusCode).json({
    status: err.status,
    message: err.message
  });
});

const server = app.listen(port, () => {
  logger.info('Server is running on port %d', port)
});

// Socket setup
const userlist = {};

var io = socket.listen(server);

 io.on('connection',  (socket) => {
    socket.on('createChat', async (data) => {      
      const allChats = await Chat.find({});
      const isTitleUniq = !allChats.some(el => el.title === data.title);

      if (isTitleUniq) {
        const chatData = {
          ...data,
          participants: [data.creator]
        };
        const chat = new Chat(chatData);
      
        await chat.save();

        const chatFromMongo = await Chat.findOne({ title: data.title });

        socket.join(`${chat._id}`);
        socket.emit('createChat', { status: true, createdChatId: chatFromMongo._id });

        const allChatsUpdated = await Chat.find({});

        io.sockets.emit('chatList', allChatsUpdated);
      } else {
        socket.emit('createChat', { status: false });
      }
    });

    socket.on('joinChat', async ({ chatId, userId }) => {        
      const chat = await Chat.findOne({ _id: chatId });      
      const isUserParticipant = chat.participants.some(el => el.userId.toString() === userId);      

      if (isUserParticipant) {
        socket.join(`${chat._id}`);
        socket.emit('joinChat', { status: true });
      } else {
        socket.emit('joinChat', { status: false });
      }
    });

    socket.on('checkKey', async ({ chatId, userId, key }) => {
      const chat = await Chat.findOne({ _id: chatId });
      const user = await User.findOne({ _id: userId });
      const modifyUser = {
        userId: user._id,
        userColour: user.colour,
        userName: user.name
      }

      if(key === chat.key) {
        await Chat.findOneAndUpdate({ _id: chatId }, {$push: { participants: modifyUser }});

        socket.join(`${chat._id}`);
        socket.emit('checkKey', { status: true });
      } else {
        socket.emit('checkKey', { status: false });
      }
    });

    socket.on('getCurrentChat', async (chatId) => {
      const openedChat = await Chat.findOne({ _id: chatId }); 

      socket.emit('getCurrentChat', openedChat);
    });

    socket.on('getHistory', async (chatId) => {
      const allChatMessages = await Message.find({ chatId });

      socket.emit('getHistory', { history: allChatMessages });
    });

    socket.on('chat', ({ userMessage, chatId }) => {
      const message = new Message(userMessage);

      message.save();

      io.to(`${chatId}`).emit('chat', { message, createdAt: new Date()});
    });

    socket.on('online', ({ userId }) => {  
      userlist[socket.id] = userId;

      UpdateUserList();
    });

    socket.on('disconnect', () => {
      delete userlist[socket.id];

      UpdateUserList();
    });
      
    function UpdateUserList() {
      io.sockets.emit('updateusers', userlist);
    }

    socket.on('chatList', async ({ type, userId  }) => {
      let chats = await Chat.find({});

      switch(type) {
        case 'ALL_CHATS': {
          break;
        }
        case 'USER_IS_PARTICIPANT': {
          chats = chats.filter(chat =>
            chat.participants.some(user => user.userId.toString() === userId));
          break;
        };
        case 'USER_IS_CREATOR': {
          chats = chats.filter(chat =>
            chat.creator.userId === userId);
          break;
        };
      }

      socket.emit('chatList', chats);
    });

    socket.on('notification', async ({ type, userId, chatId }) => {
      const user = await User.findOne({ _id: userId });
      const modifyUser = {
        userId: user._id,
        userColour: user.colour,
        userName: user.name
      }            
      const eventMessage = type === 'join' ? 'joined' : type === 'leave' ? 'left' : 'entered';
      const notificationMessage = `User ${modifyUser.userName} has ${eventMessage} a chat`;
      const notification = new Message({
        chatId,
        user: modifyUser,
        content: notificationMessage,
        type
      });

      notification.save();      

      socket.broadcast.to(`${chatId}`).emit('chat', { message: notification, createdAt: new Date()})
    });

    socket.on('leaveChat', async({ userId, chatId }) => {
      const chat = await Chat.findOne({ _id: chatId });
      
      if (chat.creator.userId === userId) {
        socket.emit('leaveChat', { status: false });
      } else {
        await Chat.findOneAndUpdate({ _id: chatId }, {$pull: { participants: { userId: ObjectId(userId) } }});

        socket.emit('leaveChat', { status: true });
      }
    });
  });
