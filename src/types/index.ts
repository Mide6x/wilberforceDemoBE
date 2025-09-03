// Backend TypeScript interfaces for the sermon transcription app

export interface SermonRoom {
  id: number;
  room_code: string;
  created_at: string;
  is_active: boolean;
}

export interface Transcript {
  id: number;
  room_id: number;
  original_text: string;
  translated_text?: string;
  language: string;
  created_at: string;
}

export interface Listener {
  id: number;
  room_id: number;
  preferred_language: string;
  joined_at: string;
}

export interface CreateRoomResponse {
  roomCode: string;
  room: SermonRoom;
}

export interface RoomInfo {
  room: SermonRoom;
  listeners: Listener[];
}

// WebSocket event types for backend
export interface WebSocketEvents {
  // Client to server
  'join-room': { roomCode: string; language: string };
  'leave-room': { roomCode: string };
  'audio-chunk': { roomCode: string; audioData: ArrayBuffer };
  'start-transcription': { roomCode: string };
  'stop-transcription': { roomCode: string };
  
  // Server to client
  'room-joined': { success: boolean; message?: string };
  'new-transcript': Transcript;
  'transcription-started': { roomCode: string };
  'transcription-stopped': { roomCode: string };
  'error': { message: string };
}

// Language options for translation
export const SUPPORTED_LANGUAGES = {
  'af': 'Afrikaans',
  'ar': 'Arabic',
  'zh': 'Chinese (Mandarin)',
  'nl': 'Dutch',
  'en': 'English',
  'fa': 'Farsi (Persian)',
  'fr': 'French',
  'de': 'German',
  'ha': 'Hausa',
  'hi': 'Hindi',
  'it': 'Italian',
  'jam': 'Jamaican Patois',
  'ja': 'Japanese',
  'ko': 'Korean',
  'mfe': 'Mauritian Creole',
  'pcm': 'Nigerian Pidgin',
  'pl': 'Polish',
  'pt': 'Portuguese',
  'pa': 'Punjabi',
  'ru': 'Russian',
  'st': 'Sesotho (Lesotho)',
  'es': 'Spanish',
  'ta': 'Tamil',
  'ur': 'Urdu',
  'vi': 'Vietnamese',
  'yo': 'Yoruba',
  'zu': 'Zulu'
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;