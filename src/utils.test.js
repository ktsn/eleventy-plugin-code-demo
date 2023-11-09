const { outdent } = require('outdent');
const ts = require('typescript');
const { parse } = require('@vue/compiler-sfc');
const { makeCodeDemoShortcode } = require('./utils');

describe('makeCodeDemoShortcode', () => {
  it('includes html, css, and js', async () => {
    const shortcode = makeCodeDemoShortcode({
      renderDocument: ({ html, css, js }) => `
      <!doctype html>
      <html>
      <head>
        <style>${css}</style>
      </head>
      <body>
        ${html}
        <script>${js}</script>
      </body>
      </html>`,
    });
    const source = outdent`
        \`\`\`html
        <button>Click me</button>
        \`\`\`
        \`\`\`css
        button { padding: 0 }
        \`\`\`
        \`\`\`js
        console.log("test");
        \`\`\`
        `;
    expect(await shortcode(source, 'title')).toMatchInlineSnapshot(
      `"<iframe title="title" srcdoc="&lt;!doctype html&gt;&lt;html&gt;&lt;head&gt;&lt;style&gt;button{padding:0}&lt;/style&gt;&lt;/head&gt;&lt;body&gt;&lt;button&gt;Click me&lt;/button&gt;&lt;script&gt;console.log(&quot;test&quot;)&lt;/script&gt;&lt;/body&gt;&lt;/html&gt;"></iframe>"`
    );
  });

  it('preprocess: ts', async () => {
    const shortcode = makeCodeDemoShortcode({
      renderDocument: ({ html, css, js }) => `
      <!doctype html>
      <html>
      <head>
        <style>${css}</style>
      </head>
      <body>
        ${html}
        <script>${js}</script>
      </body>
      </html>`,
      preprocess: {
        ts: (source) => {
          const result = ts.transpileModule(source, {
            compilerOptions: {
              target: ts.ScriptTarget.ESNext,
              module: ts.ModuleKind.ESNext,
            },
          });
          return {
            type: 'js',
            output: result.outputText,
          };
        },
      },
    });
    const source = outdent`
        \`\`\`html
        <button>Click me</button>
        \`\`\`
        \`\`\`css
        button { padding: 0 }
        \`\`\`
        \`\`\`ts
        const add = (a: number, b: number) => a + b
        console.log(add(a, b))
        \`\`\`
        `;
    expect(await shortcode(source, 'title')).toMatchInlineSnapshot(
      `"<iframe title="title" srcdoc="&lt;!doctype html&gt;&lt;html&gt;&lt;head&gt;&lt;style&gt;button{padding:0}&lt;/style&gt;&lt;/head&gt;&lt;body&gt;&lt;button&gt;Click me&lt;/button&gt;&lt;script&gt;var add=(a,d)=&gt;a+d;console.log(add(a,b))&lt;/script&gt;&lt;/body&gt;&lt;/html&gt;"></iframe>"`
    );
  });

  it('preprocess: vue', async () => {
    const shortcode = makeCodeDemoShortcode({
      renderDocument: ({ html, css, js }) => `
      <!doctype html>
      <html>
      <head>
        <style>${css}</style>
      </head>
      <body>
        <div id="app">${html}</div>
        <script>${js}</script>
      </body>
      </html>`,
      preprocess: {
        vue: (source) => {
          const { descriptor } = parse(source);
          return [
            {
              type: 'html',
              output: descriptor.template.content,
            },
            {
              type: 'js',
              output: descriptor.script.content,
            },
            {
              type: 'css',
              output: descriptor.styles.map((style) => style.content).join(''),
            },
          ];
        },
      },
    });
    const source = outdent`
        \`\`\`vue
        <template><button>Click me</button></template>
        <style>button { padding: 0 }</style>
        <script>console.log("test");</script>
        \`\`\`
        `;
    expect(await shortcode(source, 'title')).toMatchInlineSnapshot(
      `"<iframe title="title" srcdoc="&lt;!doctype html&gt;&lt;html&gt;&lt;head&gt;&lt;style&gt;button{padding:0}&lt;/style&gt;&lt;/head&gt;&lt;body&gt;&lt;div id=app&gt;&lt;button&gt;Click me&lt;/button&gt;&lt;/div&gt;&lt;script&gt;console.log(&quot;test&quot;)&lt;/script&gt;&lt;/body&gt;&lt;/html&gt;"></iframe>"`
    );
  });

  describe('merges multiple code blocks of the same type', () => {
    test('html', async () => {
      const shortcode = makeCodeDemoShortcode({
        renderDocument: ({ html }) => `
        <!doctype html>
        <html>
        <head></head>
        <body>${html}</body>
        </html>`,
      });
      const source = outdent`
          \`\`\`html
          <button>1</button>
          \`\`\`
          \`\`\`html
          <button>2</button>
          \`\`\`
          `;
      expect(await shortcode(source, 'title')).toMatchInlineSnapshot(
        `"<iframe title="title" srcdoc="&lt;!doctype html&gt;&lt;html&gt;&lt;head&gt;&lt;/head&gt;&lt;body&gt;&lt;button&gt;1&lt;/button&gt; &lt;button&gt;2&lt;/button&gt;&lt;/body&gt;&lt;/html&gt;"></iframe>"`
      );
    });

    test('css', async () => {
      const shortcode = makeCodeDemoShortcode({
        renderDocument: ({ css }) => `
        <!doctype html>
        <html>
        <head><style>${css}</style></head>
        <body></body>
        </html>`,
      });
      const source = outdent`
          \`\`\`css
          * {
            padding: 0;
          }
          \`\`\`
          \`\`\`css
          * {
            margin: 0;
          }
          \`\`\`
          `;
      expect(await shortcode(source, 'title')).toMatchInlineSnapshot(
        `"<iframe title="title" srcdoc="&lt;!doctype html&gt;&lt;html&gt;&lt;head&gt;&lt;style&gt;*{padding:0}*{margin:0}&lt;/style&gt;&lt;/head&gt;&lt;body&gt;&lt;/body&gt;&lt;/html&gt;"></iframe>"`
      );
    });

    test('js', async () => {
      const shortcode = makeCodeDemoShortcode({
        renderDocument: ({ js }) => `
        <!doctype html>
        <html>
        <head></head>
        <body><script>${js}</script></body>
        </html>`,
      });
      const source = outdent`
          \`\`\`js
          console.log("one");
          \`\`\`
          \`\`\`js
          console.log("two");
          \`\`\`
          `;
      expect(await shortcode(source, 'title')).toMatchInlineSnapshot(
        `"<iframe title="title" srcdoc="&lt;!doctype html&gt;&lt;html&gt;&lt;head&gt;&lt;/head&gt;&lt;body&gt;&lt;script&gt;console.log(&quot;one&quot;),console.log(&quot;two&quot;)&lt;/script&gt;&lt;/body&gt;&lt;/html&gt;"></iframe>"`
      );
    });

    test('js of esmodule', async () => {
      const shortcode = makeCodeDemoShortcode({
        renderDocument: ({ js }) => `
        <!doctype html>
        <html>
        <head></head>
        <body><script>${js}</script></body>
        </html>`,
      });
      const source = outdent`
          \`\`\`js
          // @filename: index.js
          export const a = 1;
          \`\`\`
          \`\`\`js
          import { a } from './index.js';
          console.log(a);
          \`\`\`
          `;
      expect(await shortcode(source, 'title')).toMatchInlineSnapshot(
        `"<iframe title="title" srcdoc="&lt;!doctype html&gt;&lt;html&gt;&lt;head&gt;&lt;/head&gt;&lt;body&gt;&lt;script&gt;var a=1;console.log(a)&lt;/script&gt;&lt;/body&gt;&lt;/html&gt;"></iframe>"`
      );
    });

    test('js with esmodule library', async () => {
      const shortcode = makeCodeDemoShortcode({
        renderDocument: ({ js }) => `
        <!doctype html>
        <html>
        <head></head>
        <body><script>${js}</script></body>
        </html>`,
      });
      const source = outdent`
          \`\`\`js
          import { a } from 'some-library';
          console.log(a);
          \`\`\`
          `;
      expect(await shortcode(source, 'title')).toMatchInlineSnapshot(
        `"<iframe title="title" srcdoc="&lt;!doctype html&gt;&lt;html&gt;&lt;head&gt;&lt;/head&gt;&lt;body&gt;&lt;script&gt;import{a}from&quot;some-library&quot;;console.log(a)&lt;/script&gt;&lt;/body&gt;&lt;/html&gt;"></iframe>"`
      );
    });

    test('with preprocessed code', async () => {
      const shortcode = makeCodeDemoShortcode({
        renderDocument: ({ js }) => `
        <!doctype html>
        <html>
        <head></head>
        <body><script>${js}</script></body>
        </html>`,
        preprocess: {
          ts: (source) => {
            const result = ts.transpileModule(source, {
              compilerOptions: {
                target: ts.ScriptTarget.ESNext,
                module: ts.ModuleKind.ESNext,
              },
            });
            return {
              type: 'js',
              output: result.outputText,
            };
          },
        },
      });
      const source = outdent`
          \`\`\`ts
          console.log("one");
          \`\`\`
          \`\`\`js
          console.log("two");
          \`\`\`
          `;
      expect(await shortcode(source, 'title')).toMatchInlineSnapshot(
        `"<iframe title="title" srcdoc="&lt;!doctype html&gt;&lt;html&gt;&lt;head&gt;&lt;/head&gt;&lt;body&gt;&lt;script&gt;console.log(&quot;one&quot;),console.log(&quot;two&quot;)&lt;/script&gt;&lt;/body&gt;&lt;/html&gt;"></iframe>"`
      );
    });
  });

  it('respects global and per-usage attributes', async () => {
    const shortcode = makeCodeDemoShortcode({
      renderDocument: () => ``,
      iframeAttributes: { class: 'one', width: '300', height: '600' },
    });
    expect(await shortcode(``, 'title', { class: 'two' })).toMatchInlineSnapshot(
      `"<iframe title="title" srcdoc="" class="one two" width="300" height="600"></iframe>"`
    );
  });

  it(`removes __keywords from Nunjucks keyword argument props`, async () => {
    const shortcode = makeCodeDemoShortcode({
      renderDocument: () => ``,
    });
    expect(await shortcode(``, 'title', { __keywords: true })).toMatchInlineSnapshot(
      `"<iframe title="title" srcdoc=""></iframe>"`
    );
  });

  it('throws an error if title is empty or undefined', async () => {
    const shortcode = makeCodeDemoShortcode({ renderDocument: () => `` });
    await expect(shortcode('')).rejects.toThrow();
    await expect(shortcode('', '')).rejects.toThrow();
    await expect(shortcode('', 'Non-empty title')).resolves.not.toThrow();
  });
});
