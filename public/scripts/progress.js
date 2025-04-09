import { generateBinNumber } from './utils.js';
import { COLLECTION_NAME, GOOGLE_DRIVE_FOLDER_ID, API_URL } from './constants.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js';
import 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js'; // Import Bootstrap JavaScript from CDN

// Import shared modules
import { auth } from './firebase-init.js';
import { handleGoogleSignIn, handleSignOut } from './auth.js';


const { jsPDF } = window.jspdf;


// Check authentication state
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        fetchAndDisplayData();
    }
});



// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {

    // Set up event listeners for authentication
    const signInButton = document.getElementById('signInButton');
    const signOutButton = document.getElementById('signOutButton');

    if (signInButton) {
        signInButton.addEventListener('click', handleGoogleSignIn);
    }

    if (signOutButton) {
        signOutButton.addEventListener('click', handleSignOut);
    }

});

async function getIdToken() {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User not signed in');
    }
    return await user.getIdToken(true); // Force refresh if needed
}

// Fetch and display courier data
async function fetchAndDisplayData() {
    try {
        const idToken = await getIdToken(); // Fetch the ID token
        const response = await fetch(`${API_URL}/getCourierData`, {
            headers: {
                'Authorization': `Bearer ${idToken}`, // Include the ID token
            },
        });
        const result = await response.json();

        if (result.status === 'success') {
            const tableBody = document.getElementById('courierData');
            tableBody.innerHTML = ''; // Clear existing rows

            // Group tracking numbers by courier
            const groupedData = result.data.reduce((acc, item) => {
                if (!acc[item.courier]) {
                    acc[item.courier] = {
                        trackingNumbers: [],
                        count: 0,
                    };
                }
                acc[item.courier].trackingNumbers.push(item.trackingNumber);
                acc[item.courier].count = acc[item.courier].trackingNumbers.length;
                return acc;
            }, {});

            // Add rows to the table
            for (const [courier, data] of Object.entries(groupedData)) {
                const row = document.createElement('tr');

                // Courier column
                const courierCell = document.createElement('td');
                courierCell.textContent = courier;
                row.appendChild(courierCell);

                // Tracking Numbers column
                const trackingNumbersCell = document.createElement('td');
                const trackingNumbersDiv = document.createElement('div');
                trackingNumbersDiv.className = 'tracking-numbers';
                data.trackingNumbers.forEach((trackingNumber) => {
                    const trackingNumberDiv = document.createElement('div');
                    trackingNumberDiv.className = 'tracking-number';

                    // Add class if tracking number is long
                    if (trackingNumber.length >= 20) {
                        trackingNumberDiv.classList.add('long-tracking-number');
                    }

                    trackingNumberDiv.textContent = trackingNumber;

                    // Add delete button for long tracking numbers
                    if (trackingNumber.length >= 20) {
                        const deleteBtn = document.createElement('button');
                        deleteBtn.innerHTML = '&times;';
                        deleteBtn.className = 'delete-tracking-btn';
                        deleteBtn.title = 'Delete this tracking number';
                        deleteBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            handleDeleteTrackingNumber(trackingNumber, courier);
                        });
                        trackingNumberDiv.appendChild(deleteBtn);
                    }

                    trackingNumbersDiv.appendChild(trackingNumberDiv);
                });
                trackingNumbersCell.appendChild(trackingNumbersDiv);
                row.appendChild(trackingNumbersCell);

                // Count column
                const countCell = document.createElement('td');
                countCell.textContent = data.count;
                row.appendChild(countCell);

                // Print button column
                const printCell = document.createElement('td');
                const printButton = document.createElement('button');
                printButton.className = 'btn btn-success';
                printButton.textContent = 'Print';
                printButton.addEventListener('click', () => handlePrint(courier, data.trackingNumbers, data.count));
                printCell.appendChild(printButton);
                row.appendChild(printCell);

                // Add the row to the table
                tableBody.appendChild(row);
            }
        } else {
            console.error('Error fetching data:', result.message);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Handle print button click
async function handlePrint(courier, trackingNumbers, count) {
    try {
        // Show the loading bar
        const loadingBarContainer = document.getElementById('loadingBarContainer');
        const loadingBar = document.getElementById('loadingBar');
        const loadingStatus = document.getElementById('loadingStatus');
        loadingBarContainer.style.display = 'block';
        loadingBar.style.width = '0%';
        loadingStatus.textContent = 'Generating PDF...';

        // Step 1: Assign bin number
        const binNumber = generateBinNumber(courier);
        console.log('Bin number:', binNumber);

        
        // Step 2: Generate PDF and CSV
        const pdfBlob = generatePDF(courier, binNumber, trackingNumbers, count);
        const csvBlob = generateCSVBlob(courier, binNumber, trackingNumbers, count)
        loadingBar.style.width = '50%';
        loadingStatus.textContent = 'Uploading PDF & CSV to Google Drive...';
        
        // Step 2.5: Get sequential number
        // Extract the courier code from the binNumber (first 2 characters)
        const courierCode = binNumber.substring(0, 2);
        // Get the sequential letter for this courier
        const sequentialLetter = getSequentialLetter(courierCode);
        
        // Step 3: Upload PDF to Google Drive via Firebase Cloud Function
        await uploadFileToGoogleDrive(binNumber,sequentialLetter, pdfBlob, 'pdf');
        await uploadFileToGoogleDrive(binNumber,sequentialLetter, csvBlob, 'csv')
        loadingBar.style.width = '100%';
        loadingStatus.textContent = 'PDF & CSV uploaded successfully!';


        // Step 4: Delete records for the courier (optional)
        await deleteCollection(courier);

        // Step 5: Refresh the page
        setTimeout(() => {
            window.location.reload();
        }, 2000); // Refresh after 2 seconds
    } catch (error) {
        console.error('Error handling print:', error);
        loadingStatus.textContent = 'Error: ' + error.message;
        loadingBar.style.backgroundColor = '#FF0000'; // Change bar color to red on error
    }

}

// Generate PDF
function generatePDF(courier, binNumber, trackingNumbers, count) {
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
    });

    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 10; // Margin from the top and bottom

    // Add content to the first page
    doc.setFontSize(18);
    doc.text('Manifest', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.text(`Courier       : ${courier}`, 10, 30);
    doc.text(`Print Date: ${new Date().toLocaleString()}`, 200, 30, { align: 'right' });

    doc.text(`Bin Number: ${binNumber}`, 10, 35);
    doc.text(`Parcel Count:                               ${count}`, 200, 35, { align: 'right' });

    doc.setFontSize(14);
    doc.text('Parcel Tracking Number', pageWidth / 2, 50, { align: 'center' });
    doc.line(78, 51, 133, 51);

    // Convert tracking numbers into a 5-column table format
    const tableData = [];
    for (let i = 0; i < trackingNumbers.length; i += 5) {
        const row = trackingNumbers.slice(i, i + 5);
        tableData.push(row);
    }

    // Use autoTable to add the tracking numbers
    doc.autoTable({
        startY: 52, // Start the table below the header
        body: tableData, // Table data
        theme: 'plain', // Use plain theme (no grid lines or stripes)
        styles: {
            fontSize: 9, // Font size for the table
            cellPadding: 1, // Padding inside cells
            textColor: [0, 0, 0], // Black text color
        },
        bodyStyles: {
            fillColor: [255, 255, 255], // White background for body
        },
        columnStyles: {
            0: { cellWidth: 37 }, // Adjust column widths
            1: { cellWidth: 37 },
            2: { cellWidth: 37 },
            3: { cellWidth: 37 },
            4: { cellWidth: 37 },
        },
    });

    // Return PDF as a Blob
    const pdfBlob = doc.output('blob');
    return pdfBlob;
}

