const myPeerIdDiv = document.getElementById('myPeerId');
const newContactIdInput = document.getElementById('new-contact-id');
const addContactBtn = document.getElementById('add-contact-btn');
const contactList = document.getElementById('contact-list');
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const noPeerMessage = document.getElementById("no-peer-message");

let peer = null;
let conn = null;
let isConnected = false;
let currentContact = null;

// Local storage keys
const CONTACTS_KEY = 'contacts';

// Load data from local storage
let contacts = JSON.parse(localStorage.getItem(CONTACTS_KEY)) || [];

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
    const encodedMessage = encodeUTF8(sanitizedMessage);  // Encode the message
    conn.send({ type: 'chat', message: encodedMessage });
    appendMessage(sanitizedMessage, 'outgoing');
    messageInput.value = '';
}

function handleData(data) {
    console.log("Received data:", data);

    if (typeof data === 'object' && data !== null) {
        if (data.type === 'chat') {
            // Decode the message
            const decodedMessage = decodeUTF8(data.message);
            appendMessage(DOMPurify.sanitize(decodedMessage), 'incoming');
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
            <span>${contact.displayName}</span>
            <button class="rename-contact-btn" data-id="${contact.peerId}">Rename</button>
            <button class="delete-contact-btn" data-id="${contact.peerId}">Delete</button>
        `;

        listItem.classList.toggle('selected', currentContact && currentContact.peerId === contact.peerId);

        // Connect on click
        listItem.addEventListener('click', () => {
            if (conn) {
                conn.close();
            }
            connectToPeer(contact.peerId);
            currentContact = contact;
            noPeerMessage.textContent = `Now connected to peer ${contact.displayName}.`;
            displayContacts();
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

    const peerIdRegex = /^AMC-\d{4}-[A-Za-z0-9]{3}-\d{4}$/;
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

    displayContacts();
};
