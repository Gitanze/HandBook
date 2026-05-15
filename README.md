# 灵感手账 / Inspiration Journal

> AI 驱动的桌面手账创作工具 —— 截图收藏、自由拼贴、AI 文生图 / 图生图，一键导出。
> An AI-powered desktop scrapbook & journal app.

![status](https://img.shields.io/badge/status-v0.2--AI-ff9ec7) ![platform](https://img.shields.io/badge/platform-Windows-blue) ![electron](https://img.shields.io/badge/electron-37-9feaf9) ![license](https://img.shields.io/badge/license-MIT-success)

<!-- TODO: 在 docs/ 下放一张主界面 + AI 生成效果图，开放后替换下面这行 -->
<!-- ![screenshot](docs/screenshot.png) -->

---

## ✨ 功能特色

### 📓 创作工作流
- **全局截图**：`Shift + Alt + A` 一键截图，直接落到画布
- **自由拼贴**：拖拽、缩放、旋转、调整透明度、图层升降
- **手账素材**：胶带、文字、图片三种基础元素，支持纸张背景切换
- **多页编辑**：左右翻页，每页独立画布
- **一键导出**：JPG（单页）/ PDF（多页合订）

### 🤖 AI 创作能力
- **文生图（Text-to-Image）**：自然语言一句话生成手账风格素材
- **图生图（Image-to-Image）**：把任意画布素材（或本地上传图片）作为参考二次创作 —— 人像→卡通、照片→水彩、风格迁移
- **自适应尺寸**：图生图模式默认匹配原图比例，生成结果直接拼合到画布上
- **底层模型**：[豆包 Seedream 4.0](https://www.volcengine.com/docs/82379)（火山方舟多模态生成）

---

## 🚀 快速开始

### 方式 A：下载即用（推荐）

1. 前往 [Releases](https://github.com/Gitanze/HandBook/releases) 下载最新 `Handmake-Journal-v0.2.0-windows.zip`（约 130 MB）
2. 右键解压到任意文件夹，双击里面的 `Handmake Journal.exe` 即可运行（**绿色版，无需安装、无残留**）
3. 第一次点 **AI** 按钮时，会自动弹出「设置」面板 → 粘贴你的豆包 API Key（见下方"获取 API Key"）

### 方式 B：从源码构建

```bash
git clone https://github.com/Gitanze/HandBook.git
cd HandBook
git checkout AI
npm install
npm start            # 开发模式运行
npm run build        # 打包 Windows portable .exe（产物在 dist/）
```

---

## 🔑 获取豆包 API Key

AI 功能需要你**自己的**豆包 API Key（防止公共 Key 被滥用）。免费试用额度足够日常体验：

1. 注册 [火山引擎账号](https://www.volcengine.com/)
2. 进入 [方舟控制台](https://console.volcengine.com/ark/) → 开通「豆包 · Seedream 4.0」模型
3. 在「API Key 管理」生成一个 Key
4. 打开本应用 → 顶部工具栏 ⚙️ **设置** → 粘贴 Key → 保存

> Key 通过 Electron `safeStorage` 用**系统级加密**（Windows DPAPI）保存在本机的 `%APPDATA%\handmake-journal\config.json`，不会上传到任何服务器。

---

## 🛠 技术栈

| 层 | 选型 |
|---|---|
| 桌面壳 | Electron 37 |
| 渲染层 | 原生 HTML / CSS / Vanilla JS（无框架，启动快） |
| AI 能力 | 豆包 Seedream 4.0（多模态图像生成 API） |
| 密钥存储 | Electron `safeStorage`（OS keychain / DPAPI） |
| 打包 | electron-builder（Windows portable） |

---

## 📐 项目亮点（设计取舍）

- **AI 入口收敛**：文生图与图生图统一在 ✨ AI 按钮下，进入后再让用户选择模式，避免功能割裂
- **画布即素材库**：图生图模式下可直接从当前手账里挑图作为参考，也支持本地上传
- **首次未配置自动引导**：用户没配 Key 就点 AI → 自动弹出设置面板，不会冷冰冰的报错
- **AI 结果不覆盖原图**：生成图作为**新素材**加入画布，原图保留，方便对比 / 撤销
- **零外部框架**：除 Electron 外不引入前端框架，启动 < 1s，安装包 < 100MB

---

## 🗺 Roadmap

- [ ] LLM Prompt 增强（用大模型改写用户的简短描述为更优 prompt）
- [ ] 智能去背景 / 自动抠图，让 AI 素材直接可拼贴
- [ ] 手账模板市场（节日 / 旅行 / 学习等场景预设）
- [ ] macOS 构建

---

## 📌 项目状态

**v0.2** — 加入 AI 文生图 + 图生图能力，应用内 API Key 管理面板。

---

## 📄 License

MIT License

---

© Designed & created by [Gitanze](https://github.com/Gitanze).
Please credit when sharing or building upon this project.
