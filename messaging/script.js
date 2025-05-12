//HIIII

const myPeerIdDiv = document.getElementById('myPeerId');
const newContactIdInput = document.getElementById('new-contact-id');
const addContactBtn = document.getElementById('add-contact-btn');
const contactList = document.getElementById('contact-list');
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const noPeerMessage = document.getElementById("no-peer-message");
const friendRequestList = document.getElementById('friend-request-list');

let peer = null;
let conn = null;
let isConnected = false;
let currentContact = null;

// Local storage keys
const PEER_ID_KEY = 'myPeerId';
const CONTACTS_KEY = 'contacts';
const FRIEND_REQUESTS_KEY = 'friendRequests';

// Load data from local storage
let myPeerId = localStorage.getItem(PEER_ID_KEY) || null;
let contacts = JSON.parse(localStorage.getItem(CONTACTS_KEY)) || [];
let friendRequests = JSON.parse(localStorage.getItem(FRIEND_REQUESTS_KEY)) || [];

// Function to generate a random Peer ID
function generatePeerId() {
    const randomNumber1 = Math.floor(1000 + Math.random() * 9000);
    const randomLetters = Array.from({ length: 3 }, () => String.fromCharCode(Math.floor(Math.random() * 52) + (Math.random() > 0.5 ? 65 : 97))).join('');
    const randomNumber2 = Math.floor(1000 + Math.random() * 9000);
    return `AMC-${randomNumber1}-${randomLetters}-${randomNumber2}`;
}

function appendMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', type);

    const timestamp = new Date().toLocaleTimeString();
    messageDiv.innerHTML = `<span class="timestamp">${timestamp}</span> ${message}`;

    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function sendMessage(message) {
    if (!isConnected || !conn) {
        alert("Not connected!");
        return;
    }

    const sanitizedMessage = DOMPurify.sanitize(message);
    conn.send({ type: 'chat', message: sanitizedMessage });
    appendMessage(sanitizedMessage, 'outgoing');
    messageInput.value = '';
}

function handleData(data) {
    console.log("Received data:", data);

    if (typeof data === 'object' && data !== null) {
        if (data.type === 'chat') {
            appendMessage(DOMPurify.sanitize(data.message), 'incoming');
        } else if (data.type === 'friendRequest') {
            // Handle friend request
            const newRequest = { peerId: data.peerId, contactId: data.contactId };
            friendRequests.push(newRequest);
            localStorage.setItem(FRIEND_REQUESTS_KEY, JSON.stringify(friendRequests));
            displayFriendRequests();
        } else {
            console.warn("Unknown data type:", data);
        }
    } else {
        console.warn("Received non-object data:", data);
    }
}

function displayContacts() {
    contactList.innerHTML = '';  // Clear the list first

    contacts.forEach(contact => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `
            <span>${contact.contactId}</span>
            <button class="delete-contact-btn" data-id="${contact.contactId}">Delete</button>
        `;

        // Connect on click
        listItem.addEventListener('click', () => {
            if (conn) {
                conn.close();
            }
            connectToPeer(contact.peerId);
            currentContact = contact;
            noPeerMessage.textContent = `Now connected to peer ${currentContact.contactId}.`;
        });

        // Delete button click
        const deleteButton = listItem.querySelector('.delete-contact-btn');
        deleteButton.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent connection attempt
            deleteContact(contact.contactId);
        });

        contactList.appendChild(listItem);
    });
}

function addContact(contactId) {
    if (contacts.find(c => c.contactId === contactId)) {
        alert("Contact ID already exists.");
        return;
    }

    const peerIdRegex = /^AMC-\d{4}-[A-Za-z]{3}-\d{4}$/;
    if (!peerIdRegex.test(contactId)) {
        alert("Invalid Contact ID format. Use AMC-XXXX-XXX-XXXX.");
        return;
    }

    // Send friend request to the peer instead of directly adding
    if (peer) {
        const data = { type: 'friendRequest', peerId: myPeerId, contactId: peer.id };
        const tempConn = peer.connect(contactId, { reliable: true });

        tempConn.on('open', () => {
            tempConn.send(data);
            alert('Friend request sent!');
            tempConn.close();
        });

        tempConn.on('error', err => {
            console.error("Could not send friend request", err);
            alert("Could not send friend request.  Peer may be offline, or connection may be bad.");
        });
    } else {
        alert("Peer object not initialized. Please refresh the page.");
    }
}

function deleteContact(contactId) {
    contacts = contacts.filter(contact => contact.contactId !== contactId);
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
    displayContacts();
    if (currentContact && currentContact.contactId === contactId) {
        currentContact = null;
    }
}

function connectToPeer(peerId) {
    if (conn) {
        conn.close();
        isConnected = false;
    }

    conn = peer.connect(peerId, { reliable: true });
    isConnected = true;

    conn.on('open', function () {
        console.log("Connected to:", peerId);
        appendMessage('Connected!', 'incoming');
    });

    conn.on('data', function (data) {
        handleData(data);
    });

    conn.on('close', function () {
        isConnected = false;
        appendMessage('Connection closed', 'incoming');
    });
}

function displayFriendRequests() {
    friendRequestList.innerHTML = '';
    friendRequests.forEach(request => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `<span>Friend request from ${request.contactId}</span>
                              <button class="accept-btn" data-id="${request.peerId}">Accept</button>
                              <button class="decline-btn">Decline</button>`;

        listItem.querySelector('.accept-btn').addEventListener('click', () => {
            acceptFriendRequest(request.peerId, request.contactId);
        });

        listItem.querySelector('.decline-btn').addEventListener('click', () => {
            declineFriendRequest(request.peerId);
        });

        friendRequestList.appendChild(listItem);
    });
}

function acceptFriendRequest(peerId, contactId) {
    // Add contact to contact list
    const newContact = { contactId: contactId, peerId: peerId };
    contacts.push(newContact);
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
    displayContacts();

    // Remove from friend requests
    friendRequests = friendRequests.filter(request => request.peerId !== peerId);
    localStorage.setItem(FRIEND_REQUESTS_KEY, JSON.stringify(friendRequests));
    displayFriendRequests();
}

function declineFriendRequest(peerId) {
    friendRequests = friendRequests.filter(request => request.peerId !== peerId);
    localStorage.setItem(FRIEND_REQUESTS_KEY, JSON.stringify(friendRequests));
    displayFriendRequests();
}

// Run on page load
window.onload = function () {
    // Generate a Peer ID and attempt to connect to the PeerJS server
    myPeerId = myPeerId || generatePeerId();

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

    peer = new Peer(myPeerId, peerConfig);

    peer.on('open', function (id) {
        console.log("Peer object on 'open':", peer);
        myPeerIdDiv.innerText = 'My Peer ID: ' + id;
        localStorage.setItem(PEER_ID_KEY, id);
        displayContacts();
        displayFriendRequests();
    });

    peer.on('error', function (err) {
        console.error("PeerJS error:", err);
    });

    // New Incoming connection
    peer.on('connection', function (connection) {
        if (conn) {
            conn.close(); // Close current connection if any
        }
        conn = connection;
        isConnected = true;
        appendMessage('Connected!', 'incoming');

        conn.on('data', function (data) {
            handleData(data);
        });

        conn.on('close', function () {
            isConnected = false;
            appendMessage('Connection closed', 'incoming');
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

    // Listener for the "Send Message" button
    sendButton.addEventListener('click', function () {
        const message = messageInput.value.trim();
        if (message) {
            sendMessage(message);
        }
    });
};
