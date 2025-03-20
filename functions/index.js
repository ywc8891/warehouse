import functions from 'firebase-functions';
import admin from 'firebase-admin';
import { COLLECTION_NAME } from './constants.js';
import { google } from 'googleapis';
import { Buffer } from 'buffer'; // Import Buffer
import fs from 'fs';
import path from 'path';
import os from 'os';
import Busboy from 'busboy';
import cors from 'cors';
import 'dotenv/config'

// Initialize Firebase Admin SDK
admin.initializeApp();

// Enable CORS
const corsMiddleware = cors({ origin: true });

// Derive __dirname equivalent in ES modules
const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Google Drive API credentials
const KEYFILE_PATH = path.join(__dirname, 'service-account-key.json'); // Replace with your service account key file
const SCOPES = ['https://www.googleapis.com/auth/drive'];

// Initialize Google Drive API client
const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILE_PATH,
    scopes: SCOPES,
});

// List of allowed email addresses
const ALLOWED_EMAILS = ['setiayap@gmail.com', 'ywc8891@gmail.com'];

// Authentication middleware
const authenticateUser = async (req, res, next) => {
    console.log('Starting authentication...'); // Debug log

    // Bypass authentication if BYPASS_AUTH is true
    if (process.env.BYPASS_AUTH === 'true') {
        console.log('Bypassing authentication for local testing'); // Debug log
        req.user = { email: 'test@example.com', uid: 'QeORe968zAuyQl4g1SnEXekJSels' }; // Mock user
        return next();
    }

    // Proceed with authentication
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
        console.error('Missing or invalid auth token'); // Debug log
        return res.status(401).json({
            status: 'error',
            message: 'Unauthorized: Missing or invalid auth token',
        });
    }

    try {
        const idToken = authHeader.split('Bearer ')[1];
        console.log('Verifying ID token...'); // Debug log
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        console.log('Token verified:', decodedToken); // Debug log
        req.user = decodedToken;
        return next();
    } catch (error) {
        console.error('Token verification failed:', error); // Debug log
        return res.status(401).json({
            status: 'error',
            message: 'Unauthorized: Invalid authentication token',
        });
    }
};

const authenticatedFunction = (handler) => {
    return functions.https.onRequest(async (req, res) => {
        console.log('Request method:', req.method); // Debug log
        // Handle OPTIONS preflight request
        if (req.method === 'OPTIONS') {
            console.log('Handling OPTIONS request...'); // Debug log
            // Set CORS headers
            res.set('Access-Control-Allow-Origin', '*');
            res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            return res.status(204).send(''); // Respond with 204 No Content
        }

        // Authenticate for POST requests
        console.log('Handling POST request...'); // Debug log
        return corsMiddleware(req, res, async () => {
            try {
                console.log('Authenticating user...'); // Debug log
                await authenticateUser(req, res, () => handler(req, res));
            } catch (error) {
                console.error('Authentication error:', error); // Debug log
                return res.status(401).json({
                    status: 'error',
                    message: 'Unauthorized: Invalid authentication token',
                });
            }
        });
    });
};

// Google Sign-In Authentication
export const googleSignIn = functions.https.onRequest(async (req, res) => {
    corsMiddleware(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).json({
                status: 'error',
                message: 'Method Not Allowed',
            });
        }

        const { idToken } = req.body;

        if (!idToken) {
            return res.status(400).json({
                status: 'error',
                message: 'ID token is required',
            });
        }

        try {
            // Verify the ID token using Firebase Admin SDK
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            const email = decodedToken.email;

            if (!ALLOWED_EMAILS.includes(email)) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Access denied. Your email is not allowed.',
                });
            }

            return res.status(200).json({
                status: 'success',
                message: 'Signed in successfully',
                user: {
                    uid: decodedToken.uid,
                    email: decodedToken.email,
                    name: decodedToken.name || 'User',
                    picture: decodedToken.picture || '',
                },
            });
        } catch (error) {
            console.error('Error during Google Sign-In:', error);
            return res.status(500).json({
                status: 'error',
                message: error.message,
            });
        }
    });
});

