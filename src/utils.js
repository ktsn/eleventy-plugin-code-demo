const escape = require('lodash.escape');
const minifyHtml = require('@minify-html/node');
const markdownIt = require('markdown-it');
const outdent = require('outdent');
const clsx = require('clsx');

/**
 * Given an array of tokens and preprocessors, finds all such matching tokens and returns preprocessed
 * big string concatenating each type of output code.
 * @param {import('markdown-it/lib/token')[]} tokens
 * @param {Record<string, (source: string) => import('./typedefs').PreprocessOutput>} preprocess
 */
const parseCode = (tokens, preprocess) => {
  const html = [];
  const css = [];
  const js = [];

  tokens.forEach((token) => {
    if (token.type === 'fence') {
      const { info, content } = token;
      const preprocessor = preprocess[info];
      const { type, output } = preprocessor ? preprocessor(content) : { type: info, output: content };

      switch (type) {
        case 'html':
          html.push(output);
          break;
        case 'css':
          css.push(output);
          break;
        case 'js':
          js.push(output);
          break;
      }
    }
  });

  return {
    html: html.join(''),
    css: css.join(''),
    js: js.join(''),
  };
};

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
   * @param {Record<string, unknown>} props HTML attributes to set on this specific `<iframe>`.
   */
  const codeDemoShortcode = (source, title, props = {}) => {
    if (!title) {
      throw new Error(`${options.name}: you must provide a non-empty title for the iframe.`);
    }

    // This comes from Nunjucks when passing in keyword arguments; we don't want it to make its way into the output HTML
    if (props['__keywords']) {
      delete props['__keywords'];
    }

    const tokens = markdownIt().parse(source);
    const { html, css, js } = parseCode(tokens, options.preprocess ?? {});

    // Allow users to customize their document structure, given this HTML, CSS, and JS
    let srcdoc = options.renderDocument({ html, css, js });
    // We have to check this or Buffer.from will throw segfaults
    if (srcdoc) {
      // Convert all the HTML/CSS/JS into one long string with zero non-essential white space, comments, etc.
      srcdoc = minifyHtml.minify(Buffer.from(srcdoc), {
        keep_spaces_between_attributes: false,
        // Only need to minify these two if they're present
        minify_css: !!css,
        minify_js: !!js,
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
