# 📧 邮箱 MCP Server

一个让AI轻松接管邮箱的MCP服务，基于 Model Context Protocol (MCP) 构建，支持在 MCP-X,Claude Desktop 等 MCP 客户端中使用。

## ✨ 功能特性

- 📤 **邮件发送**: 支持发送HTML和纯文本邮件
- 👥 **多收件人**: 支持多个收件人、抄送、密送
- 📎 **附件支持**: 支持文件附件和Base64编码内容
- 🔧 **动态配置**: 支持运行时配置邮箱服务器
- 🔍 **连接测试**: 内置SMTP服务器连接测试
- 🛡️ **安全认证**: 支持微信企业邮箱授权码认证
- ⚡ **高性能**: 优化的连接超时和重试机制

## 📚 详细配置指南

项目提供了详细的配置指南，包含各大邮箱服务商的配置说明：

📖 **[CONFIG_GUIDE.md](./CONFIG_GUIDE.md)** - 完整配置指南，包含：
- 📧 163邮箱详细配置教程
- 🏢 微信企业邮箱配置指南  
- 🌐 QQ邮箱、Gmail等主流邮箱配置
- 🛠️ 故障排除和常见问题解决

## 📋 系统要求

- Node.js 16.x 或更高版本
- 邮箱账号
- MCP 客户端 (如 Claude Desktop)

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置腾讯企业邮箱

