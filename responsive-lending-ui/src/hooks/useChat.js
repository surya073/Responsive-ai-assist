import { useCallback, useState } from 'react';

let idCounter = 0;
const nextId = () => {
  idCounter += 1;
  return `msg-${idCounter}`;
};

// Owns only the transcript. It has no opinion about application steps —
// useApplicationSession decides what happens next, this hook just
// renders the resulting conversation.
export function useChat() {
  const [messages, setMessages] = useState([]);

  const addMessage = useCallback((sender, text, extra = {}) => {
    const message = { id: nextId(), sender, text, timestamp: Date.now(), ...extra };
    setMessages((prev) => [...prev, message]);
    return message;
  }, []);

  const addBotMessage = useCallback((text, extra) => addMessage('bot', text, extra), [addMessage]);
  const addUserMessage = useCallback((text, extra) => addMessage('user', text, extra), [addMessage]);

  const clear = useCallback(() => setMessages([]), []);

  return { messages, addBotMessage, addUserMessage, clear };
}

export default useChat;
