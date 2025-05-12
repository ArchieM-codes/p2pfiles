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

//Sanatize string
function sanitize(text) {
    return DOMPurify.sanitize(text); // Use DOMPurify
}

//Append Message to the message box
function appendMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', type);
    messageDiv.innerHTML = message;
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

//All messages are being encrypted by this function
function encryptMessage(message) {
    if (!sharedSecret) {
        console.error("Cannot encrypt: No shared secret established.");
        appendMessage("Error: Cannot send message. Secure connection not established.", "error");
        return null;
    }
    return CryptoJS.AES.encrypt(message, sharedSecret).toString();
}

//All messages are being decrypted by this function
function decryptMessage(encryptedMessage) {
    if (!sharedSecret) {
        console.error("Cannot decrypt: No shared secret established.");
        appendMessage("Error: Cannot read message. Secure connection not established.", "error");
        return null;
    }
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedMessage, sharedSecret);
        return bytes.toString(CryptoJS.enc.Utf8);
    } catch (e) {
        console.error("Decryption error:", e);
        return null;
    }
}

//Function for generating AES key
function generateAESKey() {
    let key = CryptoJS.lib.WordArray.random(32).toString();  // 256 bits
    return key;
}

//Main message send function. Encrypts, sets status and sends the encrypted data
function sendMessage(message) {
    if (!isConnected || !conn || !sharedSecret) {
        console.warn("Not connected or secure connection not established. Message dropped.");
        appendMessage("Error: Not connected or secure connection not established. Please connect and establish a secure connection.", "error");
        return;
    }

    const sanitizedMessage = sanitize(message);
    const encryptedMessage = encryptMessage(sanitizedMessage);

    if (!encryptedMessage) return; //If encryptMessage has a problem, it will return null

    try {
        conn.send(encryptedMessage);
        appendMessage(sanitizedMessage, 'outgoing');
        messageInput.value = '';
        setMessageStatus("Message sent!");
        setTimeout(() => setMessageStatus(""), 3000); // Clear after 3 seconds
    } catch (err) {
        console.error("Send error:", err);
        appendMessage("Error: Message failed to send.", "error");
        isConnected = false;
        sharedSecret = null; // Invalidate shared secret on error
    }
}

//All files are sent by this function
function sendFile(file) {
    if (!isConnected || !conn || !sharedSecret) {
        console.warn("Not connected or secure connection not established.  File send aborted.");
        appendMessage("Error: Not connected or secure connection not established. Please connect and establish a secure connection to send files.", "error");
        return;
    }

    const fileReader = new FileReader();

    fileReader.onload = function (event) {
        const arrayBuffer = event.target.result;

        try {
            conn.send({
                file: true,
                name: file.name,
                type: file.type,
                data: arrayBuffer
            });
            appendMessage(`Sending file: ${file.name}`, 'outgoing');
            setMessageStatus("File sent!");
            setTimeout(() => setMessageStatus(""), 3000);
        } catch (err) {
            console.error("File send error:", err);
            appendMessage("Error: File failed to send.", "error");
            isConnected = false;
            sharedSecret = null; //Invalidate secret key
        }
    };

    fileReader.onerror = function (error) {
        console.error("FileReader error:", error);
        appendMessage("Error reading file.", "error");
    };

    fileReader.readAsArrayBuffer(file);
}

//Handle incoming file data
function handleFileData(data) {
    const fileName = sanitize(data.name);
    const fileType = sanitize(data.type);

    const blob = new Blob([data.data], {type: fileType});
    const url = URL.createObjectURL(blob);

    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = fileName;
    downloadLink.innerText = `Received file: ${fileName} (${fileType})`;

    appendMessage(downloadLink.outerHTML, 'incoming');

    downloadLink.onload = function () {
        URL.revokeObjectURL(url);
    };
}

//Set 'is typing' text field
function setTypingIndicator(isTyping) {
    typingIndicator.innerText = isTyping ? "Peer is typing..." : "";
}

//Set messag status
function setMessageStatus(status) {
    messageStatus.innerText = status;
}

// Function to perform key exchange
function performKeyExchange(encryptedSecret) {
    let crypt = new JSEncrypt();
    crypt.setPrivateKey(privateKey);
    try {
        let secret = crypt.decrypt(encryptedSecret);

        if (secret) {
            sharedSecret = secret;
            console.log("Shared Secret Established:", sharedSecret);
            appendMessage("Secure Connection Established!", "status");

        } else {
            console.error("Failed to decrypt shared secret.");
            appendMessage("Error: Secure connection failed.", "error");
        }
    } catch (err) {
        console.error("Decryption error during key exchange:", err);
        appendMessage("Error: Secure connection failed.", "error");
    }
}

// Function to send public key to the remote peer
function sendPublicKey(connection) {
    if (publicKey) {
        connection.send({publicKey: publicKey});
    }
}

// Main data handler
function handleData(data, isOutgoing) {
    if (data.publicKey) {
        //Recieved public key -> now calculate shared secret, encrypt and send to the other peer
        console.log("Received public key, starting key exchange...");
        let otherPublicKey = data.publicKey;

        //Generate key for AES, encrypt it and send back
        let aesKey = generateAESKey();

        let crypt = new JSEncrypt();
        crypt.setPublicKey(otherPublicKey);
        let encryptedKey = crypt.encrypt(aesKey);

        conn.send({encryptedSecret: encryptedKey});
    } else if (data.encryptedSecret) {
        //If data is the encrypted aes key, decrypt it with your own private key
        console.log("Performing key exchange...");
        performKeyExchange(data.encryptedSecret);
    } else if (typeof data === 'string') {
        //If the data is a string, decrypt and display it
        const decryptedMessage = decryptMessage(data);
        if (decryptedMessage) {
            const sanitizedMessage = sanitize(decryptedMessage);
            appendMessage(sanitizedMessage, 'incoming');
        } else {
            appendMessage("Error: Failed to decrypt message.", "error");
        }
    } else if (data.file) {
        // Handle file data
        handleFileData(data);
    } else if (data.typing === true) {
        setTypingIndicator(true);
    } else if (data.typing === false) {
        setTypingIndicator(false);
    }
}

// Function for creating connection to peer
function connectToPeer(remotePeerId) {
    if (conn && conn.open) {
        console.log("Already connected.  Closing old connection.");
        conn.close();
    }
    conn = peer.connect(remotePeerId, {reliable: true});

    conn.on('open', function () {
        console.log("Connected to: " + remotePeerId);
        appendMessage('Connected!', 'outgoing');
        isConnected = true;

        //Send public key after making a new connection
        sendPublicKey(conn);
    });

    conn.on('data', function (data) {
        handleData(data, true);  // True indicates message is outgoing
    });

    conn.on('close', function () {
        appendMessage('Connection closed', 'outgoing');
        isConnected = false;
        sharedSecret = null; // Reset shared secret
    });

    conn.on('error', function (err) {
        console.error("Connection error:", err);
        appendMessage('Error: ' + err, 'outgoing');
        isConnected = false;
    });
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
