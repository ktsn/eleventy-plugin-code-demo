const path = require('node:path');
const escape = require('lodash.escape');
const minifyHtml = require('html-minifier-terser');
const markdownIt = require('markdown-it');
const esbuild = require('esbuild');
const outdent = require('outdent');
const clsx = require('clsx');

/**
 * @param {string} code
 */
function parseFilenameFromJs(code) {
  const match = code.match(/@filename:\s*([^\s]+)/);
  if (match) {
    return match[1];
  }
}

/**
 * Given an array of tokens and preprocessors, finds all such matching tokens and returns preprocessed
 * big string concatenating each type of output code.
 * @param {import('markdown-it/lib/token')[]} tokens
 * @param {Record<string, (source: string) => import('./typedefs').PreprocessOutput|import('./typedefs').PreprocessOutput[]>} preprocess
 * @returns {{ html: CodeBlock[], css: CodeBlock[], js: CodeBlock[] }}
 */
const parseCode = (tokens, preprocess) => {
  const html = [];
  const css = [];
  const js = [];

  tokens.forEach((token) => {
    if (token.type === 'fence') {
      const { info, content } = token;
      const preprocessor = preprocess[info];
      const result = preprocessor ? preprocessor(content) : { type: info, output: content };
      const results = Array.isArray(result) ? result : [result];

      results.forEach(({ type, output }) => {
        switch (type) {
          case 'html':
            html.push({ code: output });
            break;
          case 'css':
            css.push({ code: output });
            break;
          case 'js':
            js.push({
              filename: parseFilenameFromJs(output),
              code: output,
            });
            break;
        }
      });
    }
  });

  return {
    html,
    css,
    js,
  };
};

/**
 * @param {CodeBlock[]} jsBlocks
 * @returns {Promise<string>}
 */
async function bundleJsCode(jsBlocks) {
  const mainFilename = '@main';

  const files = new Map();
  jsBlocks.forEach(({ filename = mainFilename, code }) => {
    const resolvedPath = filename.startsWith('@') ? filename : path.resolve('/', filename);
    const existing = files.get(resolvedPath) ?? '';
    files.set(resolvedPath, existing + code);
  });

  const bundled = await esbuild.build({
    absWorkingDir: '/',
    stdin: {
      contents: files.get(mainFilename) ?? '',
      sourcefile: mainFilename,
      resolveDir: '/',
    },

    bundle: true,
    write: false,

    plugins: [
      {
        name: 'VirtualFs',
        setup: (build) => {
          build.onResolve({ filter: /.*/ }, (args) => {
            if (args.path.search(/^[./]/) < 0) {
              return {
                namespace: 'virtual',
                path: '@' + args.path,
              };
            }
            return {
              namespace: 'virtual',
              path: path.resolve(args.resolveDir, args.path),
            };
          });

          build.onLoad({ filter: /.*/ }, (args) => {
            const contents = files.get(args.path);
            if (contents) {
              return { contents };
            }
          });
        },
      },
    ],
  });

  return bundled.outputFiles[0].text;
}

/** Maps a config of attribute-value pairs to an HTML string representing those same attribute-value pairs.
 * There's also this, but it's ESM only: https://github.com/sindresorhus/stringify-attributes
 * @param {Record<string, unknown>} attributeMap
 */
const stringifyAttributes = (attributeMap) => {
  return Object.entries(attributeMap)
    .map(([attribute, value]) => {
      if (typeof value === 'undefined') return '';
      return `${attribute}="${value}"`;
    })
    .join(' ');
};

/**
 * Higher-order function that takes user configuration options and returns the plugin shortcode.
 * @param {import('./typedefs').EleventyPluginCodeDemoOptions} options
 */
const makeCodeDemoShortcode = (options) => {
  const sharedIframeAttributes = options.iframeAttributes;

  /**
   * @param {string} source The children of this shortcode, as Markdown code blocks.
   * @param {string} title The title to set on the iframe.
   * @param {Promise<Record<string, unknown>>} props HTML attributes to set on this specific `<iframe>`.
   */
  const codeDemoShortcode = async (source, title, props = {}) => {
    if (!title) {
      throw new Error(`${options.name}: you must provide a non-empty title for the iframe.`);
    }

    // This comes from Nunjucks when passing in keyword arguments; we don't want it to make its way into the output HTML
    if (props['__keywords']) {
      delete props['__keywords'];
    }

    const tokens = markdownIt().parse(source);
    const { html, css, js } = parseCode(tokens, options.preprocess ?? {});

    const bundledJs = await bundleJsCode(js);

    // Allow users to customize their document structure, given this HTML, CSS, and JS
    let srcdoc = options.renderDocument({
      html: html.map(({ code }) => code).join(''),
      css: css.map(({ code }) => code).join(''),
      js: bundledJs,
    });
    // We have to check this or Buffer.from will throw segfaults
    if (srcdoc) {
      // Convert all the HTML/CSS/JS into one long string with zero non-essential white space, comments, etc.
      srcdoc = await minifyHtml.minify(srcdoc, {
        // Only need to minify these two if they're present
        minifyCSS: !!css,
        minifyJS: !!js,
        removeComments: true,
        removeAttributeQuotes: true,
        collapseWhitespace: true,
        useShortDoctype: true,
      });
    }
    srcdoc = escape(srcdoc);

    let iframeAttributes = { ...sharedIframeAttributes, ...props };
    /* Do this separately to allow for multiple class names. Note that this should
    technically also be done for other HTML attributes that could accept multiple
    values, like aria-describedby. But it's not worth accounting for every possibility here. */
    const className = clsx(sharedIframeAttributes?.class, props.class);
    if (className) {
      iframeAttributes.class = className;
    }
    iframeAttributes = stringifyAttributes(iframeAttributes);

    return outdent`<iframe title="${title}" srcdoc="${srcdoc}"${
      iframeAttributes ? ` ${iframeAttributes}` : ''
    }></iframe>`;
  };

  return codeDemoShortcode;
};

module.exports = { makeCodeDemoShortcode };