// Log input from HTML input form - Now with authentication
export const logInput = authenticatedFunction(async (req, res) => {
    const { trackingNumber, courier } = req.body;

    try {
        // Validate input
        if (!trackingNumber || !courier) {
            throw new Error('Missing trackingNumber or courier');
        }

        // Insert data into Firestore
        const timestamp = Date.now();
        insertNewData(timestamp, trackingNumber, courier);

        // Return a JSON response
        res.json({ status: 'success', message: 'Data logged successfully' });
    } catch (error) {
        // Return a JSON error response
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Helper function to categorise tracking number - Now with authentication
export const categorise = authenticatedFunction(async (req, res) => {
    console.log('Request received from user:', req.user?.email); // Debug log
    console.log('Request body:', req.body); // Debug log

    const { trackingNumber } = req.body;
    console.log('Tracking number:', trackingNumber); // Debug log

    try {
        const regexMap = new Map([
            ['J&T', new RegExp('^6.*$')],
            ['GDex', new RegExp('^LBX.*$')],
            ['Shopee Express', new RegExp('(^SPX.*$)|(^MY.+T$)')],
            ['Ninja Van', new RegExp('^(SPE|NLMY|SY|NVMY|SXDSG|MYNJV).*$')],
            ['Kerry Express', new RegExp('^(MYKE).*$')],
            ['Lazada Express', new RegExp('^MYMPA.*')],
            ['Flash Express', new RegExp('^M[^Y].+\\w[A-Z]\\d?$')],
            ['Skynet', new RegExp('^LAZMA.*')],
            ['J&T Cargo', new RegExp('^(8000|9000).*')],
            ['DHL', new RegExp('^59.*')],
            ['CityLink', new RegExp('^99.*')],
            ['Pos Malaysia', new RegExp('^(ER|PL).*')],
        ]);
        console.log('Regex map initialized'); // Debug log

        let courier = null;
        for (const [name, regex] of regexMap.entries()) {
            if (regex.test(trackingNumber)) {
                courier = name;
                break;
            }
        }
        console.log('Courier identified:', courier); // Debug log

        if (!courier) {
            throw new Error('Courier not found');
        }

        // Return courier as JSON
        res.json({ status: 'success', courier });
    } catch (error) {
        console.error('Error:', error.message); // Debug log
        res.status(400).json({ status: 'error', message: error.message });
    }
});

// Delete collection - Now with authentication
export const deleteCollection = authenticatedFunction(async (req, res) => {
    const { path } = req.body;

    console.log(`User ${req.user.email} attempting to delete collection:`, path);

    try {
        await deleteCollectionHelper(path);
        res.json({ status: 'success', message: 'Collection deleted successfully' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Helper function to insert data into Firestore
async function insertNewData(timestamp, trackingNumber, courier) {
    const data = {
        timestamp: timestamp,
        trackingNumber: trackingNumber,
        courier: courier,
    };

    const courierDocRef = admin.firestore()
        .collection(COLLECTION_NAME) // Main collection
        .doc(courier.toLowerCase().replace(' ', '_')); // Document ID for courier

    try {
        // Check if the main document exists
        const courierDoc = await courierDocRef.get();

        if (!courierDoc.exists) {
            // Create a dummy document if it doesn't exist
            await courierDocRef.set({ dummyField: true });
            console.log('Dummy document created successfully');
        }

        // Create a document in the subcollection
        await courierDocRef
            .collection('subcollection') // Subcollection
            .doc(trackingNumber) // Document ID for tracking number
            .set(data); // Set the data

        console.log('Document created successfully in subcollection');
    } catch (error) {
        console.error('Error creating document:', error);
        throw error; // Re-throw the error for handling in the calling function
    }
}

// Helper function to delete the whole collection once printed
async function deleteCollectionHelper(path) {
    try {
        // Get a reference to the collection
        const collectionRef = admin.firestore().collection(path);

        // Get all documents in the collection
        const snapshot = await collectionRef.get();

        // Check if the collection is empty
        if (snapshot.empty) {
            console.log('No documents to delete. Exiting.');
            return;
        }

        console.log(`Found ${snapshot.size} documents to delete in ${path}`);

        const chunkSize = 500; // Firestore allows a maximum of 500 operations per batch
        let deletedCount = 0;

        // Process documents in chunks
        for (let i = 0; i < snapshot.docs.length; i += chunkSize) {
            const chunk = snapshot.docs.slice(i, i + chunkSize);
            const batch = admin.firestore().batch();

            // Add delete operations to the batch
            chunk.forEach((doc) => {
                batch.delete(doc.ref);
            });

            // Commit the batch
            await batch.commit();
            deletedCount += chunk.length;
            console.log(`Deleted batch: ${deletedCount}/${snapshot.size} documents`);
        }

        console.log(`Deletion complete. Total documents deleted: ${deletedCount}`);
    } catch (error) {
        console.error('Error deleting collection:', error);
        throw error; // Re-throw the error for handling in the calling function
    }
}

// Fetch all courier data - Now with authentication
export const getCourierData = authenticatedFunction(async (req, res) => {
    try {
        console.log(`User ${req.user.email} querying collection:`, COLLECTION_NAME);

        // Get all documents from the collection
        const snapshot = await admin.firestore().collection(COLLECTION_NAME).get();
        // console.log('Main collection documents:', snapshot.docs);

        if (snapshot.empty) {
            console.log('No documents found in the main collection.');
            return res.json({ status: 'success', data: [] });
        }

        // Format the data
        const data = [];

        // Process each document in the main collection
        for (const doc of snapshot.docs) {
            console.log('Processing document:', doc.id);

            // Get all documents in the subcollection
            const subcollections = await doc.ref.collection('subcollection').get();
            // console.log(`Subcollection documents for ${doc.id}:`, subcollections.docs);

            if (subcollections.empty) {
                console.log(`No subcollection documents found for ${doc.id}.`);
                continue;
            }

            // Add each subcollection document to the data array
            subcollections.forEach((subDoc) => {
                // console.log('Subcollection document data:', subDoc.id, subDoc.data());
                data.push({
                    courier: doc.id,
                    trackingNumber: subDoc.id,
                    count: doc.length,
                    ...subDoc.data(),
                });
            });
        }

        // Return the data as JSON
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('Error fetching courier data:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Upload to Google Drive - Now with authentication
export const uploadToGoogleDrive = authenticatedFunction((req, res) => {
    console.log(`User ${req.user.email} attempting to upload to Google Drive`);
    
    const busboy = Busboy({ headers: req.headers });
    let fileBuffer = Buffer.from('');
    let folderId = '';
    let fileName = ''; // Declare fileName here

    busboy.on('file', (fieldname, file, filename) => {
        console.log(`File [${fieldname}] received: ${filename}`);

        file.on('data', (data) => {
            fileBuffer = Buffer.concat([fileBuffer, data]);
        });

        file.on('end', () => {
            console.log(`File [${fieldname}] finished uploading`);
        });
    });

    busboy.on('field', (fieldname, value) => {
        if (fieldname === 'folderId') {
            folderId = value;
            console.log(`Folder ID: ${folderId}`);
        } else if (fieldname === 'fileName') {
            fileName = value; // Assign value to fileName
            console.log(`File Name: ${fileName}`);
        }
    });

    busboy.on('finish', async () => {
        try {
            if (!fileBuffer || !folderId || !fileName) {
                return res.status(400).json({
                    status: 'error',
                    message: 'File, folder ID, and file name are required',
                });
            }

            // Save file to a temporary location
            const tempFilePath = path.join(os.tmpdir(), `${fileName}.pdf`);
            fs.writeFileSync(tempFilePath, fileBuffer);

            // Upload file to Google Drive
            const drive = google.drive({ version: 'v3', auth });
            const driveResponse = await drive.files.create({
                requestBody: {
                    name: `${fileName}.pdf`, // Use fileName as the file name
                    parents: [folderId],
                },
                media: {
                    mimeType: 'application/pdf',
                    body: fs.createReadStream(tempFilePath),
                },
            });

            // Delete temporary file
            fs.unlinkSync(tempFilePath);

            // Return success response
            return res.status(200).json({
                status: 'success',
                message: 'File uploaded to Google Drive',
                fileId: driveResponse.data.id,
            });
        } catch (error) {
            console.error('Error uploading to Google Drive:', error);
            return res.status(500).json({
                status: 'error',
                message: error.message,
            });
        }
    });

    // Pipe the request to busboy
    busboy.end(req.rawBody);
});