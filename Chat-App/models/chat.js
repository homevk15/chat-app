const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
  },
  username: {
    type: String, // the sender's username
    required: true,
  },
  room: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
    maxLength: [500, "Message is too long"],
  },
  replyToMessageId: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },

  // New private message fields
  private: {
    type: Boolean,
    default: false,
  },
  participants: {
    type: [String],
    validate: {
      validator: function (arr) {
        // Only enforce length === 2 if private is true
        return !this.private || (Array.isArray(arr) && arr.length === 2);
      },
      message: "Private messages must have exactly two participants",
    },
    default: undefined,
  },
});


const Chat = mongoose.model("Chat", chatSchema);
module.exports = Chat;
