// Grab elements
const micButton = document.getElementById('micButton');
const voiceAssistantBtn = document.getElementById('voiceAssistantBtn');
const voiceStatus = document.getElementById('voiceStatus');
const chatMessages = document.getElementById('chatMessages');
const textInput = document.getElementById('textInput');
const sendBtn = document.getElementById('sendBtn');


// Speech recognition setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  voiceStatus.textContent = "Voice input not supported in this browser. Please use Chrome.";
}

const recognition = new SpeechRecognition();
recognition.lang = 'en-IN';
recognition.continuous = false;
recognition.interimResults = false;


// Add message to chat
function addMessage(text, sender) {
  const msg = document.createElement('div');
  msg.classList.add('message', sender);
  msg.textContent = text;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}


// Start listening on mic click
micButton.addEventListener('click', () => {
  voiceStatus.textContent = "Listening...";
  recognition.start();
});

voiceAssistantBtn.addEventListener('click', () => {
  voiceStatus.textContent = "Listening...";
  recognition.start();
});


// Handle speech result
recognition.onresult = (event) => {
  const spokenText = event.results[0][0].transcript;
  voiceStatus.textContent = "You said: " + spokenText;
  addMessage(spokenText, 'user');

  sendToAI(spokenText);
};

recognition.onerror = (event) => {
  voiceStatus.textContent = "Sorry, I didn't catch that. Try again.";
};


// Send to AI (placeholder)
function sendToAI(userText) {
  addMessage("You said: " + userText + ". (AI response will appear here soon)", 'assistant');
}


// Text input fallback
sendBtn.addEventListener('click', () => {
  const typedText = textInput.value.trim();
  if (typedText === "") return;

  addMessage(typedText, 'user');
  sendToAI(typedText);
  textInput.value = "";
});