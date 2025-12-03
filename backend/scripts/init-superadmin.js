#!/usr/bin/env node

/**
 * 初始化超级管理员
 * 通过调用 API 端点 POST /api/v1/auth/admin/init 来创建 superadmin 账户
 *
 * 使用方法：
 *   node backend/scripts/init-superadmin.js
 */

const http = require('http')

function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = ''
      res.on('data', (chunk) => (body += chunk))
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: JSON.parse(body)
          })
        } catch (e) {
          resolve({
            status: res.statusCode,
            body: body
          })
        }
      })
    })

    req.on('error', reject)
    if (data) req.write(JSON.stringify(data))
    req.end()
  })
}

async function initSuperAdmin() {
  try {
    console.log('📝 初始化超级管理员...')
    console.log('🔗 调用 API: POST http://localhost:3000/api/v1/auth/admin/init')
    console.log('')

    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/auth/admin/init',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    console.log(`📊 API 状态码: ${response.status}`)

    if (response.body.code === 200) {
      console.log('✅ 超级管理员创建成功！')
      console.log('')
      console.log('📧 邮箱: ' + response.body.data.email)
      console.log('🔑 密码: admin123456')
      console.log('👤 角色: superadmin')
      console.log('')
      console.log('💡 提示：使用这个账号登录 Admin 管理后台')
    } else if (response.body.code === 400) {
      console.log('⚠️  ' + response.body.message)
      console.log('   （可能是因为已存在管理员账号）')
    } else {
      console.error('❌ API 返回错误:', response.body)
    }
  } catch (error) {
    console.error('❌ 错误:', error.message)
    console.log('')
    console.log('💡 提示：确保后端服务已启动 (npm run dev)')
    process.exit(1)
  }
}

// 执行初始化
initSuperAdmin()
