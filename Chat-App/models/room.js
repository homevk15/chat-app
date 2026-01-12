const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  moderatorPassword: {
    type: String,
    required: true,
  },
  userPassword: {
    type: String,
    required: true,
  },
});

const Room = mongoose.model('Room', RoomSchema);
module.exports = Room;
