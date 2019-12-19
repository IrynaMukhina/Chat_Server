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

var io = socket.listen(server);

// variables
const userStatuslist = {};
const socketUserList = {};
const allChatsParticipants = {};
const UserStatus = Object.freeze({
  online: 'ONLINE',
  offline: 'OFFLINE',
  inChat: 'IN_CHAT'
});

// Chat.find({}).then(chats => {
//   chats.forEach(chat => {
//     allChatsParticipants[chat._id] = chat.participants
//       .map(user => user.userId);
//     });
//     console.log('Initial allChatsParticipants', allChatsParticipants);
// });

User.find({}).then(users => {
  users.forEach(user => setUserStatus(user.id, UserStatus.offline, null));
  console.log('Initial users');
});

 io.on('connection',  async (socket) => {
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
      console.log('join')
      if (isUserParticipant) {
        socket.join(`${chat._id}`);
        console.log('joined!!!');
        
        socket.emit('joinChat', { status: true });
        setUserStatus(userId, UserStatus.inChat, chatId);
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

    socket.on('userStatus', ({ userId, status, saveChatId }) => {
      let chatId = null;
      switch (status) {
        case UserStatus.online: {
          socketUserList[socket.id] = userId;
          console.log('hi');
          break;
        }
        case UserStatus.offline: {
          delete socketUserList[socket.id];
          chatId = userStatuslist[userId].chatId;
          break;
        }
        // case UserStatus.inChat: {
        //   socketUserList[socket.id] = userId;
        //   chatId = userStatuslist[userId].chatId;
        // }
      }
      if (saveChatId || status === UserStatus.offline) {
        chatId = userStatuslist[userId].chatId;
      }

      setUserStatus(userId, status, chatId);
    });

    socket.on('disconnect', () => {
      const userId = socketUserList[socket.id];

      if (userId) {
        delete socketUserList[socket.id];
        chatId = userStatuslist[userId].chatId;
        setUserStatus(userId, UserStatus.offline, chatId);
      }
    });

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
      const eventMessage = type === 'join' ? 'joined' : type === 'leaveChat' ? 'left' : 'entered';
      const notificationMessage = `User ${modifyUser.userName} has ${eventMessage} a chat`;
      const notification = new Message({
        chatId,
        user: modifyUser,
        content: notificationMessage,
        type
      });

      notification.save();

      io.to(`${chatId}`).emit('chat', { notification, createdAt: new Date()})
    });

    socket.on('leaveChat', async({ userId, chatId }) => {
      const chat = await Chat.findOne({ _id: chatId });

      if (chat.creator.userId === userId) {
        socket.emit('leaveChat', { status: false });
      } else {
        await Chat.findOneAndUpdate({ _id: chatId }, {$pull: { participants: { userId: ObjectId(userId) } }});

        socket.emit('leaveChat', { status: true });
        setUserStatus(userId, UserStatus.online);
      }
    });

    socket.on('getActiveChat', ({ userId }) => {
      const userStatus = userStatuslist[userId]
      if (userStatus) {
        const chatId = userStatuslist[userId].chatId;
        socket.emit('getActiveChat', chatId);
      } else {
        userStatuslist[userId] = { status: UserStatus.online, chatId: null };
      }
    });

    // socket.on('getUserStatus', ({ userId }) => {
    //   console.log('userId', userId);
    //   const { status, chatId }  = userStatuslist[userId];
    //   socket.emit('getUserStatus', { status });
    //   if(chatId) {
    //     socket.emit('activeChat', { chatId });
    //   }
    // });
  });

  function setUserStatus(userId, status, chatId = null) {
    userStatuslist[userId] = { status, chatId };
    console.log('User status updated: ', status, userId);
  }