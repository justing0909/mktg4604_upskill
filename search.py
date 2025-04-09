import redis
import numpy as np
import json
import requests
from numpy.linalg import norm
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration from environment variables
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB = int(os.getenv("REDIS_DB", 0))
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "nomic-embed-text")
LLM_MODEL = os.getenv("LLM_MODEL", "llama3.2:latest")
TOP_K = int(os.getenv("TOP_K", 3))

r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)

def embed_query(query):
    print(f"Starting embed_query with query: '{query}'")
    print(f"Using Ollama model: {OLLAMA_MODEL}")
    
    try:
        # Prepare request data
        request_data = {
            "model": OLLAMA_MODEL,
            "prompt": query
        }
        print(f"Sending request to Ollama with data: {request_data}")
        
        # Make request
        response = requests.post(
            "http://localhost:11434/api/embeddings",
            json=request_data
        )
        
        # Log response status and headers
        print(f"Ollama response status: {response.status_code}")
        print(f"Ollama response headers: {dict(response.headers)}")
        
        # Check if response is successful
        if response.status_code != 200:
            print(f"Error response from Ollama: {response.text}")
            raise Exception(f"Ollama API returned status code {response.status_code}")
        
        # Try to parse response
        try:
            response_json = response.json()
            print("Successfully parsed JSON response")
            
            if 'embedding' not in response_json:
                print(f"Unexpected response format. Full response: {response_json}")
                raise Exception("No embedding found in response")
            
            embedding = response_json['embedding']
            print(f"Got embedding with dimensions: {len(embedding)}")
            
            return np.array(embedding)
            
        except json.JSONDecodeError as e:
            print(f"Failed to parse JSON response: {e}")
            print(f"Raw response text: {response.text}")
            raise Exception("Failed to parse Ollama response")
            
    except requests.exceptions.Timeout:
        print("Embedding request to Ollama timed out after 60 seconds")
        raise Exception("Embedding request timed out. The model might be overloaded or not responding.")
    except requests.exceptions.ConnectionError:
        print("Connection error when trying to reach Ollama")
        raise Exception("Could not connect to Ollama for embeddings. Please check if Ollama is running.")
    except Exception as e:
        print(f"Unexpected error in embed_query: {str(e)}")
        raise

def cosine_similarity(a, b):
    # Check if dimensions match
    if a.shape[0] != b.shape[0]:
        print(f"Dimension mismatch: query embedding has {a.shape[0]} dimensions, chunk embedding has {b.shape[0]} dimensions")
        
        # Resize the larger embedding to match the smaller one
        if a.shape[0] < b.shape[0]:
            # Resize chunk embedding to match query embedding
            b = b[:a.shape[0]]
            print(f"Resized chunk embedding to {b.shape[0]} dimensions")
        else:
            # Resize query embedding to match chunk embedding
            a = a[:b.shape[0]]
            print(f"Resized query embedding to {a.shape[0]} dimensions")
    
    return np.dot(a, b) / (norm(a) * norm(b))

def retrieve_top_k(query, skill_domain='both', k=TOP_K):
    print(f"Starting retrieve_top_k with query: '{query}', skill_domain: '{skill_domain}', k: {k}")
    try:
        query_embedding = embed_query(query)
        print("Query embedding generated")
    except Exception as e:
        print(f"Error generating query embedding: {e}")
        return ["I'm sorry, but I couldn't process your query due to an error with the embedding model. Please try again later."]
        
    results = []

    print("Retrieving document chunks from Redis")
    document_chunks = r.smembers("document_chunks")
    print(f"Found {len(document_chunks)} document chunks in Redis")
    
    for key in document_chunks:
        key = key.decode()
        data = r.hgetall(key)
        source_path = data[b'source'].decode()
        
        # Filter by skill domain if specified
        if skill_domain != 'both':
            if skill_domain == 'data-science':
                # Include documents from the Data Science folder
                if 'Data Science' not in source_path:
                    continue
            if skill_domain == 'business':
                # Include documents from the Business folder
                if 'Business' not in source_path:
                    continue

        chunk_embedding = np.array(json.loads(data[b'embedding'].decode()))
        similarity = cosine_similarity(query_embedding, chunk_embedding)
        results.append((similarity, data[b'text'].decode()))

    print(f"Found {len(results)} matching chunks after filtering")
    results.sort(reverse=True, key=lambda x: x[0])
    top_k_results = [text for _, text in results[:k]]
    print(f"Returning top {len(top_k_results)} chunks")
    return top_k_results

