// Global variables for Electron modules
let electron;
let ipcRenderer;

// Set to store UUIDs of selected parts
let selectedParts = new Set();

/**
 * Updates the status message with appropriate styling
 * @param {string} message - The message to display
 * @param {string} type - The type of message ('success', 'error', or 'info')
 */
function showStatus(message, type) {
    const status = document.getElementById('status');
    if (status) {
        status.textContent = message;
        status.className = type;
    }
}

/**
 * Updates the delete button state based on selected parts
 */
function updateDeleteButton() {
    const deleteButton = document.getElementById('deleteButton');
    deleteButton.disabled = selectedParts.size === 0;
}

/**
 * Shows the delete confirmation modal
 */
function showDeleteModal() {
    document.getElementById('deleteModal').style.display = 'block';
}

/**
 * Hides the delete confirmation modal
 */
function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
}

/**
 * Handles the deletion of selected parts
 * Sends delete request to main process and updates UI
 */
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

/**
 * Displays the list of parts in the UI
 * @param {boolean} forceRefresh - Whether to force a refresh from the main process
 */
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

/**
 * Handles the search functionality
 * @param {string} partNumber - The part number to search for
 */
async function handleSearch(partNumber) {
    if (!partNumber) {
        showStatus('Please enter a part number', 'error');
        return;
    }
    
    if (!ipcRenderer) {
        showStatus('IPC not available', 'error');
        return;
    }
    
    try {
        showStatus('Searching...', 'info');
        await ipcRenderer.invoke('search-part', partNumber);
        showStatus(`Successfully processed part ${partNumber}`, 'success');
        await displayPartsList(true);
    } catch (error) {
        console.error('Search error:', error);
        showStatus(`Error: ${error.message}`, 'error');
    }
}

/**
 * Handles the debug button functionality
 * Tests DOM elements and Electron availability
 */
function handleDebug() {
    showStatus('Debug button clicked at ' + new Date().toLocaleTimeString(), 'info');
    
    try {
        const elements = {
            searchButton: !!document.getElementById('searchButton'),
            debugButton: !!document.getElementById('debugButton'),
            refreshButton: !!document.getElementById('refreshButton'),
            partNumber: !!document.getElementById('partNumber'),
            status: !!document.getElementById('status'),
            result: !!document.getElementById('result')
        };
        
        const electronAvailable = !!electron;
        const ipcAvailable = !!ipcRenderer;
        
        alert(`Debug info:\nDOM elements: ${JSON.stringify(elements)}\nElectron available: ${electronAvailable}\nIPC available: ${ipcAvailable}`);
        
        if (ipcAvailable) {
            displayPartsList(true);
        }
    } catch (error) {
        console.error('Debug error:', error);
        showStatus('Debug error: ' + error.message, 'error');
    }
}

// Initialize Electron modules and set up event listeners
try {
    electron = require('electron');
    ipcRenderer = electron.ipcRenderer;
    
    // Set up event listeners
    document.getElementById('partNumber').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSearch(e.target.value.trim());
        }
    });

    document.getElementById('searchButton').addEventListener('click', () => {
        handleSearch(document.getElementById('partNumber').value.trim());
    });

    document.getElementById('refreshButton').addEventListener('click', () => {
        displayPartsList(true);
    });

    document.getElementById('deleteButton').addEventListener('click', () => {
        if (selectedParts.size > 0) {
            showDeleteModal();
        }
    });

    document.getElementById('debugButton').addEventListener('click', handleDebug);

    // Initialize the application
    showStatus('Application ready', 'info');
    displayPartsList();
} catch (error) {
    console.error('Failed to load Electron modules:', error);
    showStatus('Error loading Electron modules: ' + error.message, 'error');
} 