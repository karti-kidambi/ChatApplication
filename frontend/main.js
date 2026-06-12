// main.js

// App State
let stompClient = null;
let username = null;
let backendUrl = null;
let currentTheme = 'dark';
let soundEnabled = true;

// Active users tracking (client side roster)
const activeUsers = new Set();
// Typing status tracking
const typingUsers = new Set();

// Throttling for typing notifications
let isLocalTyping = false;
let localTypingTimeout = null;

// Audio Synthesizer using Web Audio API (No external assets required!)
const AudioSynth = {
  ctx: null,
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  },
  playSend() {
    if (!soundEnabled) return;
    try {
      this.init();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(580, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(750, this.ctx.currentTime + 0.08);
      
      gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
      
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch (e) {
      console.warn("Audio playback blocked/unsupported", e);
    }
  },
  playReceive() {
    if (!soundEnabled) return;
    try {
      this.init();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, this.ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, this.ctx.currentTime + 0.07); // E5
      
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
      
      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);
    } catch (e) {
      console.warn("Audio playback blocked/unsupported", e);
    }
  }
};

// Deterministic Gradient Generator based on string hashing
const avatarGradients = [
  'var(--avatar-grad-1)',
  'var(--avatar-grad-2)',
  'var(--avatar-grad-3)',
  'var(--avatar-grad-4)',
  'var(--avatar-grad-5)',
  'var(--avatar-grad-6)'
];

function getAvatarStyle(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % avatarGradients.length;
  return avatarGradients[index];
}

// DOM Elements
const connectionPage = document.getElementById('connection-page');
const usernamePage = document.getElementById('username-page');
const chatPage = document.getElementById('chat-page');

const connectionForm = document.getElementById('connectionForm');
const usernameForm = document.getElementById('usernameForm');
const messageForm = document.getElementById('messageForm');

const backendUrlInput = document.getElementById('backendUrl');
const nameInput = document.getElementById('name');
const messageInput = document.getElementById('message');

const avatarPreview = document.getElementById('avatar-preview');
const avatarGradientName = document.getElementById('avatar-gradient-name');
const messageArea = document.getElementById('messageArea');
const usersList = document.getElementById('usersList');
const userCount = document.getElementById('user-count');

const serverStatusIndicator = document.getElementById('server-status-indicator');
const sidebarUserAvatar = document.getElementById('sidebar-user-avatar');
const sidebarUsername = document.getElementById('sidebar-username');
const sidebarBackendHost = document.getElementById('sidebar-backend-host');

const themeToggle = document.getElementById('themeToggle');
const soundToggle = document.getElementById('soundToggle');
const clearChatBtn = document.getElementById('clearChatBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const typingIndicator = document.getElementById('typingIndicator');
const typingText = document.getElementById('typingText');
const backToConnectionBtn = document.getElementById('backToConnectionBtn');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Load backend URL preference (query param > localStorage > localhost default > production default)
  const urlParams = new URLSearchParams(window.location.search);
  const backendParam = urlParams.get('backend');
  const savedBackendUrl = localStorage.getItem('backendUrl');

  if (backendParam) {
    backendUrlInput.value = backendParam;
  } else if (savedBackendUrl) {
    backendUrlInput.value = savedBackendUrl;
  } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    backendUrlInput.value = 'http://localhost:8888/ws';
  } else {
    backendUrlInput.value = 'https://chatapplication-1xcc.onrender.com/ws';
  }

  // If a backend URL is set, bypass connection screen and go straight to username screen
  backendUrl = backendUrlInput.value.trim();
  if (backendUrl) {
    connectionPage.classList.remove('active');
    usernamePage.classList.add('active');
  }

  // Load theme preference
  const savedTheme = localStorage.getItem('theme') || 'dark';
  setTheme(savedTheme);

  // Load sound setting
  const savedSound = localStorage.getItem('sound');
  if (savedSound === 'false') {
    soundEnabled = false;
    soundToggle.innerHTML = '<i class="fa-solid fa-volume-xmark"></i><span>Sound Off</span>';
  }
});

// Event Listeners
nameInput.addEventListener('input', () => {
  const val = nameInput.value.trim();
  if (val) {
    avatarPreview.textContent = val.charAt(0).toUpperCase();
    avatarPreview.style.background = getAvatarStyle(val);
    avatarGradientName.textContent = `Gradient Pattern #${val.length % avatarGradients.length + 1}`;
  } else {
    avatarPreview.textContent = 'U';
    avatarPreview.style.background = 'var(--primary-gradient)';
    avatarGradientName.textContent = 'Dynamic Gradient';
  }
});

