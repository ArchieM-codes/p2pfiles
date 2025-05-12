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

async function getOrCreatePeerId() {
    //This will need to be moved to the group chat
    let peerId = localStorage.getItem('groupPeerId') || null;

    if (!peerId) {
        peerId = generatePeerId();
        localStorage.setItem('groupPeerId', peerId);
    }

    return peerId;
}

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

function appendGroupMessage(message, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.textContent = `${sender}: ${message}`;
    groupMessages.appendChild(messageDiv);
}

const handleGroupMessage = (e) => {
    appendGroupMessage(e.message, e.userID);
};

async function initializePeerGroup(groupId) {
    //Initialize the peer and then run other functions
    const peerId = await getOrCreatePeerId();
    groupMyPeerId.innerText = peerId;

    peer = new Peer(peerId, peerConfig);

    peer.on('open', function (id) {
        console.log("Peer object on 'open':", peer);
        myUserID = id;

        if (peerGroupInstance) {
            peerGroupInstance.removeEventListener("message", handleGroupMessage);
            peerGroupInstance.disconnect();
        }

        //Now that the peer is connected, join the group
        peerGroupInstance = new PeerGroup(peer);

        peerGroupInstance.addEventListener("message", handleGroupMessage);

        peerGroupInstance.connect(groupId, peer.id);
    });

    peer.on('error', function (err) {
        console.error("PeerJS error:", err);
    });
}

// Event listeners for group related actions
createGroupBtn.addEventListener('click', async () => {
    const groupId = groupIdInput.value;
    if (!groupId) {
        alert("Please enter a group ID.");
        return;
    }
    await initializePeerGroup(groupId);
});

joinGroupBtn.addEventListener('click', async () => {
    const groupId = groupIdInput.value;
    if (!groupId) {
        alert("Please enter a group ID.");
        return;
    }
    await initializePeerGroup(groupId);
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

document.addEventListener('DOMContentLoaded', async function () {
    //Get the id then append to the page
    const peerId = await getOrCreatePeerId();
    groupMyPeerId.innerText = peerId;
});
