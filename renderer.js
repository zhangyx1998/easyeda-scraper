// Global variables
let electron;
let ipcRenderer;

// Function to update status with class
function showStatus(message, type) {
    const status = document.getElementById('status');
    if (status) {
        status.textContent = message;
        status.className = type;
    }
}

// Function to display parts list
function displayPartsList(forceRefresh = false) {
    if (!ipcRenderer) return;
    
    const resultDiv = document.getElementById('result');
    if (!resultDiv) return;
    
    showStatus('Loading parts list...', 'info');
    
    // Disable buttons during loading
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => button.disabled = true);
    
    ipcRenderer.invoke('get-parts-list', forceRefresh)
        .then(response => {
            // Clear previous content
            resultDiv.innerHTML = '';
            
            if (response.error) {
                showStatus(response.message, 'error');
                return;
            }
            
            if (!response.parts || response.parts.length === 0) {
                resultDiv.textContent = 'No parts found';
                showStatus('No parts found', 'info');
                return;
            }
            
            // Display each part
            response.parts.forEach(part => {
                const partElement = document.createElement('div');
                partElement.className = 'part-item';
                
                // Create image element if URL exists
                if (part.imageUrl) {
                    const imgElement = document.createElement('img');
                    imgElement.src = part.imageUrl;
                    imgElement.alt = part.mpn || 'Part image';
                    imgElement.style.width = '96px';
                    imgElement.style.height = '96px';
                    partElement.appendChild(imgElement);
                }
                
                // Create info element
                const infoElement = document.createElement('div');
                infoElement.className = 'part-info';
                
                // Add part information
                const partInfo = [
                    `Part Number: ${part.mpn || 'Unknown'}`,
                    `Manufacturer: ${part.manufacturer || 'Unknown'}`,
                    part.datasheet ? `Datasheet: <a href="${part.datasheet}" target="_blank">View</a>` : ''
                ].filter(Boolean).join('<br>');
                
                infoElement.innerHTML = partInfo;
                partElement.appendChild(infoElement);
                
                resultDiv.appendChild(partElement);
            });
            
            showStatus(`Found ${response.parts.length} parts`, 'success');
        })
        .catch(error => {
            console.error('Error getting parts list:', error);
            showStatus('Error loading parts list: ' + error.message, 'error');
        })
        .finally(() => {
            // Re-enable buttons
            buttons.forEach(button => button.disabled = false);
        });
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