function generateCSVBlob(courier, binNumber, trackingNumbers, count) {
    // Create header rows
    const headerRows = [
        ['','','Manifest','',''],
        [],
        [`Courier: ${courier}`, '','',`Print Date: ${new Date().toLocaleString()}`],
        [`Bin Number: ${binNumber}`,'','','', `Parcel Count: ${count}`],
        [],
        ['','','Parcel Tracking Numbers','',''],
        []
    ];
    
    // Convert tracking numbers into 5-column rows
    const dataRows = [];
    for (let i = 0; i < trackingNumbers.length; i += 5) {
        const row = trackingNumbers.slice(i, i + 5);
        dataRows.push(row);
    }
    
    // Combine all rows
    const allRows = [...headerRows, ...dataRows];
    
    // Convert to CSV string
    let csvContent = '';
    allRows.forEach(row => {
        csvContent += row.join(',') + '\r\n';
    });
    
    // Return as Blob
    return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
}

// Upload PDF to Google Drive via Firebase Cloud Function
async function uploadFileToGoogleDrive(binNumber,sequentialLetter, fileBlob, fileType = 'pdf') {
    try {
        const idToken = await getIdToken(); // Fetch the ID token

        // Extract the courier code from the binNumber (first 2 characters)
        const courierCode = binNumber.substring(0, 2);

        // Get the current date in YYYYMMDD format
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dateString = `${year}${month}${day}`;

        // Generate the file name
        const fileName = `${courierCode}${dateString}${sequentialLetter}`;
        const fileExtension = fileType.toLowerCase() === 'csv' ? '.csv' : '.pdf';
        const mimeType = fileType.toLowerCase() === 'csv' 
            ? 'text/csv' 
            : 'application/pdf';

        // Prepare the FormData
        const formData = new FormData();
        formData.append('file', fileBlob, `${fileName}${fileExtension}`);
        formData.append('folderId', GOOGLE_DRIVE_FOLDER_ID);
        formData.append('fileName', fileName);
        formData.append('fileType', fileType); // Optional: send file type to backend

        // Upload the file
        const response = await fetch(`${API_URL}/uploadToGoogleDrive`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${idToken}`,
            },
            body: formData,
        });

        const result = await response.json();
        if (result.status !== 'success') {
            throw new Error(result.message);
        }

        console.log(`${fileType.toUpperCase()} uploaded to Google Drive successfully`);
        return result;
    } catch (error) {
        console.error(`Error uploading ${fileType.toUpperCase()} to Google Drive:`, error);
        throw error;
    }
}


// Call the deleteCollection Cloud Function
async function deleteCollection(courier) {
    try {
        const idToken = await getIdToken(); // Fetch the ID token
        const path = `${COLLECTION_NAME}/${courier.toLowerCase().replace(' ', '_')}/subcollection`;
        const response = await fetch(`${API_URL}/deleteCollection`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`, // Include the ID token
            },
            body: JSON.stringify({ path }),
        });

        const result = await response.json();
        if (result.status !== 'success') {
            throw new Error(result.message);
        }

        console.log(`Collection "${COLLECTION_NAME}" deleted successfully`);
    } catch (error) {
        console.error('Error deleting collection:', error);
        throw error;
    }
}

