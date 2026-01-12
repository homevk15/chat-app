const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Connect to MongoDB
mongoose
  .connect('mongodb://localhost:27017/chatapp', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define Room Mongoose Schema
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

// Create room function
async function createRoom(roomName, moderatorPassword, userPassword) {
  try {
    // Hash both passwords before saving
    const hashedModeratorPassword = await bcrypt.hash(moderatorPassword, 10);
    const hashedUserPassword = await bcrypt.hash(userPassword, 10);
    
    const room = new Room({
      name: roomName,
      moderatorPassword: hashedModeratorPassword,
      userPassword: hashedUserPassword,
    });
    
    await room.save();
    console.log(`Room '${roomName}' created with hashed passwords.`);
  } catch (err) {
    console.error('Error creating room:', err);
  } finally {
    mongoose.connection.close();
  }
}

// Get room name and passwords from command line arguments
const roomName = process.argv[2];
const moderatorPassword = process.argv[3];
const userPassword = process.argv[4];

if (!roomName || !moderatorPassword || !userPassword) {
  console.error('Please provide a room name, moderator password, and user password.');
  process.exit(1);
}

// Call the createRoom function
createRoom(roomName, moderatorPassword, userPassword);
