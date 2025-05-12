// script.js

// UI elements (same as before)
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
    conn.send({type: 'chat', message: sanitizedMessage});
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
        conn.send({
            type: 'file',
            name: file.name,
            fileType: file.type,
            data: event.target.result
        });
        appendMessage(`Sending file: ${file.name}`, 'outgoing');
    };

    fileReader.onerror = function (error) {
        alert("Error reading file.");
    };

    fileReader.readAsArrayBuffer(file);
}

function handleData(data) {
    console.log("Received data:", data);  // Log EVERYTHING
    console.log("Type of data:", typeof data);  // Check its type

    if (typeof data === 'object' && data !== null) {
        if (data.type === 'chat') {
            appendMessage(DOMPurify.sanitize(data.message), 'incoming');
        } else if (data.type === 'file') {
            const fileName = DOMPurify.sanitize(data.name);
            const fileType = DOMPurify.sanitize(data.fileType);

            const blob = new Blob([data.data], {type: fileType});
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

window.onload = function () {
    peer = new Peer();

    peer.on('open', function (id) {
        console.log("Peer object on 'open':", peer);  // Log Peer Object
        myPeerIdDiv.innerText = 'My Peer ID: ' + id;
    });

    peer.on('connection', function (connection) {
        console.log("Incoming connection:", connection);  // Log Connection Object
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

        conn.on('open', function() {
            console.log("Connection 'open' event fired"); // Log 'open' event
            conn.send({type: 'chat', message: 'TEST MESSAGE - connection established!'});
        });
    });

    connectButton.addEventListener('click', function () {
        const remotePeerId = remotePeerIdInput.value;
        conn = peer.connect(remotePeerId, {reliable: true});
        isConnected = true;
        appendMessage('Connected!', 'outgoing');

        conn.on('data', function (data) {
            handleData(data);
        });

        conn.on('close', function () {
            isConnected = false;
            appendMessage('Connection closed', 'outgoing');
        });
        conn.on('open', function() {
            console.log("Connection 'open' event fired"); // Log 'open' event
            conn.send({type: 'chat', message: 'TEST MESSAGE - connection established!'});
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
            conn.send({type: 'typing', isTyping: isTypingNow});
            isTyping = isTypingNow;
        }
    });
};
