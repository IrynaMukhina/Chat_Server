const Chat = require('../models/chat.model');

exports.getAllChats = async (req, res, next) => {
  const chates = await Chat.find();

  try {
    res.status(200).json({
    chates
  })
  } catch (err){
    res.status(404).json({
      status: 'fail',
      message: err
    });
  }
};
