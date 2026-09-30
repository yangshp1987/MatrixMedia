import { createAssistedArticleAdapter } from "./assistedArticle.js";
export default createAssistedArticleAdapter({
  name: "微信公众号",
  titleSelectors: ["#title", "textarea[placeholder*='标题']", "input[placeholder*='标题']"],
  bodySelectors: ["body.view[contenteditable='true']", "body[contenteditable='true']", "#ueditor_0", ".edui-body-container"],
  imageInputSelectors: ["input[type='file'][accept*='image']"],
  preferFrames: true,
});
