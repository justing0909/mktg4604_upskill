import redis
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Redis configuration from environment variables
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB = int(os.getenv("REDIS_DB", 0))

# Initialize Redis connection
r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)

def check_redis():
    print("Checking Redis database...")
    
    # Check if Redis is connected
    try:
        r.ping()
        print("Successfully connected to Redis")
    except redis.ConnectionError:
        print("Failed to connect to Redis. Is Redis running?")
        return
    
    # Get all keys
    all_keys = r.keys()
    print(f"Total number of keys in Redis: {len(all_keys)}")
    
    # Check document chunks
    document_chunks = r.smembers("document_chunks")
    print(f"Number of document chunks: {len(document_chunks)}")
    
    # Check bookshelf
    bookshelf = r.hgetall("bookshelf")
    print(f"Number of books in bookshelf: {len(bookshelf)}")
    
    # Sample a few document chunks to check their structure
    if document_chunks:
        print("\nSample document chunks:")
        # Convert set to list and take first 3 items
        chunk_keys = list(document_chunks)[:3]
        
        for i, key in enumerate(chunk_keys):
            key = key.decode()
            data = r.hgetall(key)
            print(f"\nChunk {i+1}: {key}")
            print(f"Source: {data[b'source'].decode()}")
            print(f"Text length: {len(data[b'text'].decode())} characters")
            
            # Check embedding dimensions
            embedding = json.loads(data[b'embedding'].decode())
            print(f"Embedding dimensions: {len(embedding)}")
            
            # Print a small sample of the text
            text_sample = data[b'text'].decode()[:100] + "..."
            print(f"Text sample: {text_sample}")

if __name__ == "__main__":
    check_redis() 