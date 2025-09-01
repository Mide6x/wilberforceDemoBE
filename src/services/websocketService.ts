import { Server, Socket } from 'socket.io';
import { WebSocketEvents, SupportedLanguage } from '../types';
import databaseService from './databaseService';
import openaiService from './openaiService';

interface ConnectedUser {
  socketId: string;
  roomCode: string;
  role: 'preacher' | 'listener';
  language?: SupportedLanguage;
}

class WebSocketService {
  private io: Server;
  private connectedUsers: Map<string, ConnectedUser> = new Map();
  private roomListeners: Map<string, Set<string>> = new Map(); // roomCode -> Set of socketIds
  private activeTranscriptions: Map<string, boolean> = new Map(); // roomCode -> isActive

  constructor(io: Server) {
    this.io = io;
  }

  setupEventHandlers() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Client connected: ${socket.id}`);

      // Handle joining a room
      socket.on('join-room', async (data: { roomCode: string; language: string }) => {
        try {
          await this.handleJoinRoom(socket, data);
        } catch (error) {
          console.error('Join room error:', error);
          socket.emit('error', { message: 'Failed to join room' });
        }
      });

      // Handle leaving a room
      socket.on('leave-room', async (data: { roomCode: string }) => {
        try {
          await this.handleLeaveRoom(socket, data.roomCode);
        } catch (error) {
          console.error('Leave room error:', error);
        }
      });

      // Handle transcript text for translation
      socket.on('transcript-text', async (data: { roomCode: string; text: string }) => {
        try {
          await this.handleTranscriptText(socket, data);
        } catch (error) {
          console.error('Transcript processing error:', error);
          socket.emit('error', { message: 'Failed to process transcript' });
        }
      });

      // Handle start transcription
      socket.on('start-transcription', async (data: { roomCode: string }) => {
        try {
          await this.handleStartTranscription(socket, data.roomCode);
        } catch (error) {
          console.error('Start transcription error:', error);
          socket.emit('error', { message: 'Failed to start transcription' });
        }
      });

      // Handle stop transcription
      socket.on('stop-transcription', async (data: { roomCode: string }) => {
        try {
          await this.handleStopTranscription(socket, data.roomCode);
        } catch (error) {
          console.error('Stop transcription error:', error);
          socket.emit('error', { message: 'Failed to stop transcription' });
        }
      });

      // Handle room ended
      socket.on('room-ended', (data: { roomCode: string }) => {
        console.log(`Room ${data.roomCode} has been ended`);
        // Broadcast to all users in the room that it has ended
        this.io.to(data.roomCode).emit('room-ended');
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  private async handleJoinRoom(socket: Socket, data: { roomCode: string; language: string }) {
    const { roomCode, language } = data;
    
    // Validate room exists
    const room = await databaseService.getRoomByCode(roomCode);
    if (!room) {
      socket.emit('room-joined', { success: false, message: 'Room not found' });
      return;
    }

    // Determine role based on existing connections
    const existingListeners = this.roomListeners.get(roomCode) || new Set();
    const role = existingListeners.size === 0 ? 'preacher' : 'listener';

    // Add user to connected users
    this.connectedUsers.set(socket.id, {
      socketId: socket.id,
      roomCode,
      role,
      language: language as SupportedLanguage
    });

    // Add to room listeners
    if (!this.roomListeners.has(roomCode)) {
      this.roomListeners.set(roomCode, new Set());
    }
    this.roomListeners.get(roomCode)!.add(socket.id);

    // Join socket room
    socket.join(roomCode);

    // Add listener to database if not preacher
    if (role === 'listener') {
      try {
        await databaseService.addListener(room.id, language);
      } catch (error) {
        console.error('Failed to add listener to database:', error);
      }
    }

    socket.emit('room-joined', { success: true });
    
    // Notify room about new connection
    socket.to(roomCode).emit('user-joined', { 
      role, 
      language: role === 'listener' ? language : undefined 
    });

    console.log(`User ${socket.id} joined room ${roomCode} as ${role}`);
  }

  private async handleLeaveRoom(socket: Socket, roomCode: string) {
    const user = this.connectedUsers.get(socket.id);
    if (!user || user.roomCode !== roomCode) {
      return;
    }

    // Remove from room listeners
    const listeners = this.roomListeners.get(roomCode);
    if (listeners) {
      listeners.delete(socket.id);
      if (listeners.size === 0) {
        this.roomListeners.delete(roomCode);
        // Stop any active transcription when room becomes empty
        this.activeTranscriptions.delete(roomCode);
      }
    }

    // Remove from connected users
    this.connectedUsers.delete(socket.id);

    // Leave socket room
    socket.leave(roomCode);

    // Notify room about user leaving
    socket.to(roomCode).emit('user-left', { role: user.role });

    console.log(`User ${socket.id} left room ${roomCode}`);
  }

  private async handleTranscriptText(socket: Socket, data: { roomCode: string; text: string }) {
    const user = this.connectedUsers.get(socket.id);
    if (!user || user.role !== 'preacher' || user.roomCode !== data.roomCode) {
      socket.emit('error', { message: 'Unauthorized to send transcript' });
      return;
    }

    // Check if transcription is active for this room
    if (!this.activeTranscriptions.get(data.roomCode)) {
      return;
    }

    const { text } = data;
    
    // Validate text input
    if (!text || text.trim().length === 0) {
      console.warn('Empty text received');
      return;
    }

    try {
      // Get all languages needed for this room
      const roomListeners = this.roomListeners.get(data.roomCode) || new Set();
      const targetLanguages = new Set<SupportedLanguage>(['en']); // Always include English
      
      // Add languages from all listeners in the room
      for (const socketId of roomListeners) {
        const listener = this.connectedUsers.get(socketId);
        if (listener && listener.role === 'listener' && listener.language) {
          targetLanguages.add(listener.language);
        }
      }

      // Process text for translation
      const result = await openaiService.processTranscriptText(
        text,
        Array.from(targetLanguages)
      );

      // Get room info for database storage
      const room = await databaseService.getRoomByCode(data.roomCode);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      // Save transcripts for each language and broadcast to appropriate listeners
      for (const [language, translatedText] of Object.entries(result.translations)) {
        try {
          const transcript = await databaseService.saveTranscript(
            room.id,
            result.originalText,
            language === 'en' ? null : translatedText,
            language
          );

          // Broadcast to listeners who want this language
          for (const socketId of roomListeners) {
            const listener = this.connectedUsers.get(socketId);
            if (listener && (
              (listener.role === 'preacher') || 
              (listener.role === 'listener' && listener.language === language)
            )) {
              this.io.to(socketId).emit('new-transcript', transcript);
            }
          }
        } catch (error) {
          console.error(`Failed to save/broadcast transcript for language ${language}:`, error);
        }
      }

    } catch (error) {
      console.error('Transcript processing error:', error);
      socket.emit('error', { message: 'Failed to process transcript' });
    }
  }

  private async handleStartTranscription(socket: Socket, roomCode: string) {
    const user = this.connectedUsers.get(socket.id);
    if (!user || user.role !== 'preacher' || user.roomCode !== roomCode) {
      socket.emit('error', { message: 'Unauthorized to start transcription' });
      return;
    }

    this.activeTranscriptions.set(roomCode, true);
    
    // Notify all users in the room
    this.io.to(roomCode).emit('transcription-started', { roomCode });
    
    console.log(`Transcription started for room ${roomCode}`);
  }

  private async handleStopTranscription(socket: Socket, roomCode: string) {
    const user = this.connectedUsers.get(socket.id);
    if (!user || user.role !== 'preacher' || user.roomCode !== roomCode) {
      socket.emit('error', { message: 'Unauthorized to stop transcription' });
      return;
    }

    this.activeTranscriptions.set(roomCode, false);
    
    // Notify all users in the room
    this.io.to(roomCode).emit('transcription-stopped', { roomCode });
    
    console.log(`Transcription stopped for room ${roomCode}`);
  }

  private handleDisconnect(socket: Socket) {
    const user = this.connectedUsers.get(socket.id);
    if (user) {
      this.handleLeaveRoom(socket, user.roomCode);
    }
    console.log(`Client disconnected: ${socket.id}`);
  }

  // Utility methods
  getRoomStats(roomCode: string) {
    const listeners = this.roomListeners.get(roomCode);
    const isActive = this.activeTranscriptions.get(roomCode) || false;
    
    return {
      listenerCount: listeners ? listeners.size : 0,
      isTranscribing: isActive
    };
  }

  getAllRoomStats() {
    const stats: Record<string, any> = {};
    
    for (const [roomCode] of this.roomListeners) {
      stats[roomCode] = this.getRoomStats(roomCode);
    }
    
    return stats;
  }
}

let websocketService: WebSocketService;

export function setupWebSocket(io: Server) {
  websocketService = new WebSocketService(io);
  websocketService.setupEventHandlers();
  return websocketService;
}

export { websocketService };
export default WebSocketService;