import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Sermon Transcription API',
      version: '1.0.0',
      description: 'Real-time sermon transcription and translation API with WebSocket support',
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      }
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' ? 'https://your-domain.com' : 'http://localhost:3001',
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ],
    components: {
      schemas: {
        SermonRoom: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique room identifier'
            },
            room_code: {
              type: 'string',
              description: 'Unique room code for joining'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Room creation timestamp'
            },
            is_active: {
              type: 'boolean',
              description: 'Whether the room is currently active'
            }
          }
        },
        Transcript: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique transcript identifier'
            },
            room_id: {
              type: 'integer',
              description: 'ID of the room this transcript belongs to'
            },
            original_text: {
              type: 'string',
              description: 'Original transcribed text'
            },
            translated_text: {
              type: 'string',
              nullable: true,
              description: 'Translated text (null for original language)'
            },
            language: {
              type: 'string',
              description: 'Language code (ISO 639-1)'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Transcript creation timestamp'
            }
          }
        },
        Listener: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique listener identifier'
            },
            room_id: {
              type: 'integer',
              description: 'ID of the room the listener joined'
            },
            preferred_language: {
              type: 'string',
              description: 'Listener\'s preferred language code'
            },
            joined_at: {
              type: 'string',
              format: 'date-time',
              description: 'When the listener joined the room'
            }
          }
        },
        CreateRoomResponse: {
          type: 'object',
          properties: {
            roomCode: {
              type: 'string',
              description: 'Generated room code'
            },
            room: {
              $ref: '#/components/schemas/SermonRoom'
            }
          }
        },
        RoomInfo: {
          type: 'object',
          properties: {
            room: {
              $ref: '#/components/schemas/SermonRoom'
            },
            listeners: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Listener'
              }
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message'
            },
            message: {
              type: 'string',
              description: 'Detailed error description'
            }
          }
        },
        SupportedLanguages: {
          type: 'object',
          description: 'Supported languages for translation',
          properties: {
            en: { type: 'string', example: 'English' },
            es: { type: 'string', example: 'Spanish' },
            fr: { type: 'string', example: 'French' },
            de: { type: 'string', example: 'German' },
            it: { type: 'string', example: 'Italian' },
            pt: { type: 'string', example: 'Portuguese' },
            ru: { type: 'string', example: 'Russian' },
            ja: { type: 'string', example: 'Japanese' },
            ko: { type: 'string', example: 'Korean' },
            zh: { type: 'string', example: 'Chinese' },
            ar: { type: 'string', example: 'Arabic' },
            hi: { type: 'string', example: 'Hindi' }
          }
        }
      },
      responses: {
        BadRequest: {
          description: 'Bad request',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Rooms',
        description: 'Room management operations'
      },
      {
        name: 'Transcripts',
        description: 'Transcript management operations'
      },
      {
        name: 'Health',
        description: 'Health check endpoints'
      }
    ]
  },
  apis: ['./src/routes/*.ts', './src/server.ts'], // paths to files containing OpenAPI definitions
};

const specs = swaggerJsdoc(options);

export { specs, swaggerUi };