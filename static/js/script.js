document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatMessages = document.getElementById('chat-messages');
    const sendButton = document.getElementById('send-button');
    const skillOptions = document.querySelectorAll('.skill-option');
    const bookshelf = document.getElementById('bookshelf');
    const clearBookshelfButton = document.getElementById('clear-bookshelf');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    
    // Track selected skill domain
    let selectedSkill = 'both';
    let lastSkillDomain = null;
    
    // Load books from localStorage
    let savedBooks = JSON.parse(localStorage.getItem('bookshelf') || '[]');
    
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
    
    // Initialize bookshelf
    renderBookshelf();
    
    // Handle clear bookshelf
    clearBookshelfButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear your bookshelf?')) {
            savedBooks = [];
            localStorage.setItem('bookshelf', JSON.stringify(savedBooks));
            renderBookshelf();
        }
    });

    // Handle skill selection
    skillOptions.forEach(option => {
        option.addEventListener('click', () => {
            // Remove active class from all options
            skillOptions.forEach(opt => opt.classList.remove('active'));
            
            // Add active class to selected option
            option.classList.add('active');
            
            // Update selected skill
            selectedSkill = option.getAttribute('data-skill');
            
            // Only show persona message if switching from a different domain
            if (lastSkillDomain !== null && lastSkillDomain !== selectedSkill) {
                let personaMessage = '';
                if (selectedSkill === 'data-science') {
                    personaMessage = "I'm now your Data Science assistant. How can I help you with Data Science skills today?";
                } else if (selectedSkill === 'business') {
                    personaMessage = "I'm now your Business assistant. How can I help you with Business skills today?";
                } else {
                    personaMessage = "I'm now your assistant for both Data Science and Business skills. How can I help you today?";
                }
                
                addMessage(personaMessage, 'bot');
            }
            
            // Update last skill domain
            lastSkillDomain = selectedSkill;
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
                    skill_domain: selectedSkill,
                    read_books: getReadBookTitles()
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
            
            // Check for book recommendations in the response
            checkForBookRecommendations(data.response);
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
        // Simple regex to detect book recommendations
        // This is a basic implementation and could be improved
        const bookRegex = /"([^"]+)" by ([^\.]+)\./g;
        let match;
        let foundBooks = false;
        
        while ((match = bookRegex.exec(response)) !== null) {
            foundBooks = true;
            const title = match[1];
            const author = match[2].trim();
            
            // Check if book is already in bookshelf
            if (!savedBooks.some(book => book.title === title)) {
                // Create book recommendation element
                const bookRecommendation = document.createElement('div');
                bookRecommendation.classList.add('book-recommendation');
                
                const header = document.createElement('div');
                header.classList.add('book-recommendation-header');
                
                const titleElement = document.createElement('div');
                titleElement.classList.add('book-recommendation-title');
                titleElement.textContent = `"${title}"`;
                
                const addButton = document.createElement('button');
                addButton.classList.add('add-to-bookshelf');
                addButton.innerHTML = '<i class="fas fa-plus"></i> Add to Bookshelf';
                addButton.addEventListener('click', () => {
                    addBookToBookshelf(title, author);
                    bookRecommendation.remove();
                });
                
                header.appendChild(titleElement);
                header.appendChild(addButton);
                
                const details = document.createElement('div');
                details.classList.add('book-recommendation-details');
                details.textContent = `by ${author}`;
                
                bookRecommendation.appendChild(header);
                bookRecommendation.appendChild(details);
                
                // Add to the last bot message
                const lastBotMessage = document.querySelector('.message.bot:last-child .message-content');
                if (lastBotMessage) {
                    lastBotMessage.appendChild(bookRecommendation);
                }
            }
        }
    }
    
    // Add book to bookshelf
    function addBookToBookshelf(title, author) {
        // Check if book already exists
        if (savedBooks.some(book => book.title === title)) {
            return;
        }
        
        // Add new book
        const newBook = {
            id: Date.now().toString(),
            title: title,
            author: author,
            category: selectedSkill,
            read: false
        };
        
        savedBooks.push(newBook);
        localStorage.setItem('bookshelf', JSON.stringify(savedBooks));
        
        // Update bookshelf display
        renderBookshelf();
        
        // Show confirmation message
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot');
        
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');
        
        const paragraph = document.createElement('p');
        paragraph.textContent = `I've added "${title}" to your bookshelf.`;
        
        contentDiv.appendChild(paragraph);
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        scrollToBottom();
    }
    
    // Render bookshelf
    function renderBookshelf() {
        // Clear bookshelf
        bookshelf.innerHTML = '';
        
        if (savedBooks.length === 0) {
            const emptyMessage = document.createElement('p');
            emptyMessage.classList.add('empty-bookshelf');
            emptyMessage.textContent = 'No books added yet. Books recommended by the assistant will appear here.';
            bookshelf.appendChild(emptyMessage);
            return;
        }
        
        // Add each book
        savedBooks.forEach(book => {
            const bookItem = document.createElement('div');
            bookItem.classList.add('book-item');
            if (book.read) {
                bookItem.classList.add('read');
            }
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.classList.add('book-checkbox');
            checkbox.checked = book.read;
            checkbox.addEventListener('change', () => {
                toggleBookReadStatus(book.id);
            });
            
            const content = document.createElement('div');
            content.classList.add('book-content');
            
            const title = document.createElement('div');
            title.classList.add('book-title');
            title.textContent = book.title;
            
            const author = document.createElement('div');
            author.classList.add('book-author');
            author.textContent = `by ${book.author}`;
            
            const category = document.createElement('div');
            category.classList.add('book-category', book.category);
            category.textContent = book.category === 'data-science' ? 'Data Science' : 
                                  book.category === 'business' ? 'Business' : 'Both';
            
            content.appendChild(title);
            content.appendChild(author);
            content.appendChild(category);
            
            bookItem.appendChild(checkbox);
            bookItem.appendChild(content);
            
            bookshelf.appendChild(bookItem);
        });
    }
    
    // Toggle book read status
    function toggleBookReadStatus(bookId) {
        const bookIndex = savedBooks.findIndex(book => book.id === bookId);
        if (bookIndex !== -1) {
            savedBooks[bookIndex].read = !savedBooks[bookIndex].read;
            localStorage.setItem('bookshelf', JSON.stringify(savedBooks));
            renderBookshelf();
        }
    }
    
    // Get titles of read books
    function getReadBookTitles() {
        return savedBooks
            .filter(book => book.read)
            .map(book => book.title);
    }
}); 