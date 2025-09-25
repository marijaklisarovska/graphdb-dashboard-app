from fastapi import FastAPI
from pydantic import BaseModel
import requests
import json
import os
from neo4j import GraphDatabase
from neo4j.graph import Node, Relationship, Path

app = FastAPI()

# Neo4j setup
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "dbmsmarija")

driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

class Prompt(BaseModel):
    prompt: str

NBA_SCHEMA = """
(:PLAYER{name, number, weight, age, height, salary, rebounds, assists, minutes, turnovers, points})
(:TEAM{name})
(:COACH{name})
Relationships:
(:PLAYER)-[:PLAYS_FOR]->(:TEAM)
(:PLAYER)-[:PLAYED_AGAINST {points}]->(:TEAM)
(:PLAYER)-[:TEAMMATES]->(:PLAYER)
(:COACH)-[:COACHES_FOR]->(:TEAM)
(:COACH)-[:COACHES]->(:PLAYER)
"""

# Clean up JSON response
def serialize(value):
    if isinstance(value, Node):
        return {
            "id": value.id,
            "labels": list(value.labels),
            "properties": dict(value)
        }
    elif isinstance(value, Relationship):
        return {
            "id": value.id,
            "type": value.type,
            "start": value.start_node.id,
            "end": value.end_node.id,
            "properties": dict(value)
        }
    elif isinstance(value, Path):
        return {
            "nodes": [serialize(n) for n in value.nodes],
            "relationships": [serialize(r) for r in value.relationships]
        }
    elif isinstance(value, list):
        return [serialize(v) for v in value]
    elif isinstance(value, dict):
        return {k: serialize(v) for k, v in value.items()}
    else:
        return value  

# Neo4j query run
def run_cypher(query: str):
    results = []
    with driver.session(database="nbatest") as session:
        for record in session.run(query):
            row = {}
            for key, value in record.items():
                if hasattr(value, "items"):  
                    row[key] = dict(value.items())  # just the node's properties, exclude additional stuff
                else:
                    row[key] = value
            results.append(row)
    return results


# Ollama setup
OLLAMA_HOST = "http://localhost:11434"
OLLAMA_MODEL = "gemma3:4b"

def query_ollama(prompt_text: str) -> str:
    instruction = f"""
You are an assistant that translates natural language questions into Cypher queries.
Use the schema below. Return only the Cypher query.
{NBA_SCHEMA}
Question: {prompt_text}
"""
    try:
        response = requests.post(
            f"{OLLAMA_HOST}/api/generate",
            json={"model": OLLAMA_MODEL, "prompt": instruction},
            timeout=60
        )
        response.raise_for_status()

        output = ""
        for line in response.iter_lines():
            if line:
                try:
                    chunk = json.loads(line.decode("utf-8"))
                    output += chunk.get("response") or chunk.get("text") or ""
                except json.JSONDecodeError:
                    continue

        cypher = output.replace("\\", "")   
        cypher = cypher.replace("```cypher", "").replace("```", "")  
        cypher = cypher.replace("\\n", "\n")
        cypher = cypher.strip()

        forbidden = ["create", "delete", "drop", "set"]
        if any(word in cypher.lower() for word in forbidden):
            return "(Unsafe Cypher detected, query not executed.)"
        
        return cypher
    except Exception as e:
        return f"(Error contacting Ollama: {e})"

# FastAPI endpoint
@app.post("/generate")
def generate_text(prompt: Prompt):
    cypher_query = query_ollama(prompt.prompt)
    if cypher_query.startswith("("):  
        return {"cypher": cypher_query, "results": []}

    results = run_cypher(cypher_query)
    return {"cypher": cypher_query, "results": results}

# Run app
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
