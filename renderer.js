// Global variables
let electron;
let ipcRenderer;

let selectedParts = new Set();

// Function to update status with class
function showStatus(message, type) {
    const status = document.getElementById('status');
    if (status) {
        status.textContent = message;
        status.className = type;
    }
}

function updateDeleteButton() {
    const deleteButton = document.getElementById('deleteButton');
    deleteButton.disabled = selectedParts.size === 0;
}

function showDeleteModal() {
    document.getElementById('deleteModal').style.display = 'block';
}

function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
}

async function confirmDelete() {
    try {
        const response = await ipcRenderer.invoke('delete-parts', Array.from(selectedParts));
        if (response.success) {
            closeDeleteModal();
            selectedParts.clear();
            updateDeleteButton();
            await displayPartsList(true);
        } else {
            console.error('Failed to delete parts:', response.error);
            alert('Failed to delete parts: ' + response.error);
        }
    } catch (error) {
        console.error('Error deleting parts:', error);
        alert('Error deleting parts: ' + error.message);
    }
}

async function displayPartsList(forceRefresh = false) {
    try {
        const response = await ipcRenderer.invoke('get-parts-list', forceRefresh);
        const resultDiv = document.getElementById('result');
        resultDiv.innerHTML = '';

        if (response.error) {
            resultDiv.textContent = `Error: ${response.error}`;
            return;
        }

        if (!response.parts || response.parts.length === 0) {
            resultDiv.textContent = 'No parts found.';
            return;
        }

        response.parts.forEach(part => {
            const partDiv = document.createElement('div');
            partDiv.className = 'part-item';

            // Add checkbox
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'part-checkbox';
            checkbox.checked = selectedParts.has(part.uuid);
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    selectedParts.add(part.uuid);
                } else {
                    selectedParts.delete(part.uuid);
                }
                updateDeleteButton();
            });
            partDiv.appendChild(checkbox);

            // Add image if available
            if (part.imageUrl) {
                const img = document.createElement('img');
                img.src = part.imageUrl;
                img.alt = part.mpn;
                partDiv.appendChild(img);
            }

            // Add part info
            const infoDiv = document.createElement('div');
            infoDiv.className = 'part-info';
            infoDiv.innerHTML = `
                <strong>Part Number:</strong> ${part.mpn}<br>
                <strong>Manufacturer:</strong> ${part.manufacturer || 'Unknown'}<br>
                ${part.datasheet ? `<strong>Datasheet:</strong> <a href="${part.datasheet}" target="_blank">View Datasheet</a>` : ''}
            `;
            partDiv.appendChild(infoDiv);

            resultDiv.appendChild(partDiv);
        });
    } catch (error) {
        console.error('Error displaying parts:', error);
        document.getElementById('result').textContent = `Error: ${error.message}`;
    }
}

// Initialize Electron modules
try {
    electron = require('electron');
    ipcRenderer = electron.ipcRenderer;
    showStatus('Application ready', 'info');
    
    // Load parts list on startup
    displayPartsList();
} catch (error) {
    console.error('Failed to load Electron modules:', error);
    showStatus('Error loading Electron modules: ' + error.message, 'error');
}

// Function to handle search
function handleSearch() {
    // Get part number
    const partNumber = document.getElementById('partNumber').value.trim();
    
    if (!partNumber) {
        showStatus('Please enter a part number', 'error');
        return;
    }
    
    if (!ipcRenderer) {
        showStatus('IPC not available', 'error');
        return;
    }
    
    // Disable buttons during search
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => button.disabled = true);
    
    showStatus('Searching...', 'info');
    
    // Call search function
    ipcRenderer.invoke('search-part', partNumber)
        .then(result => {
            showStatus(`Successfully processed part ${partNumber}`, 'success');
            
            // Show the updated parts list
            displayPartsList(true);
        })
        .catch(error => {
            console.error('Search error:', error);
            showStatus(`Error: ${error.message}`, 'error');
            
            // Re-enable buttons
            buttons.forEach(button => button.disabled = false);
        });
}

// Function for debug button
function handleDebug() {
    showStatus('Debug button clicked at ' + new Date().toLocaleTimeString(), 'info');
    
    // Test if we can access the DOM
    try {
        const elements = {
            searchButton: !!document.getElementById('searchButton'),
            debugButton: !!document.getElementById('debugButton'),
            refreshButton: !!document.getElementById('refreshButton'),
            partNumber: !!document.getElementById('partNumber'),
            status: !!document.getElementById('status'),
            result: !!document.getElementById('result')
        };
        
        // Test if we can access Electron
        const electronAvailable = !!electron;
        const ipcAvailable = !!ipcRenderer;
        
        alert(`Debug info:\nDOM elements: ${JSON.stringify(elements)}\nElectron available: ${electronAvailable}\nIPC available: ${ipcAvailable}`);
        
        // Refresh the parts list
        if (ipcAvailable) {
            displayPartsList(true);
        }
    } catch (error) {
        console.error('Debug error:', error);
        showStatus('Debug error: ' + error.message, 'error');
    }
}

// Function to handle refresh button
function handleRefresh() {
    displayPartsList(true);
}

// Function to set up event listeners
function setupEventListeners() {
    const searchButton = document.getElementById('searchButton');
    const debugButton = document.getElementById('debugButton');
    const refreshButton = document.getElementById('refreshButton');
    
    if (!searchButton || !debugButton || !refreshButton) {
        showStatus('Error: UI elements not found', 'error');
        return;
    }
    
    // Set up click handlers
    searchButton.onclick = handleSearch;
    debugButton.onclick = handleDebug;
    refreshButton.onclick = handleRefresh;
    
    // Also handle Enter key in the input field
    document.getElementById('partNumber').addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            handleSearch();
        }
    });
    
    showStatus('Ready', 'info');
}

// Wait for DOM to be fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupEventListeners);
} else {
    setupEventListeners();
}

// Event Listeners
document.getElementById('partNumber').addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        const partNumber = e.target.value.trim();
        if (partNumber) {
            try {
                const status = document.getElementById('status');
                status.textContent = 'Processing...';
                await ipcRenderer.invoke('search-part', partNumber);
                status.textContent = 'Done!';
                await displayPartsList(true);
            } catch (error) {
                console.error('Error processing part:', error);
                document.getElementById('status').textContent = `Error: ${error.message}`;
            }
        }
    }
});

document.getElementById('searchButton').addEventListener('click', async () => {
    const partNumber = document.getElementById('partNumber').value.trim();
    if (partNumber) {
        try {
            const status = document.getElementById('status');
            status.textContent = 'Processing...';
            await ipcRenderer.invoke('search-part', partNumber);
            status.textContent = 'Done!';
            await displayPartsList(true);
        } catch (error) {
            console.error('Error processing part:', error);
            document.getElementById('status').textContent = `Error: ${error.message}`;
        }
    }
});

document.getElementById('refreshButton').addEventListener('click', () => {
    displayPartsList(true);
});

document.getElementById('deleteButton').addEventListener('click', () => {
    if (selectedParts.size > 0) {
        showDeleteModal();
    }
});

document.getElementById('debugButton').addEventListener('click', () => {
    displayPartsList(true);
}); 