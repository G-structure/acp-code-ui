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
    fileSize: 25 * 1024 * 1024 // 25MB max (Whisper API limit)
  }
});

// Check if OpenAI API key is available
router.get('/check', (req, res) => {
  const hasKey = !!process.env.OPENAI_API_KEY;
  res.json({ 
    enabled: hasKey,
    message: hasKey ? 'Voice input available' : 'OPENAI_API_KEY not found'
  });
});

// Transcribe audio using OpenAI Whisper API
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return res.status(400).json({ error: 'OpenAI API key not configured' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  const tempPath = req.file.path;

  try {
    // Create form data for OpenAI API
    const form = new FormData();
    form.append('file', fs.createReadStream(tempPath), {
      filename: 'audio.webm',
      contentType: req.file.mimetype || 'audio/webm'
    });
    form.append('model', 'whisper-1');
    form.append('language', 'en'); // Optional: specify language for better accuracy

    // Call OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...form.getHeaders()
      },
      body: form
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('OpenAI API error:', error);
      return res.status(response.status).json({ 
        error: 'Transcription failed',
        details: error 
      });
    }

    const result = await response.json();
    
    // Clean up temp file
    fs.unlinkSync(tempPath);

    res.json({ 
      text: result.text,
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