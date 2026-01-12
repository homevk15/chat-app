const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Moderator = require("./models/moderator");  // Adjust path as necessary

mongoose.connect("mongodb://localhost:27017/chatapp", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const createModerator = async (username, password) => {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newModerator = new Moderator({
      username,
      password: hashedPassword, // Store the hashed password
    });

    await newModerator.save();
    console.log("Moderator created successfully!");
  } catch (err) {
    console.error("Error creating moderator:", err);
  } finally {
    mongoose.connection.close();
  }
};

// Call this to create the moderator (adjust the username and password)
createModerator("moderator", "moderatorSecret");
