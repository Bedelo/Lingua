const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'lingua.db');

class Database {
  constructor() {
    this.db = null;
  }

  // Initialiser la base de données
  async initDatabase() {
    return new Promise((resolve, reject) => {
      // Créer le dossier database s'il n'existe pas
      const dbDir = path.dirname(DB_PATH);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          console.error('Erreur lors de l\'ouverture de la base de données:', err);
          reject(err);
        } else {
          console.log('✅ Connexion à la base de données SQLite établie');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  // Créer les tables nécessaires
  async createTables() {
    return new Promise((resolve, reject) => {
      const createAudioTable = `
        CREATE TABLE IF NOT EXISTS audio_recordings (
          id TEXT PRIMARY KEY,
          filename TEXT NOT NULL,
          original_name TEXT,
          audio_data BLOB,
          file_size INTEGER,
          mime_type TEXT,
          upload_date TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      const createAudioChunksTable = `
        CREATE TABLE IF NOT EXISTS audio_chunks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          recording_id TEXT NOT NULL,
          chunk_index INTEGER NOT NULL,
          chunk_data BLOB NOT NULL,
          chunk_size INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (recording_id) REFERENCES audio_recordings (id) ON DELETE CASCADE
        )
      `;

      const createStreamingChunksTable = `
        CREATE TABLE IF NOT EXISTS streaming_chunks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          recording_id TEXT NOT NULL,
          chunk_index INTEGER NOT NULL,
          chunk_data BLOB NOT NULL,
          chunk_size INTEGER NOT NULL,
          timestamp INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      this.db.run(createAudioTable, (err) => {
        if (err) {
          console.error('Erreur lors de la création de la table audio_recordings:', err);
          reject(err);
        } else {
          console.log('✅ Table audio_recordings créée ou vérifiée');
          
          // Créer la table des chunks
          this.db.run(createAudioChunksTable, (err) => {
            if (err) {
              console.error('Erreur lors de la création de la table audio_chunks:', err);
              reject(err);
            } else {
              console.log('✅ Table audio_chunks créée ou vérifiée');
              
              // Créer la table des chunks de streaming
              this.db.run(createStreamingChunksTable, (err) => {
                if (err) {
                  console.error('Erreur lors de la création de la table streaming_chunks:', err);
                  reject(err);
                } else {
                  console.log('✅ Table streaming_chunks créée ou vérifiée');
                  resolve();
                }
              });
            }
          });
        }
      });
    });
  }

  // Sauvegarder un enregistrement audio avec BLOB
  async saveAudioRecord(audioData) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO audio_recordings (
          id, filename, original_name, audio_data, file_size, mime_type, upload_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        audioData.id,
        audioData.filename,
        audioData.originalName,
        audioData.audioData, // BLOB data
        audioData.size,
        audioData.mimeType,
        audioData.uploadDate
      ];

      this.db.run(query, params, function(err) {
        if (err) {
          console.error('Erreur lors de la sauvegarde:', err);
          reject(err);
        } else {
          console.log(`✅ Enregistrement audio sauvegardé avec l'ID: ${audioData.id}`);
          resolve({ id: audioData.id, changes: this.changes });
        }
      });
    });
  }

  // Sauvegarder un chunk d'audio
  async saveAudioChunk(recordingId, chunkIndex, chunkData) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO audio_chunks (recording_id, chunk_index, chunk_data, chunk_size)
        VALUES (?, ?, ?, ?)
      `;

      const params = [recordingId, chunkIndex, chunkData, chunkData.length];

      this.db.run(query, params, function(err) {
        if (err) {
          console.error('Erreur lors de la sauvegarde du chunk:', err);
          reject(err);
        } else {
          resolve({ chunkIndex, size: chunkData.length });
        }
      });
    });
  }

  // Assembler les chunks pour reconstituer l'audio complet
  async assembleAudioFromChunks(recordingId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT chunk_data FROM audio_chunks 
        WHERE recording_id = ? 
        ORDER BY chunk_index ASC
      `;

      this.db.all(query, [recordingId], (err, rows) => {
        if (err) {
          console.error('Erreur lors de l\'assemblage des chunks:', err);
          reject(err);
        } else {
          const chunks = rows.map(row => row.chunk_data);
          const completeAudio = Buffer.concat(chunks);
          resolve(completeAudio);
        }
      });
    });
  }

  // Récupérer les données audio BLOB
  async getAudioData(id) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT audio_data FROM audio_recordings WHERE id = ?';

      this.db.get(query, [id], (err, row) => {
        if (err) {
          console.error('Erreur lors de la récupération des données audio:', err);
          reject(err);
        } else {
          resolve(row ? row.audio_data : null);
        }
      });
    });
  }

  // Récupérer tous les enregistrements audio
  async getAllAudioRecords() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          id,
          filename,
          original_name,
          file_size,
          mime_type,
          upload_date,
          created_at,
          updated_at
        FROM audio_recordings 
        ORDER BY created_at DESC
      `;

      this.db.all(query, [], (err, rows) => {
        if (err) {
          console.error('Erreur lors de la récupération des enregistrements:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Récupérer un enregistrement par ID
  async getAudioRecordById(id) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          id,
          filename,
          original_name,
          file_size,
          mime_type,
          upload_date,
          created_at,
          updated_at
        FROM audio_recordings 
        WHERE id = ?
      `;

      this.db.get(query, [id], (err, row) => {
        if (err) {
          console.error('Erreur lors de la récupération de l\'enregistrement:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Supprimer un enregistrement
  async deleteAudioRecord(id) {
    return new Promise((resolve, reject) => {
      const query = 'DELETE FROM audio_recordings WHERE id = ?';

      this.db.run(query, [id], function(err) {
        if (err) {
          console.error('Erreur lors de la suppression:', err);
          reject(err);
        } else {
          console.log(`✅ Enregistrement supprimé: ${id}`);
          resolve({ id, changes: this.changes });
        }
      });
    });
  }

  // Mettre à jour un enregistrement
  async updateAudioRecord(id, updateData) {
    return new Promise((resolve, reject) => {
      const fields = [];
      const values = [];
      
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          fields.push(`${key} = ?`);
          values.push(updateData[key]);
        }
      });
      
      if (fields.length === 0) {
        resolve({ id, changes: 0 });
        return;
      }
      
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      
      const query = `UPDATE audio_recordings SET ${fields.join(', ')} WHERE id = ?`;
      
      this.db.run(query, values, function(err) {
        if (err) {
          console.error('Erreur lors de la mise à jour:', err);
          reject(err);
        } else {
          resolve({ id, changes: this.changes });
        }
      });
    });
  }

  // Obtenir des statistiques
  async getStats() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as total_recordings,
          SUM(file_size) as total_size,
          AVG(file_size) as average_size,
          MIN(created_at) as first_recording,
          MAX(created_at) as last_recording
        FROM audio_recordings
      `;

      this.db.get(query, [], (err, row) => {
        if (err) {
          console.error('Erreur lors de la récupération des statistiques:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // === FONCTIONS DE STREAMING ===

  // Sauvegarder un chunk de streaming
  async saveStreamingChunk(recordingId, chunkIndex, chunkData, timestamp) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO streaming_chunks (recording_id, chunk_index, chunk_data, chunk_size, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      const params = [recordingId, chunkIndex, chunkData, chunkData.length, timestamp];

      this.db.run(query, params, function(err) {
        if (err) {
          console.error('Erreur lors de la sauvegarde du chunk de streaming:', err);
          reject(err);
        } else {
          console.log(`✅ Chunk de streaming sauvegardé: ${recordingId} - chunk ${chunkIndex}`);
          resolve({ chunkIndex, size: chunkData.length, timestamp });
        }
      });
    });
  }

  // Assembler les chunks de streaming pour reconstituer l'audio complet
  async assembleStreamingChunks(recordingId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT chunk_data FROM streaming_chunks 
        WHERE recording_id = ? 
        ORDER BY chunk_index ASC
      `;

      this.db.all(query, [recordingId], (err, rows) => {
        if (err) {
          console.error('Erreur lors de l\'assemblage des chunks de streaming:', err);
          reject(err);
        } else {
          const chunks = rows.map(row => row.chunk_data);
          const completeAudio = Buffer.concat(chunks);
          console.log(`✅ Audio assemblé à partir de ${chunks.length} chunks de streaming`);
          resolve(completeAudio);
        }
      });
    });
  }

  // Nettoyer les chunks de streaming après assemblage
  async cleanupStreamingChunks(recordingId) {
    return new Promise((resolve, reject) => {
      const query = 'DELETE FROM streaming_chunks WHERE recording_id = ?';

      this.db.run(query, [recordingId], function(err) {
        if (err) {
          console.error('Erreur lors du nettoyage des chunks de streaming:', err);
          reject(err);
        } else {
          console.log(`✅ Chunks de streaming nettoyés pour: ${recordingId}`);
          resolve({ recordingId, deletedChunks: this.changes });
        }
      });
    });
  }

  // Obtenir le nombre de chunks de streaming pour un enregistrement
  async getStreamingChunkCount(recordingId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT COUNT(*) as count FROM streaming_chunks WHERE recording_id = ?';

      this.db.get(query, [recordingId], (err, row) => {
        if (err) {
          console.error('Erreur lors du comptage des chunks de streaming:', err);
          reject(err);
        } else {
          resolve(row.count);
        }
      });
    });
  }

  // Fermer la connexion à la base de données
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Erreur lors de la fermeture de la base de données:', err);
        } else {
          console.log('🔒 Connexion à la base de données fermée');
        }
      });
    }
  }
}

// Créer une instance unique de la base de données
const database = new Database();

module.exports = database;