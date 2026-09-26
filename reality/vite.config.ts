import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Virtual modules that embed fonts as base64 so the page makes zero network requests,
// whether served from dist/ or opened as dist/reality.html from file://.
function embeddedAssets(): Plugin {
  const katexDir = resolve(import.meta.dirname, 'node_modules/katex/dist');
  const ids = ['virtual:katex-css', 'virtual:fonts'];
  return {
    name: 'reality-embedded-assets',
    resolveId(id) {
      return ids.includes(id) ? '\0' + id : null;
    },
    load(id) {
      if (id === '\0virtual:katex-css') {
        let css = readFileSync(resolve(katexDir, 'katex.min.css'), 'utf8');
        const fonts = new Set(readdirSync(resolve(katexDir, 'fonts')));
        // keep only the woff2 source of each @font-face and inline it
        css = css.replace(/src:url\(fonts\/([^)]+?)\.woff2\) format\("woff2"\)[^;}]*/g, (_m, name: string) => {
          if (!fonts.has(name + '.woff2')) throw new Error('missing KaTeX font ' + name);
          const b64 = readFileSync(resolve(katexDir, 'fonts', name + '.woff2')).toString('base64');
          return `src:url(data:font/woff2;base64,${b64}) format("woff2")`;
        });
        if (/url\(fonts\//.test(css)) throw new Error('unresolved KaTeX font url');
        return `export default ${JSON.stringify(css)};`;
      }
      if (id === '\0virtual:fonts') {
        const inter = readFileSync(resolve(import.meta.dirname, 'node_modules/inter-ui/variable/InterVariable.woff2')).toString('base64');
        return `export const INTER_WOFF2 = "data:font/woff2;base64,${inter}";`;
      }
      return null;
    },
  };
}

export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    plugins: [embeddedAssets(), ...(single ? [viteSingleFile({ removeViteModuleLoader: true })] : [])],
    worker: { format: 'iife' }, // classic workers: module workers from blob: URLs fail on file:// (opaque origin)
    build: {
      target: 'es2022',
      outDir: single ? 'dist-single' : 'dist',
      emptyOutDir: true,
      assetsInlineLimit: single ? 100_000_000 : 4096,
      chunkSizeWarningLimit: 20_000,
      reportCompressedSize: false,
      sourcemap: false,
    },
    server: { port: 5173, host: '127.0.0.1' },
    preview: { port: 4173, host: '127.0.0.1' },
  };
});
