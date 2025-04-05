import os
import fitz
import redis
import hashlib
import json
import requests

# Constants (change the CORPUS_DIR to where your 'Corpus' folder is stored
REDIS_HOST = "localhost"
REDIS_PORT = 6379
REDIS_DB = 0
CORPUS_DIR = "Users/justi/Downloads/MKTG4604//mktg4604_upskill/Corpus"
OLLAMA_MODEL = "nomic-embed-text"

r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)

def get_pdf_text(file_path):
    doc = fitz.open(file_path)
    return "\n".join([page.get_text() for page in doc])

def chunk_text(text, max_words=250):
    words = text.split()
    return [" ".join(words[i:i+max_words]) for i in range(0, len(words), max_words)]

def embed_with_ollama(texts):
    response = requests.post("http://localhost:11434/api/embeddings", json={
        "model": OLLAMA_MODEL,
        "prompt": texts if isinstance(texts, str) else "\n".join(texts)
    })
    return response.json()["embedding"] if isinstance(texts, str) else response.json()["embeddings"]

def ingest_pdf(file_path):
    print(f"Ingesting {file_path}")
    raw_text = get_pdf_text(file_path)
    chunks = chunk_text(raw_text)

    for i, chunk in enumerate(chunks):
        chunk_id = hashlib.md5((file_path + str(i)).encode()).hexdigest()
        embedding = embed_with_ollama(chunk)
        key = f"chunk:{chunk_id}"
        r.hset(key, mapping={
            "text": chunk,
            "embedding": json.dumps(embedding),
            "source": file_path
        })
        r.sadd("document_chunks", key)

if __name__ == "__main__":
    for root, _, files in os.walk(CORPUS_DIR):
        for file in files:
            if file.endswith(".pdf"):
                ingest_pdf(os.path.join(root, file))

    print("Ingestion complete.")
