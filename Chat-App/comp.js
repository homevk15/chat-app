const bcrypt = require("bcrypt");

const storedHash = "$2b$10"; // The hash from your database
const inputPassword = ""; // The password you're trying to check

bcrypt.compare(inputPassword, storedHash, (err, result) => {
  if (err) {
    console.error("Error comparing passwords:", err);
  } else {
    console.log("Do passwords match?", result); // Should print true if they match
  }
});
