## AI agent system for automatic dashboard generation 

This FastAPI application integrates the World Happiness Report database, converted in Neo4j, and the Ollama LLM to interpret user questions as Cypher queries, and visualizes them with Chart.js.


## Technical Specifications
Backend:
- FastAPI (Python)
- Neo4j (graph database)
- Ollama LLM (interprets natural language queries into Cypher)
- Python libraries: requests, pydantic, dotenv, ...

Frontend:
- HTML / CSS / JavaScript
- Chart.js (data visualizations)
- Fetch API (communicates with FastAPI)


## Installation
### RUN TO INSTALL DEPENDENCIES:
```
pip install -r requirements.txt
```

### RUN TO START APP:
```
uvicorn main:app --reload
```

### DOWNLOAD OLLAMA MODEL FROM:
https://ollama.com/download

### RUN IN CMD TO START MODEL:
```
ollama run gemma3:4b
```
