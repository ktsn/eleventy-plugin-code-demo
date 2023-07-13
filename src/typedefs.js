/**
 * @typedef RenderArgs
 * @property {string} css The CSS, if any, that was detected in the shortcode's usage.
 * @property {string} js The JavaScript, if any, that was detected in the shortcode's usage.
 * @property {string} html The HTML, if any, that was detected in the shortcode's usage.
 */

/**
 * @typedef PreprocessOutput
 * @property {string} type The output code type.
 * @property {string} output The output code string.
 */

/**
 * @typedef EleventyPluginCodeDemoOptions
 * @property {string} name The shortcode name to use.
 * @property {(args: RenderArgs) => string} renderDocument A render function to render the iframe's document definition.
 * @property {Record<string, unknown>} [iframeAttributes] Any HTML attributes you want to set on the `<iframe>` (optional).
 * @property {Record<string, (source: string) => PreprocessOutput>} [preprocess] A map of file type to preprocessors (optional).
 */

module.exports = {};
