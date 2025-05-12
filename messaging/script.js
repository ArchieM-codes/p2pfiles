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
let sharedSecret = null;  // Shared secret after DHKE

// RSA Keypair for initial key exchange
let publicKey = null;
let privateKey = null;

// Initialization function
function initialize() {
    const crypt = new JSEncrypt({default_key_size: 2048});
    crypt.getKey();
    publicKey = crypt.getPublicKey();
    privateKey = crypt.getPrivateKey();
}

function getPublicKey() {
    return publicKey;
}

//Load after page loads
window.onload = function () {
    initialize();
    peer = new Peer();

    peer.on('open', function (id) {
        console.log('My peer ID is: ' + id);
        myPeerIdDiv.innerText = 'My Peer ID: ' + id;
    });

    peer.on('connection', function (connection) {
        conn = connection;
        console.log('Received connection from: ' + conn.peer);
        appendMessage('Connected!', 'incoming');
        isConnected = true;

        // Send public key upon connection
        sendPublicKey(conn);

        conn.on('data', function (data) {
            handleData(data, false);  // False indicates message is incoming
        });

        conn.on('close', function () {
            appendMessage('Connection closed', 'incoming');
            isConnected = false;
            sharedSecret = null; // Reset shared secret
        });

        conn.on('error', function (err) {
            console.error(err);
            appendMessage('Error: ' + err, 'incoming');
            isConnected = false;
        });
    });

    peer.on('disconnected', function () {
        console.log('Disconnected from PeerServer');
        isConnected = false;
    });

    peer.on('close', function () {
        console.log('Peer closed');
        isConnected = false;
    });

    peer.on('error', function (err) {
        console.error(err);
        alert("An error occurred: " + err);
        isConnected = false;
    });

    connectButton.addEventListener('click', function () {
        const remotePeerId = remotePeerIdInput.value;
        connectToPeer(remotePeerId);
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
        } else {
            appendMessage("Error: Please select a file.", "error");
        }
    });

    messageInput.addEventListener('input', function () {
        if (!isConnected || !conn) return;

        if (messageInput.value.trim() !== "" && !isTyping) {
            conn.send({typing: true});
            isTyping = true;
        } else if (messageInput.value.trim() === "" && isTyping) {
            conn.send({typing: false});
            isTyping = false;
        }
    });

    peer.on('connection', function (connection) {
        connection.on('data', function (data) {
            if (data.typing === true) {
                setTypingIndicator(true);
            } else if (data.typing === false) {
                setTypingIndicator(false);
            }
        });
    });
};
