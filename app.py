from flask import Flask, render_template, request, jsonify
import redis
import json
from search import embed_query, cosine_similarity, retrieve_top_k, generate_response

app = Flask(__name__)

# Redis configuration
REDIS_HOST = "localhost"
REDIS_PORT = 6379
REDIS_DB = 0

# Initialize Redis connection
r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    query = data.get('message', '')
    skill_domain = data.get('skill_domain', 'both')
    read_books = data.get('read_books', [])

    # Retrieve relevant context
    context_chunks = retrieve_top_k(query, skill_domain)
    
    if not context_chunks:
        return jsonify({
            'response': "I couldn't find any relevant information for your query. Please try rephrasing your question."
        })

    # Generate response using the context
    response = generate_response(context_chunks, query, skill_domain, read_books)
    
    return jsonify({'response': response})

if __name__ == '__main__':
    app.run(debug=True) 