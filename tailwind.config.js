/**
 * ========================================
 * TAILWIND CSS CONFIGURATION
 * ========================================
 * Arquivo de configuração do Tailwind CSS
 * Define temas, extensões e customizações
 */

module.exports = {
  content: [
    // Escaneia arquivos HTML, EJS e JS para gerar CSS
    './src/views/**/*.{html,ejs,js}',
    './src/public/**/*.{html,js}',
  ],
  
  theme: {
    extend: {
      // Aqui você pode adicionar cores customizadas
      colors: {
        // primary: '#3B82F6', // Azul primário
      },
      
      // Fontes customizadas
      fontFamily: {
        // sans: ['Inter', 'sans-serif'],
      },
      
      // Espaçamentos customizados
      spacing: {
        // Adicione valores personalizados se necessário
      },
    },
  },
  
  plugins: [
    // Aqui você pode adicionar plugins do Tailwind
  ],
}
