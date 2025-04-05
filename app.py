from flask import Flask, render_template, request, jsonify
import redis
import numpy as np
import json
import requests
from numpy.linalg import norm

app = Flask(__name__)

# Constants
REDIS_HOST = "localhost"
REDIS_PORT = 6379
REDIS_DB = 0
OLLAMA_MODEL = "nomic-embed-text"
LLM_MODEL = "llama3.2:1b"  # This is a mini llama3 model for low RAM systems
TOP_K = 5

# Initialize Redis connection
r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)

def embed_query(query):
    response = requests.post("http://localhost:11434/api/embeddings", json={
        "model": OLLAMA_MODEL,
        "prompt": query
    })
    return np.array(response.json()["embedding"])

def cosine_similarity(a, b):
    return np.dot(a, b) / (norm(a) * norm(b))

def retrieve_top_k(query, skill_domain='both', k=TOP_K):
    query_embedding = embed_query(query)
    results = []

    for key in r.smembers("document_chunks"):
        key = key.decode()
        data = r.hgetall(key)
        source_path = data[b'source'].decode()
        
        # Filter by skill domain if specified
        if skill_domain != 'both':
            if skill_domain == 'data-science' and 'Data Science' not in source_path:
                continue
            if skill_domain == 'business' and 'Business' not in source_path:
                continue
                
        chunk_embedding = np.array(json.loads(data[b'embedding'].decode()))
        similarity = cosine_similarity(query_embedding, chunk_embedding)
        results.append((similarity, data[b'text'].decode()))

    results.sort(reverse=True, key=lambda x: x[0])
    return [text for _, text in results[:k]]

def generate_response(context_chunks, query, skill_domain='both'):
    context = "\n\n".join(context_chunks)
    
    # Customize prompt based on skill domain
    domain_text = ""
    if skill_domain == 'data-science':
        domain_text = "Focus on Data Science skills and concepts."
    elif skill_domain == 'business':
        domain_text = "Focus on Business skills and concepts."
    else:
        domain_text = "Cover both Data Science and Business skills as appropriate."
    
    full_prompt = f"""You are a helpful assistant providing guidance on upskilling.
{domain_text}
Here is the context:
{context}

Answer the question: {query}"""

    response = requests.post("http://localhost:11434/api/generate", json={
        "model": LLM_MODEL,
        "prompt": full_prompt,
        "stream": False
    })
    return response.json()["response"]

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    query = data.get('message', '')
    skill_domain = data.get('skill_domain', 'both')
    
    if not query:
        return jsonify({'error': 'No message provided'}), 400
    
    try:
        # Retrieve relevant context chunks
        top_chunks = retrieve_top_k(query, skill_domain)
        
        # Generate response using the Llama model
        answer = generate_response(top_chunks, query, skill_domain)
        
        return jsonify({
            'response': answer,
            'status': 'success'
        })
    except Exception as e:
        return jsonify({
            'error': str(e),
            'status': 'error'
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001) 