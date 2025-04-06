import redis
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Redis configuration
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB = int(os.getenv("REDIS_DB", 0))

# Connect to Redis
r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)

# Get all document chunks
document_chunks = r.smembers("document_chunks")
print(f"Found {len(document_chunks)} document chunks in Redis")

# Delete all document chunks
for key in document_chunks:
    key = key.decode()
    r.delete(key)
    print(f"Deleted {key}")

# Delete the set itself
r.delete("document_chunks")
print("Deleted document_chunks set")

print("Redis database cleared successfully") 