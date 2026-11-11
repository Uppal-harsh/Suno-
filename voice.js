const micButton = document.getElementById("micBtn");
const stopVoiceButton = document.getElementById("stopVoice");
const choices = document.getElementById("voiceChoices");
const continueButton = document.getElementById("continueVoice");
const endButton = document.getElementById("endVoice");
const homeVoiceStatus = document.getElementById("voiceStatus");
const followupStatus = document.getElementById("voiceFollowup");
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let voiceSession;

function voiceStatus(session, message) {
    (session.hasResults ? followupStatus : homeVoiceStatus).textContent = message;
}

function stopVoice(message = "Voice shopping is off.") {
    const session = voiceSession;
    if (!session) return;
    voiceSession = null;
    session.controller.abort();
    clearTimeout(session.startTimer);
    session.recognition?.abort();
    clearPrompt(session);
    choices.hidden = true;
    micButton.setAttribute("aria-pressed", "false");
    stopVoiceButton.hidden = true;
    voiceStatus(session, message);
}

function clearPrompt(session) {
    clearTimeout(session.promptTimer);
    if (session.prompt) {
        session.prompt = null;
        window.speechSynthesis.cancel();
    }
}

function listen(session, message, onSpeech) {
    if (voiceSession !== session) return;
    const recognition = new SpeechRecognition();
    session.recognition = recognition;
    recognition.lang = "en-IN";
    let transcript = "";
    voiceStatus(session, "Starting microphone…");
    session.startTimer = setTimeout(() => {
        if (voiceSession === session && session.recognition === recognition) {
            stopVoice("The microphone didn’t start. Check your browser’s microphone permission or type a search.");
        }
    }, 12000);
    recognition.onstart = () => {
        if (voiceSession !== session || session.recognition !== recognition) return;
        clearTimeout(session.startTimer);
        voiceStatus(session, message);
    };
    recognition.onresult = event => {
        if (voiceSession !== session || session.recognition !== recognition) return;
        transcript = event.results[event.resultIndex || 0][0].transcript.trim();
        if (transcript) recognition.stop();
    };
    recognition.onerror = event => {
        if (voiceSession !== session || session.recognition !== recognition) return;
        const errors = {
            "not-allowed": "Microphone access was blocked. Allow it in your browser or type a search.",
            "service-not-allowed": "Speech recognition is blocked in this browser. Try Chrome or type a search.",
            "audio-capture": "No microphone is available. Check your input device or type a search.",
            "network": "The browser’s speech service couldn’t connect. Check your connection or type a search.",
            "no-speech": "No speech heard. Try again or type a search."
        };
        clearTimeout(session.startTimer);
        if (onSpeech === handleVoiceAnswer && event.error === "no-speech") {
            session.recognition = null;
            voiceStatus(session, "No answer heard. Choose Yes or No.");
            return;
        }
        stopVoice(errors[event.error] || "Voice recognition stopped. Try again or type a search.");
    };
    recognition.onend = () => {
        if (voiceSession !== session || session.recognition !== recognition) return;
        clearTimeout(session.startTimer);
        session.recognition = null;
        if (transcript) onSpeech(session, transcript);
        else if (onSpeech === handleVoiceAnswer) voiceStatus(session, "No answer heard. Choose Yes or No.");
        else stopVoice("No speech heard. Start voice shopping again or type a search.");
    };
    try {
        recognition.start();
    } catch {
        stopVoice("Could not start the microphone. Please try again or type a search.");
    }
}

async function searchByVoice(session, query) {
    document.getElementById("chatInput").value = query;
    voiceStatus(session, "Finding products…");
    try {
        await showVoiceProducts(query, session.controller.signal);
        if (voiceSession !== session) return;
        session.hasResults = true;
        homeVoiceStatus.textContent = "";
        stopVoiceButton.hidden = false;
        askToContinue(session);
    } catch {
        if (voiceSession === session) stopVoice("Could not load products. Please try again.");
    }
}

function askToContinue(session, message = "Would you like more voice-assisted help? Say yes or no.") {
    choices.hidden = false;
    voiceStatus(session, message);
    const hearAnswer = () => {
        if (voiceSession !== session) return;
        clearPrompt(session);
        listen(session, message, handleVoiceAnswer);
    };
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
        hearAnswer();
        return;
    }
    // Wait for the prompt to finish so the microphone cannot hear it.
    const prompt = new SpeechSynthesisUtterance(message);
    prompt.lang = "en-IN";
    const finishPrompt = () => {
        if (session.prompt === prompt) hearAnswer();
    };
    prompt.onend = finishPrompt;
    prompt.onerror = finishPrompt;
    session.prompt = prompt;
    session.promptTimer = setTimeout(finishPrompt, 8000);
    try {
        window.speechSynthesis.speak(prompt);
    } catch {
        finishPrompt();
    }
}

function handleVoiceAnswer(session, transcript) {
    const answer = transcript.toLowerCase().match(/^[\s.,!?]*(yes|no)\b/)?.[1];
    if (answer === "no") stopVoice();
    else if (answer === "yes") continueSearch(session);
    else askToContinue(session, "Please say yes to search again, or no to stop.");
}

function continueSearch(session) {
    if (!session) return;
    clearPrompt(session);
    clearTimeout(session.startTimer);
    const previous = session.recognition;
    session.recognition = null;
    previous?.abort();
    choices.hidden = true;
    listen(session, "Listening… Tell me what you’d like to find next.", searchByVoice);
}

function startVoice() {
    if (voiceSession) return stopVoice();
    if (!SpeechRecognition || !window.isSecureContext) {
        homeVoiceStatus.textContent = "Open EasyKart in a browser with speech recognition using localhost or HTTPS. You can type below.";
        return;
    }
    voiceSession = { controller: new AbortController(), hasResults: false };
    micButton.setAttribute("aria-pressed", "true");
    listen(voiceSession, "Listening… Tell me what you’re looking for.", searchByVoice);
}

continueButton.addEventListener("click", () => continueSearch(voiceSession));
endButton.addEventListener("click", () => stopVoice());
micButton.addEventListener("click", startVoice);
stopVoiceButton.addEventListener("click", () => stopVoice());
window.addEventListener("pagehide", () => stopVoice());
