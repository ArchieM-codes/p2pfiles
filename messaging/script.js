// --- PeerJS Connection ---
let peer = null;
let conn = null;
let isConnected = false;

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

let currentPeerId = null;

// --- Local Storage Keys (as you provided) ---
const CONTACTS_KEY = 'contacts'; // Correct key
const MY_PEER_ID_KEY = 'd18e51edd58268415a9c2311e41dfadabcfa1158ee335d067fc1f82e4127b20a';
const ICE_SERVERS = [
    { urls: ["stun:eu-turn4.xirsys.com"] },
    {
        username: "vXp0ehXgRlCJeYdQBR4hjAdVn42ttLfds4jTAVrRmD5RTceXb9qp-sCf1PEw5eWiAAAAAGggndthcmchiemtop",
        credential: "fab9d62a-2e66-11f0-b4dc-0242ac140004",
        urls: [
            "turn:eu-turn4.xirsys.com:80?transport=udp",
            "turn:eu-turn4.xirsys.com:3478?transport=udp",
            "turn:eu-turn4.xirsys.com:80?transport=tcp",
            "turn:eu-turn4.xirsys.com:3478?transport=tcp",
            "turns:eu-turn4.xirsys.com:443?transport=tcp",
            "turns:eu-turn4.xirsys.com:5349?transport=tcp"
        ]
    }
];

// --- Helper Functions for Local Storage ---
function getContacts() {
    const storedContacts = localStorage.getItem(CONTACTS_KEY);
    return storedContacts ? JSON.parse(storedContacts) : [];
}

function saveContacts(contacts) {
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
}

function getMyPeerIdFromLocalStorage() {
    return localStorage.getItem(MY_PEER_ID_KEY);
}

function saveMyPeerIdToLocalStorage(peerId) {
    localStorage.setItem(MY_PEER_ID_KEY, peerId);
}

function addContactToList(contact) {
    const listItem = document.createElement('li');
    listItem.textContent = `${contact.displayName} (${contact.peerId})`; // Display name + PeerId

    listItem.addEventListener('click', function () {
        connectToPeer(contact.peerId);
        currentPeerId = contact.peerId;
        updateNoPeerMessage();

        document.querySelectorAll('#contact-list li').forEach(item => {
            item.classList.remove('selected');
        });
        listItem.classList.add('selected');
    });

    contactList.appendChild(listItem);
}

// --- PeerJS Initialization ---
function initializePeer() {
    let peerId = getMyPeerIdFromLocalStorage();

    const peerOptions = {
        config: {
            iceServers: ICE_SERVERS
        }
    };

    if (peerId) {
        console.log("Using existing Peer ID from localStorage: " + peerId);
        peerOptions.id = peerId; // Set the ID if found in localStorage
    }

    peer = new Peer(peerOptions);

    peer.on('open', function (id) {
        console.log('My Peer ID is: ' + id);
        myPeerIdDiv.textContent = "My Peer ID: " + id;

        if (!peerId) { // If we generated a new ID, save it
            saveMyPeerIdToLocalStorage(id);
        }
    });

    peer.on('connection', function (connection) {
        console.log("Incoming connection!");
        conn = connection;
        isConnected = true;
        currentPeerId = conn.peer;
        updateNoPeerMessage();

        conn.on('data', handleData);
        conn.on('close', function () {
            console.log("Connection closed by remote peer.");
            isConnected = false;
            conn = null;
            updateNoPeerMessage();
        });
        conn.on('error', function (err) {
            console.error("Connection error:", err);
            isConnected = false;
            conn = null;
            updateNoPeerMessage();
        });
    });

    peer.on('error', function (err) {
        console.error("PeerJS error:", err);
    });
}

// --- Peer Connection Functions ---
function connectToPeer(remotePeerId) {
    if (conn) {
        conn.close();
    }

    conn = peer.connect(remotePeerId, { reliable: true });
    currentPeerId = remotePeerId;
    updateNoPeerMessage();

    conn.on('open', function () {
        console.log("Connected to: " + remotePeerId);
        isConnected = true;

        conn.on('data', handleData);
        conn.on('close', function () {
            console.log("Connection closed by remote peer.");
            isConnected = false;
            conn = null;
            updateNoPeerMessage();
        });
        conn.on('error', function (err) {
            console.error("Connection error:", err);
            isConnected = false;
            conn = null;
            updateNoPeerMessage();
        });
    });
}

function updateNoPeerMessage() {
    if (isConnected || currentPeerId) {
        noPeerMessageDiv.style.display = 'none';
    } else {
        noPeerMessageDiv.style.display = 'block';
    }
}

// --- Message Handling Functions ---
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
            appendMessage(data.content, 'incoming', true);
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
            appendMessage(base64Image, 'outgoing', true);
            imageInput.value = '';
        }
        reader.readAsDataURL(imageFile);
    }
});

addContactBtn.addEventListener('click', function () {
    const newContactId = newContactIdInput.value.trim();

    if (newContactId && /^AMC-\d{4}-[A-Za-z0-9]{3}-\d{4}$/.test(newContactId)) {
        // Prompt for display name:
        const displayName = prompt("Enter display name for this contact:");
        if (displayName) {
            const newContact = { peerId: newContactId, displayName: displayName };

            // Get existing contacts, add the new one, and save
            const contacts = getContacts();
            contacts.push(newContact);
            saveContacts(contacts);

            addContactToList(newContact);  // Add to the UI

            newContactIdInput.value = ''; // Clear the input
        }
    } else {
        alert("Invalid Peer ID format. Use AMC-1234-AbC-5678 format.");
    }
});

// --- Initialization ---
function loadInitialContacts() {
    const contacts = getContacts();
    contacts.forEach(addContactToList);
}

initializePeer();
loadInitialContacts();