connectionForm.addEventListener('submit', (e) => {
  e.preventDefault();
  backendUrl = backendUrlInput.value.trim();
  if (backendUrl) {
    connectionPage.classList.remove('active');
    usernamePage.classList.add('active');
  }
});

backToConnectionBtn.addEventListener('click', (e) => {
  e.preventDefault();
  // Clear any auto-saved or cached values if they manually want to change server
  backendUrl = '';
  usernamePage.classList.remove('active');
  connectionPage.classList.add('active');
});

usernameForm.addEventListener('submit', (e) => {
  e.preventDefault();
  username = nameInput.value.trim();
  if (username) {
    usernamePage.classList.remove('active');
    chatPage.classList.add('active');
    connectWebSocket();
  }
});

messageForm.addEventListener('submit', sendMessage);

themeToggle.addEventListener('click', () => {
  setTheme(currentTheme === 'dark' ? 'light' : 'dark');
});

soundToggle.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem('sound', soundEnabled);
  soundToggle.innerHTML = soundEnabled 
    ? '<i class="fa-solid fa-volume-high"></i><span>Sound On</span>' 
    : '<i class="fa-solid fa-volume-xmark"></i><span>Sound Off</span>';
  
  if (soundEnabled) {
    AudioSynth.playSend();
  }
});

clearChatBtn.addEventListener('click', () => {
  messageArea.innerHTML = `
    <li class="event-message system">
      <div class="event-content">
        <i class="fa-solid fa-circle-info"></i>
        <span>Chat display cleared locally.</span>
      </div>
    </li>
  `;
});

disconnectBtn.addEventListener('click', () => {
  if (stompClient) {
    stompClient.disconnect(() => {
      onDisconnected();
    });
  } else {
    onDisconnected();
  }
});

// Quick Emojis
document.querySelectorAll('.btn-emoji').forEach(btn => {
  btn.addEventListener('click', () => {
    messageInput.value += btn.getAttribute('data-emoji');
    messageInput.focus();
  });
});

// Typing detection logic
messageInput.addEventListener('input', () => {
  if (!isLocalTyping) {
    isLocalTyping = true;
    sendTypingStatus('START');
  }
  clearTimeout(localTypingTimeout);
  localTypingTimeout = setTimeout(() => {
    isLocalTyping = false;
    sendTypingStatus('STOP');
  }, 2000);
});

// STOMP & WebSockets functions
function connectWebSocket() {
  setServerStatus('connecting', 'Connecting...');
  
  const socket = new SockJS(backendUrl);
  stompClient = Stomp.over(socket);
  
  // Disable logging noise in browser console for premium feel
  stompClient.debug = null;

  stompClient.connect({}, onConnected, onConnectionError);
}

function onConnected() {
  setServerStatus('connected', 'Connected');
  
  // Cache successful backend URL connection
  localStorage.setItem('backendUrl', backendUrl);
  
  // Update Profile Sidebar info
  sidebarUserAvatar.textContent = username.charAt(0).toUpperCase();
  sidebarUserAvatar.style.background = getAvatarStyle(username);
  sidebarUsername.textContent = username;
  
  try {
    const parser = document.createElement('a');
    parser.href = backendUrl;
    sidebarBackendHost.textContent = parser.host;
  } catch(e) {
    sidebarBackendHost.textContent = backendUrl;
  }

  // Subscribe to Public channel
  stompClient.subscribe('/topic/public', onMessageReceived);

  // Send JOIN message to announce yourself
  stompClient.send("/app/chat.register",
    {},
    JSON.stringify({ sender: username, type: 'JOIN' })
  );

  // Add ourselves to client list
  addUser(username);
}

function onConnectionError(error) {
  setServerStatus('disconnected', 'Connection Failed');
  
  const errorNode = document.createElement('li');
  errorNode.className = 'event-message system';
  errorNode.innerHTML = `
    <div class="event-content" style="border-color: var(--danger-color); color: var(--danger-color);">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <span>Could not connect to WebSocket server. Double-check your backend URL and status!</span>
    </div>
  `;
  messageArea.appendChild(errorNode);
  messageArea.scrollTop = messageArea.scrollHeight;
}

function onDisconnected() {
  stompClient = null;
  username = null;
  activeUsers.clear();
  typingUsers.clear();
  updateUsersSidebar();
  
  chatPage.classList.remove('active');
  connectionPage.classList.add('active');
}

function sendMessage(e) {
  e.preventDefault();
  const content = messageInput.value.trim();
  
  if (content && stompClient) {
    const chatMsg = {
      sender: username,
      content: content,
      type: 'CHAT'
    };
    
    // Play sound immediately for sending
    AudioSynth.playSend();
    
    // Stop local typing timer
    clearTimeout(localTypingTimeout);
    isLocalTyping = false;
    sendTypingStatus('STOP');

    stompClient.send("/app/chat.send", {}, JSON.stringify(chatMsg));
    messageInput.value = '';
  }
}

