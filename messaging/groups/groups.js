// Regex for group ID
const GROUP_ID_REGEX = /^AMCG-\d{5}-[A-Za-z]{2}$/;

let peerId = null;
let peerGroupLib = null;
const groups = {};      // { groupId: { groupObj, password, isAdmin } }
let activeGroupId = null;

// UI elements
const gidIn = document.getElementById('groupIdInput'),
      pwdIn = document.getElementById('groupPasswordInput'),
      createBtn = document.getElementById('createGroupBtn'),
      joinBtn   = document.getElementById('joinGroupBtn'),
      groupsUl  = document.getElementById('groupsUl'),
      chatSec   = document.getElementById('chatSection'),
      currentTitle = document.getElementById('currentGroupTitle'),
      membersUl = document.getElementById('membersUl'),
      messages  = document.getElementById('messages'),
      msgIn     = document.getElementById('messageInput'),
      sendBtn   = document.getElementById('sendMsgBtn');

// Initialize Peer.js Groups
window.onload = () => {
  peerId = 'user-' + Math.random().toString(36).substr(2, 8);
  peerGroupLib = new PeerGroup(err => err && console.error(err), { host: '0.peerjs.com', port: 443, secure: true });

  peerGroupLib.on('joined', info => {
    const { groupId, peerId: pid, creator } = info;
    groups[groupId].isAdmin = creator === peerGroupLib.peer.id;
    refreshUI();
  });

  peerGroupLib.on('peer-list', info => {
    // contains list of all joined peers
    updateMembers(info.groupId, info.peerList);
  });

  peerGroupLib.on('message', info => {
    appendMessage(info.groupId, info.peerId, info.data);
  });

  peerGroupLib.on('user-left', info => {
    removeMember(info.groupId, info.peerId);
  });

  // Button handlers
  createBtn.onclick = () => handleGroup(true);
  joinBtn.onclick   = () => handleGroup(false);
  sendBtn.onclick   = () => {
    const txt = msgIn.value.trim();
    if (!txt || !activeGroupId) return;
    peerGroupLib.message(activeGroupId, { text: txt });
    appendMessage(activeGroupId, 'Me', txt);
    msgIn.value = '';
  };
};

function handleGroup(isCreate) {
  const gid = gidIn.value.trim(), pwd = pwdIn.value;
  if (!GROUP_ID_REGEX.test(gid)) return alert('Invalid Group ID format.');
  if (!pwd) return alert('Password required.');
  if (isCreate && groups[gid]) return alert('Group already exists.');

  if (isCreate) {
    // register password
    groups[gid] = { password: pwd, isAdmin: false };
    peerGroupLib.createGroup(gid, pwd);
  } else {
    if (!groups[gid]) groups[gid] = { password: pwd, isAdmin: false };
    else if (groups[gid].password !== pwd) return alert('Wrong password.');
    peerGroupLib.joinGroup(gid, pwd);
  }
  refreshUI();
}

function refreshUI() {
  groupsUl.innerHTML = '';
  Object.keys(groups).forEach(gid => {
    const li = document.createElement('li');
    li.textContent = gid;
    li.onclick = () => activateGroup(gid);
    groupsUl.appendChild(li);
  });
}

function activateGroup(gid) {
  activeGroupId = gid;
  currentTitle.textContent = 'Group: ' + gid + (groups[gid].isAdmin ? ' (Admin)' : '');
  chatSec.classList.remove('hidden');
  messages.innerHTML = '';
  membersUl.innerHTML = '';
  peerGroupLib.requestPeerList(gid);
}

function updateMembers(gid, list) {
  if (gid !== activeGroupId) return;
  membersUl.innerHTML = '';
  list.forEach(pid => {
    const li = document.createElement('li');
    li.textContent = pid;
    if (groups[gid].isAdmin && pid !== peerGroupLib.peer.id) {
      const btn = document.createElement('button');
      btn.textContent = 'Kick';
      btn.onclick = () => peerGroupLib.ejectPeer(gid, pid);
      li.appendChild(btn);
    }
    membersUl.appendChild(li);
  });
}

function appendMessage(gid, sender, text) {
  if (gid !== activeGroupId) return;
  const div = document.createElement('div');
  div.className = 'msg';
  div.textContent = `${sender}: ${text}`;
  messages.appendChild(div);
}

function removeMember(gid, pid) {
  if (gid === activeGroupId) {
    const items = Array.from(membersUl.children);
    items.forEach(li => { if (li.firstChild.textContent === pid) li.remove(); });
  }
}
