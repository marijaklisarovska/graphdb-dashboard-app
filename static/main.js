let chart1 = null;
let chart2 = null;

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

        document.getElementById('cypher').textContent = data.executed_cypher;
        document.getElementById('results').textContent = JSON.stringify(data.results, null, 2);

    } catch (error) {
        console.error(error);
        document.getElementById('results').textContent = 'Error fetching data';
    } finally {
        hideLoader();
    }
}

document.addEventListener('DOMContentLoaded', function() {
    initializeCharts();
});

function initializeCharts() {
    
    if (chart1) {
        chart1.destroy();
    }
    if (chart2) {
        chart2.destroy();
    }

    const ctx1 = document.getElementById("chart1");
    const ctx2 = document.getElementById("chart2");
    
    chart1 = new Chart(ctx1, {
        type: "bar",
        data: {
            labels: ["Finland", "Denmark", "Sweden"],
            datasets: [{
                label: "Happiness Score 2020",
                data: [7.8, 7.6, 7.5],
                backgroundColor: ["#4dc9f6", "#f67019", "#f53794"]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            }
        }
    });

    chart2 = new Chart(ctx2, {
        type: "line",
        data: {
            labels: ["2018", "2019", "2020", "2021"],
            datasets: [{
                label: "Finland Happiness Trend",
                data: [7.6, 7.8, 7.7, 7.9],
                borderColor: "blue",
                backgroundColor: "rgba(0, 0, 255, 0.1)",
                fill: false,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            }
        }
    });
}