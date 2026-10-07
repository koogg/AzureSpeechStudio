import http from 'http'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'

const PORT = 5273
const rootDir = process.cwd()
const dataDir = path.join(rootDir, 'data')
const distDir = path.join(rootDir, 'dist')
const storageFilePath = path.join(dataDir, 'app_storage.json')
const voicesFilePath = path.join(dataDir, 'azure_voices_cache.json')

// 确保数据目录与基础存储文件存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}
if (!fs.existsSync(storageFilePath)) {
  fs.writeFileSync(storageFilePath, JSON.stringify({}, null, 2), 'utf-8')
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg'
}

const server = http.createServer((req, res) => {
  // 跨域支持
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  const cleanUrl = req.url?.split('?')[0] || '/'

  // 1. /api/local-store (读写 app_storage.json)
  if (cleanUrl === '/api/local-store') {
    if (req.method === 'GET') {
      try {
        if (fs.existsSync(storageFilePath)) {
          const content = fs.readFileSync(storageFilePath, 'utf-8')
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(content || '{}')
        } else {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end('{}')
        }
      } catch (e) {
        res.statusCode = 500
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    if (req.method === 'POST') {
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body)
          fs.writeFileSync(storageFilePath, JSON.stringify(parsed, null, 2), 'utf-8')
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ success: true }))
        } catch (e) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: e.message }))
        }
      })
      return
    }
  }

  // 2. /api/voices-cache (读写 azure_voices_cache.json)
  if (cleanUrl === '/api/voices-cache') {
    if (req.method === 'GET') {
      try {
        if (fs.existsSync(voicesFilePath)) {
          const content = fs.readFileSync(voicesFilePath, 'utf-8')
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(content || '[]')
        } else {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end('[]')
        }
      } catch (e) {
        res.statusCode = 500
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    if (req.method === 'POST') {
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body)
          fs.writeFileSync(voicesFilePath, JSON.stringify(parsed, null, 2), 'utf-8')
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ success: true, count: Array.isArray(parsed) ? parsed.length : 0 }))
        } catch (e) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: e.message }))
        }
      })
      return
    }
  }

  // 3. 静态前端资源托管 (dist 目录)
  if (!fs.existsSync(distDir)) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end('<h3>未找到前端编译目录 dist，请先执行 npm run build</h3>')
    return
  }

  let filePath = path.join(distDir, cleanUrl === '/' ? 'index.html' : cleanUrl)
  if (!fs.existsSync(filePath)) {
    filePath = path.join(distDir, 'index.html')
  }

  try {
    const ext = path.extname(filePath).toLowerCase()
    const contentType = mimeTypes[ext] || 'application/octet-stream'
    const content = fs.readFileSync(filePath)
    res.setHeader('Content-Type', contentType)
    res.end(content)
  } catch (err) {
    res.statusCode = 404
    res.end('Not Found')
  }
})

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}`
  console.log(`====================================================`)
  console.log(`  Azure Speech Studio 便携工作台已就绪！`)
  console.log(`  服务地址: ${url}`)
  console.log(`====================================================`)

  // 自动调起系统默认浏览器
  const startCmd = process.platform === 'win32' ? `start ${url}` : `open ${url}`
  exec(startCmd, () => {})
})
