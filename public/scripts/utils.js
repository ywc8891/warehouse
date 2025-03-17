// utils.js

// Utility functions
export function clearInput() {
    document.getElementById('trackingNumberInput').value = '';
    document.getElementById('trackingNumberInput').focus();
}

export function playSound() {
    document.getElementById('sound').play();
}

// Generate bin number
function generateBinNumber(courier) {
    const courierCodes = {
        'Shopee Express': 'SE',
        'J&T': 'JT',
        'Flash Express': 'FE',
        'Lazada Express': 'LE',
        'Ninja Van': 'NV',
        'Skynet': 'SN',
        'POS Malaysia': 'PM',
        'GDex': 'GD',
        'Kerry Express': 'KE',
        'J&T Cargo': 'JC',
        'DHL': 'DH',
        'CityLink': 'CL',
    };

    const code = courierCodes[courier] || 'XX'; // Default code if courier not found
    const timestamp = Date.now(); // Epoch timestamp
    return `${code}${timestamp}`;
}

export { generateBinNumber }
