import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Meta Pixel ID
const META_PIXEL_ID = '1486269912908144';

const metaPixelPlugin = () => ({
  name: 'meta-pixel',
  transformIndexHtml(html) {
    const pixelScript = `
    <!-- Meta Pixel Code -->
    <script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js'); fbq('init', '${META_PIXEL_ID}'); fbq('track', 'PageView');<\/script>
    <noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1"/></noscript>
    <!-- End Meta Pixel Code -->`;
    return html.replace('</head>', pixelScript + '\n  </head>');
  },
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), metaPixelPlugin()],
  root: 'src',
  publicDir: 'public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
})
