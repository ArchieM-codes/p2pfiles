 const myPeerIdDiv = document.getElementById('myPeerId');
 const newContactIdInput = document.getElementById('new-contact-id');
 const addContactBtn = document.getElementById('add-contact-btn');
 const contactList = document.getElementById('contact-list');
 const noPeerMessage = document.getElementById("no-peer-message");

 // Get the popup elements
 const popupChat = document.getElementById('popup-chat');
 const popupContactName = document.getElementById('popup-contact-name');
 const popupMessages = document.getElementById('popup-messages');
 const popupMessageInput = document.getElementById('popup-message-input');
 const popupSendBtn = document.getElementById('popup-send-btn');
 const popupCloseBtn = document.getElementById('popup-close-btn');

 let peer = null;
 //let conn = null; REMOVE single connection
 let isConnected = false;
 let currentContact = null;

 // Local storage keys
 const CONTACTS_KEY = 'contacts';
 const MESSAGES_KEY = 'messages';

 // Load data from local storage
 let contacts = JSON.parse(localStorage.getItem(CONTACTS_KEY)) || [];
 let messages = JSON.parse(localStorage.getItem(MESSAGES_KEY)) || {};

 //NEW: Object to store multiple connections
 const connections = {};

 // Function to generate a random Peer ID
 function generatePeerId() {
  const randomNumber1 = Math.floor(1000 + Math.random() * 9000);
  const randomLetters = Array.from({ length: 3 }, () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return chars.charAt(Math.floor(Math.random() * chars.length));
  }).join('');
  const randomNumber2 = Math.floor(1000 + Math.random() * 9000);
  return `AMC-${randomNumber1}-${randomLetters}-${randomNumber2}`;
 }

 // Function to hash a string
 async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
 }

 async function getOrCreatePeerId() {
  try {
  const ipResponse = await fetch('https://api.ipify.org?format=json');
  const ipData = await ipResponse.json();
  const ipAddress = ipData.ip;
  const userAgent = navigator.userAgent;
  const deviceHash = await hashString(ipAddress + userAgent);
  let peerId = localStorage.getItem(deviceHash) || null;
  if (!peerId) {
  peerId = generatePeerId();
  localStorage.setItem(deviceHash, peerId);
  }
  return peerId;
  } catch (error) {
  console.error("Error getting device ID:", error);
  return generatePeerId(); // Fallback if IP or hashing fails
  }
 }

 // Utility function to encode a string to UTF-8
 function encodeUTF8(str) {
  return new TextEncoder().encode(str);
 }

 // Utility function to decode a UTF-8 byte array to string
 function decodeUTF8(bytes) {
  return new TextDecoder().decode(bytes);
 }

 function appendMessage(message, type, target) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', type);
  const timestamp = new Date().toLocaleTimeString();
  messageDiv.innerHTML = `<span class="timestamp">${timestamp}</span> ${message}`;

  target.appendChild(messageDiv);
  target.scrollTop = target.scrollHeight;
 }

 //Modified sendMessage to take a peerId
 function sendMessage(peerId, message) {
  if (!connections[peerId]) {
  alert("Not connected to this peer!");
  return;
  }

  const sanitizedMessage = DOMPurify.sanitize(message);
  const encodedMessage = encodeUTF8(sanitizedMessage);  // Encode the message

  connections[peerId].send({ type: 'chat', message: encodedMessage });
  appendMessage(sanitizedMessage, 'outgoing', popupMessages);
  //appendMessage(sanitizedMessage, 'outgoing');

  storeMessage(peerId, sanitizedMessage, 'outgoing');
  popupMessageInput.value = '';
 }

 //Modified handleData to identify the sender
 function handleData(data, peerId) {
  console.log("Received data from " + peerId + ":", data);

  if (typeof data === 'object' && data !== null) {
  if (data.type === 'chat') {
  // Decode the message
  const decodedMessage = decodeUTF8(data.message);
  const sanitizedMessage = DOMPurify.sanitize(decodedMessage);

  appendMessage(sanitizedMessage, 'incoming', popupMessages);
  storeMessage(peerId, sanitizedMessage, 'incoming');
  //appendMessage(sanitizedMessage, 'incoming');
  } else {
  console.warn("Unknown data type:", data);
  }
  } else {
  console.warn("Received non-object data:", data);
  }
 }

 function displayContacts() {
  contactList.innerHTML = ''; // Clear the list first

  contacts.forEach(contact => {
  const listItem = document.createElement('li');
  listItem.innerHTML = `
  <span style="cursor: pointer;">${contact.displayName}</span>
  <button class="rename-contact-btn" data-id="${contact.peerId}" style="margin-left: 5px;">Rename</button>
  <button class="delete-contact-btn" data-id="${contact.peerId}" style="margin-left: 5px;">Delete</button>
  `;
  listItem.style.padding = '5px';
  listItem.style.borderBottom = '1px solid #eee';
  listItem.addEventListener('click', () => {
  openChatPopup(contact);
  });

  // Rename button click
  const renameButton = listItem.querySelector('.rename-contact-btn');
  renameButton.addEventListener('click', (event) => {
  event.stopPropagation(); // Prevent connection attempt
  renameContact(contact.peerId);
  });

  // Delete button click
  const deleteButton = listItem.querySelector('.delete-contact-btn');
  deleteButton.addEventListener('click', (event) => {
  event.stopPropagation(); // Prevent connection attempt
  deleteContact(contact.peerId);
  });

  contactList.appendChild(listItem);
  });
 }

 function addContact(contactId) {
  if (contacts.find(c => c.peerId === contactId)) {
  alert("Contact ID already exists.");
  return;
  }

  const peerIdRegex = /^AMC-\\d{4}-[A-Za-z0-9]{3}-\\d{4}$/;
  if (!peerIdRegex.test(contactId)) {
  alert("Invalid Contact ID format. Use AMC-XXXX-XXX-XXXX.");
  return;
  }

  const displayName = prompt("Enter a display name for this contact:");
  if (!displayName) return;

  const newContact = { peerId: contactId, displayName: displayName };
  contacts.push(newContact);
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
  displayContacts();
 }

 function renameContact(peerId) {
  const newDisplayName = prompt("Enter a new display name:");
  if (!newDisplayName) return;
  const contact = contacts.find(c => c.peerId === peerId);
  if (contact) {
  contact.displayName = newDisplayName;
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
  displayContacts();
  }
 }

 function deleteContact(peerId) {
  contacts = contacts.filter(contact => contact.peerId !== peerId);
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
  displayContacts();
  if (currentContact && currentContact.peerId === peerId) {
  currentContact = null;
  }
 }

 //Modified connectToPeer to allow multiple connections
 function connectToPeer(peerId) {
  if (connections[peerId]) {
  console.log("Already connected to:", peerId);
  return;
  }

  const conn = peer.connect(peerId, { reliable: true });

  conn.on('open', function () {
  console.log("Connected to:", peerId);
  appendMessage('Connected to ' + peerId + '!', 'incoming', popupMessages);
  connections[peerId] = conn; // Store the connection

  });

  conn.on('data', function (data) {
  handleData(data, peerId); // Pass peerId to handleData
  });

  conn.on('close', function () {
  console.log("Connection closed with:", peerId);
  appendMessage('Connection closed with ' + peerId, 'incoming', popupMessages);
  delete connections[peerId]; // Remove the connection
  });
 }

 function storeMessage(peerId, message, type) {
  const now = new Date();
  const messageObject = {
  content: message,
  type: type,
  timestamp: now.toISOString()
  };

  if (!messages[peerId]) {
  messages[peerId] = [];
  }
  messages[peerId].push(messageObject);
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
 }

 function getRecentMessages(peerId) {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // 24 hours ago
  if (!messages[peerId]) {
  return [];
  }
  return messages[peerId].filter(message => new Date(message.timestamp) >= twentyFourHoursAgo);
 }

 function displayChatHistory(peerId) {
  popupMessages.innerHTML = ''; // Clear existing messages
  const chatHistory = getRecentMessages(peerId);
  chatHistory.forEach(message => {
  appendMessage(message.content, message.type, popupMessages);
  });
 }

 function openChatPopup(contact) {
  currentContact = contact;
  popupContactName.innerText = contact.displayName;

  displayChatHistory(contact.peerId);

  //connectToPeer(contact.peerId);

  popupChat.style.display = 'flex'; // Show the popup
 }

 function closeChatPopup() {
  popupChat.style.display = 'none';
 }

 // Run on page load
 window.onload = async function () {
  const peerId = await getOrCreatePeerId();

  const peerConfig = {
  host: '0.peerjs.com',
  port: 443,
  path: '/',
  secure: true,
  key: 'peerjs',
  debug: 3,
  config: {
  iceServers: [{
  urls: ["stun:eu-turn4.xirsys.com"]
  }, {
  username: "vXp0ehXgRlCJeYdQBR4hjAdVn42ttLfds4jTAVrRmD5RTceXb9qp-sCf1PEw5eWiAAAAAGggndthcmNoaWVtdG9w",
  credential: "fab9d62a-2e66-11f0-b4dc-0242ac140004",
  urls: [
  "turn:eu-turn4.xirsys.com:80?transport=udp",
  "turn:eu-turn4.xirsys.com:3478?transport=udp",
  "turn:eu-turn4.xirsys.com:80?transport=tcp",
  "turn:eu-turn4.xirsys.com:3478?transport=tcp",
  "turns:eu-turn4.xirsys.com:443?transport=tcp",
  "turns:eu-turn4.xirsys.com:5349?transport=tcp"
  ]
  }]
  }
  };

  peer = new Peer(peerId, peerConfig);

  peer.on('open', function (id) {
  console.log("Peer object on 'open':", peer);
  myPeerIdDiv.innerText = 'My Peer ID: ' + id;
  displayContacts();
  });

  peer.on('error', function (err) {
  console.error("PeerJS error:", err);
  });

  // New Incoming connection
  peer.on('connection', function (connection) {
  console.log("Incoming Connection object: ", connection)
  const peerId = connection.peer; // Get the peerId of the incoming connection

  connections[peerId] = connection;

  connection.on('data', function (data) {
  handleData(data, peerId);
  });

  connection.on('close', function () {
  isConnected = false;
  delete connections[peerId];
  });
  });

  // Listener for the "Add Contact" button
  addContactBtn.addEventListener('click', function () {
  const newContactId = newContactIdInput.value.trim();
  if (newContactId) {
  addContact(newContactId);
  newContactIdInput.value = '';
  }
  });

  // Popup event listeners
  popupSendBtn.addEventListener('click', () => {
  const message = popupMessageInput.value.trim();
  if (message) {
  sendMessage(currentContact.peerId, message);
  }
  });

  popupCloseBtn.addEventListener('click', closeChatPopup);

  displayContacts();
 };
