const db = require('../database/db');

async function initializeDatabase() {
  try {
    console.log('🔄 Initialisation de la base de données...');
    
    await db.initDatabase();
    
    console.log('✅ Base de données initialisée avec succès!');
    console.log('📊 Tables créées:');
    console.log('   - audio_recordings: pour stocker les métadonnées des fichiers audio');
    
    // Afficher les statistiques initiales
    const stats = await db.getStats();
    console.log('\n📈 Statistiques actuelles:');
    console.log(`   - Nombre d'enregistrements: ${stats.total_recordings}`);
    console.log(`   - Taille totale: ${stats.total_size || 0} bytes`);
    
    if (stats.first_recording) {
      console.log(`   - Premier enregistrement: ${stats.first_recording}`);
      console.log(`   - Dernier enregistrement: ${stats.last_recording}`);
    }
    
    console.log('\n🚀 La base de données est prête à être utilisée!');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Exécuter l'initialisation si ce script est appelé directement
if (require.main === module) {
  initializeDatabase();
}

module.exports = initializeDatabase;