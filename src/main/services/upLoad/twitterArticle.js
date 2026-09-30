import { createAssistedArticleAdapter } from "./assistedArticle.js";
export default createAssistedArticleAdapter({
  name: "X/Twitter",
  bodySelectors: ["[data-testid='tweetTextarea_0'][contenteditable='true']", "div[role='textbox'][contenteditable='true']"],
  imageInputSelectors: ["input[data-testid='fileInput']", "input[type='file'][accept*='image']"],
  composeBody: ({ title, content }) => [title, content].filter(Boolean).join("\n\n"),
});
