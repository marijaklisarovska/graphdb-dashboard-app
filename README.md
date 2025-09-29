## AI agent system for automatic dashboard generation 

This FastAPI application integrates the World Happiness Report database, converted in Neo4j, and the Ollama LLM to interpret user questions as Cypher queries, and visualizes them with Chart.js.

## App description

The World Happiness Report is a landmark survey of the state of global happiness. The happiness scores and rankings of each country are based on answers to the life evaluation questions asked in the Gallup World Poll. The dataset is originally tabular, therefore for this project converted into a graph dataset by defining a schema of nodes, relationships and properties and loaded in Neo4J.

**How the app works:** The user asks a question about the countries. This question in the background is sent as a prompt, along with the database schema, to a local Ollama3 model which processes it and accordingly generates a Cypher query. The query executes in Neo4J and the results are returned in JSON. The results are then visualized into a chart or a diagram by Chart.js.

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
