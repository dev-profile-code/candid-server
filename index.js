const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());

// const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT;

// if (!serviceAccountJson) {
//   console.error('GOOGLE_SERVICE_ACCOUNT is not defined in the environment variables.');
//   process.exit(1);
// }

// const serviceAccountCredentials = JSON.parse(serviceAccountJson);
// console.log("🚀 ~ serviceAccountCredentials:", serviceAccountCredentials);

// Path to your service account key file
const KEYFILEPATH = path.join(__dirname, 'test-service-account.json');

// Set up GoogleAuth with the drive scopes (using full drive scope to allow folder creation, listing, and sharing)
// const auth = new google.auth.GoogleAuth({
//   credentials: serviceAccountCredentials,
//   scopes: ['https://www.googleapis.com/auth/drive'],
// });
const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: ['https://www.googleapis.com/auth/drive'],
});

// Create the Drive API client
const drive = google.drive({ version: 'v3', auth });

// Variable to store the "users" folder ID
let usersFolderId = null;

// Function to ensure a folder named "users" exists
async function ensureUsersFolder() {
  try {
    // Look for a folder named "users" that is not trashed
    const res = await drive.files.list({
      q: "name = 'users' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id, name)',
    });
    
    if (res.data.files && res.data.files.length > 0) {
      // Folder exists, use its ID
      usersFolderId = res.data.files[0].id;
      console.log(`Found existing "users" folder: ${usersFolderId}`);
    } else {
      // Folder doesn't exist, so create it
      const fileMetadata = {
        name: 'users',
        mimeType: 'application/vnd.google-apps.folder',
      };
      const createRes = await drive.files.create({
        resource: fileMetadata,
        fields: 'id',
      });
      usersFolderId = createRes.data.id;
      console.log(`Created new "users" folder: ${usersFolderId}`);
    }
  } catch (error) {
    console.error("Error ensuring 'users' folder:", error);
  }
}

// Endpoint to get an access token for the service account
app.get('/getAccessToken', async (req, res) => {
  try {
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    res.json({ accessToken: tokenResponse.token });
  } catch (error) {
    console.error("Error generating token:", error);
    res.status(500).json({ error: 'Token generation failed' });
  }
});

// Endpoint to return the "users" folder ID so the app can use it
app.get('/getUsersFolderId', (req, res) => {
  if (usersFolderId) {
    res.json({ usersFolderId });
  } else {
    res.status(500).json({ error: 'Users folder not available' });
  }
});

// New endpoint to share the "users" folder with a provided email address.
// Example: GET /shareFolder?email=example@example.com
app.get('/shareFolder', async (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ error: 'Email address is required' });
  }
  try {
    const permission = {
      role: 'writer', // Change to 'writer' or 'commenter' or 'reader' if needed.
      type: 'user',
      emailAddress: email,
    };

    const response = await drive.permissions.create({
      fileId: usersFolderId,
      resource: permission,
      fields: 'id',
    });

    console.log(`Folder shared with ${email}, permission ID: ${response.data.id}`);
    res.json({ message: `Folder shared with ${email}`, permissionId: response.data.id });
  } catch (error) {
    console.error('Error sharing folder:', error);
    res.status(500).json({ error: 'Failed to share folder' });
  }
});

const PORT = 3000;
app.listen(PORT, async () => {
  // Ensure the "users" folder exists before the server is ready
  await ensureUsersFolder();
  console.log(`Server running on http://localhost:${PORT}`);
});
