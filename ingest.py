import os
import redis
import json
import numpy as np
import requests
from dotenv import load_dotenv
import PyPDF2
import glob

# Load environment variables
load_dotenv()

# Configuration from environment variables
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB = int(os.getenv("REDIS_DB", 0))
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "nomic-embed-text")
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", 1000))

r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)

def extract_text_from_pdf(pdf_path):
    with open(pdf_path, 'rb') as file:
        reader = PyPDF2.PdfReader(file)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
    return text

def chunk_text(text, chunk_size=CHUNK_SIZE):
    words = text.split()
    chunks = []
    current_chunk = []
    current_size = 0
    
    for word in words:
        current_chunk.append(word)
        current_size += len(word) + 1  # +1 for space
        
        if current_size >= chunk_size:
            chunks.append(" ".join(current_chunk))
            current_chunk = []
            current_size = 0
    
    if current_chunk:
        chunks.append(" ".join(current_chunk))
    
    return chunks

def embed_with_ollama(texts):
    print(f"Embedding text with model: {OLLAMA_MODEL}")
    try:
        response = requests.post("http://localhost:11434/api/embeddings", json={
            "model": OLLAMA_MODEL,
            "prompt": texts if isinstance(texts, str) else " ".join(texts)
        }, timeout=30)
        
        print("Received embedding response from Ollama")
        return np.array(response.json()["embedding"])
    except requests.exceptions.Timeout:
        print("Embedding request to Ollama timed out after 30 seconds")
        raise Exception("Embedding request timed out. The model might be overloaded or not responding.")
    except requests.exceptions.ConnectionError:
        print("Connection error when trying to reach Ollama for embeddings")
        raise Exception("Could not connect to Ollama for embeddings. Please check if Ollama is running.")
    except Exception as e:
        print(f"Error in embed_with_ollama: {e}")
        raise

def ingest_document(file_path):
    print(f"Ingesting document: {file_path}")
    try:
        text = extract_text_from_pdf(file_path)
        chunks = chunk_text(text)
        
        for i, chunk in enumerate(chunks):
            embedding = embed_with_ollama(chunk)
            
            # Store in Redis
            key = f"doc:{file_path}:chunk:{i}"
            r.hset(key, mapping={
                'text': chunk,
                'embedding': json.dumps(embedding.tolist()),
                'source': file_path
            })
            
            # Add to set of all document chunks
            r.sadd("document_chunks", key)
            
        print(f"Successfully ingested {len(chunks)} chunks from {file_path}")
    except Exception as e:
        print(f"Error ingesting document {file_path}: {e}")

def main():
    # Clear existing data
    print("Clearing existing data from Redis")
    for key in r.keys():
        r.delete(key)
    
    # Get all PDF files from the Corpus directory
    pdf_files = glob.glob("Corpus/**/*.pdf", recursive=True)
    print(f"Found {len(pdf_files)} PDF files to ingest")
    
    for pdf_file in pdf_files:
        ingest_document(pdf_file)

if __name__ == "__main__":
    main()
