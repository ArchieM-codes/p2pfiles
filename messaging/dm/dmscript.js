const dmMessagesDiv = document.getElementById('dm-messages');
const dmMessageInput = document.getElementById('dmMessageInput');
const dmSendButton = document.getElementById('dmSendButton');

let peer = null;
let dmConn = null; // Connection for Direct Messages
let targetPeerId = null; // Peer ID to connect to

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

function appendDMMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', type);

    const timestamp = new Date().toLocaleTimeString();
    messageDiv.innerHTML = `<span class="timestamp">${timestamp}</span> ${message}`;

    dmMessagesDiv.appendChild(messageDiv);
    dmMessagesDiv.scrollTop = dmMessagesDiv.scrollHeight;
}

function sendDirectMessage(message) {
    if (!dmConn) {
        alert("Not connected to peer. Please enter a Peer ID and connect.");
        return;
    }
    const sanitizedMessage = DOMPurify.sanitize(message);
    const encodedMessage = encodeUTF8(sanitizedMessage);

    dmConn.send({ type: 'chat', message: encodedMessage });
    appendDMMessage(sanitizedMessage, 'outgoing');
    dmMessageInput.value = '';
}

function handleDMData(data) {
    console.log("Received DM data:", data);

    if (typeof data === 'object' && data !== null) {
        if (data.type === 'chat') {
            const decodedMessage = decodeUTF8(data.message);
            appendDMMessage(DOMPurify.sanitize(decodedMessage), 'incoming');
        } else {
            console.warn("Unknown data type:", data);
        }
    } else {
        console.warn("Received non-object data:", data);
    }
}

function connectToPeer(peerId) {
    targetPeerId = peerId; // Set the target Peer ID

    if (dmConn) {
        dmConn.close();
    }

    dmConn = peer.connect(peerId, { reliable: true });

    dmConn.on('open', function () {
        console.log("Connected to:", peerId);
        appendDMMessage('Connected!', 'incoming');
    });

    dmConn.on('data', function (data) {
        handleDMData(data);
    });

    dmConn.on('close', function () {
        console.log("DM connection closed with: ", peerId);
        appendDMMessage('Connection closed', 'incoming');
        dmConn = null;
    });

    dmConn.on('error', function (err) {
        console.error("DM connection error:", err);
        alert("DM connection error. Check console for details.");
    });
}

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
        // Prompt for Peer ID on DM Page load
        targetPeerId = prompt("Enter Peer ID to DM:");
        if (target