def generate_response(context_chunks, query, skill_domain='both', read_books=None):
    print("Starting generate_response function")
    context = "\n\n".join(context_chunks)

    if skill_domain == 'data-science':
        domain_text = (
            "Data Science: Your AI/Agent identity is a 26-year-old recent graduate with a background in statistics and data science, currently working in a junior analyst role at a healthcare startup. You are focused on deepening your skills in areas like machine learning, data visualization, and predictive modeling. You spend your free time working through online courses, participating in Kaggle competitions, and experimenting with Python and R to build personal projects. While you're comfortable writing code and using tools like pandas, scikit-learn, and Tableau, you're still learning how to structure end-to-end data workflows, communicate insights effectively to non-technical audiences, and evaluate model performance beyond just accuracy. Offer resources based on the corpus of data indexed, while providing directly accessible links and resources to the user, and continue the conversation after responding."
            "You are a chief data scientist and mentor, providing guidance to an ambitious senior undergraduate student. "
            "Focus on technical depth, real-world applications, and resources that strengthen programming, machine learning, data visualization, and data engineering skills."
            "Note to the agent: Do not repeat responses that other agents have already stated."
        )
    elif skill_domain == 'business':
        domain_text = (
            "Business: Your AI/Agent identity is a 38-year-old professional who recently transitioned into a business operations role after years working in customer service and team leadership. You are eager to grow your understanding of business fundamentals, while diving into topics like financial management, accounting basics, and key performance metrics. You are motivated by a desire to contribute more strategically at work and eventually move into a managerial position. You are currently learning how to read financial statements, build simple budgets, and understand core metrics like profit margin, cash flow, and return on investment. While you are comfortable with spreadsheets and online tools, you often finds the language of finance and accounting intimidating. You are looking for clear, jargon-free explanations, real-world examples, and visual aids that break down complex concepts into something you can apply right away. Offer resources based on the corpus of data indexed, while providing directly accessible links and resources to the user, and continue the conversation after responding."
            "You are a strategic business mentor and executive coach, advising a soon-to-graduate business major. "
            "Focus on core business principles, case-based learning, leadership, finance, and marketing strategies that are useful for entry-level professionals."
            "Note to the agent: Do not repeat responses that other agents have already stated."
        )
    else:
        domain_text = (
            "Data Science and Business: Your AI/Agent identity is a 22-year-old undergraduate student pursuing a dual degree in Data Science and Business Administration with a concentration in Financial Technology (FinTech). With a strong foundation in statistics, machine learning, and Python programming, you are equally comfortable analyzing data models as you are discussing market trends and business strategies. You thrive at the intersection of technology and finance, often exploring how data can drive smarter decisions in areas like portfolio optimization, risk analysis, and customer personalization. You have completed projects involving real-time financial dashboards, algorithmic trading simulations, and consumer behavior analysis. Passionate about innovation in the FinTech space, your ideal learning environment blends case studies, hands-on coding, and real-world data challenges that prepare you for roles that demand both analytical depth and strategic thinking."
            "You are a cross-domain upskilling mentor with deep experience in both Data Science and Business. "
            "Help the student understand how these domains intersect, and recommend resources that bridge analytics, strategy, and communication skills."
            "Note to the agent: Do not repeat responses that other agents have already stated."
        )

    read_books_text = ""
    if read_books and len(read_books) > 0:
        read_books_text = (
            f"\nNote: The student has already read the following books, so do not suggest them again: {', '.join(read_books)}."
        )
        
    full_prompt = f"""You are an AI-powered upskilling assistant helping students prepare for careers in their domain.

{domain_text}
{read_books_text}

Use the context below to answer their question. Always recommend:
- Relevant textbooks or academic readings
- Online resources, tools, or platforms (e.g. Coursera, LinkedIn Learning)
- Podcasts, newsletters, or blogs to stay up-to-date
- Key skills to practice and how to improve them
- Career-relevant advice

Only suggest what is relevant based on the users' requests or your expert knowledge.

Context:
{context}

Question: {query}
Upskilling-focused response:"""

    print(f"Sending request to Ollama with model: {LLM_MODEL}")
    try:
        response = requests.post("http://localhost:11434/api/generate", json={
            "model": LLM_MODEL,
            "prompt": full_prompt,
            "stream": False
        })

        print("Received response from Ollama")
        return response.json()["response"]

    except requests.exceptions.Timeout:
        print("Request to Ollama timed out")
        return "I'm sorry, but the model is taking too long to respond. This could be due to the complexity of your query or the model being overloaded. Please try again with a simpler query or try again later."

    except requests.exceptions.ConnectionError:
        print("Connection error when trying to reach Ollama")
        return "I'm sorry, but I couldn't connect to the language model. Please check if Ollama is running and try again."

    except Exception as e:
        print(f"Error in generate_response: {e}")
        return f"I encountered an error while generating a response: {str(e)}"

# Command-line interface
if __name__ == "__main__":
    skill_map = {"1": "data-science", "2": "business", "3": "both"}
    
    # Ask user for their skill domain
    print("What would you like to upskill in?")
    print("1. Data Science\n2. Business\n3. Both")
    choice = input("Enter 1, 2, or 3: ").strip()
    
    skill_domain = skill_map.get(choice, "both")

    read_books = input("\nList any books you've already read (comma-separated), or press Enter to skip: ")
    read_books_list = [book.strip() for book in read_books.split(",")] if read_books else []

    while True:
        query = input("\nEnter your question (or type 'exit' to quit): ")
        if query.lower() == "exit":
            print("\nThanks for using our upskill bot! Have a shrimply impeccable day.")
            break

        top_chunks = retrieve_top_k(query, skill_domain)
        if not top_chunks:
            print("No relevant information found for your skill area.")
        else:
            answer = generate_response(top_chunks, query, skill_domain=skill_domain, read_books=read_books_list)
            print("\nAnswer:")
            print(answer)
