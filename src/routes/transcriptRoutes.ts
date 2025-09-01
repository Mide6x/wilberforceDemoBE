import express from 'express';
import databaseService from '../services/databaseService';
import { Transcript } from '../types';

const router = express.Router();

/**
 * @swagger
 * /transcripts/{id}:
 *   get:
 *     summary: Get a specific transcript by ID
 *     tags: [Transcripts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Transcript ID
 *     responses:
 *       200:
 *         description: Transcript retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transcript:
 *                   $ref: '#/components/schemas/Transcript'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ error: 'Invalid transcript ID' });
    }
    
    const { data: transcript, error } = await databaseService['supabase']
      .from('transcripts')
      .select('*')
      .eq('id', Number(id))
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Transcript not found' });
      }
      throw error;
    }
    
    res.json({ transcript });
  } catch (error) {
    console.error('Get transcript error:', error);
    res.status(500).json({ 
      error: 'Failed to get transcript',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /transcripts/{id}:
 *   delete:
 *     summary: Delete a specific transcript (for cleanup/admin purposes)
 *     tags: [Transcripts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Transcript ID
 *     responses:
 *       200:
 *         description: Transcript deleted successfully
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
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ error: 'Invalid transcript ID' });
    }
    
    const { error } = await databaseService['supabase']
      .from('transcripts')
      .delete()
      .eq('id', Number(id));
    
    if (error) {
      throw error;
    }
    
    res.json({ success: true, message: 'Transcript deleted successfully' });
    console.log(`Deleted transcript: ${id}`);
  } catch (error) {
    console.error('Delete transcript error:', error);
    res.status(500).json({ 
      error: 'Failed to delete transcript',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /transcripts/room/{roomId}:
 *   get:
 *     summary: Get all transcripts for a specific room ID
 *     tags: [Transcripts]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Room ID
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *         description: Filter by language code
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Maximum number of transcripts to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: Number of transcripts to skip
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
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/room/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { language, limit, offset } = req.query;
    
    if (!roomId || isNaN(Number(roomId))) {
      return res.status(400).json({ error: 'Invalid room ID' });
    }
    
    let query = databaseService['supabase']
      .from('transcripts')
      .select('*')
      .eq('room_id', Number(roomId))
      .order('created_at', { ascending: true });
    
    // Filter by language if specified
    if (language && typeof language === 'string') {
      query = query.eq('language', language);
    }
    
    // Add pagination if specified
    if (limit && !isNaN(Number(limit))) {
      query = query.limit(Number(limit));
    }
    
    if (offset && !isNaN(Number(offset))) {
      query = query.range(Number(offset), Number(offset) + (Number(limit) || 50) - 1);
    }
    
    const { data: transcripts, error } = await query;
    
    if (error) {
      throw error;
    }
    
    res.json({ transcripts: transcripts || [] });
  } catch (error) {
    console.error('Get room transcripts error:', error);
    res.status(500).json({ 
      error: 'Failed to get room transcripts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /transcripts/search:
 *   post:
 *     summary: Search transcripts by text content
 *     tags: [Transcripts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *                 description: Search query text
 *               roomId:
 *                 type: integer
 *                 description: Filter by room ID
 *               language:
 *                 type: string
 *                 description: Filter by language code
 *               limit:
 *                 type: integer
 *                 default: 50
 *                 description: Maximum number of results
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transcripts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Transcript'
 *                 query:
 *                   type: string
 *                 count:
 *                   type: integer
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/search', async (req, res) => {
  try {
    const { query: searchQuery, roomId, language, limit = 50 } = req.body;
    
    if (!searchQuery || typeof searchQuery !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    let query = databaseService['supabase']
      .from('transcripts')
      .select('*')
      .or(`original_text.ilike.%${searchQuery}%,translated_text.ilike.%${searchQuery}%`)
      .order('created_at', { ascending: false })
      .limit(Number(limit));
    
    // Filter by room if specified
    if (roomId && !isNaN(Number(roomId))) {
      query = query.eq('room_id', Number(roomId));
    }
    
    // Filter by language if specified
    if (language && typeof language === 'string') {
      query = query.eq('language', language);
    }
    
    const { data: transcripts, error } = await query;
    
    if (error) {
      throw error;
    }
    
    res.json({ 
      transcripts: transcripts || [],
      query: searchQuery,
      count: transcripts?.length || 0
    });
  } catch (error) {
    console.error('Search transcripts error:', error);
    res.status(500).json({ 
      error: 'Failed to search transcripts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /transcripts/stats/{roomId}:
 *   get:
 *     summary: Get transcript statistics for a room
 *     tags: [Transcripts]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Room ID
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalTranscripts:
 *                       type: integer
 *                     languageBreakdown:
 *                       type: object
 *                       additionalProperties:
 *                         type: integer
 *                     firstTranscript:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                     lastTranscript:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/stats/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    
    if (!roomId || isNaN(Number(roomId))) {
      return res.status(400).json({ error: 'Invalid room ID' });
    }
    
    // Get total count
    const { count: totalCount, error: countError } = await databaseService['supabase']
      .from('transcripts')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', Number(roomId));
    
    if (countError) {
      throw countError;
    }
    
    // Get language breakdown
    const { data: languageStats, error: langError } = await databaseService['supabase']
      .from('transcripts')
      .select('language')
      .eq('room_id', Number(roomId));
    
    if (langError) {
      throw langError;
    }
    
    // Count by language
    const languageBreakdown: Record<string, number> = {};
    languageStats?.forEach(transcript => {
      languageBreakdown[transcript.language] = (languageBreakdown[transcript.language] || 0) + 1;
    });
    
    // Get first and last transcript timestamps
    const { data: timeRange, error: timeError } = await databaseService['supabase']
      .from('transcripts')
      .select('created_at')
      .eq('room_id', Number(roomId))
      .order('created_at', { ascending: true })
      .limit(1);
    
    const { data: lastTranscript, error: lastError } = await databaseService['supabase']
      .from('transcripts')
      .select('created_at')
      .eq('room_id', Number(roomId))
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (timeError || lastError) {
      throw timeError || lastError;
    }
    
    const stats = {
      totalTranscripts: totalCount || 0,
      languageBreakdown,
      firstTranscript: timeRange?.[0]?.created_at || null,
      lastTranscript: lastTranscript?.[0]?.created_at || null
    };
    
    res.json({ stats });
  } catch (error) {
    console.error('Get transcript stats error:', error);
    res.status(500).json({ 
      error: 'Failed to get transcript statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /transcripts/room/{roomId}:
 *   delete:
 *     summary: Delete all transcripts for a room (cleanup)
 *     tags: [Transcripts]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Room ID
 *     responses:
 *       200:
 *         description: All transcripts deleted successfully
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
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/room/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    
    if (!roomId || isNaN(Number(roomId))) {
      return res.status(400).json({ error: 'Invalid room ID' });
    }
    
    const { error } = await databaseService['supabase']
      .from('transcripts')
      .delete()
      .eq('room_id', Number(roomId));
    
    if (error) {
      throw error;
    }
    
    res.json({ success: true, message: 'All transcripts deleted successfully' });
    console.log(`Deleted all transcripts for room: ${roomId}`);
  } catch (error) {
    console.error('Delete room transcripts error:', error);
    res.status(500).json({ 
      error: 'Failed to delete room transcripts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;