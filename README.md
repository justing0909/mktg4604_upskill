# MKTG4604: UI Upskill LLM System

### Business Problem:
**Upskilling** is commonly used in business practices, especially in competitive industries and with the constantly evolving landscape around tech and generative AI. Thus, the formulation of a chatbot where users can input the fields that they are in and/or skills that they want to upskill in, and we can use an API to offer textbooks along with other solutions (podcasts, LinkedIn learning, etc.) for them to upskill with.

### Agentic Elements:

### How to Run Demo:
- Download the zip file from this GitHub repository
- The "Corpus" folder contains .pdf files that the LLM system trains from by taking key terms to process
- 'ingest.py' is used to chunk and embed the files found in the "Corpus" folder, or simply the preprocessing stage
  - **IMPORTANT:** To run this successfully, make sure to replace the 'CORPUS' path directory with where you currently store it
- 'search.py' uses a vector database (Redis) along with LLM (llama3) and retrieves the best responses based on cosine similarity

### Web Interface Setup and Usage:

#### Prerequisites:
- Python 3.8 or higher
- Redis server running locally (default: localhost:6379)
- Ollama running locally with the required models (nomic-embed-text and llama3.2:1b)

#### Installation:
1. Install the required dependencies:
   ```
   pip install -r requirements.txt
   ```

2. Make sure Redis is running on your system:
   ```
   redis-server
   ```

3. Make sure Ollama is running with the required models:
   ```
   ollama run nomic-embed-text
   ollama run llama3.2:1b
   ```

#### Running the Application:
1. First, ingest the PDF documents:
   ```
   python ingest.py
   ```

2. Start the web application:
   ```
   python app.py
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:5001
   ```

4. Start chatting with the Llama model about the content in your PDF documents!

#### Features:
- Modern, responsive chat interface
- Real-time typing indicators
- Support for multi-line messages (Shift+Enter)
- Error handling and user feedback
- Mobile-friendly design
