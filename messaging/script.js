//Main script

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

// Contacts are stored in localStorage
let contacts = JSON.parse(localStorage.getItem('contacts')) || [];

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

    // Check if the Peer ID is valid
    peer.listAllPeers(peerIds => {
        if (peerIds.includes(contactId)) {
            const newContact = { contactId: contactId, peerId: contactId }; // Store both
            contacts.push(newContact);
            localStorage.setItem('contacts', JSON.stringify(contacts));
            displayContacts();
        } else {
            alert("Peer ID not found.");
        }
    });
}

function deleteContact(contactId) {
    contacts = contacts.filter(contact => contact.contactId !== contactId);
    localStorage.setItem('contacts', JSON.stringify(contacts));
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

// Run on page load
window.onload = function () {
    // Generate a Peer ID and attempt to connect to the PeerJS server
    const peerId = generatePeerId();
    peer = new Peer(peerId);

    peer.on('open', function (id) {
        myPeerIdDiv.innerText = 'My Peer ID: ' + id;
        displayContacts(); // Load contacts on init
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
