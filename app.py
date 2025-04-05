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

def generate_response(context_chunks, query, skill_domain='both', read_books=None):
    context = "\n\n".join(context_chunks)
    
    # Customize prompt based on skill domain
    domain_text = ""
    if skill_domain == 'data-science':
        domain_text = "Data Science: Kevin Lin is a 26-year-old recent graduate with a background in statistics and data science, currently working in a junior analyst role at a healthcare startup. He is focused on deepening his skills in areas like machine learning, data visualization, and predictive modeling. Kevin spends his free time working through online courses, participating in Kaggle competitions, and experimenting with Python and R to build personal projects. While he’s comfortable writing code and using tools like pandas, scikit-learn, and Tableau, he’s still learning how to structure end-to-end data workflows, communicate insights effectively to non-technical audiences, and evaluate model performance beyond just accuracy. Offer resources based on the corpus of data indexed, while providing directly accessible links and resources to the user, and continue the conversation after responding."
    elif skill_domain == 'business':
        domain_text = "Business: Maria Alvarez is a 38-year-old professional who recently transitioned into a business operations role after years working in customer service and team leadership. Eager to grow her understanding of business fundamentals, shes diving into topics like financial management, accounting basics, and key performance metrics. Maria is motivated by a desire to contribute more strategically at work and eventually move into a managerial position. Shes currently learning how to read financial statements, build simple budgets, and understand core metrics like profit margin, cash flow, and return on investment. While shes comfortable with spreadsheets and online tools, she often finds the language of finance and accounting intimidating. Maria is looking for clear, jargon-free explanations, real-world examples, and visual aids that break down complex concepts into something she can apply right away. Offer resources based on the corpus of data indexed, while providing directly accessible links and resources to the user, and continue the conversation after responding."
    else:
        domain_text = "Cover both Data Science and Business skills as appropriate, and assume the role of a chief data scientist and chief business officer that are both knowledgeable and relatable to a senior year undergraduate student. Offer resources based on the corpus of data indexed, while providing directly accessible links and resources to the user, and continue the conversation after responding."
    
    # Add information about read books
    read_books_text = ""
    if read_books and len(read_books) > 0:
        read_books_text = f"The user has already read the following books, so please avoid recommending them again: {', '.join(read_books)}."
    
    full_prompt = f"""You are a helpful assistant providing guidance on upskilling.
{domain_text}
{read_books_text}
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
    read_books = data.get('read_books', [])
    
    if not query:
        return jsonify({'error': 'No message provided'}), 400
    
    try:
        # Retrieve relevant context chunks
        top_chunks = retrieve_top_k(query, skill_domain)
        
        # Generate response using the Llama model
        answer = generate_response(top_chunks, query, skill_domain, read_books)
        
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