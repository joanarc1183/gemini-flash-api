// These are required libraries for server setup, file management, and Gemini integration.
const express = require('express');
const dotenv = require('dotenv');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// const googleGenAI = require('@google/generative-ai');
// const GoogleGenerativeAI = googleGenAI.GoogleGenerativeAI;
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Loads .env file and prepares the Express app to receive JSON bodies.
dotenv.config();
const app = express();
app.use(express.json());

// Initializes a Gemini 1.5 Flash model using your API key.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'models/gemini-1.5-flash' });

// Tells Multer to store uploaded files temporarily in /uploads.
const upload = multer({ dest: 'uploads/' });

const imageToGenerativePart = (filePath) => ({
    inlineData: {
      data: fs.readFileSync(filePath).toString('base64'),
      mimeType: 'image/png',
    },
})

// It enables clients to send a text prompt via the request body, which is then passed to the Gemini model using the generateContent() method.
app.post('/generate-text', async (req, res) => {
    // Retrieves the user’s prompt input sent from the client (e.g., Postman or frontend).
    const { promt } = req.body;

    try {
        // Sends the prompt to the Gemini model (e.g., Gemini 1.5 Flash) and waits for a response.
        const result = await model.generateContent(promt);
        const response = await result.response;
        
        // Extracts the generated text from the Gemini model's response.
        // Returns the generated text as a JSON response to the client.
        res.json({ output: response.text() });
    } catch (error) {
        // If any error occurs, the catch block handles it and responds with HTTP 500 and the relevant error message.
        res.status(500).json({ error: error.message });
    }
});

app.post("/generate-from-image", upload.single("image"), async (req, res) => {
    const prompt = req.body.prompt || "Describe the image";
    const image = imageToGenerativePart(req.file.path);
    try {
        const result = await model.generateContent([prompt, image]);
        const response = await result.response;
        res.json({ output: response.text() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        fs.unlinkSync(req.file.path);
    }
});

app.post("/generate-from-document", upload.single("document"), async (req, res) => {
    const filePath = req.file.path;
    const buffer = fs.readFileSync(filePath);
    const base64Data = buffer.toString("base64");
    const mimeType = req.file.mimetype;
    
    try {
        const documentPart = {
            inlineData: { data: base64Data, mimeType },
        };

        const result = await model.generateContent([ "Analyze this document:", documentPart ]);
        const response = await result.response;
        res.json({ output: response.text() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        fs.unlinkSync(filePath);
    }
});

app.post("/generate-from-audio", upload.single("audio"), async (req, res) => {
    const audioBuffer = fs.readFileSync(req.file.path);
    const base64Audio = audioBuffer.toString("base64");
    const audioPart = {
        inlineData: {
            data: base64Audio,
            mimeType: req.file.mimetype
        }
    };
    
    try {
        const result = await model.generateContent([ "Transcribe or analyze the following audio:", audioPart ]);
        const response = await result.response;
        res.json({ output: response.text() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        fs.unlinkSync(req.file.path);
    }
});

// This code starts the Express application and listens on the specified port. 
// Once the server is up, it logs a message to the console indicating the local URL where the Gemini API can be accessed.
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Gemini API server is running at http://localhost:${PORT}`)
});
