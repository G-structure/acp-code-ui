// import { Router } from 'express';
// import multer from 'multer';
// import { logger } from '../logger';
// import FormData from 'form-data';
// import fetch from 'node-fetch';
// import fs from 'fs';
// import path from 'path';

// const router = Router();

// // Configure multer for temporary file storage
// const upload = multer({ 
//   dest: '/tmp/voice-uploads/',
//   limits: {
//     fileSize: 25 * 1024 * 1024 // 25MB max (Whisper API limit)
//   }
// });

// // Check if OpenAI API key is available
// router.get('/check', (req, res) => {
//   const hasKey = !!process.env.OPENAI_API_KEY;
//   res.json({ 
//     enabled: hasKey,
//     message: hasKey ? 'Voice input available' : 'OPENAI_API_KEY not found'
//   });
// });

// // Transcribe audio using OpenAI Whisper API
// router.post('/transcribe', upload.single('audio'), async (req, res) => {
//   const apiKey = process.env.OPENAI_API_KEY;
  
//   if (!apiKey) {
//     return res.status(400).json({ error: 'OpenAI API key not configured' });
//   }

//   if (!req.file) {
//     return res.status(400).json({ error: 'No audio file provided' });
//   }

//   const tempPath = req.file.path;

//   try {
//     // Create form data for OpenAI API
//     const form = new FormData();
//     form.append('file', fs.createReadStream(tempPath), {
//       filename: 'audio.webm',
//       contentType: req.file.mimetype || 'audio/webm'
//     });
//     form.append('model', 'whisper-1');

//     // Call OpenAI Whisper API
//     const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
//       method: 'POST',
//       headers: {
//         'Authorization': `Bearer ${apiKey}`,
//         ...form.getHeaders()
//       },
//       body: form
//     });

//     if (!response.ok) {
//       const errorText = await response.text();
//       let errorMessage = 'Transcription failed';
      
//       try {
//         const errorJson = JSON.parse(errorText);
//         errorMessage = errorJson.error?.message || errorMessage;
        
//         // Handle rate limiting specifically
//         if (response.status === 429) {
//           errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
//         }
//       } catch (e) {
//         // If error is not JSON, use the text directly
//         errorMessage = errorText || errorMessage;
//       }
      
//       logger.error('OpenAI API error:', { 
//         status: response.status, 
//         error: errorText 
//       });
      
//       return res.status(response.status).json({ 
//         error: errorMessage,
//         details: errorText 
//       });
//     }

//     const result = await response.json();
    
//     // Clean up temp file
//     fs.unlinkSync(tempPath);

//     res.json({ 
//       text: result.text,
//       success: true 
//     });

//   } catch (error) {
//     logger.error('Voice transcription error:', error);
    
//     // Clean up temp file on error
//     if (fs.existsSync(tempPath)) {
//       fs.unlinkSync(tempPath);
//     }

//     res.status(500).json({ 
//       error: 'Failed to transcribe audio',
//       details: error.message 
//     });
//   }
// });

// export default router;

import { Router } from 'express';
import multer from 'multer';
import { logger } from '../logger';
import FormData from 'form-data';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const router = Router();

// Configure multer for temporary file storage
const upload = multer({ 
  dest: '/tmp/voice-uploads/',
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB max
  }
});

// Check if local Whisper server is available
router.get('/check', async (req, res) => {
  try {
    const baseUrl = process.env.WHISPER_BASE_URL || 'http://localhost:9000';
    const response = await fetch(`${baseUrl}/`);
    res.json({ 
      enabled: response.ok,
      message: response.ok ? 'Local voice input available' : 'Local Whisper server not responding'
    });
  } catch (error) {
    res.json({ 
      enabled: false,
      message: 'Local Whisper server not available'
    });
  }
});

// Transcribe audio using local Whisper server
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  const baseUrl = process.env.WHISPER_BASE_URL || 'http://localhost:9000';
  
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  const tempPath = req.file.path;

  try {
    // Create form data for Whisper API
    const form = new FormData();
    form.append('audio_file', fs.createReadStream(tempPath), {
      filename: 'audio.webm',
      contentType: req.file.mimetype || 'audio/webm'
    });
    
    // Optional parameters you can uncomment/modify:
    // form.append('task', 'transcribe'); // 'transcribe' or 'translate'
    // form.append('language', 'en'); // force language detection
    // form.append('output', 'json'); // request JSON output

    // Call local Whisper API
    const response = await fetch(`${baseUrl}/asr`, {
      method: 'POST',
      body: form
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Transcription failed';
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      
      logger.error('Whisper server error:', { 
        status: response.status, 
        error: errorText 
      });
      
      return res.status(response.status).json({ 
        error: errorMessage,
        details: errorText 
      });
    }

    // Handle both JSON and plain text responses
    const contentType = response.headers.get('content-type') || '';
    let transcribedText;

    if (contentType.includes('application/json')) {
      // Response is JSON
      const result = await response.json();
      transcribedText = result.text || result.transcription || result;
    } else {
      // Response is plain text
      transcribedText = await response.text();
    }

    // Clean up temp file
    fs.unlinkSync(tempPath);

    // Return in OpenAI-compatible format
    res.json({ 
      text: transcribedText.trim(),
      success: true 
    });

  } catch (error) {
    logger.error('Voice transcription error:', error);
    
    // Clean up temp file on error
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    res.status(500).json({ 
      error: 'Failed to transcribe audio',
      details: error.message 
    });
  }
});

export default router;