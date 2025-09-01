import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SermonRoom, Transcript, Listener } from '../types';

class DatabaseService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration. Please check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // Room operations
  async createRoom(roomCode: string): Promise<SermonRoom> {
    const { data, error } = await this.supabase
      .from('sermon_rooms')
      .insert({
        room_code: roomCode,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create room: ${error.message}`);
    }

    return data;
  }

  async getRoomByCode(roomCode: string): Promise<SermonRoom | null> {
    const { data, error } = await this.supabase
      .from('sermon_rooms')
      .select('*')
      .eq('room_code', roomCode)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Room not found
      }
      throw new Error(`Failed to get room: ${error.message}`);
    }

    return data;
  }

  async endRoom(roomCode: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('sermon_rooms')
      .update({ is_active: false })
      .eq('room_code', roomCode);

    if (error) {
      throw new Error(`Failed to end room: ${error.message}`);
    }

    return true;
  }

  // Transcript operations
  async saveTranscript(
    roomId: number,
    originalText: string,
    translatedText: string | null,
    language: string
  ): Promise<Transcript> {
    const { data, error } = await this.supabase
      .from('transcripts')
      .insert({
        room_id: roomId,
        original_text: originalText,
        translated_text: translatedText,
        language: language
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save transcript: ${error.message}`);
    }

    return data;
  }

  async getTranscriptsByRoom(roomId: number): Promise<Transcript[]> {
    const { data, error } = await this.supabase
      .from('transcripts')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get transcripts: ${error.message}`);
    }

    return data || [];
  }

  // Listener operations
  async addListener(roomId: number, preferredLanguage: string): Promise<Listener> {
    const { data, error } = await this.supabase
      .from('listeners')
      .insert({
        room_id: roomId,
        preferred_language: preferredLanguage
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add listener: ${error.message}`);
    }

    return data;
  }

  async getListenersByRoom(roomId: number): Promise<Listener[]> {
    const { data, error } = await this.supabase
      .from('listeners')
      .select('*')
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get listeners: ${error.message}`);
    }

    return data || [];
  }

  async removeListener(listenerId: number): Promise<boolean> {
    const { error } = await this.supabase
      .from('listeners')
      .delete()
      .eq('id', listenerId);

    if (error) {
      throw new Error(`Failed to remove listener: ${error.message}`);
    }

    return true;
  }

  // Utility method to generate unique room codes
  async generateUniqueRoomCode(): Promise<string> {
    let roomCode: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      roomCode = this.generateRoomCode();
      const existingRoom = await this.getRoomByCode(roomCode);
      
      if (!existingRoom) {
        return roomCode;
      }
      
      attempts++;
    } while (attempts < maxAttempts);

    throw new Error('Failed to generate unique room code after multiple attempts');
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('sermon_rooms')
        .select('id')
        .limit(1);
      
      return !error;
    } catch {
      return false;
    }
  }
}

export const databaseService = new DatabaseService();
export default databaseService;