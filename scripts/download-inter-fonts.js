/**
 * Script pour télécharger automatiquement les polices Inter depuis Google Fonts
 * Usage: node scripts/download-inter-fonts.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const fontsDir = path.join(__dirname, '../assets/fonts');
const fonts = [
  { name: 'Inter-Regular', weight: '400' },
  { name: 'Inter-Medium', weight: '500' },
  { name: 'Inter-SemiBold', weight: '600' },
  { name: 'Inter-Bold', weight: '700' }
];

// Créer le dossier si nécessaire
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

console.log('📥 Téléchargement des polices Inter depuis Google Fonts...\n');

// Note: Ce script nécessite d'avoir curl ou wget installé
// Alternative: télécharger manuellement depuis https://fonts.google.com/specimen/Inter

fonts.forEach((font) => {
  const url = `https://github.com/rsms/inter/raw/master/docs/font-files/Inter-${font.weight}.ttf`;
  const filePath = path.join(fontsDir, `${font.name}.ttf`);

  console.log(`Téléchargement de ${font.name}...`);

  try {
    // Utiliser curl si disponible (Windows 10+ ou Git Bash)
    execSync(`curl -L "${url}" -o "${filePath}"`, { stdio: 'inherit' });
    console.log(`✅ ${font.name} téléchargé\n`);
  } catch (error) {
    console.log(`⚠️  Impossible de télécharger ${font.name} automatiquement`);
    console.log(`   Veuillez télécharger manuellement depuis: ${url}\n`);
  }
});

console.log('✅ Téléchargement terminé!');
console.log('\n📝 Note: Si le téléchargement automatique a échoué,');
console.log('   téléchargez les fichiers depuis: https://fonts.google.com/specimen/Inter');
console.log('   et placez-les dans assets/fonts/');
