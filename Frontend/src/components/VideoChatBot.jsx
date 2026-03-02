import React, { useState, useRef, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const VideoChatBot = ({ jobId, videoName }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hi! I'm your Video Insights Assistant. I can help you understand and analyze the content from ${videoName || 'this video'}. What would you like to know?`,
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Format message text to convert markdown-like syntax to HTML
  const formatMessageText = (text) => {
    // Convert **bold** to <strong>
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convert *italic* to <em>
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Convert numbered lists to proper formatting
    formatted = formatted.replace(/^(\d+\.\s+\*\*.*?\*\*)/gm, '<div style="margin-top: 12px; font-weight: 600;">$1</div>');
    
    // Add line breaks for better readability
    formatted = formatted.replace(/\n/g, '<br/>');
    
    return formatted;
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');

    // Add user message to chat
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // Prepare conversation history (excluding the welcome message)
      const conversationHistory = newMessages
        .slice(1) // Skip the initial welcome message
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

      const response = await fetch(`${API_BASE}/api/videos/chat/${jobId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: userMessage,
          conversation_history: conversationHistory.slice(-10), // Send last 10 messages
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from chatbot');
      }

      const data = await response.json();

      // Add assistant response to chat
      setMessages([...newMessages, { role: 'assistant', content: data.response }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const suggestedQuestions = [
    "What are the main topics covered in this video?",
    "Can you summarize the key points discussed?",
    "What are the most important takeaways?",
    "Tell me about a specific topic from the video"
  ];

  const handleSuggestionClick = (question) => {
    setInputMessage(question);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          backgroundColor: '#6366f1',
          color: 'white',
          border: 'none',
          boxShadow: '0 2px 10px rgba(99,102,241,0.3)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '22px',
          transition: 'all 0.2s ease',
          zIndex: 1000,
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'scale(1.08)';
          e.currentTarget.style.boxShadow = '0 4px 14px rgba(99,102,241,0.4)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 2px 10px rgba(99,102,241,0.3)';
        }}
        title="Video Insights Assistant"
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '90px',
            right: '24px',
            width: '400px',
            maxWidth: 'calc(100vw - 48px)',
            height: '600px',
            maxHeight: 'calc(100vh - 140px)',
            backgroundColor: '#1e293b',
            borderRadius: '14px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 999,
            animation: 'slideUp 0.25s ease-out',
          }}
        >
          {/* Header */}
          <div
            style={{
              background: '#6366f1',
              padding: '16px 20px',
              color: 'white',
            }}
          >
            <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '2px' }}>
              Video Insights Assistant
            </div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>
              Ask questions about video content
            </div>
          </div>

          {/* Messages Container */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              backgroundColor: '#0f172a',
            }}
          >
            {messages.map((message, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '80%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    backgroundColor: message.role === 'user' ? '#6366f1' : 'rgba(255,255,255,0.05)',
                    border: message.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.06)',
                    color: 'white',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    wordBreak: 'break-word',
                  }}
                  dangerouslySetInnerHTML={{ 
                    __html: formatMessageText(message.content) 
                  }}
                />
              </div>
            ))}

            {isLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: '#94a3b8',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <span className="typing-dot" style={{ animation: 'typing 1.4s infinite' }}>●</span>
                    <span className="typing-dot" style={{ animation: 'typing 1.4s infinite 0.2s' }}>●</span>
                    <span className="typing-dot" style={{ animation: 'typing 1.4s infinite 0.4s' }}>●</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Questions (only show initially) */}
          {messages.length === 1 && (
            <div
              style={{
                padding: '10px 16px',
                backgroundColor: '#0f172a',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Try asking
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {suggestedQuestions.slice(0, 2).map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(question)}
                    style={{
                      padding: '7px 10px',
                      backgroundColor: 'rgba(99,102,241,0.08)',
                      color: '#a5b4fc',
                      border: '1px solid rgba(99,102,241,0.15)',
                      borderRadius: '7px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.15)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.08)';
                    }}
                  >
                    "{question}"
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div
            style={{
            padding: '12px 16px',
            backgroundColor: '#1e293b',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask a question... (e.g., 'What is discussed at 5:30?')"
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  backgroundColor: '#0f172a',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '13px',
                  outline: 'none',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#6366f1';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                }}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading}
                style={{
                  padding: '10px 14px',
                  backgroundColor: inputMessage.trim() && !isLoading ? '#6366f1' : '#334155',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: inputMessage.trim() && !isLoading ? 'pointer' : 'not-allowed',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                  minWidth: '40px',
                }}
                onMouseOver={(e) => {
                  if (inputMessage.trim() && !isLoading) {
                    e.currentTarget.style.backgroundColor = '#4f46e5';
                  }
                }}
                onMouseOut={(e) => {
                  if (inputMessage.trim() && !isLoading) {
                    e.currentTarget.style.backgroundColor = '#6366f1';
                  }
                }}
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add CSS animations */}
      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes typing {
          0%, 60%, 100% {
            opacity: 0.3;
          }
          30% {
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
};

export default VideoChatBot;
