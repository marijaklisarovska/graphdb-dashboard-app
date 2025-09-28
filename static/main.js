function showLoader() {
    document.getElementById('overlay').style.display = 'flex';
}

function hideLoader() {
    document.getElementById('overlay').style.display = 'none';
}

async function sendPrompt() {
    const prompt = document.getElementById('prompt').value;
    showLoader();

    try {
        const response = await fetch('/generate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({prompt: prompt})
        });
        const data = await response.json();

        document.getElementById('cypher').textContent = data.cypher;
        document.getElementById('results').textContent = JSON.stringify(data.results, null, 2);

    } catch (error) {
        console.error(error);
        document.getElementById('results').textContent = 'Error fetching data';
    } finally {
        hideLoader();
    }
}
