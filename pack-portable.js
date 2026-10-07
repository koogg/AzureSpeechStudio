import fs from 'fs'
import path from 'path'

const rootDir = process.cwd()
const targetDir = path.join(rootDir, 'portable-dist')
const binDir = path.join(targetDir, 'bin')
const dataDir = path.join(targetDir, 'data')
const distDir = path.join(targetDir, 'dist')

console.log('[Packager] 开始生成免安装绿色便携包...')

fs.mkdirSync(binDir, { recursive: true })
fs.mkdirSync(dataDir, { recursive: true })

// 1. 拷贝当前环境下的便携 Node.js 运行时 (如果已存在且未改动则跳过，防止运行中文件占用 EBUSY)
const nodeExePath = process.execPath
const destNodeExe = path.join(binDir, 'node.exe')
if (!fs.existsSync(destNodeExe)) {
  console.log(`[Packager] 复制便携 Node 运行时: ${nodeExePath}`)
  fs.copyFileSync(nodeExePath, destNodeExe)
} else {
  try {
    fs.copyFileSync(nodeExePath, destNodeExe)
    console.log(`[Packager] 已更新便携 Node 运行时`)
  } catch (e) {
    if (e.code === 'EBUSY') {
      console.log(`[Packager] portable-dist\\bin\\node.exe 正在后台运行中，复用已有可执行文件，无需重复覆盖`)
    } else {
      throw e
    }
  }
}

// 2. 复制独立轻量服务 server.js
fs.copyFileSync(path.join(rootDir, 'server.js'), path.join(targetDir, 'server.js'))

// 3. 复制前端编译产物 dist
console.log('[Packager] 复制前端静态资源 dist...')
function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(dest, { recursive: true })
  for (const item of fs.readdirSync(src)) {
    const s = path.join(src, item)
    const d = path.join(dest, item)
    if (fs.statSync(s).isDirectory()) copyRecursive(s, d)
    else fs.copyFileSync(s, d)
  }
}
copyRecursive(path.join(rootDir, 'dist'), distDir)

// 4. 初始化数据模板
if (fs.existsSync(path.join(rootDir, 'data', 'azure_voices_cache.json'))) {
  fs.copyFileSync(path.join(rootDir, 'data', 'azure_voices_cache.json'), path.join(dataDir, 'azure_voices_cache.json'))
}
const targetStorage = path.join(dataDir, 'app_storage.json')
if (!fs.existsSync(targetStorage)) {
  fs.writeFileSync(targetStorage, JSON.stringify({}, null, 2), 'utf-8')
}

// 5. 写入一键启动脚本 (使用纯 ASCII/ANSI 语法，杜绝 Windows cmd 字符集乱码导致闪退)
const batLines = [
  '@echo off',
  'title Azure Speech Studio',
  'cd /d "%~dp0"',
  '',
  'if not exist bin\\node.exe (',
  '    echo [ERROR] bin\\node.exe not found!',
  '    pause',
  '    exit /b 1',
  ')',
  '',
  'start "AzureSpeechStudio" "bin\\node.exe" "server.js"',
  'exit /b 0'
]
fs.writeFileSync(path.join(targetDir, '一键启动.bat'), batLines.join('\r\n'), 'ascii')

// 6. 自动压缩生成 release/AzureSpeechStudio-Portable-Green.zip
import { execSync } from 'child_process'
const releaseDir = path.join(rootDir, 'release')
fs.mkdirSync(releaseDir, { recursive: true })
const targetZip = path.join(releaseDir, 'AzureSpeechStudio-Portable-Green.zip')

console.log('[Packager] 正在将便携包自动压缩为 release 归档文件...')
try {
  if (fs.existsSync(targetZip)) {
    fs.unlinkSync(targetZip)
  }
  execSync(`powershell Compress-Archive -Path "${targetDir}\\*" -DestinationPath "${targetZip}" -CompressionLevel Optimal`, { stdio: 'inherit' })
  const stats = fs.statSync(targetZip)
  const sizeMb = (stats.size / 1024 / 1024).toFixed(2)
  console.log(`[Packager] 压缩归档完成: ${targetZip} (${sizeMb} MB)`)
} catch (e) {
  console.warn('[Packager] 自动压缩归档失败 (可手动将 portable-dist 压缩为 zip):', e.message)
}

console.log('========================================================')
console.log('✅ 便携绿色免安装包生成完毕！')
console.log(`📁 独立目录: ${targetDir}`)
console.log(`📦 ZIP 归档: ${targetZip}`)
console.log('👉 可将该 ZIP 包直接拷贝给任何 Windows 电脑，解压后双击【一键启动.bat】直接运行！')
console.log('========================================================')
