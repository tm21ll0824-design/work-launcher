# 工作启动台

GitHub Pages + Supabase 个人云端工作台。

1. 在 Supabase SQL Editor 执行 `supabase/schema.sql`。
2. 在 Authentication → Users 创建个人登录账号。
3. 在 Authentication → URL Configuration 填写 Pages 地址。
4. GitHub Settings → Pages → Source 选择 GitHub Actions。
5. 首次登录后点击“上传本机旧数据”。

`config.js` 中仅含 Supabase publishable key，可以公开；不要提交 secret/service_role key。

注意：GitHub Free 的私人仓库不能发布 Pages。保持私人仓库需要 GitHub Pro；免费方案需将仓库改为 Public。Note 数据不在 GitHub，而在启用 RLS 的 Supabase 中。
