const Message = require('../models/message.model');

exports.getAllMessages = async (req, res, next) => {
  const messages = await Message.find();

  try {
    res.status(200).json({
    messages
  })
  } catch (err){
    res.status(404).json({
      status: 'fail',
      message: err
    });
  }
};
