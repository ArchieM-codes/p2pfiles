const peer = new Peer(null, {
    host: '0.peerjs.com',
    port: 443,
    secure: true,
    config: {
        iceServers: [
            { urls: ["stun:eu-turn4.xirsys.com"] },
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
        ]
    }
});

const peerIdElem = document.getElementById("peer-id");
const remoteIdInput = document.getElementById("remote-id");
const connectBtn = document.getElementById("connect-btn");
const fileInput = document.getElementById("file-input");
const sendBtn = document.getElementById("send-btn");
const statusElem = document.getElementById("status");
const progressBar = document.getElementById("progress-bar");
let conn;

peer.on("open", id => {
    peerIdElem.textContent = id;
});

connectBtn.addEventListener("click", () => {
    const remoteId = remoteIdInput.value;
    conn = peer.connect(remoteId);
    setupConnection(conn);
});

peer.on("connection", connection => {
    conn = connection;
    setupConnection(conn);
});

function setupConnection(conn) {
    statusElem.textContent = "Connected to: " + conn.peer;
    document.getElementById("file-transfer").style.display = "block";

    conn.on("data", data => {
        const blob = new Blob([data]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "received_file";
        a.textContent = "Download File";
        document.body.appendChild(a);
    });
}

sendBtn.addEventListener("click", () => {
    const file = fileInput.files[0];
    if (!file || !conn) return;

    const chunkSize = 64 * 1024;
    let offset = 0;

    function sendChunk() {
        const reader = new FileReader();
        const slice = file.slice(offset, offset + chunkSize);
        reader.onload = e => {
            conn.send(e.target.result);
            offset += chunkSize;
            progressBar.value = (offset / file.size) * 100;
            if (offset < file.size) {
                sendChunk();
            } else {
                statusElem.textContent = "File sent!";
            }
        };
        reader.readAsArrayBuffer(slice);
    }

    statusElem.textContent = "Sending file...";
    sendChunk();
});
