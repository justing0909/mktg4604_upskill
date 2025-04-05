document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatMessages = document.getElementById('chat-messages');
    const skillOptions = document.querySelectorAll('.skill-option');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const clearBookshelfBtn = document.getElementById('clear-bookshelf');
    const bookshelfTabs = document.querySelectorAll('.bookshelf-tab');
    const bookshelf = document.getElementById('bookshelf');
    
    // State variables
    let currentSkillDomain = 'both';
    let lastSelectedSkillDomain = 'both';
    let books = JSON.parse(localStorage.getItem('books')) || [];
    let activeTab = 'all';
    
    // Check for dark mode preference
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
    
    // Event Listeners
    darkModeToggle.addEventListener('click', toggleDarkMode);
    clearBookshelfBtn.addEventListener('click', clearBookshelf);
    bookshelfTabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    // Initialize bookshelf
    renderBookshelf();
    
    // Handle skill selection
    skillOptions.forEach(option => {
        option.addEventListener('click', () => {
            const skill = option.dataset.skill;
            if (skill !== currentSkillDomain) {
                lastSelectedSkillDomain = currentSkillDomain;
                currentSkillDomain = skill;
                
                // Update active state
                skillOptions.forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');
                
                // Add persona message only when switching domains
                addPersonaMessage(skill);
            }
        });
    });
    
    // Handle Enter key in textarea
    userInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatForm.dispatchEvent(new Event('submit'));
        }
    });
    
    // Handle chat form submission
    chatForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const message = userInput.value.trim();
        if (!message) return;
        
        // Add user message to chat
        addMessage(message, 'user');
        userInput.value = '';
        
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
            
            const data = await response.json();
            
            // Remove typing indicator
            typingIndicator.remove();
            
            // Process and add bot response
            processBotResponse(data.response);
            
        } catch (error) {
            console.error('Error:', error);
            typingIndicator.remove();
            addMessage('Sorry, there was an error processing your request. Please try again.', 'bot');
        }
    });
    
    // Functions
    function toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', isDarkMode);
        darkModeToggle.innerHTML = isDarkMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }
    
    function clearBookshelf() {
        if (confirm('Are you sure you want to clear all books from your bookshelf?')) {
            books = [];
            localStorage.removeItem('books');
            renderBookshelf();
        }
    }
    
    function switchTab(tab) {
        activeTab = tab;
        bookshelfTabs.forEach(t => t.classList.remove('active'));
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        renderBookshelf();
    }
    
    function addPersonaMessage(skill) {
        let personaMessage = '';
        if (skill === 'data-science') {
            personaMessage = "I'm your Data Science upskilling assistant. I can help you with topics like machine learning, data analysis, programming, and statistical methods. What would you like to learn about?";
        } else if (skill === 'business') {
            personaMessage = "I'm your Business upskilling assistant. I can help you with topics like marketing, finance, management, and entrepreneurship. What would you like to learn about?";
        } else {
            personaMessage = "I'm your upskilling assistant for both Data Science and Business. I can help you develop skills in either or both areas. What would you like to learn about?";
        }
        addMessage(personaMessage, 'bot');
    }
    
    function addMessage(content, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender);
        
        const messageContent = document.createElement('div');
        messageContent.classList.add('message-content');
        
        // Process links in the message
        const processedContent = processLinks(content);
        messageContent.innerHTML = processedContent;
        
        messageDiv.appendChild(messageContent);
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    function addTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.classList.add('message', 'bot', 'typing-indicator');
        indicator.innerHTML = '<div class="message-content"><div class="typing"><span></span><span></span><span></span></div></div>';
        chatMessages.appendChild(indicator);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return indicator;
    }
    
    function processLinks(content) {
        // Convert URLs to clickable links
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return content.replace(urlRegex, url => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="resource-link">${url}</a>`);
    }
    
    function processBotResponse(response) {
        // Remove persona text if present
        const cleanedResponse = response.replace(/^(?:I am|I'm) (?:Kevin Lin|Maria Alvarez).*?(?=\n\n)/s, '');
        
        // First add the processed response to chat
        addMessage(cleanedResponse, 'bot');
        
        // Then check for book recommendations and add them below
        const bookRecommendations = checkForBookRecommendations(cleanedResponse);
        if (bookRecommendations.length > 0) {
            addBookshelfMessage(bookRecommendations);
        }
        
        // Finally check for resource recommendations and add them below
        const resourceRecommendations = checkForResourceRecommendations(cleanedResponse);
        if (resourceRecommendations.length > 0) {
            addResourceMessage(resourceRecommendations);
        }
    }
    
    function checkForBookRecommendations(text) {
        const bookRegex = /"([^"]+)"(?:\s+by\s+([^"]+))?/g;
        const matches = [];
        let match;
        
        while ((match = bookRegex.exec(text)) !== null) {
            matches.push({
                title: match[1],
                author: match[2] || 'Unknown Author'
            });
        }
        
        return matches;
    }
    
    function checkForResourceRecommendations(text) {
        // Look for resources section with various possible headings
        const resourceRegex = /(?:Resources:|Here are some resources:|Learn more:|For more information:|Online resources:|Recommended resources:)([\s\S]*?)(?=\n\n|$)/g;
        const matches = [];
        let match;
        
        while ((match = resourceRegex.exec(text)) !== null) {
            const resourcesText = match[1].trim();
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const urlMatches = resourcesText.match(urlRegex) || [];
            
            urlMatches.forEach(url => {
                // Extract title from before the URL
                let title = resourcesText.split(url)[0].trim().replace(/^[•\-\*]\s*/, '');
                
                // If no title found, use the URL itself
                if (!title) {
                    title = url;
                }
                
                matches.push({
                    title: title,
                    url: url
                });
            });
        }
        
        return matches;
    }
    
    function addBookshelfMessage(books) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot', 'bookshelf-message');
        
        const messageContent = document.createElement('div');
        messageContent.classList.add('message-content');
        
        let html = '<p>I found some book recommendations:</p>';
        books.forEach(book => {
            html += `
                <div class="book-recommendation">
                    <p>"${book.title}" ${book.author !== 'Unknown Author' ? `by ${book.author}` : ''}</p>
                    <button class="add-to-bookshelf" data-title="${book.title}" data-author="${book.author}">
                        Add to Bookshelf
                    </button>
                </div>
            `;
        });
        
        messageContent.innerHTML = html;
        messageDiv.appendChild(messageContent);
        chatMessages.appendChild(messageDiv);
        
        // Add event listeners to the "Add to Bookshelf" buttons
        messageDiv.querySelectorAll('.add-to-bookshelf').forEach(button => {
            button.addEventListener('click', function() {
                const title = this.dataset.title;
                const author = this.dataset.author;
                addBookToBookshelf(title, author, currentSkillDomain);
                this.textContent = 'Added to Bookshelf';
                this.disabled = true;
            });
        });
    }
    
    function addResourceMessage(resources) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot', 'resource-message');
        
        const messageContent = document.createElement('div');
        messageContent.classList.add('message-content');
        
        let html = '<div class="resource-container">';
        html += '<div class="resource-title">Recommended Resources:</div>';
        resources.forEach(resource => {
            html += `
                <div class="resource-item">
                    <a href="${resource.url}" target="_blank" rel="noopener noreferrer" class="resource-link">
                        ${resource.title}
                    </a>
                    <button class="add-to-bookshelf" data-title="${resource.title}" data-url="${resource.url}">
                        Add to Bookshelf
                    </button>
                </div>
            `;
        });
        html += '</div>';
        
        messageContent.innerHTML = html;
        messageDiv.appendChild(messageContent);
        chatMessages.appendChild(messageDiv);
        
        // Add event listeners to the "Add to Bookshelf" buttons
        messageDiv.querySelectorAll('.add-to-bookshelf').forEach(button => {
            button.addEventListener('click', function() {
                const title = this.dataset.title;
                const url = this.dataset.url;
                addResourceToBookshelf(title, url, currentSkillDomain);
                this.textContent = 'Added to Bookshelf';
                this.disabled = true;
            });
        });
    }
    
    function addBookToBookshelf(title, author, category) {
        // Check if book already exists
        if (!books.some(book => book.title === title)) {
            books.push({
                title: title,
                author: author,
                category: category,
                read: false,
                dateAdded: new Date().toISOString()
            });
            localStorage.setItem('books', JSON.stringify(books));
            renderBookshelf();
        }
    }
    
    function addResourceToBookshelf(title, url, category) {
        // Check if resource already exists
        if (!books.some(book => book.title === title)) {
            books.push({
                title: title,
                author: 'Online Resource',
                category: category,
                read: false,
                dateAdded: new Date().toISOString(),
                url: url
            });
            localStorage.setItem('books', JSON.stringify(books));
            renderBookshelf();
        }
    }
    
    function toggleBookReadStatus(title) {
        const book = books.find(b => b.title === title);
        if (book) {
            book.read = !book.read;
            localStorage.setItem('books', JSON.stringify(books));
            renderBookshelf();
        }
    }
    
    function renderBookshelf() {
        bookshelf.innerHTML = '';
        
        // Add multi-select controls at the top
        const multiSelectControls = document.createElement('div');
        multiSelectControls.classList.add('multi-select-controls');
        multiSelectControls.innerHTML = `
            <div class="multi-select-actions">
                <button id="mark-selected-read" class="action-button">Mark Selected as Read</button>
                <button id="delete-selected" class="action-button">Delete Selected</button>
            </div>
        `;
        bookshelf.appendChild(multiSelectControls);
        
        // Filter books based on active tab
        const filteredBooks = activeTab === 'read' 
            ? books.filter(book => book.read)
            : books;
        
        if (filteredBooks.length === 0) {
            const emptyMessage = document.createElement('p');
            emptyMessage.classList.add('empty-bookshelf');
            emptyMessage.textContent = activeTab === 'read' 
                ? 'No read books yet.'
                : 'No books added yet. Books recommended by the assistant will appear here.';
            bookshelf.appendChild(emptyMessage);
            return;
        }
        
        // Sort books by date added (newest first)
        filteredBooks.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
        
        // Create a container for the books
        const booksContainer = document.createElement('div');
        booksContainer.classList.add('books-container');
        
        filteredBooks.forEach(book => {
            const bookItem = document.createElement('div');
            bookItem.classList.add('book-item');
            if (book.read) bookItem.classList.add('read');
            
            // Create title element - if it's a resource with URL, make it clickable
            let titleElement = `<div class="book-title">${book.title}</div>`;
            if (book.url) {
                titleElement = `<div class="book-title"><a href="${book.url}" target="_blank" rel="noopener noreferrer">${book.title}</a></div>`;
            }
            
            bookItem.innerHTML = `
                <div class="book-checkbox">
                    <input type="checkbox" id="book-${book.title.replace(/\s+/g, '-')}" ${book.read ? 'checked' : ''}>
                    <label for="book-${book.title.replace(/\s+/g, '-')}"></label>
                </div>
                <div class="book-info">
                    ${titleElement}
                    <div class="book-author">by ${book.author}</div>
                    <div class="book-category ${book.category}">${book.category}</div>
                </div>
            `;
            
            // Add event listener to checkbox
            const checkbox = bookItem.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', () => {
                if (!event.shiftKey) {
                    // Single select - toggle read status
                    toggleBookReadStatus(book.title);
                } else {
                    // Multi-select - just update the UI
                    bookItem.classList.toggle('selected');
                }
            });
            
            booksContainer.appendChild(bookItem);
        });
        
        bookshelf.appendChild(booksContainer);
        
        // Add event listeners for multi-select actions
        document.getElementById('mark-selected-read').addEventListener('click', markSelectedAsRead);
        document.getElementById('delete-selected').addEventListener('click', deleteSelected);
    }
    
    function markSelectedAsRead() {
        const selectedBooks = document.querySelectorAll('.book-item.selected');
        selectedBooks.forEach(bookItem => {
            const checkbox = bookItem.querySelector('input[type="checkbox"]');
            const title = bookItem.querySelector('.book-title').textContent;
            toggleBookReadStatus(title);
        });
    }
    
    function deleteSelected() {
        if (confirm('Are you sure you want to delete the selected items?')) {
            const selectedBooks = document.querySelectorAll('.book-item.selected');
            selectedBooks.forEach(bookItem => {
                const title = bookItem.querySelector('.book-title').textContent;
                deleteBook(title);
            });
        }
    }
    
    function deleteBook(title) {
        books = books.filter(book => book.title !== title);
        localStorage.setItem('books', JSON.stringify(books));
        renderBookshelf();
    }
    
    // Auto-resize textarea
    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
}); 