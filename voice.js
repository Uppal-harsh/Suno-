const micButton = document.getElementById("micBtn");
const stopVoiceButton = document.getElementById("stopVoice");
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
    session.recognition?.abort();
    if (session.prompt) window.speechSynthesis.cancel();
    micButton.setAttribute("aria-pressed", "false");
    stopVoiceButton.hidden = true;
    voiceStatus(session, message);
}

function listen(session, message, onSpeech) {
    if (voiceSession !== session) return;
    const recognition = new SpeechRecognition();
    session.recognition = recognition;
    recognition.lang = "en-IN";
    let transcript = "";
    voiceStatus(session, message);
    recognition.onresult = event => {
        transcript = event.results[0][0].transcript.trim();
    };
    recognition.onerror = event => {
        if (voiceSession !== session) return;
        stopVoice(event.error === "not-allowed" || event.error === "service-not-allowed"
            ? "Allow microphone access to use voice shopping. You can also type a search."
            : "Voice recognition stopped. Start voice shopping again or type a search.");
    };
    recognition.onend = () => {
        if (voiceSession !== session) return;
        session.recognition = null;
        if (transcript) onSpeech(session, transcript);
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
    voiceStatus(session, message);
    const hearAnswer = () => {
        if (voiceSession !== session) return;
        session.prompt = null;
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
    window.speechSynthesis.speak(prompt);
}

function handleVoiceAnswer(session, transcript) {
    const answer = transcript.toLowerCase().match(/^[\s.,!?]*(yes|no)\b/)?.[1];
    if (answer === "no") stopVoice();
    else if (answer === "yes") listen(session, "Listening… Tell me what you’d like to find next.", searchByVoice);
    else askToContinue(session, "Please say yes to search again, or no to stop.");
}

function startVoice() {
    if (voiceSession) return stopVoice();
    if (!SpeechRecognition) {
        homeVoiceStatus.textContent = "Voice recognition is unavailable here. Please type your search.";
        return;
    }
    voiceSession = { controller: new AbortController(), hasResults: false };
    micButton.setAttribute("aria-pressed", "true");
    listen(voiceSession, "Listening… Tell me what you’re looking for.", searchByVoice);
}

micButton.addEventListener("click", startVoice);
stopVoiceButton.addEventListener("click", () => stopVoice());
window.addEventListener("pagehide", () => stopVoice());
