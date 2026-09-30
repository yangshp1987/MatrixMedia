import { createAssistedArticleAdapter } from "./assistedArticle.js";
export default createAssistedArticleAdapter({
  name: "掘金",
  titleSelectors: [".header .title-input"],
  bodySelectors: [".bytemd-editor .CodeMirror textarea", ".bytemd-editor .CodeMirror-lines", ".bytemd-editor [contenteditable='true']"],
  imageInputSelectors: [".coverselector_container input[type='file']", "input[type='file'][accept*='image']"],
});
