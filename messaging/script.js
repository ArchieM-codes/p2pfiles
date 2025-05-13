// --- PeerJS Connection ---
let peer = null; // Will hold the Peer object
let conn = null; // Will hold the DataConnection object
let isConnected = false; // Flag to check connection status

// --- UI Elements ---
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const messagesDiv = document.getElementById("messages");
const newContactIdInput = document.getElementById("new-contact-id");
const addContactBtn = document.getElementById("add-contact-btn");
const contactList = document.getElementById("contact-list");
const myPeerIdDiv = document.getElementById("myPeerId");
const noPeerMessageDiv = document.getElementById("no-peer-message");
const imageInput = document.getElementById('imageInput');

let currentPeerId = null; // Tracks the currently selected peer

// --- Local Storage ---
const CONTACTS_KEY = 'p2p_chat_contacts';

function loadContacts() {
    const storedContacts = localStorage.getItem(CONTACTS_KEY);
    if (storedContacts) {
        const contacts = JSON.parse(storedContacts);
        contacts.forEach(addContactToList); // Render from local storage
    }
}

function saveContacts() {
    const contacts = [];
    document.querySelectorAll('#contact-list li').forEach(item => {
        contacts.push(item.textContent);  // Get text from list item
    });
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
}

// --- PeerJS Initialization ---
function initializePeer() {
    peer = new Peer();

    peer.on('open', function (id) {
        console.log('My Peer ID is: ' + id);
        myPeerIdDiv.textContent = "My Peer ID: " + id;
    });

    peer.on('connection', function (connection) {
        console.log("Incoming connection!");
        conn = connection;
        isConnected = true;
        currentPeerId = conn.peer; // Set the connected peer ID
        updateNoPeerMessage(); // Hide the no-peer message

        conn.on('data', handleData);
        conn.on('close', function () {
            console.log("Connection closed by remote peer.");
            isConnected = false;
            conn = null;
            updateNoPeerMessage();  // Show no-peer message
        });
        conn.on('error', function (err) {
            console.error("Connection error:", err);
            isConnected = false;
            conn = null;
            updateNoPeerMessage();  // Show no-peer message
        });
    });

    peer.on('error', function (err) {
        console.error("PeerJS error:", err);
    });
}

function connectToPeer(remotePeerId) {
    if (conn) {
        conn.close(); // Close existing connection
    }

    conn = peer.connect(remotePeerId, { reliable: true }); // Establish new connection
    currentPeerId = remotePeerId;
    updateNoPeerMessage(); // Hide the no-peer message

    conn.on('open', function () {
        console.log("Connected to: " + remotePeerId);
        isConnected = true;

        conn.on('data', handleData);
        conn.on('close', function () {
            console.log("Connection closed by remote peer.");
            isConnected = false;
            conn = null;
            updateNoPeerMessage(); // Show no-peer message
        });
        conn.on('error', function (err) {
            console.error("Connection error:", err);
            isConnected = false;
            conn = null;
            updateNoPeerMessage();  // Show no-peer message
        });
    });
}

function updateNoPeerMessage() {
    if (isConnected || currentPeerId) {
        noPeerMessageDiv.style.display = 'none'; // Hide message
    } else {
        noPeerMessageDiv.style.display = 'block'; // Show message
    }
}

function sendMessage(type, content) {
    if (!isConnected || !conn) {
        alert("Not connected!");
        return;
    }

    const data = { type: type, content: content };
    conn.send(data);
}

function decodeUTF8(text) {
    try {
        return decodeURIComponent(escape(text));
    } catch (e) {
        console.warn("Could not decode UTF-8 message:", text);
        return text;
    }
}

function handleData(data) {
    console.log("Received data:", data);

    if (typeof data === 'object' && data !== null) {
        if (data.type === 'chat') {
            const decodedMessage = decodeUTF8(data.content);
            appendMessage(DOMPurify.sanitize(decodedMessage), 'incoming');
        } else if (data.type === 'image') {
            appendMessage(data.content, 'incoming', true); // Indicate it's an image
        } else {
            console.warn("Unknown data type:", data);
        }
    } else {
        console.warn("Received non-object data:", data);
    }
}

function appendMessage(message, type, isImage = false) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', type);
    const timestamp = new Date().toLocaleTimeString();
    let messageContent;

    if (isImage) {
        messageContent = `<span class="timestamp">${timestamp}</span><img src="${message}" alt="Image" style="max-width: 200px; height: auto;">`;
    } else {
        messageContent = `<span class="timestamp">${timestamp}</span> ${message}`;
    }

    messageDiv.innerHTML = messageContent;
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function addContactToList(peerId) {
    const listItem = document.createElement('li');
    listItem.textContent = peerId;

    listItem.addEventListener('click', function () {
        connectToPeer(peerId);
        currentPeerId = peerId; // Set the connected peer ID
        updateNoPeerMessage(); // Hide the no-peer message
        // Remove "selected" class from all list items
        document.querySelectorAll('#contact-list li').forEach(item => {
            item.classList.remove('selected');
        });
        // Add "selected" class to the clicked item
        listItem.classList.add('selected');
    });

    contactList.appendChild(listItem);
}

// --- Event Listeners ---
sendButton.addEventListener('click', function () {
    const messageText = messageInput.value.trim();
    const imageFile = imageInput.files[0];

    if (messageText) {
        sendMessage('chat', messageText);
        appendMessage(messageText, 'outgoing');
        messageInput.value = '';
    }

    if (imageFile) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const base64Image = e.target.result;
            sendMessage('image', base64Image);
            appendMessage(base64Image, 'outgoing', true); // Indicate it's an image
            imageInput.value = ''; // Clear the input
        }
        reader.readAsDataURL(imageFile);
    }
});

addContactBtn.addEventListener('click', function () {
    const newContactId = newContactIdInput.value.trim();

    if (newContactId && /^AMC-\d{4}-[A-Za-z0-9]{3}-\d{4}$/.test(newContactId)) {
        addContactToList(newContactId); // Add the contact to the list

        saveContacts(); // Save updated contact list
        newContactIdInput.value = ''; // Clear the input
    } else {
        alert("Invalid Peer ID format. Use AMC-1234-AbC-5678 format.");
    }
});

contactList.addEventListener('DOMNodeInserted', saveContacts);
contactList.addEventListener('DOMNodeRemoved', saveContacts);

// Initialization
initializePeer();
loadContacts();
