# EchoHire

一款面向求职者的 AI 个性化模拟面试平台。用户上传 PDF 简历并粘贴目标岗位 JD 后，EchoHire 会生成与个人经历和岗位要求相关的面试问题，在答题结束后提供评分、能力维度分析和可执行的改进建议。

**在线体验：** [EchoHire](https://echohire-ai-interview.guolinghao6.chatgpt.site)

## 功能亮点

- 根据简历、岗位 JD、面试类型和难度生成 4 道定制问题
- 从岗位相关性、回答结构、专业深度、证据和表达清晰度进行分析
- 提供逐题反馈、优化方向和下一阶段训练计划
- 使用函数工具先检查岗位与回答证据，再由教练 Agent 生成结构化报告
- 在报告页展示 Agent 执行轨迹，便于理解报告来源和降级状态
- 使用浏览器本地存储保留面试历史和训练进度
- OpenAI API Key 仅在服务端使用，不会发送到浏览器
- AI 暂时不可用时仍会按回答内容识别行动、取舍、协作、结果与证据，生成逐题差异化建议
- 支持桌面端与移动端的响应式界面

## 产品流程

1. 上传不超过 5 MB 的 PDF 简历
2. 粘贴目标职位描述并配置面试类型、难度
3. AI 结合简历与 JD 生成个性化问题
4. 逐题提交回答
5. 查看综合评分、能力维度和逐题改进建议

## 技术栈

- Next.js 16（App Router）
- React 19 + TypeScript
- Tailwind CSS 4
- OpenAI Responses API + Function Calling + Structured Outputs
- Cloudflare Workers / OpenAI Sites + Secret Environment Variables
- Browser Local Storage

## 系统结构

```text
Browser
  ├─ PDF / JD / answers
  ├─ localStorage: interview history
  └─ Next.js UI
          │
          ▼
Next.js Route Handlers
  ├─ input validation
  ├─ fallback generation and analysis
  └─ EchoHire Coaching Agent
          ├─ inspect_interview_context tool
          ├─ role / answer evidence signals
          └─ structured coaching report
```

## 本地运行

环境要求：Node.js 22.13 或更高版本、pnpm 11。

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Windows PowerShell 可使用：

```powershell
Copy-Item .env.example .env.local
pnpm dev
```

然后打开 [http://localhost:3000](http://localhost:3000)。

在 `.env.local` 中配置：

```dotenv
OPENAI_API_KEY=your_openai_project_key
OPENAI_MODEL=gpt-5.4-mini
```

请勿提交 `.env.local` 或真实 API Key。仓库只包含安全的 `.env.example` 示例。

## 常用命令

```bash
pnpm dev        # 启动开发环境
pnpm lint       # 运行 ESLint
pnpm typecheck  # 运行 TypeScript 检查
pnpm build      # 生成生产构建
pnpm start      # 启动生产构建
```

## 数据与隐私

- PDF 简历只在生成本次面试问题时提交给服务端处理，应用本身不长期保存文件。
- 面试记录默认保存在用户当前浏览器的 Local Storage 中。
- OpenAI 请求使用 `store: false`。
- 部署时应通过托管平台的 Secret/Environment Variables 配置密钥。

## 部署

生产站点部署在 OpenAI Sites。`OPENAI_API_KEY` 仅作为生产环境 Secret 保存，不写入源码或部署配置文件。

## 后续计划

- 游客演示模式，免上传简历即可体验完整流程
- 面试计时与语音回答
- 服务端账户、跨设备历史记录与数据导出
- API 限流、用量监控和成本保护
- 自动化测试与可访问性测试

## License

本项目目前用于个人作品集与学习展示。若需要复用，请先联系项目作者。