#### 获取授权码
1. 访问 [企业邮箱管理后台](https://exmail.qq.com/)
2. 进入 **"设置"** → **"账户"** → **"客户端专用密码"**
3. 生成 **客户端专用密码** (授权码)
4. 进入 **"设置"** → **"收发信设置"** → **"设置方法"**
5. 开启 **"POP/IMAP/SMTP服务"**

### 3. 配置 MCP 客户端

#### MCP-X 配置
在 工具管理 中添加：

**个人邮箱配置：**
```json
{
  "mcpServers": {
    "universal-email": {
      "command": "node",
      "args": ["F:\\enterprise\\mail\\index.js"],
      "env": {
        "EMAIL_USER": "your-email@domain.com",
        "EMAIL_PASSWORD": "your-password-or-auth-code",
        "EMAIL_TYPE": "auto"
      }
    }
  }
}
```

**企业邮箱配置：**
```json
{
  "mcpServers": {
    "enterprise-email": {
      "command": "node",
      "args": ["F:\\enterprise\\mail\\index.js"],
      "env": {
        "EMAIL_USER": "user@company.com",
        "EMAIL_PASSWORD": "your-enterprise-auth-code",
        "EMAIL_TYPE": "exmail"
      }
    }
  }
}
```

💡 **关键提示**: 企业邮箱必须设置 `EMAIL_TYPE` 字段！

📖 **[CONFIG_GUIDE.md](./CONFIG_GUIDE.md)** - 完整配置指南，包含所有邮箱类型详细说明

**重要**: 请将 `your-email@yourcompany.com` 和 `your-authorization-code` 替换为您的实际邮箱地址和授权码。

#### 本地开发配置
为了保护敏感信息，推荐使用本地配置文件：

1. 复制 `mcp-x-config.json` 为 `mcp-x-config.local.json`
2. 在本地文件中填入真实的邮箱账号和密码
3. 本地配置文件已被 `.gitignore` 保护，不会被提交到版本控制

### 4. 测试配置

```bash
# 测试邮件配置是否成功
node test-auto-config.js
```

## 🔧 MCP 工具说明

### 1. `send_wechat_enterprise_email` - 发送邮件

发送微信企业邮箱，支持多种格式和收件人。

#### 参数
- **`to`** (必需): 收件人邮箱地址数组
- **`subject`** (必需): 邮件主题
- **`text`** (必需): 纯文本邮件内容
- **`cc`** (可选): 抄送邮箱地址数组
- **`bcc`** (可选): 密送邮箱地址数组
- **`html`** (可选): HTML格式邮件内容
- **`attachments`** (可选): 附件数组

#### 使用示例

**基本邮件发送：**
```json
{
  "to": ["recipient@example.com"],
  "subject": "测试邮件",
  "text": "这是一封测试邮件"
}
```

**带抄送和HTML内容：**
```json
{
  "to": ["recipient1@example.com", "recipient2@example.com"],
  "cc": ["manager@example.com"],
  "subject": "项目报告",
  "text": "请查看项目报告",
  "html": "<h1>项目报告</h1><p>项目进展顺利。</p>"
}
```

**带附件的邮件：**
```json
{
  "to": ["recipient@example.com"],
  "subject": "带附件的邮件",
  "text": "请查看附件",
  "attachments": [
    {
      "filename": "report.pdf",
      "path": "C:\\path\\to\\report.pdf"
    },
    {
      "filename": "data.txt",
      "content": "SGVsbG8gV29ybGQ=",
      "encoding": "base64"
    }
  ]
}
```

### 2. `configure_wechat_email_server` - 配置服务器

动态配置微信企业邮箱服务器设置。

#### 参数
- **`user`** (必需): 发送邮箱账号
- **`password`** (必需): 邮箱密码或授权码
- **`host`** (可选): SMTP服务器地址，默认 `smtp.exmail.qq.com`
- **`port`** (可选): SMTP端口，默认 `465`
- **`secure`** (可选): 是否使用SSL，默认 `true`

#### 使用示例
```json
{
  "user": "your-email@company.com",
  "password": "your-authorization-code",
  "host": "smtp.exmail.qq.com",
  "port": 465,
  "secure": true
}
```

### 3. `test_email_connection` - 测试连接

测试微信企业邮箱SMTP服务器连接状态。

#### 参数
无需参数

#### 使用示例
```json
{}
```

## 📊 SMTP 配置说明

### 微信企业邮箱官方配置

| 协议 | 服务器地址 | 端口 | 加密方式 | 认证 |
|------|------------|------|----------|------|
| SMTP | smtp.exmail.qq.com | 465 | SSL/TLS | 是 |
| SMTP | smtp.exmail.qq.com | 587 | STARTTLS | 是 |
| SMTP | smtp.exmail.qq.com | 25 | STARTTLS | 是 |

**推荐配置**: 使用 **465端口 + SSL/TLS** 加密

## 🔍 故障排除

### 常见错误和解决方案

#### 1. `535 Error: authentication failed`
**原因**: 认证失败
**解决方案**:
- 确认已在企业邮箱管理后台开启SMTP服务
- 重新生成授权码
- 检查用户名和授权码是否正确
- 确认企业管理员已允许SMTP访问

#### 2. `ECONNREFUSED` 或连接超时
**原因**: 网络连接问题
**解决方案**:
- 检查网络连接
- 确认防火墙没有阻挡SMTP端口 (25, 465, 587)
- 尝试不同的网络环境

#### 3. `ETIMEDOUT`
**原因**: 连接超时
**解决方案**:
- 检查网络稳定性
- 尝试其他SMTP端口
- 增加超时时间配置

### 调试模式

启用调试模式查看详细日志：

```javascript
// 在配置中添加
debug: true,
logger: console
```

## 📁 项目结构

```
├── index.js                    # MCP Server主程序
├── package.json               # 项目依赖配置
├── claude-desktop-config.json # Claude Desktop配置示例
├── mcp-config.json           # 通用MCP配置示例
├── config-template.env       # 环境变量模板
├── test-mcp-server.js       # MCP Server测试脚本
├── wait-and-retry.js        # 等待重试测试脚本
├── diagnose-wechat-email.js # 邮箱诊断脚本
└── README.md                # 项目文档
```

## 🔐 安全注意事项

1. **保护授权码**: 不要将授权码提交到版本控制系统
2. **使用环境变量**: 推荐使用环境变量存储敏感信息
3. **定期更新**: 定期更新授权码和检查安全设置
4. **权限控制**: 确保只有授权用户可以访问MCP服务器

## 📞 技术支持

### 获取帮助
- 📚 [微信企业邮箱官方文档](https://open.work.weixin.qq.com/help2/pc/19886)
- 🌐 [企业邮箱管理后台](https://exmail.qq.com/)
- 💬 联系企业邮箱管理员

### 贡献代码
欢迎提交 Issue 和 Pull Request 来改进这个项目。

## 📄 许可证

MIT License

---

## 🎉 快速测试

配置完成后，可以在MCP客户端中发送测试邮件：

```
请发送一封测试邮件到 test@example.com，主题为"MCP测试邮件"，内容为"Hello from MCP Server!"
```

如果配置正确，邮件应该能够成功发送！ 