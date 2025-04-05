document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatMessages = document.getElementById('chat-messages');
    const sendButton = document.getElementById('send-button');
    const skillOptions = document.querySelectorAll('.skill-option');
    const bookshelf = document.getElementById('bookshelf');
    const clearBookshelfButton = document.getElementById('clear-bookshelf');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    
    let currentSkillDomain = 'both';
    let lastSkillDomain = null;
    let books = JSON.parse(localStorage.getItem('books')) || [];
    
    // Dark mode functionality
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
    
    darkModeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', isDark);
        darkModeToggle.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    });
    
    // Clear bookshelf functionality
    clearBookshelfButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear your bookshelf?')) {
            books = [];
            localStorage.setItem('books', JSON.stringify(books));
            renderBookshelf();
        }
    });
    
    // Load books from localStorage
    renderBookshelf();
    
    // Handle skill selection
    skillOptions.forEach(option => {
        option.addEventListener('click', () => {
            const skill = option.getAttribute('data-skill');
            
            // Remove active class from all options
            skillOptions.forEach(opt => opt.classList.remove('active'));
            
            // Add active class to selected option
            option.classList.add('active');
            
            // Update current skill domain
            currentSkillDomain = skill;
            
            // Only show persona message if switching from a different domain
            if (lastSkillDomain !== null && lastSkillDomain !== currentSkillDomain) {
                let personaMessage = '';
                if (skill === 'data-science') {
                    personaMessage = "I'm now your Data Science assistant. How can I help you with Data Science skills today?";
                } else if (skill === 'business') {
                    personaMessage = "I'm now your Business assistant. How can I help you with Business skills today?";
                } else {
                    personaMessage = "I'm now your assistant for both Data Science and Business skills. How can I help you today?";
                }
                
                addMessage(personaMessage, 'bot');
            }
            
            // Update last skill domain
            lastSkillDomain = currentSkillDomain;
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
            // Get read books
            const readBooks = books.filter(book => book.read).map(book => book.title);
            
            // Send message to backend
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    skill_domain: currentSkillDomain,
                    read_books: readBooks
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
            
            // Check for book recommendations and resources
            checkForBookRecommendations(data.response);
            checkForResourceRecommendations(data.response);
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
        
        return messageDiv;
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
    
    // Check for book recommendations in the response
    function checkForBookRecommendations(response) {
        // Enhanced regex to detect book recommendations with various formats
        const bookRegex = /"([^"]+)" by ([^"]+)|"([^"]+)"|"([^"]+)" \(([^)]+)\)/g;
        let match;
        let foundBooks = false;
        
        while ((match = bookRegex.exec(response)) !== null) {
            foundBooks = true;
            let title, author;
            
            // Handle different book formats
            if (match[1] && match[2]) {
                // Format: "Title" by Author
                title = match[1];
                author = match[2].trim();
            } else if (match[3]) {
                // Format: "Title"
                title = match[3];
                author = "Unknown Author";
            } else if (match[4] && match[5]) {
                // Format: "Title" (Author)
                title = match[4];
                author = match[5].trim();
            }
            
            // Check if book is already in the bookshelf
            if (!books.some(book => book.title === title)) {
                // Create book recommendation element
                const bookRecommendation = document.createElement('div');
                bookRecommendation.className = 'book-recommendation';
                bookRecommendation.innerHTML = `
                    <div class="book-recommendation-header">
                        <div class="book-recommendation-title">${title}</div>
                        <button class="add-to-bookshelf" onclick="addBookToBookshelf('${title.replace(/'/g, "\\'")}', '${author.replace(/'/g, "\\'")}', '${currentSkillDomain}')">
                            <i class="fas fa-plus"></i> Add to Bookshelf
                        </button>
                    </div>
                    <div class="book-recommendation-details">by ${author}</div>
                `;
                
                // Add to the last bot message
                const lastBotMessage = chatMessages.querySelector('.message.bot:last-child .message-content');
                lastBotMessage.appendChild(bookRecommendation);
            }
        }
        
        // If books were found, add a message about the bookshelf
        if (foundBooks) {
            const bookshelfMessage = document.createElement('div');
            bookshelfMessage.className = 'bookshelf-message';
            bookshelfMessage.innerHTML = `
                <p><i class="fas fa-info-circle"></i> You can add these books to your bookshelf by clicking the "Add to Bookshelf" button.</p>
            `;
            
            // Add to the last bot message
            const lastBotMessage = chatMessages.querySelector('.message.bot:last-child .message-content');
            lastBotMessage.appendChild(bookshelfMessage);
        }
    }
    
    // Check for resource recommendations
    function checkForResourceRecommendations(response) {
        // Look for common resource indicators
        const resourceIndicators = [
            'course', 'courses', 'tutorial', 'tutorials', 'website', 'websites', 
            'podcast', 'podcasts', 'video', 'videos', 'article', 'articles',
            'blog', 'blogs', 'newsletter', 'newsletters', 'tool', 'tools',
            'platform', 'platforms', 'resource', 'resources'
        ];
        
        let hasResources = false;
        for (const indicator of resourceIndicators) {
            if (response.toLowerCase().includes(indicator)) {
                hasResources = true;
                break;
            }
        }
        
        if (hasResources) {
            const resourceMessage = document.createElement('div');
            resourceMessage.className = 'resource-message';
            resourceMessage.innerHTML = `
                <p><i class="fas fa-lightbulb"></i> I've included links to resources in my response. You can click on them to open in a new tab.</p>
            `;
            
            // Add to the last bot message
            const lastBotMessage = chatMessages.querySelector('.message.bot:last-child .message-content');
            lastBotMessage.appendChild(resourceMessage);
        }
    }
    
    // Add book to bookshelf
    window.addBookToBookshelf = function(title, author, category) {
        // Check if book already exists
        if (!books.some(book => book.title === title)) {
            // Add new book
            books.push({
                title: title,
                author: author,
                category: category,
                read: false
            });
            
            // Save to localStorage
            localStorage.setItem('books', JSON.stringify(books));
            
            // Update bookshelf display
            renderBookshelf();
            
            // Show confirmation message
            addMessage(`Added "${title}" to your bookshelf!`, 'bot');
        }
    };
    
    // Toggle book read status
    window.toggleBookReadStatus = function(index) {
        books[index].read = !books[index].read;
        localStorage.setItem('books', JSON.stringify(books));
        renderBookshelf();
    };
    
    // Render bookshelf
    function renderBookshelf() {
        if (books.length === 0) {
            bookshelf.innerHTML = '<p class="empty-bookshelf">No books added yet. Books recommended by the assistant will appear here.</p>';
            return;
        }
        
        bookshelf.innerHTML = books.map((book, index) => `
            <div class="book-item ${book.read ? 'read' : ''}">
                <input type="checkbox" class="book-checkbox" ${book.read ? 'checked' : ''} 
                       onchange="toggleBookReadStatus(${index})">
                <div class="book-content">
                    <div class="book-title">${book.title}</div>
                    <div class="book-author">by ${book.author}</div>
                    <div class="book-category ${book.category}">${book.category}</div>
                </div>
            </div>
        `).join('');
    }
}); 