function getSequentialLetter(courierCode) {
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format

    // Retrieve the last used letter and date for this courier from localStorage
    const lastUploadKey = `lastUpload_${courierCode}`;
    const lastUpload = JSON.parse(localStorage.getItem(lastUploadKey)) || { date: '', letter: 'A' };

    // If it's a new day, reset the letter to 'A'
    if (lastUpload.date !== today) {
        localStorage.setItem(lastUploadKey, JSON.stringify({ date: today, letter: 'A' }));
        return 'A';
    }

    // Increment the letter (A -> B, B -> C, etc.)
    const nextLetter = String.fromCharCode(lastUpload.letter.charCodeAt(0) + 1);
    localStorage.setItem(lastUploadKey, JSON.stringify({ date: today, letter: nextLetter }));
    return nextLetter;
}

async function handleDeleteTrackingNumber(trackingNumber, courier) {
    if (!confirm(`Are you sure you want to delete tracking number: ${trackingNumber}?`)) {
        return;
    }

    try {
        const idToken = await getIdToken();
        const response = await fetch(`${API_URL}/deleteTrackingNumber`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`,
            },
            body: JSON.stringify({
                trackingNumber,
                courier
            }),
        });

        const result = await response.json();

        if (result.status === 'success') {
            alert('Tracking number deleted successfully');
            fetchAndDisplayData(); // Refresh the data
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Error deleting tracking number:', error);
        alert('Error deleting tracking number: ' + error.message);
    }
}


// Load data when the page loads
window.onload = fetchAndDisplayData;

// Load data when the page loads
document.getElementById('refreshData').addEventListener("click", fetchAndDisplayData);
