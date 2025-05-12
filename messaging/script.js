// script.js - hhjuh
const myPeerIdDiv = document.getElementById('myPeerId');
const remotePeerIdInput = document.getElementById('remotePeerId');
const connectButton = document.getElementById('connectButton');
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const fileInput = document.getElementById('fileInput');
const sendFileButton = document.getElementById('sendFileButton');
const typingIndicator = document.getElementById('typingIndicator');

let peer = null;
let conn = null;
let isConnected = false;
let isTyping = false;
let incomingConnectionEstablished = false; // Flag for single incoming connection

function appendMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', type);

    const timestamp = new Date().toLocaleTimeString();
    messageDiv.innerHTML = `<span class="timestamp">${timestamp}</span> ${message}`;

    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function setTypingIndicator(isTyping) {
    typingIndicator.innerText = isTyping ? "Peer is typing..." : "";
}

function sendMessage(message) {
    if (!isConnected || !conn) {
        alert("Not connected!");
        return;
    }

    const sanitizedMessage = DOMPurify.sanitize(message);
    const data = { type: 'chat', message: sanitizedMessage };
    console.log("Sending data:", data); // Add console log
    conn.send(data);
    appendMessage(sanitizedMessage, 'outgoing');
    messageInput.value = '';
}

function sendFile(file) {
    if (!isConnected || !conn) {
        alert("Not connected!");
        return;
    }

    const fileReader = new FileReader();

    fileReader.onload = function (event) {
        const data = {
            type: 'file',
            name: file.name,
            fileType: file.type,
            data: event.target.result
        };
        console.log("Sending data:", data); // Add console log
        conn.send(data);
        appendMessage(`Sending file: ${file.name}`, 'outgoing');
    };

    fileReader.onerror = function (error) {
        alert("Error reading file.");
    };

    fileReader.readAsArrayBuffer(file);
}

function handleData(data) {
    console.log("Received data:", data);
    console.log("Type of data:", typeof data);

    if (typeof data === 'object' && data !== null) {
        if (data.type === 'chat') {
            appendMessage(DOMPurify.sanitize(data.message), 'incoming');
        } else if (data.type === 'file') {
            const fileName = DOMPurify.sanitize(data.name);
            const fileType = DOMPurify.sanitize(data.fileType);

            const blob = new Blob([data.data], { type: fileType });
            const url = URL.createObjectURL(blob);

            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = fileName;
            downloadLink.innerText = `Received file: ${fileName}`;

            appendMessage(downloadLink.outerHTML, 'incoming');

            downloadLink.onload = function () {
                URL.revokeObjectURL(url);
            };
        } else if (data.type === 'typing') {
            setTypingIndicator(data.isTyping);
        } else {
            console.warn("Unknown data type:", data);
        }
    } else {
        console.warn("Received non-object data:", data);
    }
}

function resetConnection() {
    isConnected = false;
    isTyping = false;
    conn = null;
    incomingConnectionEstablished = false;
}

window.onload = function () {
    peer = new Peer();

    peer.on('open', function (id) {
        console.log("Peer object on 'open':", peer);
        myPeerIdDiv.innerText = 'My Peer ID: ' + id;
    });

    peer.on('connection', function (connection) {
        if (incomingConnectionEstablished) {
            console.warn("Ignoring duplicate incoming connection");
            connection.close();
            return;
        }
        incomingConnectionEstablished = true;

        console.log("Incoming connection:", connection);
        conn = connection;
        isConnected = true;
        appendMessage('Connected!', 'incoming');

        conn.on('data', function (data) {
            handleData(data);
        });

        conn.on('close', function () {
            console.log("Connection closed by peer:", connection.peer); // Debug log
            appendMessage('Connection closed', 'incoming');
            resetConnection(); // Reset all flags
        });

        conn.on('open', function () {
            console.log("Connection 'open' event fired");
            conn.send({ type: 'chat', message: 'TEST MESSAGE - connection established!' });
        });
    });

    connectButton.addEventListener('click', function () {
        const remotePeerId = remotePeerIdInput.value;

        // Close the existing connection if any
        if (conn) {
            console.log("Closing existing connection to:", conn.peer); // Debug log
            conn.close();
        }

        // Reset flag before connecting
        incomingConnectionEstablished = false;

        conn = peer.connect(remotePeerId, { reliable: true });
        isConnected = true;
        appendMessage('Connected!', 'outgoing');

        conn.on('data', function (data) {
            handleData(data);
        });

        conn.on('close', function () {
            console.log("Connection closed by peer:", remotePeerId); // Debug log
            appendMessage('Connection closed', 'outgoing');
            resetConnection(); // Reset all flags
        });
        conn.on('open', function () {
            console.log("Connection 'open' event fired");
            conn.send({ type: 'chat', message: 'TEST MESSAGE - connection established!' });
        });
    });

    sendButton.addEventListener('click', function () {
        const message = messageInput.value;
        if (message.trim() !== '') {
            sendMessage(message);
        }
    });

    sendFileButton.addEventListener('click', function () {
        const file = fileInput.files[0];
        if (file) {
            sendFile(file);
        }
    });

    messageInput.addEventListener('input', function () {
        if (!isConnected || !conn) return;

        const isTypingNow = messageInput.value.trim() !== "";
        if (isTypingNow !== isTyping) {
            conn.send({ type: 'typing', isTyping: isTypingNow });
            isTyping = isTypingNow;
        }
    });
};
