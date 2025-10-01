const themeToggle = document.getElementById('themeToggle');

function toggleTheme() {
  document.body.classList.toggle('light-mode');
  document.body.classList.toggle('dark-mode');

  const isLight = document.body.classList.contains('light-mode');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
}

document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('theme');
  document.body.classList.remove('light-mode', 'dark-mode');
  document.body.classList.add(savedTheme === 'light' ? 'light-mode' : 'dark-mode');
});

themeToggle.addEventListener('click', toggleTheme);
