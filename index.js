#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import nodemailer from 'nodemailer';
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import POP3Client from 'poplib';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 邮箱配置映射
const EMAIL_CONFIGS = {
  'qq': {
    name: 'QQ邮箱',
    domains: ['qq.com'],
    smtp: { host: 'smtp.qq.com', port: 587, secure: false },
    imap: { host: 'imap.qq.com', port: 993, secure: true },
    pop3: { host: 'pop.qq.com', port: 995, secure: true },
    usePOP3: false
  },
  '163': {
    name: '网易邮箱',
    domains: ['163.com', '126.com', 'yeah.net'],
    smtp: { host: 'smtp.163.com', port: 465, secure: true },
    imap: { host: 'imap.163.com', port: 993, secure: true },
    pop3: { host: 'pop.163.com', port: 995, secure: true },
    usePOP3: true // 163邮箱推荐使用POP3
  },
  // 'netease-enterprise': {
  //   name: '网易企业邮箱',
  //   domains: [], // 企业域名不固定
  //   smtp: { host: 'smtphz.qiye.163.com', port: 587, secure: false }, // 使用587端口和STARTTLS
  //   imap: { host: 'imaphz.qiye.163.com', port: 993, secure: true },
  //   pop3: { host: 'pophz.qiye.163.com', port: 995, secure: true },
  //   usePOP3: true // 网易企业邮箱推荐使用POP3
  // },
  'gmail': {
    name: 'Gmail',
    domains: ['gmail.com', 'googlemail.com'],
    smtp: { host: 'smtp.gmail.com', port: 587, secure: true }, // 从2025年5月1日起，需要OAuth认证
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    pop3: { host: 'pop.gmail.com', port: 995, secure: true },
    usePOP3: false, // Gmail推荐使用IMAP
    requiresOAuth: true, // 2025年5月1日后必须使用OAuth，不支持密码认证
    note: '需要在Gmail设置中启用POP/IMAP，Google Workspace需要管理员启用'
  },
  'outlook': {
    name: 'Outlook/Hotmail',
    domains: ['outlook.com', 'hotmail.com', 'live.com', 'msn.com'],
    smtp: { host: 'smtp-mail.outlook.com', port: 587, secure: false },
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    pop3: { host: 'outlook.office365.com', port: 995, secure: true },
    usePOP3: false
  },
  'exmail': {
    name: '腾讯企业邮箱',
    domains: ['exmail.qq.com'],
    smtp: { host: 'smtp.exmail.qq.com', port: 465, secure: true },
    imap: { host: 'imap.exmail.qq.com', port: 993, secure: true },
    pop3: { host: 'pop.exmail.qq.com', port: 995, secure: true },
    usePOP3: false
  },
  'aliyun': {
    name: '阿里云邮箱',
    domains: ['aliyun.com', 'alibaba-inc.com'],
    smtp: { host: 'smtp.mxhichina.com', port: 465, secure: true },
    imap: { host: 'imap.mxhichina.com', port: 993, secure: true },
    pop3: { host: 'pop.mxhichina.com', port: 995, secure: true },
    usePOP3: false
  },
  'sina': {
    name: '新浪邮箱',
    domains: ['sina.com', 'sina.cn'],
    smtp: { host: 'smtp.sina.com', port: 587, secure: false },
    imap: { host: 'imap.sina.com', port: 993, secure: true },
    pop3: { host: 'pop.sina.com', port: 995, secure: true },
    usePOP3: false
  },
  'sohu': {
    name: '搜狐邮箱',
    domains: ['sohu.com'],
    smtp: { host: 'smtp.sohu.com', port: 25, secure: false },
    imap: { host: 'imap.sohu.com', port: 993, secure: true },
    pop3: { host: 'pop.sohu.com', port: 995, secure: true },
    usePOP3: false
  }
};

class UniversalEmailMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'universal-email-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  // 根据邮箱地址或手动指定类型识别邮箱类型
  detectEmailProvider(email, manualType = null) {
    // 优先使用手动指定的邮箱类型
    if (manualType && EMAIL_CONFIGS[manualType]) {
      console.log(`使用手动指定的邮箱类型: ${manualType} (${EMAIL_CONFIGS[manualType].name})`);
      return manualType;
    }

    // 如果没有手动指定，则根据域名自动检测
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return null;
    
    for (const [provider, config] of Object.entries(EMAIL_CONFIGS)) {
      if (config.domains.includes(domain)) {
        console.log(`自动检测到邮箱类型: ${provider} (${config.name})`);
        return provider;
      }
    }
    
    console.log(`未能识别邮箱类型，域名: ${domain}`);
    return null;
  }

  // 根据邮箱类型自动配置服务器设置
  autoConfigureByProvider(provider) {
    const config = EMAIL_CONFIGS[provider];
    if (!config) {
      throw new Error(`不支持的邮箱类型: ${provider}`);
    }

    // 设置SMTP配置
    process.env.EMAIL_SMTP_HOST = config.smtp.host;
    process.env.EMAIL_SMTP_PORT = config.smtp.port.toString();
    process.env.EMAIL_SMTP_SECURE = config.smtp.secure.toString();

    // 设置IMAP配置
    process.env.EMAIL_IMAP_HOST = config.imap.host;
    process.env.EMAIL_IMAP_PORT = config.imap.port.toString();
    process.env.EMAIL_IMAP_SECURE = config.imap.secure.toString();

    // 设置POP3配置
    process.env.EMAIL_POP3_HOST = config.pop3.host;
    process.env.EMAIL_POP3_PORT = config.pop3.port.toString();
    process.env.EMAIL_POP3_SECURE = config.pop3.secure.toString();

    // 设置协议偏好
    process.env.EMAIL_USE_POP3 = config.usePOP3.toString();

    return config;
  }

  setupToolHandlers() {
    // 列出可用工具
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'send_email',
            description: '发送邮件',
            inputSchema: {
              type: 'object',
              properties: {
                to: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '收件人邮箱地址列表'
                },
                cc: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '抄送邮箱地址列表（可选）'
                },
                bcc: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '密送邮箱地址列表（可选）'
                },
                subject: {
                  type: 'string',
                  description: '邮件主题'
                },
                text: {
                  type: 'string',
                  description: '纯文本邮件内容'
                },
                html: {
                  type: 'string',
                  description: 'HTML格式邮件内容（可选）'
                },
                attachments: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      filename: { type: 'string', description: '附件文件名' },
                      path: { type: 'string', description: '附件文件路径' },
                      content: { type: 'string', description: '附件内容(base64编码)' }
                    }
                  },
                  description: '邮件附件列表（可选）'
                }
              },
              required: ['to', 'subject', 'text']
            }
          },
          {
            name: 'get_recent_emails',
            description: '获取最近三天的邮件列表',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  description: '返回邮件数量限制（默认20）'
                },
                days: {
                  type: 'number',
                  description: '获取最近几天的邮件（默认3天）'
                }
              },
              required: []
            }
          },
          {
            name: 'get_email_content',
            description: '获取指定邮件的详细内容',
            inputSchema: {
              type: 'object',
              properties: {
                uid: {
                  type: 'string',
                  description: '邮件唯一标识符'
                }
              },
              required: ['uid']
            }
          },
          {
            name: 'setup_email_account',
            description: '设置邮箱账号（自动识别邮箱类型并配置服务器）',
            inputSchema: {
              type: 'object',
              properties: {
                email: {
                  type: 'string',
                  description: '邮箱地址（如 user@qq.com）'
                },
                password: {
                  type: 'string',
                  description: '邮箱密码或授权码'
                },
                provider: {
                  type: 'string',
                  enum: ['qq', '163', 'gmail', 'outlook', 'exmail', 'aliyun', 'sina', 'sohu'], // 暂时注释掉: 'netease-enterprise'
                  description: '邮箱提供商（可选，不填写则自动识别）'
                }
              },
              required: ['email', 'password']
            }
          },
          {
            name: 'list_supported_providers',
            description: '列出支持的邮箱提供商',
            inputSchema: {
              type: 'object',
              properties: {},
              required: []
            }
          },
          {
            name: 'configure_email_server',
            description: '手动配置邮箱服务器设置（高级用户使用）',
            inputSchema: {
              type: 'object',
              properties: {
                smtpHost: {
                  type: 'string',
                  description: 'SMTP服务器地址'
                },
                smtpPort: {
                  type: 'number',
                  description: 'SMTP端口'
                },
                smtpSecure: {
                  type: 'boolean',
                  description: '是否使用SSL'
                },
                imapHost: {
                  type: 'string',
                  description: 'IMAP服务器地址'
                },
                imapPort: {
                  type: 'number',
                  description: 'IMAP端口'
                },
                imapSecure: {
                  type: 'boolean',
                  description: '是否使用SSL'
                },
                user: {
                  type: 'string',
                  description: '邮箱账号'
                },
                password: {
                  type: 'string',
                  description: '邮箱密码或授权码'
                }
              },
              required: ['user', 'password']
            }
          },
          {
            name: 'test_email_connection',
            description: '测试邮箱服务器连接',
            inputSchema: {
              type: 'object',
              properties: {
                testType: {
                  type: 'string',
                  enum: ['smtp', 'imap', 'both'],
                  description: '测试类型：smtp（发送）、imap（接收）或both（全部）'
                }
              },
              required: []
            }
          }
        ]
      };
    });

    // 执行工具调用
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'send_email':
            return await this.sendEmail(args);
          case 'get_recent_emails':
            return await this.getRecentEmails(args);
          case 'get_email_content':
            return await this.getEmailContent(args);
          case 'setup_email_account':
            return await this.setupEmailAccount(args);
          case 'list_supported_providers':
            return await this.listSupportedProviders(args);
          case 'configure_email_server':
            return await this.configureEmailServer(args);
          case 'test_email_connection':
            return await this.testConnection(args);
          default:
            throw new Error(`未知的工具: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `错误: ${error.message}`
            }
          ]
        };
      }
    });
  }

  // 创建SMTP邮件传输器
  createSMTPTransporter() {
    try {
      // 如果已经有手动配置的设置，直接使用
      if (process.env.EMAIL_SMTP_HOST || process.env.WECHAT_EMAIL_HOST) {
        const config = {
          host: process.env.EMAIL_SMTP_HOST || process.env.WECHAT_EMAIL_HOST,
          port: parseInt(process.env.EMAIL_SMTP_PORT || process.env.WECHAT_EMAIL_PORT) || 587,
          secure: (process.env.EMAIL_SMTP_SECURE || process.env.WECHAT_EMAIL_SECURE) !== 'false',
          auth: {
            user: process.env.EMAIL_USER || process.env.WECHAT_EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD || process.env.WECHAT_EMAIL_PASSWORD
          },
          connectionTimeout: 30000,
          greetingTimeout: 30000,
          socketTimeout: 30000
        };
        console.log('使用手动配置的SMTP设置:', { host: config.host, port: config.port, secure: config.secure });
        return nodemailer.createTransport(config);
      }

      // 自动配置
      const emailUser = process.env.EMAIL_USER || process.env.WECHAT_EMAIL_USER;
      const emailType = process.env.EMAIL_TYPE; // 手动指定的邮箱类型
      
      if (!emailUser) {
        throw new Error('缺少邮箱用户名配置。请设置 EMAIL_USER 环境变量。');
      }

      const provider = this.detectEmailProvider(emailUser, emailType);
      if (!provider) {
        throw new Error(`无法识别邮箱类型: ${emailUser}。如果是企业邮箱，请设置 EMAIL_TYPE 环境变量（如: 'exmail' 代表腾讯企业邮箱）`);
      }

      const emailConfig = EMAIL_CONFIGS[provider];
      const config = {
        host: emailConfig.smtp.host,
        port: emailConfig.smtp.port,
        secure: emailConfig.smtp.secure,
        auth: {
          user: emailUser,
          pass: process.env.EMAIL_PASSWORD || process.env.WECHAT_EMAIL_PASSWORD
        },
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 30000
      };

      // 验证必需的配置项
      if (!config.auth.pass) {
        throw new Error('缺少邮箱密码配置。请设置 EMAIL_PASSWORD 环境变量。');
      }

      console.log(`自动配置SMTP设置 - 邮箱类型: ${emailConfig.name}`, { host: config.host, port: config.port, secure: config.secure });
      return nodemailer.createTransport(config);
    } catch (error) {
      console.error('创建SMTP传输器失败:', error.message);
      throw error;
    }
  }

  // 创建IMAP连接
  createIMAPConnection() {
    try {
      // 如果已经有手动配置的设置，直接使用
      if (process.env.EMAIL_IMAP_HOST || process.env.WECHAT_EMAIL_HOST) {
        const config = {
          user: process.env.EMAIL_USER || process.env.WECHAT_EMAIL_USER,
          password: process.env.EMAIL_PASSWORD || process.env.WECHAT_EMAIL_PASSWORD,
          host: process.env.EMAIL_IMAP_HOST || process.env.WECHAT_EMAIL_HOST?.replace('smtp', 'imap'),
          port: parseInt(process.env.EMAIL_IMAP_PORT) || 993,
          tls: (process.env.EMAIL_IMAP_SECURE !== 'false'),
          tlsOptions: { rejectUnauthorized: false }
        };
        console.log('使用手动配置的IMAP设置:', { host: config.host, port: config.port });
        return new Imap(config);
      }

      // 自动配置
      const emailUser = process.env.EMAIL_USER || process.env.WECHAT_EMAIL_USER;
      const emailType = process.env.EMAIL_TYPE;
      
      if (!emailUser) {
        throw new Error('缺少邮箱用户名配置。请设置 EMAIL_USER 环境变量。');
      }

      const provider = this.detectEmailProvider(emailUser, emailType);
      if (!provider) {
        throw new Error(`无法识别邮箱类型: ${emailUser}。如果是企业邮箱，请设置 EMAIL_TYPE 环境变量`);
      }

      const emailConfig = EMAIL_CONFIGS[provider];
      const config = {
        user: emailUser,
        password: process.env.EMAIL_PASSWORD || process.env.WECHAT_EMAIL_PASSWORD,
        host: emailConfig.imap.host,
        port: emailConfig.imap.port,
        tls: emailConfig.imap.secure,
        tlsOptions: { rejectUnauthorized: false }
      };

      // 验证必需的配置项
      if (!config.password) {
        throw new Error('缺少邮箱密码配置。请设置 EMAIL_PASSWORD 环境变量。');
      }

      console.log(`自动配置IMAP设置 - 邮箱类型: ${emailConfig.name}`, { host: config.host, port: config.port });
      return new Imap(config);
    } catch (error) {
      console.error('创建IMAP连接失败:', error.message);
      throw error;
    }
  }

  // 创建POP3连接
  createPOP3Connection() {
    try {
      // 如果已经有手动配置的设置，直接使用
      if (process.env.EMAIL_POP3_HOST || process.env.WECHAT_EMAIL_HOST) {
        const config = {
          hostname: process.env.EMAIL_POP3_HOST || process.env.WECHAT_EMAIL_HOST?.replace('smtp', 'pop'),
          port: parseInt(process.env.EMAIL_POP3_PORT) || 995,
          tls: (process.env.EMAIL_POP3_SECURE !== 'false'),
          username: process.env.EMAIL_USER || process.env.WECHAT_EMAIL_USER,
          password: process.env.EMAIL_PASSWORD || process.env.WECHAT_EMAIL_PASSWORD
        };
        console.log('使用手动配置的POP3设置:', { hostname: config.hostname, port: config.port });
        return config;
      }

      // 自动配置
      const emailUser = process.env.EMAIL_USER || process.env.WECHAT_EMAIL_USER;
      const emailType = process.env.EMAIL_TYPE;
      
      if (!emailUser) {
        throw new Error('缺少邮箱用户名配置。请设置 EMAIL_USER 环境变量。');
      }

      const provider = this.detectEmailProvider(emailUser, emailType);
      if (!provider) {
        throw new Error(`无法识别邮箱类型: ${emailUser}。如果是企业邮箱，请设置 EMAIL_TYPE 环境变量`);
      }

      const emailConfig = EMAIL_CONFIGS[provider];
      const config = {
        hostname: emailConfig.pop3.host,
        port: emailConfig.pop3.port,
        tls: emailConfig.pop3.secure,
        username: emailUser,
        password: process.env.EMAIL_PASSWORD || process.env.WECHAT_EMAIL_PASSWORD
      };

      // 验证必需的配置项
      if (!config.password) {
        throw new Error('缺少邮箱密码配置。请设置 EMAIL_PASSWORD 环境变量。');
      }

      console.log(`自动配置POP3设置 - 邮箱类型: ${emailConfig.name}`, { hostname: config.hostname, port: config.port });
      return config;
    } catch (error) {
      console.error('创建POP3连接失败:', error.message);
      throw error;
    }
  }

  // 发送邮件
  async sendEmail(args) {
    const { to, cc, bcc, subject, text, html, attachments } = args;

    const transporter = this.createSMTPTransporter();

    const mailOptions = {
      from: process.env.EMAIL_USER || process.env.WECHAT_EMAIL_USER,
      to: Array.isArray(to) ? to.join(', ') : to,
      cc: cc ? (Array.isArray(cc) ? cc.join(', ') : cc) : undefined,
      bcc: bcc ? (Array.isArray(bcc) ? bcc.join(', ') : bcc) : undefined,
      subject,
      text,
      html
    };

    // 处理附件
    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments.map(att => {
        if (att.content) {
          return {
            filename: att.filename,
            content: att.content,
            encoding: 'base64'
          };
        } else if (att.path) {
          return {
            filename: att.filename,
            path: att.path
          };
        }
        return att;
      });
    }

    const result = await transporter.sendMail(mailOptions);

    return {
      content: [
        {
          type: 'text',
          text: `邮件发送成功！\n消息ID: ${result.messageId}\n收件人: ${Array.isArray(to) ? to.join(', ') : to}\n主题: ${subject}`
        }
      ]
    };
  }

  // 获取最近的邮件列表
  async getRecentEmails(args = {}) {
    const { limit = 20, days = 3 } = args;
    
    // 自动检测邮箱类型并选择最佳协议
    const email = process.env.EMAIL_USER || process.env.WECHAT_EMAIL_USER;
    const emailType = process.env.EMAIL_TYPE;
    
    if (email) {
      const provider = this.detectEmailProvider(email, emailType);
      if (provider && EMAIL_CONFIGS[provider]) {
        const config = EMAIL_CONFIGS[provider];
        console.log(`使用${config.name}的${config.usePOP3 ? 'POP3' : 'IMAP'}协议获取邮件`);
        if (config.usePOP3) {
          return this.getRecentEmailsPOP3(args);
        }
      }
    }
    
    // 默认尝试IMAP，失败则尝试POP3
    try {
      return await this.getRecentEmailsIMAP(args);
    } catch (error) {
      console.log('IMAP失败，尝试POP3:', error.message);
      return this.getRecentEmailsPOP3(args);
    }
  }

  // 使用IMAP获取邮件列表  
  async getRecentEmailsIMAP(args = {}) {
    const { limit = 20, days = 3 } = args;
    
    // 检查是否支持IMAP
    try {
      const imap = this.createIMAPConnection();
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ IMAP功能不可用: ${error.message}\n\n建议：\n1. 检查邮箱IMAP/POP3设置\n2. 确认使用正确的授权码\n3. 尝试使用QQ邮箱等其他邮箱服务`
        }]
      };
    }
    
    return new Promise((resolve, reject) => {
      const imap = this.createIMAPConnection();

      imap.once('ready', () => {
        imap.openBox('INBOX', true, (err, box) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          // 获取所有邮件，然后根据日期过滤
          imap.search(['ALL'], (err, results) => {
            if (err) {
              imap.end();
              return reject(err);
            }

            if (!results || results.length === 0) {
              imap.end();
              return resolve({
                content: [{
                  type: 'text',
                  text: `最近${days}天内没有找到邮件。`
                }]
              });
            }

            // 获取最近的邮件（取最后的一些邮件）
            const uids = results.slice(-Math.min(limit * 3, results.length));
            
            // 获取邮件头部信息
            const fetch = imap.fetch(uids, {
              bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
              struct: true
            });

            const emails = [];

            fetch.on('message', (msg, seqno) => {
              let headers = {};
              
              msg.on('body', (stream, info) => {
                let buffer = '';
                stream.on('data', (chunk) => {
                  buffer += chunk.toString('utf8');
                });
                stream.once('end', () => {
                  headers = Imap.parseHeader(buffer);
                });
              });

              msg.once('attributes', (attrs) => {
                emails.push({
                  uid: attrs.uid,
                  date: headers.date ? headers.date[0] : '',
                  from: headers.from ? headers.from[0] : '',
                  to: headers.to ? headers.to[0] : '',
                  subject: headers.subject ? headers.subject[0] : '(无主题)'
                });
              });
            });

            fetch.once('error', (err) => {
              imap.end();
              reject(err);
            });

            fetch.once('end', () => {
              imap.end();
              
              // 计算日期范围
              const since = new Date();
              since.setDate(since.getDate() - days);
              
              // 过滤最近几天的邮件
              const recentEmails = emails.filter(email => {
                const emailDate = new Date(email.date);
                return emailDate >= since;
              });
              
              // 按日期排序（最新的在前）
              recentEmails.sort((a, b) => new Date(b.date) - new Date(a.date));
              
              // 限制结果数量
              const limitedEmails = recentEmails.slice(0, limit);

              if (limitedEmails.length === 0) {
                resolve({
                  content: [{
                    type: 'text',
                    text: `最近${days}天内没有找到邮件。`
                  }]
                });
                return;
              }

              const emailList = limitedEmails.map(email => 
                `📧 UID: ${email.uid}\n` +
                `📅 日期: ${email.date}\n` +
                `👤 发件人: ${email.from}\n` +
                `📝 主题: ${email.subject}\n` +
                `────────────────────────────────`
              ).join('\n');

              resolve({
                content: [{
                  type: 'text',
                  text: `📬 最近${days}天的邮件列表 (共${limitedEmails.length}封):\n\n${emailList}`
                }]
              });
            });
          });
        });
      });

      imap.once('error', (err) => {
        reject(err);
      });

      imap.connect();
    });
  }

  // 使用POP3获取邮件列表
  async getRecentEmailsPOP3(args = {}) {
    const { limit = 20, days = 3 } = args;
    
    return new Promise((resolve, reject) => {
      const config = this.createPOP3Connection();
      const pop3 = new POP3Client(config.port, config.hostname, {
        enabletls: config.tls,
        debug: false
      });

      let emails = [];
      let messageCount = 0;

      pop3.on('connect', () => {
        pop3.login(config.username, config.password);
      });

      pop3.on('login', (status, data) => {
        if (status) {
          pop3.list();
        } else {
          reject(new Error('POP3登录失败: ' + data));
        }
      });

      pop3.on('list', (status, msgcount, msgnumber, data) => {
        if (status) {
          messageCount = msgcount;
          if (msgcount === 0) {
            pop3.quit();
            resolve({
              content: [{
                type: 'text',
                text: '邮箱中没有邮件。'
              }]
            });
            return;
          }

          // 获取最近的邮件（从最新的开始）
          const startMsg = Math.max(1, msgcount - limit + 1);
          const endMsg = msgcount;
          
          for (let i = endMsg; i >= startMsg; i--) {
            pop3.retr(i);
          }
        } else {
          reject(new Error('获取邮件列表失败: ' + data));
        }
      });

      pop3.on('retr', (status, msgnumber, data) => {
        if (status) {
          // 解析邮件
          simpleParser(data, (err, parsed) => {
            if (!err) {
              // 检查邮件日期是否在指定范围内
              const since = new Date();
              since.setDate(since.getDate() - days);
              
              const emailDate = new Date(parsed.date);
              if (emailDate >= since) {
                emails.push({
                  uid: msgnumber,
                  date: parsed.date ? parsed.date.toLocaleString() : '未知',
                  from: parsed.from?.text || '未知',
                  to: parsed.to?.text || '未知',
                  subject: parsed.subject || '(无主题)'
                });
              }
            }

            // 检查是否获取完所有邮件
            if (emails.length > 0 || msgnumber === Math.max(1, messageCount - limit + 1)) {
              pop3.quit();
            }
          });
        } else {
          reject(new Error(`获取邮件${msgnumber}失败: ${data}`));
        }
      });

      pop3.on('quit', (status, data) => {
        // 按日期排序（最新的在前）
        emails.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (emails.length === 0) {
          resolve({
            content: [{
              type: 'text',
              text: `最近${days}天内没有找到邮件。`
            }]
          });
          return;
        }

        const emailList = emails.map(email => 
          `📧 邮件号: ${email.uid}\n` +
          `📅 日期: ${email.date}\n` +
          `👤 发件人: ${email.from}\n` +
          `📝 主题: ${email.subject}\n` +
          `────────────────────────────────`
        ).join('\n');

        resolve({
          content: [{
            type: 'text',
            text: `📬 最近${days}天的邮件列表 (共${emails.length}封，POP3协议):\n\n${emailList}`
          }]
        });
      });

      pop3.on('error', (err) => {
        reject(new Error('POP3连接错误: ' + err.message));
      });
    });
  }

  // 获取指定邮件内容
  async getEmailContent(args) {
    const { uid } = args;

    return new Promise((resolve, reject) => {
      const imap = this.createIMAPConnection();

      imap.once('ready', () => {
        imap.openBox('INBOX', true, (err, box) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          // 获取指定UID的邮件
          const fetch = imap.fetch([uid], {
            bodies: '',
            struct: true
          });

          fetch.on('message', (msg, seqno) => {
            msg.on('body', (stream, info) => {
              simpleParser(stream, (err, parsed) => {
                imap.end();
                
                if (err) {
                  return reject(err);
                }

                let content = `📧 邮件详情 (UID: ${uid})\n`;
                content += `────────────────────────────────\n`;
                content += `📅 日期: ${parsed.date || '未知'}\n`;
                content += `👤 发件人: ${parsed.from?.text || '未知'}\n`;
                content += `👥 收件人: ${parsed.to?.text || '未知'}\n`;
                
                if (parsed.cc) {
                  content += `📋 抄送: ${parsed.cc.text}\n`;
                }
                
                content += `📝 主题: ${parsed.subject || '(无主题)'}\n`;
                content += `────────────────────────────────\n`;
                
                // 邮件内容
                if (parsed.text) {
                  content += `📄 文本内容:\n${parsed.text}\n`;
                }
                
                if (parsed.html && parsed.html !== parsed.text) {
                  content += `🌐 HTML内容:\n${parsed.html}\n`;
                }

                // 附件信息
                if (parsed.attachments && parsed.attachments.length > 0) {
                  content += `📎 附件列表:\n`;
                  parsed.attachments.forEach((att, index) => {
                    content += `  ${index + 1}. ${att.filename || '未命名'} (${att.size || 0} bytes)\n`;
                  });
                }

                resolve({
                  content: [{
                    type: 'text',
                    text: content
                  }]
                });
              });
            });
          });

          fetch.once('error', (err) => {
            imap.end();
            reject(err);
          });
        });
      });

      imap.once('error', (err) => {
        reject(err);
      });

      imap.connect();
    });
  }

  // 设置邮箱账号（自动配置）
  async setupEmailAccount(args) {
    const { email, password, provider } = args;

    // 设置用户名和密码
    process.env.EMAIL_USER = email;
    process.env.EMAIL_PASSWORD = password;

    let detectedProvider = provider;
    let config;

    try {
      // 如果没有指定提供商，则自动检测
      if (!detectedProvider) {
        detectedProvider = this.detectEmailProvider(email);
        if (!detectedProvider) {
          return {
            content: [{
              type: 'text',
              text: `❌ 无法识别邮箱类型: ${email}\n\n支持的邮箱类型请使用 list_supported_providers 查看，或手动指定 provider 参数。`
            }]
          };
        }
      }

      // 自动配置服务器设置
      config = this.autoConfigureByProvider(detectedProvider);

      let result = `✅ 邮箱账号设置成功！\n\n`;
      result += `📧 邮箱地址: ${email}\n`;
      result += `🏢 邮箱提供商: ${config.name}\n`;
      result += `📤 SMTP服务器: ${config.smtp.host}:${config.smtp.port} (SSL: ${config.smtp.secure})\n`;
      result += `📥 接收协议: ${config.usePOP3 ? 'POP3' : 'IMAP'}\n`;
      
      if (config.usePOP3) {
        result += `📥 POP3服务器: ${config.pop3.host}:${config.pop3.port} (SSL: ${config.pop3.secure})\n`;
      } else {
        result += `📥 IMAP服务器: ${config.imap.host}:${config.imap.port} (SSL: ${config.imap.secure})\n`;
      }

      result += `\n💡 提示: 配置已自动完成，您现在可以使用邮件功能了！`;

      return {
        content: [{
          type: 'text',
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ 邮箱设置失败: ${error.message}`
        }]
      };
    }
  }

  // 列出支持的邮箱提供商
  async listSupportedProviders() {
    let result = `📋 支持的邮箱提供商:\n\n`;
    
    for (const [provider, config] of Object.entries(EMAIL_CONFIGS)) {
      result += `🏢 ${config.name} (${provider})\n`;
      result += `   域名: ${config.domains.join(', ')}\n`;
      result += `   推荐协议: ${config.usePOP3 ? 'POP3' : 'IMAP'}\n`;
      result += `   示例: user@${config.domains[0]}\n\n`;
    }

    result += `💡 使用方法:\n`;
    result += `1. 使用 setup_email_account 工具\n`;
    result += `2. 填写完整邮箱地址和密码/授权码\n`;
    result += `3. 系统会自动识别并配置对应的邮箱服务器\n\n`;
    result += `⚠️  注意: 请确保已在对应邮箱中开启POP3/IMAP/SMTP服务并获取授权码！`;

    return {
      content: [{
        type: 'text',
        text: result
      }]
    };
  }

  // 配置邮箱服务器
  async configureEmailServer(args) {
    const { smtpHost, smtpPort, smtpSecure, imapHost, imapPort, imapSecure, user, password } = args;

    // 更新环境变量
    if (smtpHost) process.env.EMAIL_SMTP_HOST = smtpHost;
    if (smtpPort) process.env.EMAIL_SMTP_PORT = smtpPort.toString();
    if (smtpSecure !== undefined) process.env.EMAIL_SMTP_SECURE = smtpSecure.toString();
    if (imapHost) process.env.EMAIL_IMAP_HOST = imapHost;
    if (imapPort) process.env.EMAIL_IMAP_PORT = imapPort.toString();
    if (imapSecure !== undefined) process.env.EMAIL_IMAP_SECURE = imapSecure.toString();
    if (user) process.env.EMAIL_USER = user;
    if (password) process.env.EMAIL_PASSWORD = password;

    let configInfo = '邮箱配置已更新：\n';
    configInfo += `SMTP服务器: ${process.env.EMAIL_SMTP_HOST || '未设置'}\n`;
    configInfo += `SMTP端口: ${process.env.EMAIL_SMTP_PORT || '未设置'}\n`;
    configInfo += `SMTP SSL: ${process.env.EMAIL_SMTP_SECURE || '未设置'}\n`;
    configInfo += `IMAP服务器: ${process.env.EMAIL_IMAP_HOST || '未设置'}\n`;
    configInfo += `IMAP端口: ${process.env.EMAIL_IMAP_PORT || '未设置'}\n`;
    configInfo += `IMAP SSL: ${process.env.EMAIL_IMAP_SECURE || '未设置'}\n`;
    configInfo += `用户: ${user || '未更新'}`;

    return {
      content: [
        {
          type: 'text',
          text: configInfo
        }
      ]
    };
  }

  // 测试连接
  async testConnection(args = {}) {
    const { testType = 'both' } = args;
    let results = [];

    try {
      // 测试SMTP连接
      if (testType === 'smtp' || testType === 'both') {
        try {
          const transporter = this.createSMTPTransporter();
          await transporter.verify();
          results.push('✅ SMTP服务器连接测试成功！');
        } catch (error) {
          results.push(`❌ SMTP连接测试失败: ${error.message}`);
        }
      }

      // 测试IMAP连接
      if (testType === 'imap' || testType === 'both') {
        try {
          await new Promise((resolve, reject) => {
            const imap = this.createIMAPConnection();
            
            imap.once('ready', () => {
              imap.end();
              resolve();
            });
            
            imap.once('error', (err) => {
              reject(err);
            });
            
            imap.connect();
          });
          results.push('✅ IMAP服务器连接测试成功！');
        } catch (error) {
          results.push(`❌ IMAP连接测试失败: ${error.message}`);
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: results.join('\n')
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ 测试失败: ${error.message}`
          }
        ]
      };
    }
  }

  async run() {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error('通用邮件MCP服务器已启动');
    } catch (error) {
      console.error('MCP服务器启动失败:', error.message);
      throw error;
    }
  }
}

// 导出类供测试使用
export { UniversalEmailMCPServer };

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const server = new UniversalEmailMCPServer();

const transport = new StreamableHTTPServerTransport(server.server, {
  path: '/mcp',
  expressApp: app,
});

transport.listen();

app.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on port ${port}`);
});