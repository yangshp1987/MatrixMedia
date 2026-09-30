import { createAssistedArticleAdapter } from "./assistedArticle.js";
export default createAssistedArticleAdapter({
  name: "知乎",
  titleSelectors: ["textarea.WriteIndex-titleInput", "textarea[placeholder*='标题']", "input[placeholder*='标题']"],
  bodySelectors: [".public-DraftEditor-content[contenteditable='true']", ".DraftEditor-editorContainer [contenteditable='true']", "div[contenteditable='true']"],
  imageInputSelectors: ["input[type='file'][accept*='image']"],
});
