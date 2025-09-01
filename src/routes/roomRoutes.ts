import express from 'express';
import databaseService from '../services/databaseService';
import { CreateRoomResponse, RoomInfo } from '../types';

const router = express.Router();

/**
 * @swagger
 * /rooms/create:
 *   post:
 *     summary: Create a new sermon room
 *     tags: [Rooms]
 *     responses:
 *       201:
 *         description: Room created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateRoomResponse'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/create', async (req, res) => {
  try {
    // Generate a unique room code
    const roomCode = await databaseService.generateUniqueRoomCode();
    
    // Create the room in the database
    const room = await databaseService.createRoom(roomCode);
    
    const response: CreateRoomResponse = {
      roomCode: room.room_code,
      room: room
    };
    
    res.status(201).json(response);
    console.log(`Created room: ${roomCode}`);
  } catch (error) {
    console.error('Create room error:', error);
    return res.status(500).json({ 
      error: 'Failed to create room',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /rooms/{code}:
 *   get:
 *     summary: Get room information by room code
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Room code
 *     responses:
 *       200:
 *         description: Room information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoomInfo'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Invalid room code' });
    }
    
    const room = await databaseService.getRoomByCode(code.toUpperCase());
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    // Get listeners for this room
    const listeners = await databaseService.getListenersByRoom(room.id);
    
    const response: RoomInfo = {
      room: room,
      listeners: listeners
    };
    
    res.json(response);
  } catch (error) {
    console.error('Get room error:', error);
    return res.status(500).json({ 
      error: 'Failed to get room information',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /rooms/{code}/end:
 *   post:
 *     summary: End a sermon room (mark as inactive)
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Room code
 *     responses:
 *       200:
 *         description: Room ended successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/:code/end', async (req, res) => {
  try {
    const { code } = req.params;
    
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Invalid room code' });
    }
    
    // Check if room exists
    const room = await databaseService.getRoomByCode(code.toUpperCase());
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    // End the room
    await databaseService.endRoom(code.toUpperCase());
    
    res.json({ success: true, message: 'Room ended successfully' });
    console.log(`Ended room: ${code.toUpperCase()}`);
  } catch (error) {
    console.error('End room error:', error);
    return res.status(500).json({ 
      error: 'Failed to end room',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /rooms/{code}/transcripts:
 *   get:
 *     summary: Get all transcripts for a room
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Room code
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *         description: Filter by language code
 *     responses:
 *       200:
 *         description: Transcripts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transcripts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Transcript'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:code/transcripts', async (req, res) => {
  try {
    const { code } = req.params;
    const { language } = req.query;
    
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Invalid room code' });
    }
    
    const room = await databaseService.getRoomByCode(code.toUpperCase());
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    let transcripts = await databaseService.getTranscriptsByRoom(room.id);
    
    // Filter by language if specified
    if (language && typeof language === 'string') {
      transcripts = transcripts.filter(t => t.language === language);
    }
    
    res.json({ transcripts });
  } catch (error) {
    console.error('Get transcripts error:', error);
    return res.status(500).json({ 
      error: 'Failed to get transcripts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /rooms/{code}/listeners:
 *   get:
 *     summary: Get all listeners for a room
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Room code
 *     responses:
 *       200:
 *         description: Listeners retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 listeners:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Listener'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:code/listeners', async (req, res) => {
  try {
    const { code } = req.params;
    
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Invalid room code' });
    }
    
    const room = await databaseService.getRoomByCode(code.toUpperCase());
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    const listeners = await databaseService.getListenersByRoom(room.id);
    
    res.json({ listeners });
  } catch (error) {
    console.error('Get listeners error:', error);
    return res.status(500).json({ 
      error: 'Failed to get listeners',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /rooms:
 *   get:
 *     summary: Get all active rooms (for admin/debugging purposes)
 *     tags: [Rooms]
 *     responses:
 *       200:
 *         description: Active rooms retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 rooms:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SermonRoom'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/', async (req, res) => {
  try {
    // This is a simple implementation - in production you might want to add pagination
    const { data: rooms, error } = await databaseService['supabase']
      .from('sermon_rooms')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) {
      throw error;
    }
    
    res.json({ rooms: rooms || [] });
  } catch (error) {
    console.error('Get rooms error:', error);
    return res.status(500).json({ 
      error: 'Failed to get rooms',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;