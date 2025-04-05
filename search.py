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

    results.sort(reverse=True, key=lambda x: x[0])
    return [text for _, text in results[:k]]

def generate_response(context_chunks, query, skill_domain='both', read_books=None):
    context = "\n\n".join(context_chunks)
    
    # Customize prompt based on skill domain
    domain_text = ""
    if skill_domain == 'data-science':
        domain_text = "Data Science: Kevin Lin is a 26-year-old recent graduate with a background in statistics and data science, currently working in a junior analyst role at a healthcare startup. He is focused on deepening his skills in areas like machine learning, data visualization, and predictive modeling. Kevin spends his free time working through online courses, participating in Kaggle competitions, and experimenting with Python and R to build personal projects. While he's comfortable writing code and using tools like pandas, scikit-learn, and Tableau, he's still learning how to structure end-to-end data workflows, communicate insights effectively to non-technical audiences, and evaluate model performance beyond just accuracy. Offer resources based on the corpus of data indexed, while providing directly accessible links and resources to the user, and continue the conversation after responding."
    elif skill_domain == 'business':
        domain_text = "Business: Maria Alvarez is a 38-year-old professional who recently transitioned into a business operations role after years working in customer service and team leadership. Eager to grow her understanding of business fundamentals, she's diving into topics like financial management, accounting basics, and key performance metrics. Maria is motivated by a desire to contribute more strategically at work and eventually move into a managerial position. She's currently learning how to read financial statements, build simple budgets, and understand core metrics like profit margin, cash flow, and return on investment. While she's comfortable with spreadsheets and online tools, she often finds the language of finance and accounting intimidating. Maria is looking for clear, jargon-free explanations, real-world examples, and visual aids that break down complex concepts into something she can apply right away. Offer resources based on the corpus of data indexed, while providing directly accessible links and resources to the user, and continue the conversation after responding."
    else:
        domain_text = "Alex Chen is a 22-year-old undergraduate student pursuing a dual degree in Data Science and Business Administration with a concentration in Financial Technology (FinTech). With a strong foundation in statistics, machine learning, and Python programming, Alex is equally comfortable analyzing data models as he is discussing market trends and business strategies. He thrives at the intersection of technology and finance, often exploring how data can drive smarter decisions in areas like portfolio optimization, risk analysis, and customer personalization. Alex has completed projects involving real-time financial dashboards, algorithmic trading simulations, and consumer behavior analysis. Passionate about innovation in the FinTech space, His ideal learning environment blends case studies, hands-on coding, and real-world data challenges that prepare him for roles that demand both analytical depth and strategic thinking."
    
    # Add information about read books
    read_books_text = ""
    if read_books and len(read_books) > 0:
        read_books_text = f"The user has already read the following books, so please avoid recommending them again: {', '.join(read_books)}."
    
    full_prompt = f"""You are a helpful assistant providing guidance on upskilling.
{domain_text}
{read_books_text}

When recommending resources:
1. Format book recommendations as "Title" by Author
2. Include direct links to online resources when available
3. Group resources under clear headings like "Here are some resources:" or "Learn more:"
4. Make recommendations specific to the user's question

Here is the context:
{context}

Answer the question: {query}"""

    response = requests.post("http://localhost:11434/api/generate", json={
        "model": LLM_MODEL,
        "prompt": full_prompt,
        "stream": False
    })

    return response.json()["response"]

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
