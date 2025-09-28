from fastapi import FastAPI
from pydantic import BaseModel
import requests
import json
import os
from neo4j import GraphDatabase
from neo4j.graph import Node, Relationship, Path
from dotenv import load_dotenv

app = FastAPI()

dotenv_path = os.path.join(os.path.dirname(__file__), ".env")  # always points to same folder as main.py
load_dotenv(dotenv_path)

# Neo4j setup
NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = os.getenv("NEO4J_USER")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

print("NEO4J_URI:", os.getenv("NEO4J_URI"))
print("NEO4J_USER:", os.getenv("NEO4J_USER"))
print("NEO4J_PASSWORD:", os.getenv("NEO4J_PASSWORD"))

driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

class Prompt(BaseModel):
    prompt: str

COUNTRIES_HAPPINESS_SCHEMA = """
(:Country{name})
(:Region{name})
(:Year{year})
(:MetricCategory{name})
(:HappinessTier{name})

Relationships:
# Core
(:Country)-[:BELONGS_TO]->(:Region)
(:Country)-[:HAS_HAPPINESS_DATA {happiness_score, happiness_rank, gdp_per_capita, social_support, healthy_life_expectancy, freedom_to_make_life_choices, generosity, perceptions_of_corruption}]->(:Year)

# Performance
(:Country)-[:EXCELS_IN {year, value, percentile}]->(:MetricCategory)
(:Country)-[:STRUGGLES_WITH {year, value, percentile}]->(:MetricCategory)
(:Country)-[:BELONGS_TO_TIER {year}]->(:HappinessTier)

# Temporal
(:Country)-[:IMPROVED_FROM {from_year, to_year, score_change, rank_change}]->(:Year)
(:Country)-[:DECLINED_FROM {from_year, to_year, score_change, rank_change}]->(:Year)

# Comparative
(:Country)-[:SIMILAR_TO {year, score_difference}]->(:Country)
(:Country)-[:ABOVE_REGIONAL_AVERAGE {metric, year, country_value, regional_average, difference}]->(:Region)
(:Country)-[:BELOW_REGIONAL_AVERAGE {metric, year, country_value, regional_average, difference}]->(:Region)
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
    with driver.session() as session:
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
{COUNTRIES_HAPPINESS_SCHEMA}
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