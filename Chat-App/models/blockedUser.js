const mongoose = require("mongoose");

const blockedUserSchema = new mongoose.Schema({
  room: String,
  users: [String],
});

module.exports = mongoose.model("BlockedUser", blockedUserSchema);
