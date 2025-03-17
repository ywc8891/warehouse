const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
admin.initializeApp();

async function addTestData() {
  const db = admin.firestore();

  // Add a document to the "EFLMY05" collection
  const docRef = db.collection('EFLMY05').doc('j&t');
  await docRef.set({}); // Add an empty document

  // Add a subcollection document
  const subcollectionRef = docRef.collection('subcollection').doc('SPE8055057110');
  await subcollectionRef.set({
    timestamp: new Date(),
    trackingNumber: 'SPE8055057110',
    courier: 'J&T',
  });

  console.log('Test data added successfully');
}

// Run the function
addTestData().catch((error) => {
  console.error('Error adding test data:', error);
});