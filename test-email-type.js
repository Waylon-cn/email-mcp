#!/usr/bin/env node

// 测试EMAIL_TYPE功能
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 模拟EMAIL_CONFIGS
const EMAIL_CONFIGS = {
  'qq': {
    name: 'QQ邮箱',
    domains: ['qq.com'],
    smtp: { host: 'smtp.qq.com', port: 587, secure: false }
  },
  '163': {
    name: '网易邮箱/企业邮箱',
    domains: ['163.com', '126.com', 'yeah.net'],
    smtp: { host: 'smtp.163.com', port: 465, secure: true }
  },
  'netease-enterprise': {
    name: '网易企业邮箱',
    domains: [], // 企业域名不固定
    smtp: { host: 'smtp.ym.163.com', port: 465, secure: true }
  },
  'exmail': {
    name: '腾讯企业邮箱',
    domains: ['exmail.qq.com'],
    smtp: { host: 'smtp.exmail.qq.com', port: 465, secure: true }
  },
  'gmail': {
    name: 'Gmail',
    domains: ['gmail.com', 'googlemail.com'],
    smtp: { host: 'smtp.gmail.com', port: 587, secure: false }
  }
};

// 模拟邮箱类型检测函数
function detectEmailProvider(email, manualType = null) {
  console.log(`\n🔍 检测邮箱: ${email}`);
  console.log(`📝 手动指定类型: ${manualType || '无'}`);
  
  // 优先使用手动指定的邮箱类型
  if (manualType && EMAIL_CONFIGS[manualType]) {
    console.log(`✅ 使用手动指定的邮箱类型: ${manualType} (${EMAIL_CONFIGS[manualType].name})`);
    return manualType;
  }

  // 如果没有手动指定，则根据域名自动检测
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) {
    console.log(`❌ 无效的邮箱地址`);
    return null;
  }
  
  for (const [provider, config] of Object.entries(EMAIL_CONFIGS)) {
    if (config.domains.includes(domain)) {
      console.log(`✅ 自动检测到邮箱类型: ${provider} (${config.name})`);
      return provider;
    }
  }
  
  console.log(`❌ 未能识别邮箱类型，域名: ${domain}`);
  return null;
}

// 测试用例
const testCases = [
  {
    email: 'user@qq.com',
    emailType: null,
    description: 'QQ邮箱 - 自动检测'
  },
  {
    email: 'user@163.com', 
    emailType: null,
    description: '网易邮箱 - 自动检测'
  },
  {
    email: 'user@company.com',
    emailType: 'exmail',
    description: '腾讯企业邮箱 - 手动指定'
  },
  {
    email: 'user@enterprise.com',
    emailType: 'netease-enterprise',
    description: '网易企业邮箱 - 手动指定'
  },
  {
    email: 'user@unknown.com',
    emailType: null,
    description: '未知域名邮箱 - 自动检测失败'
  },
  {
    email: 'user@unknown.com',
    emailType: 'exmail',
    description: '未知域名邮箱 - 手动指定救援'
  }
];

console.log('🧪 EMAIL_TYPE 功能测试\n');
console.log('=' * 50);

testCases.forEach((testCase, index) => {
  console.log(`\n📋 测试用例 ${index + 1}: ${testCase.description}`);
  console.log('-'.repeat(40));
  
  const provider = detectEmailProvider(testCase.email, testCase.emailType);
  
  if (provider) {
    const config = EMAIL_CONFIGS[provider];
    console.log(`🎯 最终配置:`);
    console.log(`   - 邮箱类型: ${config.name}`);
    console.log(`   - SMTP服务器: ${config.smtp.host}:${config.smtp.port}`);
    console.log(`   - SSL/TLS: ${config.smtp.secure ? '是' : '否'}`);
  } else {
    console.log(`❌ 配置失败: 无法识别邮箱类型`);
  }
});

console.log('\n' + '='.repeat(50));
console.log('🎉 测试完成!');
console.log('\n💡 使用说明:');
console.log('1. 个人邮箱（@qq.com, @163.com等）可以自动检测');
console.log('2. 企业邮箱必须手动设置 EMAIL_TYPE 字段');
console.log('3. 腾讯企业邮箱设置: EMAIL_TYPE="exmail"');
console.log('4. 网易企业邮箱设置: EMAIL_TYPE="netease-enterprise"'); 