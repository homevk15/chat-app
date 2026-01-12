//const socket = io();
const socket = io('https://yourwebsite.com', {
  path: '/socket.io'
});
const chatMessages = document.querySelector(".chat-messages");
const chatForm = document.getElementById("chat-form");
const roomName = document.getElementById("room-name");
const userList = document.getElementById("users");
const blockedUsersList = document.getElementById("blocked-users");
const input = document.getElementById("msg");
const botName = "FreeChat Bot";

let currentEditId = null; 
const blockedUsers = new Set(); 
const messagesMap = new Map(); // Map to keep track of message IDs and their current text
const currentUsers = new Set(); // Set to track currently active users

let openedPrivateChats = new Set();



const username = "tester1"; 
const room = "myroom";
const password = "guest123";
console.log("Logged in as:", username);

//const password = "moderatorSecret";
// Join chatroom
socket.emit("joinRoom", { username, room, password });

// Load blocked users from the database on page load
socket.emit('getBlockedUsers', username);

// Get room and users
socket.on("roomUsers", ({ room, users }) => {
  outputRoomName(room);
  outputUsers(users);

  // Update the set of current users
  currentUsers.clear();
  users.forEach(user => currentUsers.add(user.username));
});




// Message from server
socket.on("message", (message) => {
	console.log("Any message received", message); // ← ADD THIS

  // Public message
  if (blockedUsers.has(message.username)) return;
  if (message.private) return;

  messagesMap.set(message.id || message._id, message);
  outputMessage2(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

function openPrivateChatTab2(username) {
  // Example basic implementation, customize based on your UI
  const chatTabs = document.getElementById("private-chat-tabs");
  const existingTab = document.getElementById(`tab-${username}`);

  if (!existingTab) {
    const tab = document.createElement("div");
    tab.id = `tab-${username}`;
    tab.className = "private-chat-tab";
    tab.innerHTML = `<h5>Private chat with ${username}</h5><div class="chat-messages" id="private-${username}"></div>`;
    chatTabs.appendChild(tab);
  }
}


socket.on("blockedUser", ({ message }) => {
  alert(message); // Notify the user they are blocked
});

function parseUSDateTime(usDateTimeStr) {
  // Example input: "7/25/2025, 11:30:48 AM"
  // Split date and time parts
  const [datePart, timePart, meridian] = usDateTimeStr.match(/(\d+\/\d+\/\d+), (\d+:\d+:\d+) (AM|PM)/i).slice(1);

  let [month, day, year] = datePart.split('/').map(Number);
  let [hours, minutes, seconds] = timePart.split(':').map(Number);

  // Convert to 24h format
  if (meridian.toUpperCase() === 'PM' && hours !== 12) {
    hours += 12;
  } else if (meridian.toUpperCase() === 'AM' && hours === 12) {
    hours = 0;
  }

  return new Date(year, month -1, day, hours, minutes, seconds);
}
// Modify the outputMessage function to append bot messages at the bottom
function outputMessage(message) {
  const div = document.createElement('div');
  div.classList.add('message');
  div.dataset.id = message.id;

  const isBotMessage = message.username === botName;

  let quoteHTML = '';
  const r = message.replyingTo;
  
  // Check if the message has a valid reply reference
  if (r && typeof r === 'object' && r.username && r.text && r.time) {
    const quoteTime = new Date(r.time).toLocaleDateString('en-GB') + ', ' +
      new Date(r.time).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

    quoteHTML = `
      <div class="quoted-message">
        <div class="quote-meta">
          <strong>@${escapeHtml(r.username)}</strong>
          <small>${quoteTime}</small>
        </div>
        <div class="quote-text">${escapeHtml(r.text)}</div>
      </div>
    `;
  }

  const messageTime = new Date(message.time).toLocaleDateString('en-GB') + ', ' +
    new Date(message.time).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

  div.innerHTML = `
    <p class="meta">${escapeHtml(message.username)}
      <span>${messageTime}</span>
    </p>
    ${quoteHTML}
    <p class="text">${escapeHtml(message.text)}</p>
    ${!isBotMessage ? `
      <div class="message-buttons">
        <button class="btn-reply">Reply</button>
        <button class="btn-edit">Edit</button>
        <button class="btn-delete">Delete</button>
      </div>
    ` : ''}
  `;

  document.querySelector('.chat-messages').appendChild(div);
}




function replyToMessage(messageId) {
  const message = messagesMap.get(messageId);
  if (!message) return;

  const username = message.username;
  const time = new Date(message.time || message.createdAt).toLocaleString();
  
  const text = message.text || message.message;

  const replyPreview = document.getElementById('reply-preview');
  const input = document.getElementById('msg');

  replyPreview.innerHTML = `
    <div class="reply-box" data-replying-to="${messageId}">
      <strong>@${escapeHtml(username)}</strong> <small>${escapeHtml(time)}</small>
      <div class="reply-text">${escapeHtml(text)}</div>
      <button onclick="cancelReply()" class="btn btn-sm btn-outline-secondary">Cancel</button>
    </div>
  `;
  replyPreview.style.display = 'block';
  input.focus();
}



function cancelReply() {
  document.getElementById('reply-preview').style.display = 'none';
  document.getElementById('reply-preview').innerHTML = '';
}


// Load chat history
// Load chat history
socket.on("chatHistory", (chatHistory) => {
  messagesMap.clear(); // clear old messages

  // Filter out private messages first
  const publicMessages = chatHistory.filter(msg => !msg.private);

  // Update messagesMap only with public messages
  publicMessages.forEach(msg => messagesMap.set(msg.id || msg._id, msg));

  // Display only public messages
  publicMessages.forEach((message) => {
    let replyingTo = null;
    if (message.replyingTo) {
      replyingTo = {
        username: message.replyingTo.username,
        time: new Date(message.replyingTo.time).toLocaleString(),
        text: message.replyingTo.text
      };
    }
    outputMessage2({
      id: message.id || message._id,
      username: message.username,
      text: message.text || message.message,
      room: message.room,
      time: message.time || message.createdAt,
      replyingTo: replyingTo
    });
  });
});


function formatDate(dateString) {
  const date = new Date(dateString);
  if (isNaN(date)) return "Invalid Date";

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function outputMessage2(message) {
  const messageDate = new Date(message.time);

  const formattedTime = !isNaN(messageDate)
    ? `${messageDate.getDate().toString().padStart(2, '0')}/${
        (messageDate.getMonth() + 1).toString().padStart(2, '0')
      }/${messageDate.getFullYear()} ${
        messageDate.getHours().toString().padStart(2, '0')
      }:${messageDate.getMinutes().toString().padStart(2, '0')}`
    : "Invalid Date";

  const safeTextForJs = escapeJsString(message.text || "");
  const safeTextForHtml = escapeHtml(message.text || "");

  const replyingTo = message.replyingTo;
  const replyingToTime = formatDate(replyingTo?.time);
  
  const quoteHTML = replyingTo && replyingTo.username && replyingTo.text ? `
  <div class="quoted-message" data-replying-to-id="${message.replyingTo.id || message.replyingTo._id}">
    <div class="quoted-message">
      <div class="quote-meta">
        <strong>@${escapeHtml(replyingTo.username)}</strong>
        <small>${replyingToTime}</small>
      </div>
      <div class="quote-text">${escapeHtml(replyingTo.text)}</div>
    </div>
  </div>
  ` : '';

const escapedText = JSON.stringify(message.text); // Escapes quotes, newlines, etc.

const escapedMessage = JSON.stringify(message).replace(/"/g, '&quot;');

const messageHTML = `
  <div class="message" 
       data-id="${message.id}" 
       data-username="${escapeHtml(message.username)}"
       data-text="${escapeHtml(message.text)}"
       data-time="${escapeHtml(formattedTime)}">
    <p class="meta">${escapeHtml(message.username)} <span>${formattedTime}</span></p>
    ${quoteHTML}
    <p class="text">${safeTextForHtml}</p>
    <button class="reply-btn" onclick="replyToMessage('${message.id}')">Reply</button>
    ${(message.username === username || username === 'moderator') ? `
      <button class="edit-btn" onclick="editMessageById('${message.id}')">Edit</button>

      <button class="delete-btn" onclick="deleteMessage('${message.id}')">Delete</button>
    ` : ''}
  </div>
`;




  const chatMessages = document.querySelector(".chat-messages");
  chatMessages.insertAdjacentHTML('beforeend', messageHTML);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}








// Handle receiving blocked users from the server
socket.on('blockedUsersList', (blockedUsernames) => {
 blockedUsers.clear(); // Clear existing blocked users
  blockedUsernames.forEach((blockedUsername) => blockedUsers.add(blockedUsername));
  updateBlockedUsersList(); 
});

// Handle unblocked user broadcast from server
socket.on("userUnblockedBroadcast", (unblockedUsername) => {
  blockedUsers.delete(unblockedUsername); // Remove from blocked list
  socket.emit("getActiveUsers"); // Get fresh list of active users from server
});

// Function to update the blocked users list in the DOM
function updateBlockedUsersList() {
  blockedUsersList.innerHTML = ""; 
  blockedUsers.forEach((blockedUsername) => {
    const li = document.createElement("li");
    li.innerText = escapeHtml(blockedUsername);

    // Only show the Unblock button for the moderator
    if (username === 'moderator') {
      const unblockButton = document.createElement("button");
      unblockButton.innerText = "Unblock"; 
      unblockButton.onclick = () => unblockUser(blockedUsername); 
      li.appendChild(unblockButton); 
    }

    blockedUsersList.appendChild(li);
  });

  updateInputState(); // Update input field state based on blocked status
}

// Handle user blocking
socket.on("userBlocked", (blockedUsername) => {
  blockedUsers.add(blockedUsername); 
  updateBlockedUsersList(); 
});

// Message submit
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();

  if (blockedUsers.has(username)) {
    alert("You are blocked from sending messages.");
    return;
  }

  const message = e.target.elements.msg.value.trim();
  if (!message) return alert("Message cannot be empty.");

  const replyBox = document.querySelector('.reply-box');
  const replyingToId = replyBox ? replyBox.getAttribute('data-replying-to') : null;

  if (currentEditId) {
    socket.emit("message_edit", {
      message_id: currentEditId,
      message_data: message
    }, (response) => {
      if (response.error) {
        alert(response.error);
      } else {
        singleMessageUpdate({ id: currentEditId, message: message });
      }
    });
    currentEditId = null;
  } else {
    socket.emit("chatMessage", {
      text: message,
      replyingTo: replyingToId
    });
  }

  cancelReply(); // hide reply box after sending
  e.target.elements.msg.value = "";
  e.target.elements.msg.focus();
});


// Block user function
function blockUser(blockedUsername) {
  if (confirm(`Are you sure you want to block ${blockedUsername}?`)) {
    socket.emit("blockthisuser", blockedUsername); 
    blockedUsers.add(blockedUsername); 
    updateBlockedUsersList(); 
  }
}

// Unblock user function
// Handle user unblocking
function unblockUser(unblockedUsername) {
  if (confirm(`Are you sure you want to unblock ${unblockedUsername}?`)) {
    socket.emit("unblockUser", unblockedUsername); // Unblock the user

    // After unblocking, check with the server if the user is still in the room
    socket.emit("getActiveUsers", (activeUsers) => {
      blockedUsers.delete(unblockedUsername); // Remove the user from the blocked set
      updateBlockedUsersList(); // Update the blocked users list in the DOM

      // If the unblocked user is still an active user, update the user list
      if (activeUsers.includes(unblockedUsername)) {
        outputUsers(activeUsers); // Re-render the user list with active users
      } else {
        console.log(`${unblockedUsername} has already left the room, not adding to the user list.`);
      }
    });
  }
}

// Handle receiving the active user list from the server
socket.on("activeUsersList", (activeUsers) => {
  outputUsers(activeUsers); // Update user list with currently active users
});

socket.on("deletedMessage", (data) => {
  deleteMessageUpdate({ id: data.id});
});

// Function to update the message display on edit



// Edit message
function editMessage2(messageId, messageText) {
  currentEditId = messageId;
  document.getElementById("msg").value = messagesMap.get(messageId) || messageText; // Use the latest message text
}

socket.on("editedMessage", (message) => {
  singleMessageUpdate({ id: message.id, message: message.text });
});


// Function to update the message display on edit
function singleMessageUpdate({ id, message, time }) {
  const messageElement = document.querySelector(`.message[data-id="${id}"]`);
  if (messageElement) {
    messageElement.querySelector(".text").innerHTML = escapeHtml(message);
    const metaSpan = messageElement.querySelector(".meta span");
    if (metaSpan && !metaSpan.innerText.includes("(edited)")) {
      metaSpan.innerText += " (edited)";
    }
    // Update messagesMap
    if (messagesMap.has(id)) {
      const msgObj = messagesMap.get(id);
      msgObj.text = message;
      if (time) msgObj.time = time; // Update time if available
      msgObj.edited = true; // mark edited
      messagesMap.set(id, msgObj);
    }

    // Update all quoted messages referencing this message id
    const quotedMessages = document.querySelectorAll(`.quoted-message[data-replying-to-id="${id}"]`);
    quotedMessages.forEach(quotedDiv => {
      const latestMsg = messagesMap.get(id);
      if (!latestMsg) return;

      const quoteMeta = quotedDiv.querySelector('.quote-meta strong');
      const quoteTime = quotedDiv.querySelector('.quote-meta small');
      const quoteText = quotedDiv.querySelector('.quote-text');

      if (quoteMeta) quoteMeta.textContent = '@' + latestMsg.username;
      if (quoteTime) {
        const formattedTime = new Date(latestMsg.time).toLocaleDateString('en-GB') + ', ' +
          new Date(latestMsg.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
        quoteTime.textContent = formattedTime;
      }
      if (quoteText) quoteText.textContent = latestMsg.text + (latestMsg.edited ? " (edited)" : "");
    });
  }
}


function deleteMessageUpdate({ id }) {
  const messageElement = document.querySelector(`.message[data-id="${id}"]`);
  if (messageElement) {
    messageElement.remove();
  }
  messagesMap.delete(id);
}


// Listen for the edited message event from the server
function editMessage(messageObj) {
  currentEditId = messageObj.id;
  document.getElementById("msg").value = messageObj.text;
}

function editMessageById(messageId) {
  const message = messagesMap.get(messageId);
  if (!message) return;

  currentEditId = messageId;
  document.getElementById("msg").value = message.text;
}


// Delete message
function deleteMessage(messageId) {
  if (confirm("Are you sure you want to delete this message?")) {
    socket.emit("message_delete", { message_id: messageId }, (response) => {
      if (response.error) {
        alert(response.error);
      }
    });
  }
}

// Output room name to DOM
function outputRoomName(room) {
  roomName.innerText = room;
}

// Output users to DOM
// Output room users to the DOM, skipping blocked users
// Output users to DOM with Block and Blacklist buttons for the moderator
function outputUsers(users) {
  userList.innerHTML = "";

  users.forEach((user) => {
    if (blockedUsers.has(user.username)) {
      return; // Skip blocked users
    }

    const li = document.createElement("li");
    li.className = "user-link"; // Required for click listener
    li.dataset.username = user.username;

    const nameSpan = document.createElement("span");
    nameSpan.textContent = user.username;
    li.appendChild(nameSpan);

    // Add Block and Blacklist buttons for moderators
    if (username === "moderator") {
      const blockButton = document.createElement("button");
      blockButton.innerText = "Block";
      blockButton.onclick = () => blockUser(user.username);

      const blacklistButton = document.createElement("button");
      blacklistButton.innerText = "Blacklist";
      blacklistButton.onclick = () => blacklistUser(user.username);

      li.appendChild(blockButton);
      li.appendChild(blacklistButton);
    }

    userList.appendChild(li);
  });
}

// Function to blacklist a user and disconnect them
function blacklistUser(blacklistedUsername) {
  if (confirm(`Are you sure you want to blacklist ${blacklistedUsername}?`)) {
    // Emit the block event to block the user
    socket.emit("blacklistthisuser", blacklistedUsername); 
    blockedUsers.add(blacklistedUsername); 
    updateBlockedUsersList(); 
    
    // Request the server to disconnect the blacklisted user by their socket.id
    socket.emit("disconnectUserBySocket", blacklistedUsername); 
  }
}


// Escape HTML to prevent XSS
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Escape string for safe inclusion inside single-quoted JS string literal in HTML attribute
function escapeJsString(str) {
  return str
    .replace(/\\/g, '\\\\')   // Escape backslashes
    .replace(/'/g, "\\'")     // Escape single quotes (for single quoted string)
    .replace(/"/g, '\\"')     // Escape double quotes (optional, but good practice)
    .replace(/\n/g, '\\n')    // Escape newlines
    .replace(/\r/g, '\\r');
}

// Function to update input state based on blocked status
function updateInputState() {
  if (blockedUsers.has(username)) {
    input.disabled = true;
  } else {
    input.disabled = false;
  }
}

// Listen for message updates from the server
socket.on("message_update", function ({ messageId, message, time }) {
  singleMessageUpdate({ id: messageId, message: message, time: time });
});

// Handle user leaving the room
socket.on("userLeft", (user) => {
  currentUsers.delete(user.username); // Remove the user from the currentUsers set
  outputUsers(Array.from(currentUsers)); // Update the user list
});


document.addEventListener('DOMContentLoaded', function () {
  const privateMessagesMap = new Map();
  let currentPrivateEditId = null;
  const privateTabsContainer = document.getElementById('private-tabs');
  const privateChatArea = document.getElementById('private-chat');
  const openedPrivateChats = new Set();
  const usernameToSocketId = new Map();
  const username = window.username || "tester1";

  // ---- Utility Functions ----
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }

  function formatTime(time) {
    if (!time) return "Invalid Date";
    const date = time instanceof Date ? time : new Date(time);
    if (isNaN(date)) return "Invalid Date";
    const day = String(date.getDate()).padStart(2,'0');
    const month = String(date.getMonth()+1).padStart(2,'0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2,'0');
    const minutes = String(date.getMinutes()).padStart(2,'0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  function cancelPrivateReply(otherUsername) {
    const chatBox = document.querySelector(`.private-chat-box[data-username="${otherUsername}"]`);
    if (!chatBox) return;
    const replyPreview = chatBox.querySelector('.reply-preview');
    const input = chatBox.querySelector(`input[data-username="${otherUsername}"]`);
    replyPreview.style.display = 'none';
    replyPreview.innerHTML = '';
    delete input.dataset.replyingTo;
  }
  
  function getReplyingTo(msg) {
  if (!msg.replyingTo) return null;
  const replyId = typeof msg.replyingTo === 'string' ? msg.replyingTo : getMessageId(msg.replyingTo);
  const original = privateMessagesMap.get(replyId);
  if (!original) return { id: replyId, username: 'Unknown', text: '[message deleted]', time: new Date() };
  return {
    id: replyId,
    username: original.username,
    text: original.text || original.message,
    time: original.time || original.createdAt
  };
}


  // ---- Socket Event Handlers ----
  socket.on('roomUsers', ({ users }) => {
    usernameToSocketId.clear();
    users.forEach(u => usernameToSocketId.set(u.username, u.id));
  });

  socket.on("privateMessage", handleIncomingPrivate);

 // Resolve replyingTo references safely
function getMessageId(msg) {
  return msg._id?.toString() || msg.id?.toString();
}

function resolveReplyingTo(msg) {
  if (!msg?.replyingTo) return null;
  const replyId = typeof msg.replyingTo === 'string' ? msg.replyingTo : getMessageId(msg.replyingTo);
  const original = privateMessagesMap.get(replyId);
  return {
    id: replyId,
    username: original?.username || 'Unknown',
    text: original ? (original.text || original.message) : '[message deleted]',
    time: original ? (original.time || original.createdAt) : new Date()
  };
}


// When receiving chat history:
socket.on('privateChatHistory', ({ participants, messages }) => {
  const otherUsername = participants.find(u => u !== username);
  if (!openedPrivateChats.has(otherUsername)) openPrivateChatTab(otherUsername);

  const chatBox = document.querySelector(`.private-chat-box[data-username="${otherUsername}"]`);
  if (!chatBox) return;
  const messagesDiv = chatBox.querySelector('.private-messages');
  messagesDiv.innerHTML = '';
  privateMessagesMap.clear();

  // 1️⃣ Store all messages first
 // 1️⃣ Store all messages first with normalized ID
messages.forEach(msg => {
  const id = getMessageId(msg);
  if (id) privateMessagesMap.set(id, msg);
});

// 2️⃣ Resolve replyingTo references
messages.forEach(msg => {
  // Normalize to a common property
  if (msg.replyToMessageId && !msg.replyingTo) {
    msg.replyingTo = msg.replyToMessageId; // now resolve below
  }
  if (msg.replyingTo) {
    msg.replyingTo = resolveReplyingTo(msg);
  }
});


// 3️⃣ Append messages
messages.forEach(msg => appendMessageToPrivateChat(otherUsername, msg));

});



// When receiving a single private message:
function handleIncomingPrivate(message) {
  if (!message || !message.private) return;
  
  const otherUser = message.participants?.find(u => u !== username);
  if (!otherUser) return;
  if (!openedPrivateChats.has(otherUser)) openPrivateChatTab(otherUser);

  const chatBox = document.querySelector(`.private-chat-box[data-username="${otherUser}"]`);
  if (!chatBox) return;

  const id = message._id?.toString() || message.id;
  if (id) privateMessagesMap.set(id, message);

  // Normalize reply reference
  if (message.replyToMessageId && !message.replyingTo) {
    message.replyingTo = message.replyToMessageId; // unify field name
  }

  // Resolve replyingTo into full object
  if (message.replyingTo) {
    const replyId = typeof message.replyingTo === 'string'
      ? message.replyingTo
      : message.replyingTo.id;
    const original = privateMessagesMap.get(replyId);
    message.replyingTo = {
      id: replyId,
      username: original?.username || 'Unknown',
      text: original ? (original.text || original.message) : '[message deleted]',
      time: original ? (original.time || original.createdAt) : new Date()
    };
  }

  appendMessageToPrivateChat(otherUser, message);
}







  socket.on('privateMessageUpdated', updatedMessage => {
    privateMessagesMap.set(updatedMessage.id, updatedMessage);

    // Update the original message text
    const msgDiv = document.querySelector(`.message[data-id="${updatedMessage.id}"]`);
    if (msgDiv) {
        msgDiv.querySelector('.text').textContent = updatedMessage.text || updatedMessage.message || '';
        msgDiv.classList.add('edited');
        setTimeout(() => msgDiv.classList.remove('edited'), 1000);
    }

    // 🔹 Update all replies quoting this message
    document.querySelectorAll(`.message .quoted-message`).forEach(q => {
        const parent = q.closest('.message');
        if (!parent) return;
        const msgId = parent.dataset.id;
        const msg = privateMessagesMap.get(msgId);
        if (msg?.replyingTo?.id === updatedMessage.id) {
            q.querySelector('.quote-text').textContent = updatedMessage.text || updatedMessage.message || '';
            // Also keep map data in sync
            msg.replyingTo.text = updatedMessage.text || updatedMessage.message || '';
            privateMessagesMap.set(msgId, msg);
        }
    });
});


  socket.on('privateMessageDeleted', ({ id }) => {
    const msgDiv = document.querySelector(`.message[data-id="${id}"]`);
    if (msgDiv) msgDiv.remove();
  });

  // ---- Incoming Message Handler ----
  
  function expandReplyingTo(msg) {
    if (!msg || !msg.replyingTo) return;
    const replyId = typeof msg.replyingTo === 'string' ? msg.replyingTo : msg.replyingTo.id;
    const original = privateMessagesMap.get(replyId);
    msg.replyingTo = {
      id: replyId,
      username: original?.username || 'Unknown',
      text: original ? (original.text || original.message) : '[message deleted]',
      time: original ? (original.time || original.createdAt) : new Date()
    };
    return msg;
  }

  // ---- Open Private Chat Tab ----
  function openPrivateChatTab(otherUsername) {
    if (openedPrivateChats.has(otherUsername)) return focusPrivateChatTab(otherUsername);
    openedPrivateChats.add(otherUsername);

    // Tab
    const tab = document.createElement('div');
    tab.className = 'private-tab';
    tab.dataset.username = otherUsername;

    const nameSpan = document.createElement('span');
    nameSpan.textContent = otherUsername;
    nameSpan.style.cursor = 'pointer';
    nameSpan.onclick = () => focusPrivateChatTab(otherUsername);

    const closeBtn = document.createElement('span');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.marginLeft = '10px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.title = 'Close chat';
    closeBtn.onclick = e => { e.stopPropagation(); closePrivateChatTab(otherUsername); };

    tab.appendChild(nameSpan);
    tab.appendChild(closeBtn);
    privateTabsContainer.appendChild(tab);

    // Chat box
    const chatBox = document.createElement('div');
    chatBox.className = 'private-chat-box';
    chatBox.dataset.username = otherUsername;
    chatBox.style.display = 'none';

    const messagesDiv = document.createElement('div');
    messagesDiv.className = 'private-messages';
    messagesDiv.style.height = '350px';
    messagesDiv.style.overflowY = 'auto';
    chatBox.appendChild(messagesDiv);

    const replyPreview = document.createElement('div');
    replyPreview.className = 'reply-preview';
    replyPreview.style.display = 'none';
    chatBox.appendChild(replyPreview);

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = `Message ${otherUsername}`;
    input.style.width = '80%';
    input.dataset.username = otherUsername;

    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendBtn.click(); } });

    const sendBtn = document.createElement('button');
    sendBtn.textContent = 'Send';
    sendBtn.onclick = () => {
      const text = input.value.trim();
      if (!text) return;
      const replyTo = input.dataset.replyingTo ? JSON.parse(input.dataset.replyingTo) : null;

      if (input.dataset.editing) {
        const editingId = input.dataset.editing;
        socket.emit('editPrivateMessage', { messageId: editingId, newText: text, participants: [username, otherUsername].sort() }, res => {
          if (!res.error) {
            const oldMsg = privateMessagesMap.get(editingId);
            if (oldMsg) { oldMsg.message = text; privateMessagesMap.set(editingId, oldMsg); }
            const msgDiv = document.querySelector(`.message[data-id="${editingId}"] .text`);
            if (msgDiv) msgDiv.textContent = text;
            delete input.dataset.editing;
            input.value = '';
            currentPrivateEditId = null;
          } else alert(res.error);
        });
      } else {
        sendPrivateMessage(otherUsername, text, replyTo ? replyTo.id : null);
        input.value = '';
        delete input.dataset.replyingTo;
        cancelPrivateReply(otherUsername);
      }
    };

    chatBox.appendChild(input);
    chatBox.appendChild(sendBtn);
    privateChatArea.appendChild(chatBox);

    focusPrivateChatTab(otherUsername);
    socket.emit('loadPrivateChatHistory', { participants: [username, otherUsername].sort() });
  }

  function focusPrivateChatTab(name) {
    document.querySelectorAll('.private-chat-box').forEach(b => b.style.display='none');
    document.querySelectorAll('.private-tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.querySelector(`.private-tab[data-username="${name}"]`);
    if (activeTab) activeTab.classList.add('active');
    const chatBox = document.querySelector(`.private-chat-box[data-username="${name}"]`);
    if (chatBox) chatBox.style.display='block';
  }

  function closePrivateChatTab(name) {
    openedPrivateChats.delete(name);
    document.querySelector(`.private-tab[data-username="${name}"]`)?.remove();
    document.querySelector(`.private-chat-box[data-username="${name}"]`)?.remove();
  }

  // ---- Message Actions ----
  function replyPrivateMessage(user, text, id) {
    const chatBox = document.querySelector(`.private-chat-box[data-username="${user}"]`);
    if (!chatBox) return;
    const replyPreview = chatBox.querySelector('.reply-preview');
    const input = chatBox.querySelector(`input[data-username="${user}"]`);
    replyPreview.innerHTML = `<div class="reply-box"><strong>@${escapeHtml(user)}</strong><div class="reply-text">${escapeHtml(text)}</div><button class="cancel-reply">Cancel</button></div>`;
    replyPreview.style.display = 'block';
    replyPreview.querySelector('.cancel-reply').onclick = () => cancelPrivateReply(user);
    input.dataset.replyingTo = JSON.stringify({ username: user, text, id });
    input.focus();
  }

  window.editPrivateMessageById = function(id, chatBoxUser) {
    const msg = privateMessagesMap.get(id);
    if (!msg) return;
    focusPrivateChatTab(chatBoxUser);
    const input = document.querySelector(`.private-chat-box[data-username="${chatBoxUser}"] input[data-username="${chatBoxUser}"]`);
    if (!input) return;
    input.value = msg.text || msg.message || '';
    input.dataset.editing = id;
    currentPrivateEditId = id;
    input.focus();
  };

  function deletePrivateMessage(messageId) {
  if (!confirm("Delete this message?")) return;

  socket.emit("private_message_delete", { message_id: messageId }, (response) => {
    if (response.error) {
      alert("Error deleting private message: " + response.error);
    } else {
      // Remove from UI
      const msgDiv = document.querySelector(`.message[data-id="${messageId}"]`);
      if (msgDiv) msgDiv.remove();
      // Remove from map
      privateMessagesMap.delete(messageId);
    }
  });
}


  
 function appendMessageToPrivateChat(otherUsername, message) {
  const chatBox = document.querySelector(`.private-chat-box[data-username="${otherUsername}"]`);
  if (!chatBox) return;

  const messagesDiv = chatBox.querySelector('.private-messages');
  if (!messagesDiv) return;

  const messageId = message._id?.toString() || message.id || '';
  if (messageId) privateMessagesMap.set(messageId, message);

  const isAuthorOrModerator = message.username === username || username === 'moderator';
  const formattedTime = formatTime(message.time || message.createdAt);

  const div = document.createElement('div');
  div.classList.add('message');
  div.dataset.id = messageId;

  // Build HTML including replyingTo if present
  let html = `
    <p class="meta">
  ${escapeHtml(message.username)} 
  <span class="time">${escapeHtml(formattedTime)}</span>
</p>
  `;

  const replyingToData = getReplyingTo(message);
if (replyingToData) {
  html += `
    <div class="quoted-message">
      <strong>@${escapeHtml(replyingToData.username)}</strong>
      <small>${escapeHtml(formatTime(replyingToData.time))}</small>
      <div class="quote-text">${escapeHtml(replyingToData.text)}</div>
    </div>
  `;
}

  html += `
    <p class="text">${escapeHtml(message.text || message.message || '[no text]')}</p>
    <div class="actions">
      <button class="reply-btn">Reply</button>
      ${isAuthorOrModerator ? `
        <button class="edit-btn" data-id="${messageId}">Edit</button>
        <button class="delete-btn" data-id="${messageId}">Delete</button>
      ` : ''}
    </div>
  `;

  div.innerHTML = html;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

  // Attach event handlers
  div.querySelector(".reply-btn").addEventListener("click", () => {
  replyPrivateMessage(otherUsername, message.text || message.message, messageId);
});


  if (isAuthorOrModerator) {
    div.querySelector(".edit-btn")?.addEventListener("click", () => {
      editPrivateMessageById(messageId, otherUsername);
    });
    div.querySelector(".delete-btn")?.addEventListener("click", () => {
      deletePrivateMessage(messageId);
    });
  }
}



  function sendPrivateMessage(toUser, text, replyToId=null) {
    socket.emit('chatMessage', { text, private:true, participants:[username,toUser].sort(), sender: username, replyingTo: replyToId });
  }

  // ---- Click on user to open chat ----
  document.getElementById('users')?.addEventListener('click', e => {
    const target = e.target.closest('.user-link');
    if (!target || !target.dataset.username) return;
    const other = target.dataset.username;
    if (other===username) return;
    openPrivateChatTab(other);
  });

});

