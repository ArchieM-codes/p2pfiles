const iceServers = [
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
];


// Validate AMCG-12345-AB
const ID_RE = /^AMCG-\d{5}-[A-Za-z]{2}$/;

let pg, peerId = 'u-'+Math.random().toString(36).slice(2,8);
const groups = {}, ui = {};

// Grab elements
['groupId','groupPwd','createBtn','joinBtn','groupList',
 'currentGroup','memberList','messages','msgInput','sendBtn']
 .forEach(id => ui[id] = document.getElementById(id));

// Init Peer.js Groups
pg = new PeerGroup(err => err&&console.error(err), {
  host: '0.peerjs.com',
        port: 443,
        path: '/',
        secure: true,
        key: 'peerjs',
        debug: 3,
        config: { iceServers });

// Event handlers
pg.on('joined', ({groupId,creator}) => {
  groups[groupId].isAdmin = creator===pg.peer.id; renderList();
});
pg.on('peer-list', ({groupId,peerList}) => updateMembers(groupId,peerList));
pg.on('message', ({groupId,peerId,data}) => addMsg(groupId,peerId,data.text));
pg.on('user-left', ({groupId,peerId}) => {
  groups[groupId].peers = groups[groupId].peers.filter(p=>p!==peerId);
  if(ui.currentGroup.textContent.startsWith(groupId)) updateMembers(groupId,groups[groupId].peers);
});

function handle(create) {
  const gid = ui.groupId.value.trim(), pwd = ui.groupPwd.value;
  if(!ID_RE.test(gid)) return alert('Invalid ID format');
  if(!pwd) return alert('Password required');
  if(create && groups[gid]) return alert('Group exists');
  if(!create && groups[gid]?.pwd!==pwd) return alert('Wrong password');
  groups[gid] = groups[gid]||{pwd,peers:[],isAdmin:false};
  pg[create?'createGroup':'joinGroup'](gid,pwd);
  renderList();
}

function renderList(){
  ui.groupList.innerHTML = '';
  Object.keys(groups).forEach(gid => {
    const li = document.createElement('li');
    li.textContent = gid;
    li.classList.toggle('active', ui.currentGroup.textContent.startsWith(gid));
    li.onclick = () => selectGroup(gid);
    ui.groupList.append(li);
  });
}

function selectGroup(gid) {
  ui.currentGroup.textContent = gid + (groups[gid].isAdmin?' (Admin)':'');
  ui.messages.innerHTML = ''; groups[gid].peers = [];
  pg.requestPeerList(gid);
}

function updateMembers(gid,list) {
  groups[gid].peers = list;
  if(ui.currentGroup.textContent.startsWith(gid)) {
    ui.memberList.innerHTML = '';
    list.forEach(pid => {
      const li = document.createElement('li');
      li.textContent = pid;
      if(groups[gid].isAdmin && pid!==pg.peer.id) {
        const btn = document.createElement('button');
        btn.textContent = 'Kick';
        btn.onclick = () => pg.ejectPeer(gid,pid);
        li.append(btn);
      }
      ui.memberList.append(li);
    });
  }
}

function addMsg(gid,sender,text){
  if(!ui.currentGroup.textContent.startsWith(gid)) return;
  const div = document.createElement('div');
  div.className = 'msg' + (sender===pg.peer.id?' self':'');
  div.textContent = (sender===pg.peer.id?'Me':sender)+': '+text;
  ui.messages.append(div);
  ui.messages.scrollTop = ui.messages.scrollHeight;
}

// Wire up buttons
ui.createBtn.onclick =()=>handle(true);
ui.joinBtn.onclick   =()=>handle(false);
ui.sendBtn.onclick   =()=>{
  const txt = ui.msgInput.value.trim();
  if(!txt) return;
  const gid = ui.currentGroup.textContent.split(' ')[0];
  pg.message(gid,{text:txt});
  addMsg(gid,pg.peer.id,txt);
  ui.msgInput.value = '';
};
