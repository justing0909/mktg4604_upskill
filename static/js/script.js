document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM fully loaded and parsed");
    
    // DOM Elements
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatMessages = document.getElementById('chat-messages');
    const skillOptions = document.querySelectorAll('.skill-option');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const clearBookshelfBtn = document.getElementById('clear-bookshelf');
    const bookshelfTabs = document.querySelectorAll('.bookshelf-tab');
    const bookshelf = document.getElementById('bookshelf');
    const sidebar = document.querySelector('.sidebar');
    const drawerToggle = document.querySelector('.drawer-toggle');
    const sendButton = document.getElementById('send-button');
    
    console.log("Bookshelf element:", bookshelf);
    console.log("Sidebar element:", sidebar);
    console.log("Drawer toggle element:", drawerToggle);
    
    // State variables
    let currentSkillDomain = 'both';
    let lastSelectedSkillDomain = 'both';
    let books = JSON.parse(localStorage.getItem('books')) || [];
    let activeTab = 'all';
    
    console.log("Current books in localStorage:", books);
    
    // Add a test book if the bookshelf is empty
    if (books.length === 0) {
        books.push({
            title: "Test Book",
            author: "Test Author",
            category: "data-science",
            read: false,
            dateAdded: new Date().toISOString()
        });
        localStorage.setItem('books', JSON.stringify(books));
        console.log("Added test book to bookshelf");
    }
    
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
    
    // Initialize drawer toggle
    if (drawerToggle && sidebar) {
        drawerToggle.addEventListener('click', function() {
            console.log('Drawer toggle clicked');
            sidebar.classList.toggle('collapsed');
            console.log('Sidebar collapsed state:', sidebar.classList.contains('collapsed'));
        });
    } else {
        console.error('Drawer toggle or sidebar not found');
    }
    
    // Initialize bookshelf
    console.log("Rendering bookshelf...");
    renderBookshelf();
    console.log("Bookshelf rendered");
    
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
    
    // Update send button state based on input content
    userInput.addEventListener('input', function() {
        if (this.value.trim()) {
            sendButton.classList.add('active');
        } else {
            sendButton.classList.remove('active');
        }
        
        // Existing auto-resize code
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
    
    // Handle chat form submission
    chatForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const message = userInput.value.trim();
        if (!message) return;
        
        // Add user message to chat
        addMessage(message, 'user');
        userInput.value = '';
        sendButton.classList.remove('active');
        
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
    
    // Multi-select functionality
    function updateMultiSelectControls() {
        const selectedItems = document.querySelectorAll('.resource-item.selected');
        const multiSelectControls = document.querySelector('.multi-select-controls');
        
        if (selectedItems.length > 0) {
            multiSelectControls.classList.add('visible');
        } else {
            multiSelectControls.classList.remove('visible');
        }
    }

    function handleResourceSelection(checkbox, resourceItem) {
        if (checkbox.checked) {
            resourceItem.classList.add('selected');
        } else {
            resourceItem.classList.remove('selected');
        }
        updateMultiSelectControls();
    }

    // Mark selected as read
    document.getElementById('mark-selected-read').addEventListener('click', () => {
        const selectedItems = document.querySelectorAll('.resource-item.selected');
        selectedItems.forEach(item => {
            const checkbox = item.querySelector('input[type="checkbox"]');
            checkbox.checked = true;
            item.classList.add('read');
        });
        updateMultiSelectControls();
    });

    // Delete selected
    document.getElementById('delete-selected').addEventListener('click', () => {
        if (confirm('Are you sure you want to delete the selected items?')) {
            const selectedItems = document.querySelectorAll('.resource-checkbox:checked');
            const books = JSON.parse(localStorage.getItem('books') || '[]');
            
            selectedItems.forEach(checkbox => {
                const resourceItem = checkbox.closest('.resource-item');
                const title = resourceItem.querySelector('.resource-title').textContent;
                const bookIndex = books.findIndex(b => b.title === title);
                if (bookIndex !== -1) {
                    books.splice(bookIndex, 1);
                }
            });
            
            localStorage.setItem('books', JSON.stringify(books));
            renderBookshelf();
        }
    });

    // Handle clear all in current tab
    document.getElementById('clear-bookshelf').addEventListener('click', () => {
        const activeTab = document.querySelector('.bookshelf-tab.active').dataset.tab;
        if (confirm(`Are you sure you want to clear all ${activeTab === 'read' ? 'read' : 'unread'} resources?`)) {
            const books = JSON.parse(localStorage.getItem('books') || '[]');
            const remainingBooks = activeTab === 'read'
                ? books.filter(book => !book.read)
                : books.filter(book => book.read);
            
            localStorage.setItem('books', JSON.stringify(remainingBooks));
            renderBookshelf();
        }
    });

    // Add select all functionality
    const selectAllBtn = document.createElement('button');
    selectAllBtn.id = 'select-all';
    selectAllBtn.innerHTML = '<i class="fas fa-check-double"></i> Select All';
    selectAllBtn.className = 'control-btn select-all';

    // Insert select all button before the clear button
    const multiSelectControls = document.querySelector('.clear-button');
    multiSelectControls.parentNode.insertBefore(selectAllBtn, multiSelectControls);

    selectAllBtn.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.resource-checkbox');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        
        checkboxes.forEach(checkbox => {
            checkbox.checked = !allChecked;
            const resourceItem = checkbox.closest('.resource-item');
            resourceItem.classList.toggle('selected', !allChecked);
        });
        
        updateSelection();
    });

    // Update resource item creation
    function createResourceElement(resource) {
        const resourceItem = document.createElement('div');
        resourceItem.className = 'resource-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'resource-checkbox';
        
        const resourceInfo = document.createElement('div');
        resourceInfo.className = 'resource-info';
        
        const title = document.createElement('div');
        title.className = 'resource-title';
        title.textContent = resource.title;
        
        const description = document.createElement('div');
        description.className = 'resource-description';
        description.textContent = resource.author;
        
        const category = document.createElement('div');
        category.className = `resource-category ${resource.category}`;
        category.textContent = resource.category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        const starButton = document.createElement('button');
        starButton.className = 'star-button' + (resource.starred ? ' starred' : '');
        starButton.innerHTML = '<i class="fas fa-star"></i>';
        starButton.title = resource.starred ? 'Unstar Resource' : 'Star Resource';
        
        starButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const books = JSON.parse(localStorage.getItem('books') || '[]');
            const book = books.find(b => b.title === resource.title);
            if (book) {
                book.starred = !book.starred;
                localStorage.setItem('books', JSON.stringify(books));
                starButton.classList.toggle('starred');
                starButton.title = book.starred ? 'Unstar Resource' : 'Star Resource';
            }
        });
        
        resourceInfo.appendChild(title);
        resourceInfo.appendChild(description);
        resourceInfo.appendChild(category);
        
        resourceItem.appendChild(checkbox);
        resourceItem.appendChild(resourceInfo);
        resourceItem.appendChild(starButton);
        
        // Add click handler for selection
        resourceItem.addEventListener('click', (e) => {
            if (e.target !== checkbox && e.target !== starButton && !starButton.contains(e.target)) {
                checkbox.checked = !checkbox.checked;
                resourceItem.classList.toggle('selected', checkbox.checked);
                updateSelection();
            }
        });
        
        checkbox.addEventListener('change', (e) => {
            resourceItem.classList.toggle('selected', e.target.checked);
            updateSelection();
        });
        
        return resourceItem;
    }
    
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
            personaMessage = "Hi! I'm Kevin, your Data Science upskilling assistant. I can help you with topics like machine learning, data analysis, programming, and statistical methods. What would you like to learn about?";
        } else if (skill === 'business') {
            personaMessage = "Hi! I'm María, your Business upskilling assistant. I can help you with topics like marketing, finance, management, and entrepreneurship. What would you like to learn about?";
        } else {
            personaMessage = "Hi! I'm Alex, your upskilling assistant for both Data Science and Business. I can help you develop skills in either or both areas. What would you like to learn about?";
        }
        addMessage(personaMessage, 'bot');
    }
    
    function addMessage(content, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender);
        
        const messageContent = document.createElement('div');
        messageContent.classList.add('message-content');
        
        // Convert asterisks to bullet points
        let processedContent = content;
        
        // Check if the content contains asterisks that might be bullet points
        if (content.includes('*')) {
            // Split the content by newlines
            const lines = content.split('\n');
            let inBulletList = false;
            let bulletList = [];
            
            // Process each line
            const processedLines = lines.map(line => {
                // Check if line starts with an asterisk
                if (line.trim().startsWith('*')) {
                    if (!inBulletList) {
                        inBulletList = true;
                        bulletList = [];
                    }
                    // Add the line without the asterisk to the bullet list
                    bulletList.push(line.trim().substring(1).trim());
                    return null; // Skip this line in the main content
                } else {
                    // If we were in a bullet list and this line doesn't start with an asterisk,
                    // end the bullet list
                    if (inBulletList) {
                        inBulletList = false;
                        // Create a bullet list HTML
                        const bulletListHTML = `<ul>${bulletList.map(item => `<li>${item}</li>`).join('')}</ul>`;
                        return bulletListHTML + line;
                    }
                    return line;
                }
            });
            
            // If we ended while still in a bullet list, add the bullet list to the end
            if (inBulletList) {
                processedLines.push(`<ul>${bulletList.map(item => `<li>${item}</li>`).join('')}</ul>`);
            }
            
            // Join the lines back together
            processedContent = processedLines.filter(line => line !== null).join('\n');
        }
        
        // Process links in the message
        const processedContentWithLinks = processLinks(processedContent);
        messageContent.innerHTML = processedContentWithLinks;
        
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
    
    function addBookToBookshelf(title, description, category) {
        // Check if book already exists
        if (!books.some(book => book.title === title)) {
            books.push({
                title: title,
                author: description || 'No description available',
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
        console.log('Starting renderBookshelf');
        const bookshelf = document.getElementById('bookshelf');
        if (!bookshelf) {
            console.error('Bookshelf element not found');
            return;
        }

        // Clear the bookshelf
        bookshelf.innerHTML = '';

        // Get books from localStorage
        const books = JSON.parse(localStorage.getItem('books') || '[]');
        console.log('Books from localStorage:', books);

        // Filter books based on active tab
        const activeTab = document.querySelector('.bookshelf-tab.active').dataset.tab;
        let filteredBooks;
        
        switch (activeTab) {
            case 'read':
                filteredBooks = books.filter(book => book.read);
                break;
            case 'starred':
                filteredBooks = books.filter(book => book.starred);
                break;
            default: // unread
                filteredBooks = books.filter(book => !book.read);
        }

        // Update mark selected button text
        const markSelectedButton = document.getElementById('mark-selected-read');
        if (activeTab === 'read') {
            markSelectedButton.innerHTML = '<i class="fas fa-times"></i> Mark Selected as Unread';
        } else {
            markSelectedButton.innerHTML = '<i class="fas fa-check"></i> Mark Selected as Read';
        }

        // Show empty message if no books
        if (filteredBooks.length === 0) {
            const emptyMessage = document.createElement('p');
            emptyMessage.className = 'empty-bookshelf';
            switch (activeTab) {
                case 'read':
                    emptyMessage.textContent = 'No read resources yet. Mark resources as read to see them here.';
                    break;
                case 'starred':
                    emptyMessage.textContent = 'No starred resources yet. Star resources to see them here.';
                    break;
                default:
                    emptyMessage.textContent = 'No unread resources yet. Resources recommended by the assistant will appear here.';
            }
            bookshelf.appendChild(emptyMessage);
            return;
        }

        // Create book items
        filteredBooks.forEach(book => {
            const resourceElement = createResourceElement(book);
            bookshelf.appendChild(resourceElement);
        });
    }
    
    function updateSelection() {
        const selectedItems = document.querySelectorAll('.resource-checkbox:checked');
        const multiSelectControls = document.querySelector('.multi-select-controls');
        
        if (selectedItems.length > 0) {
            multiSelectControls.classList.add('visible');
        } else {
            multiSelectControls.classList.remove('visible');
        }
    }

    // Handle marking selected as read/unread
    document.getElementById('mark-selected-read').addEventListener('click', () => {
        const selectedItems = document.querySelectorAll('.resource-checkbox:checked');
        const books = JSON.parse(localStorage.getItem('books') || '[]');
        const activeTab = document.querySelector('.bookshelf-tab.active').dataset.tab;
        
        selectedItems.forEach(checkbox => {
            const resourceItem = checkbox.closest('.resource-item');
            const title = resourceItem.querySelector('.resource-title').textContent;
            
            const book = books.find(b => b.title === title);
            if (book) {
                book.read = activeTab !== 'read';
            }
        });
        
        localStorage.setItem('books', JSON.stringify(books));
        renderBookshelf();
    });

    // Handle tab switching
    document.querySelectorAll('.bookshelf-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.bookshelf-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderBookshelf();
        });
    });
    
    // Auto-resize textarea
    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    // Update tab text
    document.querySelector('.bookshelf-tab[data-tab="all"]').textContent = 'Unread Resources';
}); 
