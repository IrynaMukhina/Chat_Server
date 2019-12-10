// @ts-nocheck
const path = require('path');
const cors = require('cors');
const pino = require('pino');
const express = require('express');
const expressPino = require('express-pino-logger');
const socket = require('socket.io');

const Message = require('./api/models/message.model');
const Chat = require('./api/models/chat.model');
// mongodb connection & env variables
process.env.NODE_ENV !== 'production' && require('dotenv').config();

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
        const chat = new Chat(data);

        chat.save();

        socket.join(`${chat._id}`);
        socket.emit('createChat', { status: true });
      } else {
        socket.emit('createChat', { status: false });
      }
    });

    socket.on('joinChat', async ({ chatId, userId }) => {      
      const chat = await Chat.find({ _id: chatId });
      const chatParticipants = chat[0].participants;
      const isUserParticipant = chatParticipants.some(el => el.userId === userId);

      if (isUserParticipant) {
        const allChatMessages = await Message.find({ chatId });
        
        socket.join(`${chat._id}`);
        socket.emit('joinChat', { status: true, history: allChatMessages });
      } else {
        socket.emit('joinChat', { status: false });
      }
    });

    socket.on('checkKey', async ({ chatId, user, key }) => {
      const chat = await Chat.find({ _id: chatId });
      const chatKey = chat[0].key;
      const allChatMessages = await Message.find({ chatId });

      if(key === chatKey) {
        await Chat.findOneAndUpdate({ _id: chatId }, {$push: { participants: user }});

        socket.join(`${chat._id}`);
        socket.emit('checkKey', { status: true, history: allChatMessages });
      } else {
        socket.emit('checkKey', { status: false });
      }
    });

    socket.on('chat', ({ userMessage, chatId }) => {
      const message = new Message(userMessage);

      message.save();

      io.to(`${chatId}`).emit('chat', { message, socketId: socket.id, createdAt: new Date()});
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
});
