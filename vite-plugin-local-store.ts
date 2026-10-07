import type { Plugin } from 'vite'
import fs from 'fs'
import path from 'path'

export function localStorePlugin(): Plugin {
  // 数据文件统一存放在项目根目录下的 data 目录中
  const dataDir = path.resolve(process.cwd(), 'data')
  const storageFilePath = path.join(dataDir, 'app_storage.json')
  const voicesFilePath = path.join(dataDir, 'azure_voices_cache.json')

  // 确保数据目录及默认数据文件存在
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
  if (!fs.existsSync(storageFilePath)) {
    fs.writeFileSync(storageFilePath, JSON.stringify({}, null, 2), 'utf-8')
  }

  return {
    name: 'vite-plugin-local-file-store',
    configureServer(server) {
      // 1. 常规配置与历史存储
      server.middlewares.use('/api/local-store', (req, res, next) => {
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
          } catch (e: any) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: e.message }))
          }
          return
        }

        if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk) => {
            body += chunk
          })
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body)
              fs.writeFileSync(storageFilePath, JSON.stringify(parsed, null, 2), 'utf-8')
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({ success: true }))
            } catch (e: any) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: e.message }))
            }
          })
          return
        }

        next()
      })

      // 2. 音色库本地缓存持久化接口 (/api/voices-cache)
      server.middlewares.use('/api/voices-cache', (req, res, next) => {
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
          } catch (e: any) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: e.message }))
          }
          return
        }

        if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk) => {
            body += chunk
          })
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body)
              fs.writeFileSync(voicesFilePath, JSON.stringify(parsed, null, 2), 'utf-8')
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({ success: true, count: Array.isArray(parsed) ? parsed.length : 0 }))
            } catch (e: any) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: e.message }))
            }
          })
          return
        }

        next()
      })
    }
  }
}
