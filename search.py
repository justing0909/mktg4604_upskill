import redis
import numpy as np
import json
import requests
from numpy.linalg import norm

REDIS_HOST = "localhost"
REDIS_PORT = 6379
REDIS_DB = 0
OLLAMA_MODEL = "nomic-embed-text"
LLM_MODEL = "llama3.2:1b"  # Use llama3 if memory allows
TOP_K = 5

r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)

# Ask user for their skill domain
print("What would you like to upskill in?")
print("1. Data Science\n2. Business\n3. Both")
choice = input("Enter 1, 2, or 3: ").strip()

FILTER_KEYWORDS = []
if choice == "1":
    FILTER_KEYWORDS = ["Data Science"]
elif choice == "2":
    FILTER_KEYWORDS = ["Business"]
else:
    FILTER_KEYWORDS = []

def embed_query(query):
    response = requests.post("http://localhost:11434/api/embeddings", json={
        "model": OLLAMA_MODEL,
        "prompt": query
    })
    return np.array(response.json()["embedding"])

def cosine_similarity(a, b):
    return np.dot(a, b) / (norm(a) * norm(b))

def retrieve_top_k(query, k=TOP_K):
    query_embedding = embed_query(query)
    results = []

    for key in r.smembers("document_chunks"):
        key = key.decode()
        data = r.hgetall(key)
        source_path = data[b'source'].decode()

        if FILTER_KEYWORDS and not any(keyword in source_path for keyword in FILTER_KEYWORDS):
            continue

        chunk_embedding = np.array(json.loads(data[b'embedding'].decode()))
        similarity = cosine_similarity(query_embedding, chunk_embedding)
        results.append((similarity, data[b'text'].decode()))

    results.sort(reverse=True, key=lambda x: x[0])
    return [text for _, text in results[:k]]

def generate_response(context_chunks, query):
    context = "\n\n".join(context_chunks)
    full_prompt = f"""You are a helpful assistant answering questions about how the user can improve upon their current skillset.
Here is the context:
{context}

Answer the question: {query}"""

    response = requests.post("http://localhost:11434/api/generate", json={
        "model": LLM_MODEL,
        "prompt": full_prompt,
        "stream": False
    })
    return response.json()["response"]

if __name__ == "__main__":
    while True:
        query = input("\nEnter your question (or type 'exit' to quit): ")
        if query.lower() == "exit":
            print("\nThanks for using our upskill bot! Have a shrimply impeccable day.")
            break

        top_chunks = retrieve_top_k(query)
        if not top_chunks:
            print("No relevant information found for your skill area.")
        else:
            answer = generate_response(top_chunks, query)
            print("\nAnswer:")
            print(answer)
