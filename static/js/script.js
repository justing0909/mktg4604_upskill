document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatMessages = document.getElementById('chat-messages');
    const sendButton = document.getElementById('send-button');
    const skillOptions = document.querySelectorAll('.skill-option');
    
    // Track selected skill domain
    let selectedSkill = 'both';

    // Handle skill selection
    skillOptions.forEach(option => {
        option.addEventListener('click', () => {
            // Remove active class from all options
            skillOptions.forEach(opt => opt.classList.remove('active'));
            
            // Add active class to selected option
            option.classList.add('active');
            
            // Update selected skill
            selectedSkill = option.getAttribute('data-skill');
            
            // Add a message to indicate skill change
            addMessage(`I'll now focus on helping you with ${selectedSkill === 'both' ? 'Data Science and Business' : selectedSkill === 'data-science' ? 'Data Science' : 'Business'} skills.`, 'bot');
        });
    });

    // Auto-resize textarea
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = (userInput.scrollHeight) + 'px';
    });

    // Handle form submission
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const message = userInput.value.trim();
        if (!message) return;
        
        // Add user message to chat
        addMessage(message, 'user');
        
        // Clear input and reset height
        userInput.value = '';
        userInput.style.height = 'auto';
        
        // Show typing indicator
        const typingIndicator = addTypingIndicator();
        
        try {
            // Send message to backend
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    message,
                    skill_domain: selectedSkill
                })
            });
            
            // Remove typing indicator
            typingIndicator.remove();
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to get response');
            }
            
            const data = await response.json();
            
            // Add bot response to chat
            addMessage(data.response, 'bot');
        } catch (error) {
            // Remove typing indicator
            typingIndicator.remove();
            
            // Show error message
            addMessage(`Error: ${error.message}`, 'bot');
            console.error('Error:', error);
        }
        
        // Scroll to bottom
        scrollToBottom();
    });
    
    // Add a message to the chat
    function addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender);
        
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');
        
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        
        contentDiv.appendChild(paragraph);
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        scrollToBottom();
    }
    
    // Add typing indicator
    function addTypingIndicator() {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot');
        
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');
        
        const typingDiv = document.createElement('div');
        typingDiv.classList.add('typing-indicator');
        
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('span');
            typingDiv.appendChild(dot);
        }
        
        contentDiv.appendChild(typingDiv);
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        scrollToBottom();
        
        return messageDiv;
    }
    
    // Scroll chat to bottom
    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Handle Enter key (send message) and Shift+Enter (new line)
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatForm.dispatchEvent(new Event('submit'));
        }
    });
}); 