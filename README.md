# Tuple Vmess/Vless 链接转换器 (Cloudflare Worker 版)

本项目是一个部署在 Cloudflare Workers 上的在线工具，用于将各类（例如 ShadowRocket 分享的）VMess 或 VLESS 链接转换为统一的、包含所有配置信息的 Base64 JSON 格式链接。同时，它还提供了尝试一键导入到部分主流客户端（如 Shadowrocket, V2RayNG, NekoBox）的功能。

**当前时间 (用于记录文档版本参考):** 2025年5月8日

## 功能特性

-   支持 **VMess** 和 **VLESS** 协议链接的解析。
-   能够处理链接主要部分是 Base64 编码的 JSON，或 Base64 编码的 `security:uuid@address:port` (VMess) / `[prefix:]uuid@address:port` (VLESS) 格式。
-   智能合并 URL 查询参数 (如 `remarks`, `obfs`/`type`, `tls`, `sni`/`peer`, `path`, `host`, `pbk`, `fp`, `sid`, `flow` 等)，查询参数具有更高优先级。
-   正确处理 Reality, XTLS 和 TLS 等现代 VLESS 配置参数。
-   输出统一的 `vmess://BASE64_JSON_CONFIG` 或 `vless://BASE64_JSON_CONFIG` 格式链接。
-   提供解析后的中间 JSON 配置结构预览。
-   支持 Unicode 字符（如中文、Emoji）的备注，并能正确进行 Base64 编码。
-   提供“一键导入”按钮，尝试跳转到已安装的客户端：
    -   Shadowrocket (iOS)
    -   V2RayNG (Android)
    -   NekoBox (Android)
-   提供增强的“复制链接”功能，并为 V2RayN (Windows/Mac) 及其他桌面客户端提供清晰的手动导入指引。
-   界面美观，响应式设计，适配桌面和移动设备。
-   纯前端和服务端逻辑，无需外部数据库或复杂后端。

## 演示和使用

部署成功后，您可以直接访问您的 Cloudflare Worker URL (例如 `your-worker-name.your-subdomain.workers.dev`) 来使用此工具。

**使用步骤：**

1.  **输入链接**：将您需要转换的 VMess 或 VLESS 链接粘贴到输入框中。
    ![输入区域截图](https://github.com/user-attachments/assets/380d3fd2-b6b9-446a-91c6-f0fdea82582a)
 2.  **点击转换**：点击“转换链接”按钮。
3.  **查看结果**：
    * **解析后的配置**：会显示一个中间的 JSON 对象，这是脚本从输入链接中解析和整合出的详细配置信息。您可以复制此 JSON。
        ![解析结果截图](https://github.com/user-attachments/assets/171b7bf4-477f-433b-9552-acdcab1aa3ec)
 * **转换后的链接**：这是最终生成的、包含所有配置的 Base64 JSON 格式的标准链接。
        ![转换后链接截图](https://github.com/user-attachments/assets/753caaed-a57c-4067-af69-792b20199f86)
 4. **操作链接**：
    * **复制链接**：点击转换后链接旁边的“复制链接”按钮，或下方的“复制链接 (V2RayN Win/Mac 及桌面)”按钮。
    * **一键导入 (移动端)**：
        * 点击 "导入 Shadowrocket (iOS)"
        * 点击 "导入 V2RayNG (Android)"
        * 点击 "导入 NekoBox (Android)"

        这些操作会尝试调用相应客户端的 URL Scheme 进行导入。**前提是您的设备上已安装对应的客户端，并且客户端正确处理了该 URL Scheme。** 浏览器可能会弹出提示要求确认。如果跳转失败，请使用复制链接并手动导入。
    * **桌面客户端 (如 V2RayN)**：请点击“复制链接 (V2RayN Win/Mac 及桌面)”按钮，然后在您的 V2RayN 客户端中选择“从剪贴板导入”或类似选项。Mac 用户请选用支持此类链接的兼容客户端。

## 部署到 Cloudflare Workers

您可以非常轻松地将此工具部署到您自己的 Cloudflare Workers 账户。

**步骤：**

1.  **获取代码**：
    * 复制项目中的 `index.js` 文件（即包含所有 JavaScript 和 HTML 生成逻辑的那个文件）的全部内容。

2.  **登录 Cloudflare Dashboard**：
    * 打开您的 [Cloudflare 控制台](https://dash.cloudflare.com/)。

3.  **创建 Worker**：
    * 在侧边栏中，找到并点击 "Workers & Pages"。
    * 点击 "Create application" 按钮。
    * 在 "Create application" 页面，选择 "Workers" 选项卡下的 "Create Worker" 按钮。
    * 为您的 Worker 指定一个名称（例如 `vmess-vless-converter`）。这个名称将成为您 Worker URL 的一部分 (例如 `vmess-vless-converter.your-username.workers.dev`)。
    * 点击 "Deploy"。

4.  **编辑并粘贴代码**：
    * Worker 创建并部署（初始会有一个默认的 "Hello World" 脚本）后，点击 "Edit code" 或 "Configure Worker" -> "Quick edit"。
    * Cloudflare 会打开一个在线编辑器。删除编辑器中现有的所有示例代码。
    * 将您在步骤1中复制的 `_worker.js` 文件的**全部内容**粘贴到在线编辑器中。

5.  **保存并部署**：
    * 点击编辑器界面上方的 "Deploy" (或 "Save and Deploy") 按钮。
    * 等待片刻，Cloudflare 会将您的代码部署到全球的边缘节点。

6.  **访问您的工具**：
    * 部署成功后，您就可以通过 Cloudflare 提供的 Worker URL (通常显示在 Worker 的概览页面或设置中) 访问您自己的链接转换工具了。

## 技术细节

* **前端**：动态生成的 HTML、CSS 和 JavaScript，无需外部依赖。
* **后端 (Worker)**：纯 JavaScript 实现，运行在 Cloudflare Workers 环境。
* **Base64 处理**：能够正确处理包含 Unicode 字符（如中文、Emoji）的字符串的 Base64 编解码，解决了 `btoa()` 只能处理 Latin-1 字符的问题。
* **剪贴板 API**：使用了 `navigator.clipboard.writeText()` 并提供了对 `document.execCommand('copy')` 的备选方案，以提高复制功能的兼容性。
* **URL Scheme**：尝试使用已知的 URL Scheme 来方便部分移动客户端的导入。

## 注意事项与限制

* “一键导入”功能依赖于目标客户端是否已安装并在系统中正确注册了相应的 URL Scheme。其成功率取决于用户的设备环境和客户端设置。
* 对于 V2RayN (Windows) 及多数桌面客户端，目前最可靠的导入方式仍是复制链接后在客户端内手动从剪贴板导入。
* 虽然脚本尽力解析和标准化各种链接格式，但由于不同客户端分享链接时可能存在细微差异或非标准参数，某些极其特殊的链接可能无法完美解析。
* Cloudflare Workers 的免费套餐有每日请求次数等限制，但对于个人使用通常足够。

## 贡献与反馈

如果您发现任何问题或有改进建议，欢迎通过 GitHub Issues 提出。如果您想贡献代码，请 Fork 本仓库并提交 Pull Request。

---
