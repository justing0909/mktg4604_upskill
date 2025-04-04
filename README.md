# MKTG4604: UI Upskill LLM System

### Business Problem:
**Upskilling** is commonly used in business practices, especially in competitive industries and with the constantly evolving landscape around tech and generative AI. Thus, the formulation of a chatbot where users can input the fields that they are in and/or skills that they want to upskill in, and we can use an API to offer textbooks along with other solutions (podcasts, LinkedIn learning, etc.) for them to upskill with.

### Agentic Elements:

### How to Run Demo:
- Download the zip file from this GitHub repository
- The "Corpus" folder contains .pdf files that the LLM system trains from by taking key terms to process
- 'ingest.py' is used to chunk and embed the files found in the "Corpus" folder, or simply the preprocessing stage
  - **IMPORTANT:** To run this successfully, make sure to replace the 'CORPUS' path directory with where you currently store it
-  'search.py' uses a vector database (Redis) along with LLM (llama3) and retrieves the best responses based on cosine similarity
