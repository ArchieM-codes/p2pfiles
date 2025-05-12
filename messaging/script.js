// script.js

// UI elements
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
            type: file.type,
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
    if (data.type === 'chat') {
        appendMessage(data.message, 'incoming');
    } else if (data.type === 'file') {
        const fileName = DOMPurify.sanitize(data.name);
        const fileType = DOMPurify.sanitize(data.type);

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
    }
}

window.onload = function () {
    peer = new Peer();

    peer.on('open', function (id) {
        myPeerIdDiv.innerText = 'My Peer ID: ' + id;
    });

    peer.on('connection', function (connection) {
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
