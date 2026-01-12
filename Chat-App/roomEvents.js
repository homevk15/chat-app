const mongoose = require('mongoose');
const bcrypt = require('bcrypt'); // Import bcrypt

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
  password: {
    type: String,
    required: true,
  },
});

const Room = mongoose.model('Room', RoomSchema);

// Create room function
async function createRoom(roomName, password) {
  try {
    console.log('Creating room:', roomName, 'with password:', password); // Debugging log
    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10); // 10 is the salt rounds
    const room = new Room({ name: roomName, password: hashedPassword });
    await room.save();
    console.log(`Room '${roomName}' created with hashed password.`);
  } catch (err) {
    console.error('Error creating room:', err);
  } finally {
    mongoose.connection.close();
  }
}

// Get room name and password from command line arguments
const roomNumber = process.argv[2];
const password = process.argv[3]; // Get password from the command-line argument

// Add log for debugging
console.log('Room name from argv:', roomNumber);
console.log('Password from argv:', password);

if (!roomNumber || !password) {
  console.error('Please provide both a room number and a password.');
  process.exit(1);
}

// Call the createRoom function
createRoom(roomNumber, password);
