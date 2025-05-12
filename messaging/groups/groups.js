const groupIdInput = document.getElementById('group-id-input');
const createGroupBtn = document.getElementById('create-group-btn');
const joinGroupBtn = document.getElementById('join-group-btn');
const memberList = document.getElementById('member-list');
const targetUserId = document.getElementById('target-user-id');
const assignAdminBtn = document.getElementById('assign-admin-btn');
const kickUserBtn = document.getElementById('kick-user-btn');
const banUserBtn = document.getElementById('ban-user-btn');
const groupMessages = document.getElementById('group-messages');
const groupMessageInput = document.getElementById('group-message-input');
const sendGroupMessageBtn = document.getElementById('send-group-message-btn');
const groupMyPeerId = document.getElementById('group-my-peer-id');

let peer = null;
let peerGroupInstance = null; // To store the PeerGroup instance
let myUserID = null; // Store the current user's ID

function generatePeerId() {
    const randomNumber1 = Math.floor(1000 + Math.random() * 9000);
    const randomLetters = Array.from({ length: 3 }, () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        return chars.charAt(Math.floor(Math.random() * chars.length));
    }).join('');
    const randomNumber2 = Math.floor(1000 + Math.random() * 9000);
    return `AMCG-${randomNumber1}-${randomLetters}-${randomNumber2}`;
}

async function getOrCreatePeerId() {
    //This will need to be moved to the group chat
    let peerId = localStorage.getItem('groupPeerId') || null;

    if (!peerId) {
        peerId = generatePeerId();
        localStorage.setItem('groupPeerId', peerId);
    }

    return peerId;
}

function appendGroupMessage(message, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.textContent = `${sender}: ${message}`;
    groupMessages.appendChild(messageDiv);
}

// Function to handle messages within the group
const handleGroupMessage = (e) => {
    console.log(e)
    appendGroupMessage(e.message, e.userID);
};

// Initialize or connect to a PeerGroup, depending on whether one already exists
async function initializePeerGroup(groupId) {
    if (peerGroupInstance) {
        peerGroupInstance.removeEventListener("message", handleGroupMessage);
        peerGroupInstance.disconnect(); // Disconnect from any existing group
    }

    //Now that the peer is connected, join the group
    peerGroupInstance = new PeerGroup(peer);

    peerGroupInstance.addEventListener("message", handleGroupMessage);

    peerGroupInstance.connect(groupId, peer.id);
}

// Event listeners for group related actions
createGroupBtn.addEventListener('click', async () => {
    const groupId = groupIdInput.value;
    if (!groupId) {
        alert("Please enter a group ID.");
        return;
    }

    initializePeerGroup(groupId);
});

joinGroupBtn.addEventListener('click', async () => {
    const groupId = groupIdInput.value;
    if (!groupId) {
        alert("Please enter a group ID.");
        return;
    }

    initializePeerGroup(groupId);
});

// Event listener for sending group messages
sendGroupMessageBtn.addEventListener('click', () => {
    const message = groupMessageInput.value;
    if (message && peerGroupInstance) {
        peerGroupInstance.send(message);
        appendGroupMessage(message, 'Me'); // Append sent message
        groupMessageInput.value = ''; // Clear input
    }
});

// Run when the window is ready
window.onload = async function () {
    //Initialize the peer
    const peerId = await getOrCreatePeerId();
    groupMyPeerId.innerText = peerId;
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
                username: "vXp0ehXgRlCJeYdQBR4hjAdVn42ttLfds4jTAVrRmD5RTceXb9qp-sCf1PEw5eWiAAAAAGggndthcmchiemtvc",
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
        myUserID = id;
    });
};