function sendTypingStatus(status) {
  if (stompClient) {
    stompClient.send("/app/chat.send", {}, JSON.stringify({
      sender: username,
      type: 'TYPING',
      content: status
    }));
  }
}

// Handler for incoming messages
function onMessageReceived(payload) {
  const message = JSON.parse(payload.body);
  
  // 1. Handling Typing Messages
  if (message.type === 'TYPING') {
    if (message.sender === username) return; // Ignore self typing status
    
    if (message.content === 'START') {
      typingUsers.add(message.sender);
    } else {
      typingUsers.delete(message.sender);
    }
    updateTypingIndicator();
    return;
  }

  // 2. Handling Chat and Event Messages
  const isSelf = message.sender === username;
  const messageNode = document.createElement('li');

  if (message.type === 'JOIN') {
    messageNode.className = 'event-message join';
    messageNode.innerHTML = `
      <div class="event-content">
        <i class="fa-solid fa-circle-check"></i>
        <span><strong>${message.sender}</strong> joined the room</span>
      </div>
    `;
    addUser(message.sender);
    
    if (!isSelf) AudioSynth.playReceive();
    
  } else if (message.type === 'LEAVE') {
    messageNode.className = 'event-message leave';
    messageNode.innerHTML = `
      <div class="event-content">
        <i class="fa-solid fa-circle-xmark"></i>
        <span><strong>${message.sender}</strong> left the room</span>
      </div>
    `;
    removeUser(message.sender);
    typingUsers.delete(message.sender);
    updateTypingIndicator();
    
    if (!isSelf) AudioSynth.playReceive();
    
  } else if (message.type === 'CHAT') {
    messageNode.className = `message-node ${isSelf ? 'sent' : 'received'}`;
    
    // Format timestamp
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const avatarChar = message.sender ? message.sender.charAt(0).toUpperCase() : '?';
    const avatarBg = message.sender ? getAvatarStyle(message.sender) : 'var(--primary-gradient)';
    
    // Add user to active roster if not already present
    if (message.sender) addUser(message.sender);

    messageNode.innerHTML = `
      <div class="user-avatar" style="background: ${avatarBg};" title="${message.sender}">${avatarChar}</div>
      <div class="message-bubble">
        ${!isSelf ? `<span class="msg-sender">${message.sender}</span>` : ''}
        <div class="msg-text">${escapeHtml(message.content)}</div>
        <div class="msg-meta">
          <span>${timeString}</span>
          ${isSelf ? '<i class="fa-solid fa-check-double"></i>' : ''}
        </div>
      </div>
    `;
    
    if (!isSelf) AudioSynth.playReceive();
  }

  messageArea.appendChild(messageNode);
  messageArea.scrollTop = messageArea.scrollHeight;
}

// UI Helpers
function setTheme(theme) {
  currentTheme = theme;
  localStorage.setItem('theme', theme);
  
  if (theme === 'light') {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
    themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i><span>Dark Mode</span>';
  } else {
    document.body.classList.remove('light-theme');
    document.body.classList.add('dark-theme');
    themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i><span>Light Mode</span>';
  }
}

function setServerStatus(status, text) {
  serverStatusIndicator.className = `server-status ${status}`;
  serverStatusIndicator.querySelector('.status-text').textContent = text;
}

function addUser(user) {
  if (!user) return;
  activeUsers.add(user);
  updateUsersSidebar();
}

function removeUser(user) {
  activeUsers.delete(user);
  updateUsersSidebar();
}

function updateUsersSidebar() {
  usersList.innerHTML = '';
  userCount.textContent = activeUsers.size;
  
  activeUsers.forEach(user => {
    const li = document.createElement('li');
    const char = user.charAt(0).toUpperCase();
    const bg = getAvatarStyle(user);
    
    li.innerHTML = `
      <div class="user-avatar" style="background: ${bg}; width: 28px; height: 28px; font-size: 0.75rem;">${char}</div>
      <span>${escapeHtml(user)}</span>
    `;
    usersList.appendChild(li);
  });
}

function updateTypingIndicator() {
  if (typingUsers.size > 0) {
    typingIndicator.classList.add('active');
    if (typingUsers.size === 1) {
      typingText.textContent = `${Array.from(typingUsers)[0]} is typing...`;
    } else {
      typingText.textContent = `${typingUsers.size} users are typing...`;
    }
  } else {
    typingIndicator.classList.remove('active');
  }
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
