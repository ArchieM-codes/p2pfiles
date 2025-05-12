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
const messageStatus = document.getElementById('messageStatus');

let peer = null;
let conn = null;
let isConnected = false;
let isTyping = false;

// Handshake state
let isInitiator = false;
let remotePublicKey = null;
let sharedSecret = null;

// RSA keys for key-exchange
let publicKey, privateKey;

function initialize() {
    const crypt = new JSEncrypt({default_key_size: 2048});
    crypt.getKey();
    publicKey = crypt.getPublicKey();
    privateKey = crypt.getPrivateKey();
    console.log("RSA keypair ready.");
}

function sanitize(text) {
    return DOMPurify.sanitize(text);
}

function appendMessage(html, type) {
    const d = document.createElement('div');
    d.classList.add('message', type);
    d.innerHTML = html;
    messagesDiv.appendChild(d);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function setMessageStatus(s) {
    messageStatus.innerText = s;
}

function setTypingIndicator(flag) {
    typingIndicator.innerText = flag ? "Peer is typing…" : "";
}

function generateAESKey() {
    return CryptoJS.lib.WordArray.random(32).toString(); // 256-bit
}

function encryptMessage(plain) {
    if (!sharedSecret) return null;
    return CryptoJS.AES.encrypt(plain, sharedSecret).toString();
}

function decryptMessage(cipher) {
    if (!sharedSecret) return null;
    try {
        const bytes = CryptoJS.AES.decrypt(cipher, sharedSecret);
        return bytes.toString(CryptoJS.enc.Utf8) || null;
    } catch {
        return null;
    }
}

// QUEUE any chat/file/typing until handshake done
const outboundQueue = [];

function flushQueue() {
    while (sharedSecret && outboundQueue.length) {
        const item = outboundQueue.shift();
        conn.send(item);
    }
}

// SEND helpers
function sendEncrypted(data) {
    if (!sharedSecret) {
        outboundQueue.push(data);
    } else {
        conn.send(data);
    }
}

function sendMessage(text) {
    if (!isConnected) {
        appendMessage("Error: Not connected.", "error");
        return;
    }
    const sanitized = sanitize(text);
    const cipher = encryptMessage(sanitized);
    if (!cipher) {
        appendMessage("Error: Secure connection not established.", "error");
        return;
    }
    conn.send(cipher);
    appendMessage(sanitized, 'outgoing');
    messageInput.value = '';
    setMessageStatus("Message sent");
    setTimeout(() => setMessageStatus(""), 3000);
}

function sendFile(file) {
    if (!isConnected) {
        appendMessage("Error: Not connected.", "error");
        return;
    }
    if (!sharedSecret) {
        appendMessage("Error: Secure connection not established.", "error");
        return;
    }

    const reader = new FileReader();
    reader.onload = e => {
        conn.send({
            file: true,
            name: file.name,
            type: file.type,
            data: e.target.result
        });
        appendMessage(`Sending file: ${file.name}`, 'outgoing');
        setMessageStatus("File sent");
        setTimeout(() => setMessageStatus(""), 3000);
    };
    reader.onerror = () => appendMessage("Error reading file.", "error");
    reader.readAsArrayBuffer(file);
}

// HANDLER
function handleData(data) {
    // 1) PUBLIC KEY arrival
    if (data.publicKey) {
        console.log("▶️ Received PUBLIC KEY");
        remotePublicKey = data.publicKey;

        if (isInitiator && !sharedSecret) {
            // Initiator now generates AES key, sends encryptedSecret, and sets sharedSecret
            const aesKey = generateAESKey();
            sharedSecret = aesKey;
            console.log("🔐 [Initiator] Generated AES key:", aesKey);

            const enc = new JSEncrypt();
            enc.setPublicKey(remotePublicKey);
            const encryptedSecret = enc.encrypt(aesKey);

            conn.send({encryptedSecret});
            appendMessage("Secure Connection Established!", "status");
            console.log("▶️ Sent ENCRYPTED SECRET to peer");
            flushQueue();
        }
        return;
    }

    // 2) ENCRYPTED SECRET arrival
    if (data.encryptedSecret) {
        console.log("▶️ Received ENCRYPTED SECRET");
        const dec = new JSEncrypt();
        dec.setPrivateKey(privateKey);

        const aesKey = dec.decrypt(data.encryptedSecret);
        if (aesKey) {
            sharedSecret = aesKey;
            console.log("🔐 [Receiver] Decrypted AES key:", aesKey);
            appendMessage("Secure Connection Established!", "status");
            flushQueue();
        } else {
            console.error("Failed to decrypt shared secret");
            appendMessage("Error: Secure connection failed.", "error");
        }
        return;
    }

    // 3) Everything else must wait for sharedSecret
    if (!sharedSecret) {
        // block chat/file until secure
        if (data.typing) {
            // you could queue typing if you want
        } else {
            appendMessage("Error: Cannot read message. Secure connection not established.", "error");
        }
        return;
    }

    // 4) CHAT TEXT
    if (typeof data === 'string') {
        const txt = decryptMessage(data);
        if (txt) {
            appendMessage(sanitize(txt), 'incoming');
        } else {
            appendMessage("Error: Failed to decrypt message.", "error");
        }
        return;
    }

    // 5) FILE
    if (data.file) {
        const name = sanitize(data.name);
        const type = sanitize(data.type);
        const blob = new Blob([data.data], {type});
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.innerText = `Received file: ${name} (${type})`;
        appendMessage(a.outerHTML, 'incoming');

        a.onload = () => URL.revokeObjectURL(url);
        return;
    }

    // 6) TYPING
    if (data.typing === true || data.typing === false) {
        setTypingIndicator(data.typing);
        return;
    }
}

// KEY-EXCHANGE: send our publicKey
function sendPublicKey() {
    conn.send({publicKey});
    console.log("▶️ Sent PUBLIC KEY");
}

// CONNECT logic
function connectToPeer(remoteId) {
    if (conn && conn.open) conn.close();

    isInitiator = true;
    remotePublicKey = null;
    sharedSecret = null;
    outboundQueue.length = 0;

    conn = peer.connect(remoteId, {reliable: true});
    conn.on('open', () => {
        console.log("📡 Connected to:", remoteId);
        appendMessage("Connected!", 'outgoing');
        isConnected = true;
        sendPublicKey();
    });

    conn.on('data', handleData);
    conn.on('close', () => {
        console.log("Connection closed");
        appendMessage("Connection closed", 'outgoing');
        resetConnection();
    });
    conn.on('error', err => {
        console.error("Connection error:", err);
        appendMessage("Error: " + err, 'error');
        resetConnection();
    });
}

function resetConnection() {
    isConnected = false;
    sharedSecret = null;
    remotePublicKey = null;
    isInitiator = false;
    outboundQueue.length = 0;
}

// PAGE LOAD
window.onload = () => {
    initialize();

    // use static STUN/TURN
    const iceServers = [
        {urls: ["stun:eu-turn4.xirsys.com"]},
        {
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
        }
    ];

    peer = new Peer(undefined, {
        config: {iceServers}
    });

    peer.on('open', id => {
        console.log("🌐 My peer ID:", id);
        myPeerIdDiv.innerText = "My Peer ID: " + id;
    });

    peer.on('connection', connection => {
        // We’re the *receiver*
        isInitiator = false;
        remotePublicKey = null;
        sharedSecret = null;
        outboundQueue.length = 0;

        conn = connection;
        console.log("📡 Incoming connection from:", conn.peer);
        appendMessage("Connected!", 'incoming');
        isConnected = true;

        sendPublicKey();  // reply with our publicKey

        conn.on('data', handleData);
        conn.on('close', () => {
            console.log("Connection closed");
            appendMessage("Connection closed", 'incoming');
            resetConnection();
        });
        conn.on('error', err => {
            console.error("Connection error:", err);
            appendMessage("Error: " + err, 'error');
            resetConnection();
        });
    });

    // UI hooks
    connectButton.addEventListener('click', () => {
        const rid = remotePeerIdInput.value.trim();
        if (rid) connectToPeer(rid);
    });

    sendButton.addEventListener('click', () => {
        const txt = messageInput.value.trim();
        if (txt) sendMessage(txt);
    });

    sendFileButton.addEventListener('click', () => {
        const f = fileInput.files[0];
        if (f) sendFile(f);
        else appendMessage("Error: Please select a file.", "error");
    });

    messageInput.addEventListener('input', () => {
        if (!isConnected || !conn || !sharedSecret) return;
        const nowTyping = messageInput.value.trim() !== "";
        if (nowTyping && !isTyping) {
            sendEncrypted({typing: true});
            isTyping = true;
        }
        if (!nowTyping && isTyping) {
            sendEncrypted({typing: false});
            isTyping = false;
        }
    });

    peer.on('error', err => {
        console.error("Peer error:", err);
        alert("An error occurred: " + err);
        resetConnection();
    });
};
