import { useState, useRef, useEffect } from 'react';

interface UseVoiceInputOptions {
  onTranscription?: (text: string) => void;
  onError?: (error: string) => void;
}

export function useVoiceInput(options: UseVoiceInputOptions = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Check if voice input is available on mount
  useEffect(() => {
    checkVoiceAvailability();
  }, []);

  const checkVoiceAvailability = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/voice/check');
      const data = await response.json();
      setVoiceEnabled(data.enabled);
    } catch (error) {
      console.error('Failed to check voice availability:', error);
      setVoiceEnabled(false);
    }
  };

  const startRecording = async () => {
    try {
      // Check if browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support audio recording');
      }

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000, // Optimal for Whisper
          echoCancellation: true,
          noiseSuppression: true
        } 
      });

      // Create MediaRecorder with webm format (widely supported)
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        
        // Clean up stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error: any) {
      console.error('Failed to start recording:', error);
      
      // Provide specific error messages based on the error type
      let errorMessage = 'Failed to access microphone.';
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Microphone access denied. Please allow microphone access in your browser settings and try again.';
        
        // Check if we're in Chrome and provide Chrome-specific instructions
        if (/Chrome/.test(navigator.userAgent)) {
          errorMessage += ' Click the camera icon in the address bar to change permissions.';
        }
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone and try again.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = 'Microphone is already in use by another application.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Microphone does not support the required settings.';
      } else if (error.name === 'TypeError') {
        errorMessage = 'This page must be served over HTTPS to use microphone.';
      }
      
      options.onError?.(errorMessage);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch('http://localhost:3001/api/voice/transcribe', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Transcription failed');
      }

      const result = await response.json();
      
      if (result.text) {
        options.onTranscription?.(result.text);
      }
    } catch (error) {
      console.error('Transcription error:', error);
      options.onError?.(error instanceof Error ? error.message : 'Failed to transcribe audio');
    } finally {
      setIsTranscribing(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return {
    isRecording,
    isTranscribing,
    voiceEnabled,
    startRecording,
    stopRecording,
    toggleRecording
  };
}