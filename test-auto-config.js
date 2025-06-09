#!/usr/bin/env node

import { UniversalEmailMCPServer } from './index.js';

async function testAutoConfig() {
  console.log('🚀 测试邮箱自动配置功能\n');

  const server = new UniversalEmailMCPServer();

  try {
    // 测试1: 列出支持的邮箱提供商
    console.log('📋 测试1: 列出支持的邮箱提供商');
    console.log('─────────────────────────────────');
    const providersResult = await server.listSupportedProviders();
    console.log(providersResult.content[0].text);
    console.log();

    // 测试2: 自动配置163邮箱
    console.log('📋 测试2: 自动配置163邮箱');
    console.log('─────────────────────────────────');
    const setup163Result = await server.setupEmailAccount({
      email: 'ganyizhi520@163.com',
      password: ''
    });
    console.log(setup163Result.content[0].text);
    console.log();

    // 测试3: 连接测试
    console.log('📋 测试3: 连接测试');
    console.log('─────────────────────────────────');
    const testResult = await server.testConnection({ testType: 'smtp' });
    console.log(testResult.content[0].text);
    console.log();

    // 测试4: 发送邮件
    console.log('📋 测试4: 发送测试邮件');
    console.log('─────────────────────────────────');
    const sendResult = await server.sendEmail({
      to: ['229637012@qq.com'],
      subject: '自动配置功能测试',
      text: '这是自动配置功能的测试邮件！\n\n系统已自动识别163邮箱并配置了相应的服务器设置。\n\n测试时间: ' + new Date().toLocaleString()
    });
    console.log(sendResult.content[0].text);
    console.log();

    // 测试5: 获取邮件列表
    console.log('📋 测试5: 获取邮件列表');
    console.log('─────────────────────────────────');
    const emailsResult = await server.getRecentEmails({ limit: 3, days: 7 });
    console.log(emailsResult.content[0].text);
    console.log();

    console.log('✅ 自动配置功能测试完成！');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
  }
}

// 测试QQ邮箱自动配置
async function testQQAutoConfig() {
  console.log('\n🚀 测试QQ邮箱自动配置功能\n');

  const server = new UniversalEmailMCPServer();

  try {
    // 自动配置QQ邮箱
    console.log('📋 自动配置QQ邮箱');
    console.log('─────────────────────────────────');
    const setupQQResult = await server.setupEmailAccount({
      email: '229637012@qq.com',
      password: ''  // QQ邮箱授权码
    });
    console.log(setupQQResult.content[0].text);
    console.log();

    // 连接测试
    console.log('📋 QQ邮箱连接测试');
    console.log('─────────────────────────────────');
    const testResult = await server.testConnection({ testType: 'both' });
    console.log(testResult.content[0].text);
    console.log();

    console.log('✅ QQ邮箱自动配置测试完成！');

  } catch (error) {
    console.error('❌ QQ邮箱测试失败:', error.message);
  }
}

// 运行所有测试
async function runAllTests() {
  await testAutoConfig();
  await testQQAutoConfig();
}

runAllTests().catch(console.error); 