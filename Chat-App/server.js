const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const mongoose = require("mongoose");
const formatMessage = require("./utils/messages");
const Chat = require("./models/chat"); // Ensure this path is correct
const Room = require("./models/room");
const bcrypt = require("bcrypt");

const {
  userJoin,
  getCurrentUser,
  userLeaves,
  getRoomUsers,
  getUserByUsername,
} = require("./utils/users");

const app = express();
const server = http.createServer(app);
//const io = socketIO(server);

const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const PORT = process.env.PORT || 3001;
const botName = "FreeChat Bot";

// Middleware for serving static files
app.use(express.static("public"));

// Connect to MongoDB
mongoose
  .connect("mongodb://localhost:27017/chatapp", { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

// Define the BlockedUser Mongoose model
const BlockedUserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
});

const BlockedUser = mongoose.model("BlockedUser", BlockedUserSchema);

// List to keep track of active users in each room
const activeUsers = {};

// Function to emit the blocked users list to all connected clients
async function emitBlockedUsers() {
  const blockedUsers = await BlockedUser.find().distinct('username');
  io.emit("blockedUsersList", blockedUsers);
}

const privateMessagesMap = new Map();
// Listen for incoming connections
io.on("connection", (socket) => {
  console.log("New websocket connection");

  // Emit the blocked users list to all clients when they connect
  emitBlockedUsers();

  // When a user joins a room


// When a user joins a room

// Import the Room model


// When a user joins a room
socket.on("joinRoom", async ({ username, room, password }) => {
  const userBlocked = await BlockedUser.findOne({ username });
  if (userBlocked) {
    socket.emit("blockedUser", { message: "You are blocked from this chat." });
    socket.disconnect();
    return; // Exit the function
  }
  try {
    // Check if the user is a moderator
    const roomData = await Room.findOne({ name: room });
    if (!roomData) {
      socket.emit("message", formatMessage(botName, "Room not found."));
      socket.disconnect();
      return;
    }

    let isMatch;
    if (username === 'moderator') {
      isMatch = await bcrypt.compare(password, roomData.moderatorPassword);
    } else {
      isMatch = await bcrypt.compare(password, roomData.userPassword);
    }

    if (!isMatch) {
      socket.emit("message", formatMessage(botName, "Incorrect password."));
      socket.disconnect();
      return;
    }

    // Proceed with the rest of the join logic if the password matches
    const user = userJoin(socket.id, username, room);
    socket.username = username;
    socket.join(user.room);

    // Track active users
    if (!activeUsers[user.room]) {
      activeUsers[user.room] = new Set();
    }
    activeUsers[user.room].add(username);

    // Welcome current user
    socket.emit("message", formatMessage(botName, "Welcome to FreeChat!"));

    // Broadcast when a user connects
    socket.broadcast.to(user.room).emit("message", formatMessage(botName, `${user.username} has joined the chat!`));

    // Send chat history with reply enrichment
    const messages = await Chat.find({
  room: user.room,
  $or: [
    { private: { $exists: false } },
    { private: false }
  ]
}).lean();


    // Map messages by their _id for quick lookup
    const messageMap = new Map();
    messages.forEach(msg => messageMap.set(msg._id.toString(), msg));

    // Enrich messages with replyingTo data
    const enrichedMessages = messages.map(msg => {
      let replyingTo = null;
      if (msg.replyToMessageId) {
        const repliedMsg = messageMap.get(msg.replyToMessageId.toString());
        if (repliedMsg) {
          replyingTo = {
            id: repliedMsg._id.toString(),
            username: repliedMsg.username,
            text: repliedMsg.message,
            time: repliedMsg.createdAt,
          };
        }
      }
      return {
        id: msg._id.toString(),
        username: msg.username,
        text: msg.message,
        room: msg.room,
        time: msg.createdAt,
        replyingTo,
      };
    });

    socket.emit("chatHistory", enrichedMessages);

    io.to(user.room).emit("roomUsers", {
      room: user.room,
      users: getRoomUsers(user.room),
    });

  } catch (error) {
    console.error("Error during user authentication:", error);
    socket.disconnect();
  }
});


  // Receive chat message
socket.on("chatMessage", async (message) => {
  const currentUser = getCurrentUser(socket.id);
  const sanitizedMessage = message?.text?.trim();

  if (!currentUser || !sanitizedMessage) return;

  try {
    // Check if user is blocked
    const blockedUser = await BlockedUser.findOne({ username: currentUser.username });
    if (blockedUser) {
      socket.emit("message", formatMessage(botName, "You are currently blocked from posting messages."));
      return;
    }

    const isPrivate = message.private === true;
    const participants = isPrivate && Array.isArray(message.participants) ? message.participants : null;

    if (isPrivate) {
      if (!participants || participants.length !== 2 || !participants.includes(currentUser.username)) {
        socket.emit("message", formatMessage(botName, "Invalid private message format."));
        return;
      }
    }

    // Create and store the message
    const chatMessage = new Chat({
      id: socket.id,
      username: currentUser.username,
      room: currentUser.room,
      message: sanitizedMessage,
      replyToMessageId: message.replyingTo || null,
      private: isPrivate,
      participants: isPrivate ? participants : undefined,
    });

    await chatMessage.save();

    // Prepare reply quote
    let replyData = null;
    if (chatMessage.replyToMessageId) {
      const repliedMessage = await Chat.findById(chatMessage.replyToMessageId).lean();
      if (repliedMessage) {
        replyData = {
          id: repliedMessage._id,
          username: repliedMessage.username,
          text: repliedMessage.message,
          time: new Date(repliedMessage.createdAt).toLocaleString(undefined, {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
        };
      }
    }

    const finalMessage = {
      id: chatMessage._id,
      username: currentUser.username,
      text: chatMessage.message,
      room: currentUser.room,
      time: new Date(chatMessage.createdAt).toLocaleString(undefined, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      replyingTo: replyData,
      private: isPrivate,
      participants: participants,
    };

    if (isPrivate) {
      const recipientUsername = participants.find(name => name !== currentUser.username);
      const recipientUser = getUserByUsername(recipientUsername); // ← You must define this function

console.log("Recipient user:", recipientUser);
console.log("finalMessage:", finalMessage);

      if (recipientUser) {
        io.to(socket.id).emit("privateMessage", finalMessage);
        io.to(recipientUser.id).emit("privateMessage", finalMessage);
      } else {
        socket.emit("message", formatMessage(botName, "Recipient is not online."));
      }
    } else {
      const blockedUsers = await BlockedUser.find().distinct("username");
      if (!blockedUsers.includes(currentUser.username)) {
        io.to(currentUser.room).emit("message", finalMessage);
      }
    }

  } catch (err) {
    console.error("Error saving or broadcasting message:", err);
  }
});

// Handle deleting a message

socket.on('loadPrivateChatHistory', async ({ participants }) => {
  try {
    if (!Array.isArray(participants) || participants.length !== 2) return;

    // Always sort for consistent querying
    const sorted = [...participants].sort();

    const messages = await Chat.find({
      private: true,
      participants: sorted,
    }).sort({ createdAt: 1 }); // oldest first

    socket.emit('privateChatHistory', {
      participants: sorted,
      messages,
    });
  } catch (err) {
    console.error('Error loading private chat history:', err);
  }
});

socket.on("private_message_delete", async ({ message_id }, callback) => {
  try {
    // Validate messageId if you want:
    if (!mongoose.Types.ObjectId.isValid(message_id)) {
      return callback({ error: "Invalid message ID" });
    }

    const message = await Chat.findById(message_id);
    if (!message) {
      return callback({ error: "Message not found." });
    }

    // Authorization check
    if (message.username !== socket.username) {
      return callback({ error: "Not authorized to delete this message." });
    }

    const participants = message.participants || [];

    await Chat.findByIdAndDelete(message_id);

    console.log(`Private message with ID ${message._id} deleted successfully.`);

    // Notify all participants
    participants.forEach(username => {
      const userSocket = getSocketByUsername(username);
      if (userSocket) {
        userSocket.emit("privateMessageDeleted", {
          id: message._id.toString(),
          deleted: true,
        });
      }
    });

    callback({ success: true });
  } catch (err) {
    console.error("Error deleting private message:", err);
    callback({ error: "Failed to delete private message." });
  }
});


socket.on('editPrivateMessage', async ({ messageId, newText, participants }, callback) => {
  try {
    // Validate messageId
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return callback({ error: 'Invalid message ID' });
    }

    // Find the message in the DB
    const message = await Chat.findById(messageId);
    if (!message) {
      return callback({ error: 'Message not found' });
    }

    // Authorization check
    if (message.username !== socket.username) {
      return callback({ error: 'Not authorized to edit this message' });
    }

    // Update fields
    message.message = newText; //Make sure to use `message.message`, not `message.text`
    message.editedAt = new Date();
    await message.save();

    // Construct updated message payload
    const updatedMessage = {
      id: message._id.toString(),
      username: message.username,
      text: message.message,
      room: message.room,
      time: new Date(message.createdAt).toLocaleString(undefined, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      private: message.private,
      participants: message.participants,
      editedAt: message.editedAt
    };

    // Notify both sender and recipient
    participants.forEach(username => {
      const userSocket = getSocketByUsername(username);
      if (userSocket) {
        userSocket.emit('privateMessageUpdated', updatedMessage);
      }
    });

    callback({ success: true });
  } catch (err) {
    console.error('Error editing private message:', err);
    callback({ error: 'Internal server error' });
  }
});

socket.on('updatePrivateMessage', ({ to, updatedMessage }) => {
  // Broadcast the updated message to the recipient and sender
  io.to(to).emit('privateMessageUpdated', updatedMessage);
  socket.emit('privateMessageUpdated', updatedMessage);
});

// Handle editing a message
  socket.on("message_edit", ({ message_id, message_data }, callback) => {
    const sanitizedData = message_data.trim();

    if (sanitizedData.length > 200) {
      return callback({ error: "Message exceeds 200 characters limit." });
    }

    Chat.findByIdAndUpdate(
      message_id,
      { message: sanitizedData },
      { new: true },
    ).then((updatedMessage) => {
      if (!updatedMessage) {
        return callback({ error: "Message not found." });
      }
      // Emit the edited message to the room
      io.to(updatedMessage.room).emit("editedMessage", {
        id: updatedMessage._id,
        username: updatedMessage.username,
        text: updatedMessage.message,
        room: updatedMessage.room,
        time: new Date(updatedMessage.createdAt).toLocaleString(),
      });
      callback({ success: true, message: updatedMessage });
    }).catch(err => {
      console.error("Error editing message:", err);
      callback({ error: "Failed to edit message." });
    });
  });

// Handle deleting a message
// Handle deleting a message
socket.on("message_delete", ({ message_id }, callback) => {
    Chat.findByIdAndDelete(message_id)
        .then((deletedMessage) => {
            if (!deletedMessage) {
                return callback({ error: "Message not found." });
            }
            // Log success message after deletion
            console.log(`Message with ID ${deletedMessage._id} deleted successfully.`);

            // Notify the room about the deleted message
            io.to(deletedMessage.room).emit("deletedMessage", {
                id: deletedMessage._id,
                deleted: true, // Mark this message as deleted
            });
            callback({ success: true });
        })
        .catch(err => {
            console.error("Error deleting message:", err);
            callback({ error: "Failed to delete message." });
        });
});

  // Block user event
  socket.on("blacklistthisuser", async (blockedUsername) => {
    const user = getCurrentUser(socket.id); // Get the current user details
    if (user.username === 'moderator') {
      try {
        const blockedUser = await BlockedUser.findOne({ username: blockedUsername });
        if (!blockedUser) {
          // Create a new blocked user entry
          await BlockedUser.create({ username: blockedUsername });

          // Notify all users in the room
          io.to(user.room).emit("message", formatMessage(botName, `${blockedUsername} has been blocked.`));
          io.to(user.room).emit("userBlocked", blockedUsername);

          // Remove the blocked user from active users if they are in the room
          if (activeUsers[user.room].has(blockedUsername)) {
            const blockedUserSocketId = Array.from(io.sockets.sockets)
              .find(([_, s]) => s.username === blockedUsername)?.[0]; // Get the socket ID of the blocked user
            if (blockedUserSocketId) {
              const blockedSocket = io.sockets.sockets.get(blockedUserSocketId);
              if (blockedSocket) {
                blockedSocket.disconnect(); // Disconnect the blocked user
              }
            }
            activeUsers[user.room].delete(blockedUsername); // Remove from active users
          }

          // Emit the updated list of blocked users
          const blockedUsers = await BlockedUser.find().distinct('username');
          io.to(user.room).emit("blockedUsersList", blockedUsers);

          // Update the user list, filtering out all blocked users
          const users = getRoomUsers(user.room); // Fetch the updated list of users
          const updatedUsers = users.filter(u => !blockedUsers.includes(u.username)); // Filter out all blocked users
          io.to(user.room).emit("roomUsers", {
            room: user.room,
            users: updatedUsers
          });
        } else {
          socket.emit("message", formatMessage(botName, `${blockedUsername} is already blocked.`));
        }
      } catch (err) {
        console.error("Error blocking user:", err);
      }
    }
  });


  // Block user event
  socket.on("blockthisuser", async (blockedUsername) => {
    const user = getCurrentUser(socket.id); // Get the current user details
    if (user.username === 'moderator') {
      try {
        const blockedUser = await BlockedUser.findOne({ username: blockedUsername });
        if (!blockedUser) {
          // Create a new blocked user entry
          await BlockedUser.create({ username: blockedUsername });

          // Notify all users in the room
          io.to(user.room).emit("message", formatMessage(botName, `${blockedUsername} has been blocked.`));
          io.to(user.room).emit("userBlocked", blockedUsername);

          // Remove the blocked user from active users if they are in the room
          if (activeUsers[user.room].has(blockedUsername)) {
            activeUsers[user.room].delete(blockedUsername);
          }

          // Emit the updated list of blocked users
          const blockedUsers = await BlockedUser.find().distinct('username');
          io.to(user.room).emit("blockedUsersList", blockedUsers);

          // Update the user list, filtering out all blocked users
          const users = getUsersInRoom(user.room); // Fetch the updated list of users
          const updatedUsers = users.filter(u => !blockedUsers.includes(u.username)); // Filter out all blocked users
          io.to(user.room).emit("roomUsers", {
            room: user.room,
            users: updatedUsers
          });
        } else {
          socket.emit("message", formatMessage(botName, `${blockedUsername} is already blocked.`));
        }
      } catch (err) {
        console.error("Error blocking user:", err);
      }
    }
  });


  // Unblock user event
socket.on('unblockUser', async (unblockedUsername) => {
  const user = getCurrentUser(socket.id);
  
  // Check if user is defined and is a moderator
  if (user && user.username === 'moderator') {
    try {
      // Remove the user from the blocked users collection
      const result = await BlockedUser.findOneAndDelete({ username: unblockedUsername });
      if (result) {
        // Notify the room about the unblocking
        io.to(user.room).emit("message", formatMessage(botName, `${unblockedUsername} has been unblocked.`));
        socket.emit("userUnblocked", unblockedUsername);

        // Check if the unblocked user is currently in the active users set
        if (activeUsers[user.room].has(unblockedUsername)) {
          io.to(user.room).emit("message", formatMessage(botName, `${unblockedUsername} can now post messages.`));
        } else {
          // Notify that they can join to start posting messages
          io.to(user.room).emit("message", formatMessage(botName, `${unblockedUsername} has been unblocked. They can join the room to start posting messages.`));
        }

        // Emit the updated list of blocked users
        const blockedUsers = await BlockedUser.find().distinct('username');
        io.to(user.room).emit("blockedUsersList", blockedUsers);

        // Emit the updated list of users
        const updatedUsers = getUsersInRoom(user.room);
        io.to(user.room).emit("roomUsers", {
          room: user.room,
          users: updatedUsers,
        });
      } else {
        socket.emit("message", formatMessage(botName, `${unblockedUsername} was not found in the blocked users.`));
      }
    } catch (err) {
      console.error("Error unblocking user:", err);
    }
  } else {
    // Handle case where user is not a moderator or not found
    if (!user) {
      socket.emit("message", formatMessage(botName, "You are not currently connected to any chat room."));
    } else {
      socket.emit("message", formatMessage(botName, "You do not have permission to unblock users."));
    }
  }
});

  // When a user disconnects
  socket.on("disconnect", () => {
    const user = userLeaves(socket.id);
    if (user) {
      activeUsers[user.room].delete(user.username);
      io.to(user.room).emit("message", formatMessage(botName, `${user.username} has left the chat.`));
      io.to(user.room).emit("roomUsers", {
        room: user.room,
        users: getRoomUsers(user.room),
      });
    }
  });
});

// Function to get users in a room
function getUsersInRoom(room) {
  return Array.from(io.sockets.adapter.rooms.get(room) || []).map(socketId => {
    return getCurrentUser(socketId); // Assume you have a function to get user by socket ID
  });
}

// Helper to get a socket instance by username
function getSocketByUsername(username) {
  const user = getUserByUsername(username);
  if (user && user.id) {
    return io.sockets.sockets.get(user.id);
  }
  return null;
}


// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
