const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const db = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration CORS
const corsOptions = {
  origin: '*', // Accepte toutes les origines
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  // allowedHeaders: [
  //   'Content-Type',
  //   'Authorization',
  //   'X-Requested-With',
  //   'Accept',
  //   'Origin'
  // ],
  credentials: false, // Désactivé car origin: '*'
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' })); // Increased limit for chunked uploads

// Middleware to set the ngrok-skip-browser-warning header
app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next(); // Pass control to the next middleware or route handler
});

// Middleware to set a custom User-Agent header
app.use((req, res, next) => {
    req.headers['User-Agent'] = 'CustomUserAgent/1.0'; // Set your custom User-Agent
    next(); // Pass control to the next middleware or route handler
});

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
  
  console.log(`📡 ${req.method} ${req.path} - IP: ${clientIP} - ${timestamp}`);
  
  // Log response status when request completes
  const originalSend = res.send;
  res.send = function(data) {
    if (res.statusCode >= 400) {
      console.log(`❌ Erreur ${res.statusCode} pour ${req.method} ${req.path} - IP: ${clientIP}`);
    } else {
      console.log(`✅ Succès ${res.statusCode} pour ${req.method} ${req.path} - IP: ${clientIP}`);
    }
    originalSend.call(this, data);
  };
  
  next();
});


// Routes

// Favicon route to prevent 404 errors (add this here)
app.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // No content
});

app.get('/', (req, res) => {
  console.log("HELLLO")
   res.json({ 
    success: true, 
    message: 'Welcome to API of LINGUA!'
  });
});

// Health check
app.get('/api/health', (req, res) => {
  const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  const timestamp = new Date().toISOString();
  
  console.log(`✅ Test de connexion réussi - IP: ${clientIP} - User-Agent: ${userAgent} - ${timestamp}`);
  
  res.json({ 
    success: true, 
    message: 'Serveur Lingua backend opérationnel',
    timestamp: timestamp
  });
});



// Upload d'un chunk d'audio
app.post('/api/audio/upload-chunk', async (req, res) => {
  try {
    const { recordingId, chunkIndex, chunkData } = req.body;
    
    if (!recordingId || chunkIndex === undefined || !chunkData) {
      return res.status(400).json({ error: 'Données de chunk manquantes' });
    }

    // Convertir base64 en Buffer
    const chunkBuffer = Buffer.from(chunkData, 'base64');
    
    // Sauvegarder le chunk
    const result = await db.saveAudioChunk(recordingId, chunkIndex, chunkBuffer);
    
    res.json({
      success: true,
      message: 'Chunk sauvegardé avec succès',
      data: result
    });
  } catch (error) {
    console.error('Erreur lors de la sauvegarde du chunk:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la sauvegarde du chunk' });
  }
});

// Finaliser l'upload par chunks
app.post('/api/audio/finalize-chunked-upload', async (req, res) => {
  try {
    const { recordingId, filename, originalName, mimeType, totalSize } = req.body;
    
    if (!recordingId) {
      return res.status(400).json({ error: 'ID d\'enregistrement manquant' });
    }

    // Assembler les chunks
    const completeAudio = await db.assembleAudioFromChunks(recordingId);
    
    const audioRecord = {
      id: recordingId,
      filename: `lingua_${filename || 'recording_' + Date.now() + '.m4a'}`,
      originalName: originalName || 'recording.m4a',
      audioData: completeAudio,
      size: totalSize || completeAudio.length,
      mimeType: mimeType || 'audio/mp4',
      uploadDate: new Date().toISOString()
    };

    // Sauvegarder l'enregistrement complet
    await db.saveAudioRecord(audioRecord);
    
    res.json({
      success: true,
      message: 'Upload par chunks finalisé avec succès',
      data: {
        id: audioRecord.id,
        filename: audioRecord.filename,
        uploadDate: audioRecord.uploadDate,
        size: audioRecord.size
      }
    });
  } catch (error) {
    console.error('Erreur lors de la finalisation:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la finalisation' });
  }
});



// Récupérer tous les enregistrements audio
app.get('/api/audio', async (req, res) => {
  try {
    const recordings = await db.getAllAudioRecords();
    res.json({
      success: true,
      data: recordings
    });
  } catch (error) {
    console.error('Erreur lors de la récupération:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération' });
  }
});

// Récupérer un enregistrement spécifique
app.get('/api/audio/:id', async (req, res) => {
  try {
    const recording = await db.getAudioRecordById(req.params.id);
    if (!recording) {
      return res.status(404).json({ error: 'Enregistrement non trouvé' });
    }
    res.json({
      success: true,
      data: recording
    });
  } catch (error) {
    console.error('Erreur lors de la récupération:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération' });
  }
});

// Supprimer un enregistrement
app.delete('/api/audio/:id', async (req, res) => {
  try {
    const recording = await db.getAudioRecordById(req.params.id);
    if (!recording) {
      return res.status(404).json({ error: 'Enregistrement non trouvé' });
    }

    // Supprimer de la base de données (les chunks seront supprimés automatiquement via CASCADE)
    await db.deleteAudioRecord(req.params.id);
    
    res.json({
      success: true,
      message: 'Enregistrement supprimé avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la suppression' });
  }
});

// Télécharger un fichier audio
app.get('/api/audio/:id/download', async (req, res) => {
  try {
    const recording = await db.getAudioRecordById(req.params.id);
    if (!recording) {
      return res.status(404).json({ error: 'Enregistrement non trouvé' });
    }

    // Récupérer les données audio BLOB
    const audioData = await db.getAudioData(req.params.id);
    if (!audioData) {
      return res.status(404).json({ error: 'Données audio non trouvées' });
    }

    // Définir les headers appropriés
    res.setHeader('Content-Type', recording.mime_type || 'audio/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${recording.original_name}"`);
    res.setHeader('Content-Length', audioData.length);
    
    // Envoyer les données audio
    res.send(audioData);
  } catch (error) {
    console.error('Erreur lors du téléchargement:', error);
    res.status(500).json({ error: 'Erreur serveur lors du téléchargement' });
  }
});



// Initialiser la base de données et démarrer le serveur
db.initDatabase().then(() => {
  app.listen(PORT, "0.0.0.0",() => {
    console.log(`🚀 Serveur Lingua démarré sur le port ${PORT}`);
    console.log(`📊 Base de données SQLite initialisée`);
    console.log(`🔗 API disponible sur http://localhost:${PORT}/api`);
  });
}).catch(error => {
  console.error('❌ Erreur lors de l\'initialisation de la base de données:', error);
  process.exit(1);
});

module.exports = app;