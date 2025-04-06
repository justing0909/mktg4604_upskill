from flask import Flask, render_template, request, jsonify
import redis
import json
import os
from dotenv import load_dotenv
from search import embed_query, cosine_similarity, retrieve_top_k, generate_response

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Redis configuration from environment variables
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB = int(os.getenv("REDIS_DB", 0))

# Initialize Redis connection
r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    print("Received chat request")
    data = request.json
    query = data.get('message', '')
    skill_domain = data.get('skill_domain', 'both')
    read_books = data.get('read_books', [])
    
    print(f"Processing query: '{query}', skill_domain: '{skill_domain}'")

    # Retrieve relevant context
    print("Retrieving top k chunks")
    context_chunks = retrieve_top_k(query, skill_domain)
    print(f"Retrieved {len(context_chunks)} context chunks")
    
    if not context_chunks:
        print("No relevant context found")
        return jsonify({
            'response': "I couldn't find any relevant information for your query. Please try rephrasing your question."
        })

    # Generate response using the context
    print("Generating response")
    response = generate_response(context_chunks, query, skill_domain, read_books)
    print("Response generated")
    
    return jsonify({'response': response})

@app.route('/api/bookshelf', methods=['GET'])
def get_bookshelf():
    """Get all books from the bookshelf"""
    books = r.hgetall('bookshelf')
    if not books:
        return jsonify([])
    
    # Convert bytes to strings and parse JSON
    books_list = []
    for book_id, book_data in books.items():
        book = json.loads(book_data.decode())
        book['id'] = book_id.decode()
        books_list.append(book)
    
    return jsonify(books_list)

@app.route('/api/bookshelf', methods=['POST'])
def add_to_bookshelf():
    """Add a book to the bookshelf"""
    data = request.json
    book_id = data.get('id')
    book_data = {
        'title': data.get('title'),
        'author': data.get('author'),
        'category': data.get('category'),
        'read': data.get('read', False),
        'date_added': data.get('date_added')
    }
    
    # Store book in Redis
    r.hset('bookshelf', book_id, json.dumps(book_data))
    
    return jsonify({'status': 'success', 'message': 'Book added to bookshelf'})

@app.route('/api/bookshelf/<book_id>', methods=['PUT'])
def update_book(book_id):
    """Update a book's status (e.g., mark as read)"""
    data = request.json
    book_data = r.hget('bookshelf', book_id)
    
    if not book_data:
        return jsonify({'status': 'error', 'message': 'Book not found'}), 404
    
    book = json.loads(book_data.decode())
    book.update(data)
    
    r.hset('bookshelf', book_id, json.dumps(book))
    
    return jsonify({'status': 'success', 'message': 'Book updated'})

@app.route('/api/bookshelf/<book_id>', methods=['DELETE'])
def delete_book(book_id):
    """Remove a book from the bookshelf"""
    if r.hdel('bookshelf', book_id):
        return jsonify({'status': 'success', 'message': 'Book removed from bookshelf'})
    return jsonify({'status': 'error', 'message': 'Book not found'}), 404

@app.route('/api/bookshelf/clear', methods=['POST'])
def clear_bookshelf():
    """Clear all books from the bookshelf"""
    r.delete('bookshelf')
    return jsonify({'status': 'success', 'message': 'Bookshelf cleared'})

if __name__ == '__main__':
    app.run(debug=True) 