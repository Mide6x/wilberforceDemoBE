import OpenAI from 'openai';
import { SupportedLanguage, SUPPORTED_LANGUAGES } from '../types';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

class OpenAIService {
  private openai: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('Missing OpenAI API key. Please set OPENAI_API_KEY environment variable.');
    }

    this.openai = new OpenAI({
      apiKey: apiKey
    });
  }

  /**
   * Transcribe audio using OpenAI Whisper API
   */
  async transcribeAudio(audioBuffer: Buffer, language?: string): Promise<string> {
    try {
      // Validate buffer has webm signature
      if (!this.isValidWebMBuffer(audioBuffer)) {
        throw new Error('Invalid WebM audio format');
      }

      // Create a temporary file from the buffer
      const tempFilePath = path.join(__dirname, '../../temp', `audio_${Date.now()}.webm`);
      
      // Ensure temp directory exists
      const tempDir = path.dirname(tempFilePath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Write buffer to temporary file
      fs.writeFileSync(tempFilePath, audioBuffer);

      // Create a readable stream from the file with proper filename
      const audioStream = fs.createReadStream(tempFilePath);
      
      // Add filename property to the stream for OpenAI
      (audioStream as any).path = tempFilePath;

      const transcription = await this.openai.audio.transcriptions.create({
        file: audioStream,
        model: 'whisper-1',
        language: language || 'en', // ISO-639-1 format
        response_format: 'text',
        temperature: 0.2
      });

      // Clean up temporary file
      fs.unlinkSync(tempFilePath);

      return transcription.trim();
    } catch (error) {
      console.error('Transcription error:', error);
      throw new Error(`Failed to transcribe audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Translate text using OpenAI GPT API
   */
  async translateText(text: string, targetLanguage: SupportedLanguage): Promise<string> {
    try {
      // If target language is English, return original text
      if (targetLanguage === 'en') {
        return text;
      }

      const targetLanguageName = SUPPORTED_LANGUAGES[targetLanguage];
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the given text to ${targetLanguageName}. Maintain the original meaning, tone, and context. If the text is already in ${targetLanguageName}, return it as is. Only return the translated text, no explanations or additional content.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });

      const translatedText = completion.choices[0]?.message?.content?.trim();
      
      if (!translatedText) {
        throw new Error('No translation received from OpenAI');
      }

      return translatedText;
    } catch (error) {
      console.error('Translation error:', error);
      throw new Error(`Failed to translate text: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process audio chunk: transcribe and translate if needed
   */
  async processAudioChunk(
    audioBuffer: Buffer,
    targetLanguages: SupportedLanguage[] = ['en']
  ): Promise<{
    originalText: string;
    translations: Record<string, string>;
  }> {
    try {
      // First, transcribe the audio
      const originalText = await this.transcribeAudio(audioBuffer);
      
      if (!originalText || originalText.trim().length === 0) {
        return {
          originalText: '',
          translations: {}
        };
      }

      // Then translate to all requested languages
      const translations: Partial<Record<SupportedLanguage, string>> = {};
      
      for (const language of targetLanguages) {
        if (language === 'en') {
          translations[language] = originalText;
        } else {
          try {
            translations[language] = await this.translateText(originalText, language);
          } catch (error) {
            console.error(`Failed to translate to ${language}:`, error);
            // Fallback to original text if translation fails
            translations[language] = originalText;
          }
        }
      }

      return {
        originalText,
        translations: translations as Record<string, string>
      };
    } catch (error) {
      console.error('Audio processing error:', error);
      throw error;
    }
  }

  /**
   * Process transcript text for translation (Web Speech API approach)
   */
  async processTranscriptText(
    originalText: string,
    targetLanguages: SupportedLanguage[] = ['en']
  ): Promise<{
    originalText: string;
    translations: Record<string, string>;
  }> {
    try {
      if (!originalText || originalText.trim().length === 0) {
        return {
          originalText: '',
          translations: {}
        };
      }

      // Then translate to all requested languages
      const translations: Partial<Record<SupportedLanguage, string>> = {};
      
      for (const language of targetLanguages) {
        if (language === 'en') {
          translations[language] = originalText;
        } else {
          try {
            translations[language] = await this.translateText(originalText, language);
          } catch (error) {
            console.error(`Failed to translate to ${language}:`, error);
            // Fallback to original text if translation fails
            translations[language] = originalText;
          }
        }
      }

      return {
        originalText,
        translations: translations as Record<string, string>
      };
    } catch (error) {
      console.error('Text processing error:', error);
      throw error;
    }
  }

  /**
   * Validate audio buffer
   */
  validateAudioBuffer(buffer: Buffer): boolean {
    // Check if buffer is not empty
    if (!buffer || buffer.length === 0) {
      return false;
    }

    // Check minimum size (e.g., 1KB)
    if (buffer.length < 1024) {
      return false;
    }

    // Check maximum size (e.g., 25MB - OpenAI limit)
    if (buffer.length > 25 * 1024 * 1024) {
      return false;
    }

    return true;
  }

  /**
   * Check if buffer contains valid WebM file signature
   */
  private isValidWebMBuffer(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 4) {
      return false;
    }

    // Check for WebM/Matroska signature (EBML header)
    // WebM files start with EBML header: 0x1A, 0x45, 0xDF, 0xA3
    const webmSignature = Buffer.from([0x1A, 0x45, 0xDF, 0xA3]);
    
    // Check if buffer starts with WebM signature
    for (let i = 0; i < webmSignature.length; i++) {
      if (buffer[i] !== webmSignature[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Health check for OpenAI service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Simple API call to check if the service is working
      await this.openai.models.list();
      return true;
    } catch (error) {
      console.error('OpenAI health check failed:', error);
      return false;
    }
  }
}

export const openaiService = new OpenAIService();
export default openaiService;