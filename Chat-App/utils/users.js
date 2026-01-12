const users = [];

// User joins a chat
function userJoin(id, username, room) {
  const user = { id, username, room };
  users.push(user);
  return user;
}

// Get current user
function getCurrentUser(id) {
  return users.find((user) => user.id === id);
}

// User leaves the chat
function userLeaves(id) {
  const index = users.findIndex((user) => user.id === id);
  if (index !== -1) {
    return users.splice(index, 1)[0]; // Remove user and return it
  }
}

// Get users in a room
function getRoomUsers(room) {
  return users.filter((user) => user.room === room);
}

function getUserByUsername(username) {
  return users.find(user => user.username === username);
}

module.exports = { userJoin, getCurrentUser, userLeaves, getRoomUsers, getUserByUsername };
