const myPeerIdDiv = document.getElementById('myPeerId');
const remotePeerIdInput = document.getElementById('remotePeerId');
const connectButton = document.getElementById('connectButton');
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');

let peer = null; // Declare peer outside the scope of the event listener
let conn = null; // Declare conn outside the scope of the event listener

function appendMessage(message, type) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', type);
  messageDiv.innerText = message;
  messagesDiv.appendChild(messageDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight; // Scroll to bottom
}


window.onload = function() { // ensures all html is loaded

    peer = new Peer();  // Now peer is accessible

    peer.on('open', function(id) {
      console.log('My peer ID is: ' + id);
      myPeerIdDiv.innerText = 'My Peer ID: ' + id;
    });

    peer.on('connection', function(connection) {
        conn = connection; // store the connection
      console.log('Received connection from: ' + conn.peer);
      appendMessage('Connected!', 'incoming');

      conn.on('data', function(data) {
        console.log('Received data: ' + data);
        appendMessage(data, 'incoming');
      });

      conn.on('close', function() {
        appendMessage('Connection closed', 'incoming');
      });

      conn.on('error', function(err) {
          console.error(err);
          appendMessage('Error: ' + err, 'incoming');
      });
    });

    peer.on('error', function(err) {
        console.error(err);
        alert("An error occurred: " + err);
    });

    connectButton.addEventListener('click', function() {
      const remotePeerId = remotePeerIdInput.value;
        conn = peer.connect(remotePeerId);  // Store the connection
      console.log('Connecting to: ' + remotePeerId);

      conn.on('open', function() {
        console.log("Connected to: " + remotePeerId);
        appendMessage('Connected!', 'outgoing');
      });

      conn.on('data', function(data) {
        console.log('Received data: ' + data);
        appendMessage(data, 'incoming');
      });

      conn.on('close', function() {
        appendMessage('Connection closed', 'outgoing');
      });

       conn.on('error', function(err) {
            console.error(err);
            appendMessage('Error: ' + err, 'outgoing');
        });

    });

    sendButton.addEventListener('click', function() {
      const message = messageInput.value;
      if (message.trim() !== '') {
        appendMessage(message, 'outgoing');
        conn.send(message);
        messageInput.value = '';
      }
    });
}
