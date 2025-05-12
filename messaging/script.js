const myPeerIdDiv = document.getElementById('myPeerId');
const remotePeerIdInput = document.getElementById('remotePeerId');
const connectButton = document.getElementById('connectButton');
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const fileInput = document.getElementById('fileInput');
const sendFileButton = document.getElementById('sendFileButton');

let peer = null;
let conn = null;
let isConnected = false; // Track connection status

// Encryption Key (Ideally, negotiate this securely via Diffie-Hellman or similar)
const encryptionKey = "AMT-d4IUU2UZ1Uk53eq4HXbAcyIu0WSjCWsv2tAWF0JVFMQCKcS1N5HOw6TxP9iduilpYr6fTETWW9XrbFiVE2PQvJWomqfd5lER5LVHNDQt7LiebJfNQJ50A6EKJmVpqPtGaORg8uemJu6dSaOzUwPeoo6KwKm1ZsMnz5pDfuNBQ2h2RZtGMDaoFKWAvSkswqypmjbNc5DcteGRYvWzIyNGo51X1XH6aN0FQFkRLjK4RVXPx2rSzpqlTOdHM5nk
"; // MUST BE SECURE AND SHARED

// Sanitization Function (Basic Example - improve as needed)
function sanitize(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Encryption Function (AES) using CryptoJS
function encrypt(message, key) {
  return CryptoJS.AES.encrypt(message, key).toString();
}

// Decryption Function (AES) using CryptoJS
function decrypt(ciphertext, key) {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    console.error("Decryption error:", e);
    return null; // Or handle the error appropriately
  }
}
function appendMessage(message, type) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', type);
  messageDiv.innerHTML = message; // Allow HTML (after sanitization!)
  messagesDiv.appendChild(messageDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function sendMessage(message) {
  if (!isConnected || !conn) {
    console.warn("Not connected.  Message dropped.");
    appendMessage("Error: Not connected. Please connect to a peer.", "error"); //Provide user feedback
    return;
  }

  const sanitizedMessage = sanitize(message);
  const encryptedMessage = encrypt(sanitizedMessage, encryptionKey);

  try {
    conn.send(encryptedMessage);
    appendMessage(sanitizedMessage, 'outgoing'); // Display sanitized, unencrypted message locally
    messageInput.value = '';
  } catch (err) {
    console.error("Send error:", err);
    appendMessage("Error: Message failed to send.", "error"); //User feedback
    isConnected = false; //Consider disconnecting on error
  }
}
function sendFile(file) {
  if (!isConnected || !conn) {
    console.warn("Not connected.  File send aborted.");
    appendMessage("Error: Not connected. Please connect to a peer to send files.", "error");
    return;
  }

  const fileReader = new FileReader();

  fileReader.onload = function(event) {
    const arrayBuffer = event.target.result;

    try {
      conn.send({
        file: true, // Flag to indicate a file
        name: file.name,
        type: file.type,
        data: arrayBuffer
      });
      appendMessage(`Sending file: ${file.name}`, 'outgoing');
    } catch (err) {
      console.error("File send error:", err);
      appendMessage("Error: File failed to send.", "error");
      isConnected = false;
    }
  };

  fileReader.onerror = function(error) {
    console.error("FileReader error:", error);
    appendMessage("Error reading file.", "error");
  };

  fileReader.readAsArrayBuffer(file); // Read as ArrayBuffer for binary data
}

function handleFileData(data) {
  const fileName = sanitize(data.name);  // Sanitize the filename
  const fileType = sanitize(data.type);  // Sanitize file type

  const blob = new Blob([data.data], { type: fileType });
  const url = URL.createObjectURL(blob);

  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = fileName;
  downloadLink.innerText = `Received file: ${fileName} (${fileType})`;

  appendMessage(downloadLink.outerHTML, 'incoming'); // Use outerHTML to append the whole link

  // Clean up the URL object after appending to the DOM (optional)
  downloadLink.onload = function() {
    URL.revokeObjectURL(url);
  };
}
window.onload = function() {

    peer = new Peer();

    peer.on('open', function(id) {
      console.log('My peer ID is: ' + id);
      myPeerIdDiv.innerText = 'My Peer ID: ' + id;
    });

    peer.on('connection', function(connection) {
        conn = connection;
      console.log('Received connection from: ' + conn.peer);
      appendMessage('Connected!', 'incoming');
      isConnected = true; // Set connection status

      conn.on('data', function(data) {
        if (typeof data === 'string') {
          //Handle text message
          const decryptedMessage = decrypt(data, encryptionKey);
          if (decryptedMessage) {
            const sanitizedMessage = sanitize(decryptedMessage);
            appendMessage(sanitizedMessage, 'incoming');
          } else {
            appendMessage("Error: Failed to decrypt message.", "error");
          }
        } else if (data.file) {
          // Handle file data
          handleFileData(data);
        }
      });

      conn.on('close', function() {
        appendMessage('Connection closed', 'incoming');
        isConnected = false;
      });

      conn.on('error', function(err) {
          console.error(err);
          appendMessage('Error: ' + err, 'incoming');
          isConnected = false;
      });
    });

    peer.on('disconnected', function() {
      console.log('Disconnected from PeerServer');
      isConnected = false;
    });

    peer.on('close', function() {
      console.log('Peer closed');
      isConnected = false;
    });


    peer.on('error', function(err) {
        console.error(err);
        alert("An error occurred: " + err);
        isConnected = false;
    });


    connectButton.addEventListener('click', function() {
      const remotePeerId = remotePeerIdInput.value;
      connectToPeer(remotePeerId);
    });

    sendButton.addEventListener('click', function() {
      const message = messageInput.value;
      if (message.trim() !== '') {
        sendMessage(message);
      }
    });

   sendFileButton.addEventListener('click', function() {
      const file = fileInput.files[0];
      if (file) {
        sendFile(file);
      } else {
          appendMessage("Error: Please select a file.", "error");
      }
    });
}
function connectToPeer(remotePeerId) {
  if (conn && conn.open) {
    console.log("Already connected.  Closing old connection.");
    conn.close(); //Close existing connection before making new one
  }
  conn = peer.connect(remotePeerId, {reliable: true}); // Enable reliable connections

  conn.on('open', function() {
    console.log("Connected to: " + remotePeerId);
    appendMessage('Connected!', 'outgoing');
    isConnected = true;
  });

  conn.on('data', function(data) {
    if (typeof data === 'string') {
      const decryptedMessage = decrypt(data, encryptionKey);
        if (decryptedMessage) {
          const sanitizedMessage = sanitize(decryptedMessage);
          appendMessage(sanitizedMessage, 'incoming');
        } else {
          appendMessage("Error: Failed to decrypt message.", "error");
        }
    } else if (data.file) {
      handleFileData(data);
    }
  });

  conn.on('close', function() {
    appendMessage('Connection closed', 'outgoing');
    isConnected = false;
  });

  conn.on('error', function(err) {
    console.error("Connection error:", err);
    appendMessage('Error: ' + err, 'outgoing');
    isConnected = false;
  });
}

