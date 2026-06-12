document.addEventListener('DOMContentLoaded', () => {
  const usernamePage = document.getElementById('username-page');
  const chatPage = document.getElementById('chat-page');
  const usernameForm = document.getElementById('usernameForm');
  const messageForm = document.getElementById('messageForm');
  const messageArea = document.getElementById('messageArea');
  const messageInput = document.getElementById('message');
  const nameInput = document.getElementById('name');

  let username = null;

  usernameForm.addEventListener('submit', function (e) {
    e.preventDefault();
    username = nameInput.value.trim();
    if (username) {
      usernamePage.classList.add('hidden');
      chatPage.classList.remove('hidden');
    }
  });

  messageForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const message = messageInput.value.trim();
    if (message) {
      const msgElement = document.createElement('li');
      msgElement.textContent = `${username}: ${message}`;
      messageArea.appendChild(msgElement);
      messageInput.value = '';
      messageArea.scrollTop = messageArea.scrollHeight;
    }
  });
});
