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
const userStatuslist = {};
const socketUserList = {};

var io = socket.listen(server);

 io.on('connection',  (socket) => {
// CHAT CREATION
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

//JOIN CHAT
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

// CHECK KEY
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

      createAndSaveNotification({ type: 'join', userId, chatId }, socket)
    } else {
      socket.emit('checkKey', { status: false });
    }
  });

// GET CURRENT CHAT
  socket.on('getCurrentChat', async (chatId) => {
    const openedChat = await Chat.findOne({ _id: chatId }); 

    socket.emit('getCurrentChat', openedChat);
  });

// GET CHAT HISTORY
  socket.on('getHistory', async (chatId) => {
    const allChatMessages = await Message.find({ chatId });

    socket.emit('getHistory', { history: allChatMessages });
  });

// CHAT FUNCTIONALITY
  socket.on('chat', ({ userMessage, chatId }) => {
    const message = new Message(userMessage);
    const newMessage = { ...userMessage, createdAt: new Date() };

    message.save();

    io.to(`${chatId}`).emit('chat', { message: newMessage });
  });

// ONLINE MODE

function userOnline(socketId, userId) {
    socketUserList[socketId] = userId;
    userStatuslist[userId] = true;
  }
function userOffline(socketId) {
  userId = socketUserList[socketId];
  if (userId) {
    delete userStatuslist[userId];
  }
}

socket.on('online', ({ userId }) => {
  userOnline(socket.id, userId);
});

socket.on('offline', () => {
  userOffline(socket.id);
});

socket.on('disconnect', () => {
  userOffline(socket.id);
});

socket.on('chatUserList', async ({ chatId }) => {
  const chat = await Chat.findOne({ _id: chatId });
  const participants = chat.participants;
  const participantsWithStatus = participants.map(
    participant => {
      const isOnline = !!userStatuslist[participant.userId];
      return {
        userId: participant.userId,
        userName: participant.userName,
        userColour: participant.userColour,
        isOnline: isOnline
      };
    }
  );

  socket.emit('chatUserList', participantsWithStatus);
});

// DISPLAY CHATLISTS
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

  socket.on('leaveChat', async({ userId, chatId }) => {
    const chat = await Chat.findOne({ _id: chatId });
    
    if (chat.creator.userId === userId) {
      socket.emit('leaveChat', { status: false });
    } else {
      await Chat.findOneAndUpdate({ _id: chatId }, {$pull: { participants: { userId: ObjectId(userId) } }});

      createAndSaveNotification({ type: 'leave', userId, chatId }, socket)

      socket.emit('leaveChat', { status: true });
    }
  });

// SETTINGS OPTIONS
  socket.on('changeTitle', async({ chatId, newTitle }) =>  {
    const allChats = await Chat.find({});
    const chat = await Chat.findOne({ _id: chatId });
    const userId = chat.creator.userId;
    const oldTitle = chat.title;
    const isNewTitleExist = allChats.some(el => el.title === newTitle);

    if (!isNewTitleExist) {
      await Chat.findOneAndUpdate({ _id: chatId }, { title: newTitle });

      createAndSaveNotification({ type: 'changeTitle', userId, chatId, oldTitle, newTitle }, socket);

      io.to(`${chatId}`).emit('changeTitle', { status: true, newTitle });

      const allChatsUpdated = await Chat.find({});

      io.sockets.emit('chatList', allChatsUpdated);
    } else {
      socket.emit('changeTitle', { status: false });
    }
  });

  socket.on('deleteParticipant', async({ chatId, userId }) =>  {
    await Chat.findOneAndUpdate({ _id: chatId }, {$pull: { participants: { userId: ObjectId(userId) } }});

    io.to(`${chatId}`).emit('deleteParticipant', { status: true, deletedParticipantId: userId });

    createAndSaveNotification({ type: 'delete', userId, chatId }, socket);
  });

  socket.on('deleteChat', async(chatId) => {    
    await Chat.findOneAndDelete({ _id: chatId });

    io.to(`${chatId}`).emit('deleteChat', { status: true });

    const allChatsUpdated = await Chat.find({});

    io.sockets.emit('chatList', allChatsUpdated);
  });
});

async function createAndSaveNotification({ type, userId, chatId, oldTitle, newTitle }, socket) {
  const user = await User.findOne({ _id: userId });
  const modifyUser = {
    userId: user._id,
    userColour: user.colour,
    userName: user.name
  }
  let eventMessage;
  switch(type) {
    case 'join':
      eventMessage = 'joined';
      break;
    case 'leave':
      eventMessage = 'left';
      break;
    case 'delete':
      eventMessage = 'deleted';
      break;
    case 'changeTitle':
      eventMessage = 'changed';
      break;
    default:
      eventMessage = '';
  }
  let notificationMessage = `User ${modifyUser.userName} has ${eventMessage} a chat`;

  if (type === 'delete') {
    notificationMessage = `User ${modifyUser.userName} was ${eventMessage} 
      from chat by chat creator`;
  }

  if (type === 'changeTitle') {
    notificationMessage = `Chat title was ${eventMessage} from "${oldTitle}" to "${newTitle}" 
      by user ${modifyUser.userName}`;
  }

  const notificationBody = {
    chatId,
    user: modifyUser,
    content: notificationMessage,
    type
  };
  const notification = new Message(notificationBody);

  notification.save(); 
  
  const newMessage = { ...notificationBody, createdAt: new Date() };

  socket.to(`${chatId}`).emit('chat', { message: newMessage});
};
